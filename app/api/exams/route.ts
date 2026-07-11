import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dedupeExams } from '@/lib/dedupe';
import { clampImportance } from '@/lib/importance';
import type { ExamInput } from '@/lib/types';

export const runtime = 'nodejs';
// Supabase(내부적으로 fetch 사용) 응답을 Next.js가 자동 캐싱하지 않도록 강제.
// 이게 없으면 같은 조회가 예전 결과로 고정되어, DB가 바뀌어도 화면에 반영되지 않는다.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET /api/exams?userId=&subjectId= — 기출문제 목록
// count=1 이면 문항을 전혀 내려받지 않고 개수만 반환 (해설 텍스트가 길어서, 홈 화면처럼
// 개수만 필요한 곳에서 전체를 받아오지 않도록 함 — lib/api.ts countExams 참고)
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const subjectId = req.nextUrl.searchParams.get('subjectId');
  const countOnly = req.nextUrl.searchParams.get('count') === '1';
  if (!userId || !subjectId)
    return NextResponse.json({ error: 'userId, subjectId 필요' }, { status: 400 });

  const db = createAdminClient();

  if (countOnly) {
    const { count, error } = await db
      .from('exam_questions')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('subject_id', subjectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ count: count ?? 0 });
  }

  const { data, error } = await db
    .from('exam_questions')
    .select('*')
    .eq('owner_id', userId)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/exams — 단건/대량 추가 (5단어 이상 겹치면 중복 스킵)
// body: { userId, subjectId, items: ExamInput[] }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, subjectId } = body;
  const items: ExamInput[] = Array.isArray(body.items) ? body.items : [body.item];
  if (!userId || !subjectId || !items?.length)
    return NextResponse.json({ error: 'userId, subjectId, items 필요' }, { status: 400 });

  const db = createAdminClient();
  const { data: existing } = await db
    .from('exam_questions')
    .select('question')
    .eq('owner_id', userId)
    .eq('subject_id', subjectId);

  const clean = items
    .filter((it) => (it.question || '').trim() && Array.isArray(it.options) && it.options.length >= 2)
    .map((it) => {
      const options = it.options.map((o) => (o || '').trim()).filter((o) => o !== '');
      let answer = Number(it.answer) || 0;
      if (answer < 0 || answer >= options.length) answer = 0;
      return {
        era: (it.era || '').trim() || '기타',
        question: it.question.trim(),
        options,
        answer,
        explain: (it.explain || '').trim(),
        importance: clampImportance((it as any).importance),
      };
    });

  const { toInsert, added, skipped } = dedupeExams(existing || [], clean);
  if (toInsert.length) {
    const rows = toInsert.map((it) => ({ ...it, owner_id: userId, subject_id: subjectId }));
    let { error } = await db.from('exam_questions').insert(rows);
    // importance 컬럼 마이그레이션 전이면 그 컬럼만 빼고 재시도 (등록이 막히지 않게)
    if (error && `${error.message}`.includes('importance')) {
      ({ error } = await db.from('exam_questions').insert(rows.map((r: any) => { const { importance, ...rest } = r; return rest; })));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ added, skipped });
}

// DELETE /api/exams?userId=&subjectId= — 해당 과목의 기출문제 전체 삭제
// exam_attempts 등 연관 기록은 FK(on delete cascade)로 함께 정리된다.
export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const subjectId = req.nextUrl.searchParams.get('subjectId');
  if (!userId || !subjectId)
    return NextResponse.json({ error: 'userId, subjectId 필요' }, { status: 400 });

  const db = createAdminClient();
  const { error, count } = await db
    .from('exam_questions')
    .delete({ count: 'exact' })
    .eq('owner_id', userId)
    .eq('subject_id', subjectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0 });
}
