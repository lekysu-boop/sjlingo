import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dedupeKeywords } from '@/lib/dedupe';
import { clampImportance } from '@/lib/importance';
import type { KeywordInput } from '@/lib/types';

export const runtime = 'nodejs';
// Supabase(내부적으로 fetch 사용) 응답을 Next.js가 자동 캐싱하지 않도록 강제.
// 이게 없으면 같은 조회가 예전 결과로 고정되어, DB가 바뀌어도 화면에 반영되지 않는다.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET /api/keywords?userId=&subjectId= — 키워드 목록
// fields=id 이면 id 컬럼만 반환 (개념/원리 같은 무거운 텍스트를 안 내려받아도 되는
// 홈 화면의 "등록 개수/오늘 복습" 계산용 — lib/api.ts listKeywordIds 참고)
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const subjectId = req.nextUrl.searchParams.get('subjectId');
  const fields = req.nextUrl.searchParams.get('fields');
  if (!userId || !subjectId)
    return NextResponse.json({ error: 'userId, subjectId 필요' }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('keywords')
    .select(fields === 'id' ? 'id' : '*')
    .eq('owner_id', userId)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/keywords — 단건 또는 대량 추가 (중복 스킵)
// body: { userId, subjectId, items: KeywordInput[] }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, subjectId } = body;
  const items: KeywordInput[] = Array.isArray(body.items) ? body.items : [body.item];
  if (!userId || !subjectId || !items?.length)
    return NextResponse.json({ error: 'userId, subjectId, items 필요' }, { status: 400 });

  const db = createAdminClient();

  // 기존 목록을 읽어 중복 판정 (공백/슬래시 무시한 암기코드 비교)
  const { data: existing } = await db
    .from('keywords')
    .select('code')
    .eq('owner_id', userId)
    .eq('subject_id', subjectId);

  const clean = items
    .filter((it) => (it.code || '').trim() && (it.concept || '').trim())
    .map((it) => ({
      era: (it.era || '').trim() || '기타',
      code: it.code.trim(),
      concept: it.concept.trim(),
      principle: (it.principle || '').trim(),
      day: (it.day || '').trim(),
      importance: clampImportance((it as any).importance),
    }));

  const { toInsert, added, skipped } = dedupeKeywords(existing || [], clean);

  if (toInsert.length) {
    const rows = toInsert.map((it) => ({ ...it, owner_id: userId, subject_id: subjectId }));
    // unique index가 있으므로 혹시 남은 충돌은 무시하고 통과
    let { error } = await db.from('keywords').insert(rows);
    // importance 컬럼 마이그레이션 전이면 그 컬럼만 빼고 재시도 (등록이 막히지 않게)
    if (error && `${error.message}`.includes('importance')) {
      ({ error } = await db.from('keywords').insert(rows.map((r: any) => { const { importance, ...rest } = r; return rest; })));
    }
    if (error && !`${error.message}`.includes('duplicate'))
      return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ added, skipped });
}

// DELETE /api/keywords?userId=&subjectId= — 해당 과목의 키워드 전체 삭제
// keyword_progress 등 연관 기록은 FK(on delete cascade)로 함께 정리된다.
export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const subjectId = req.nextUrl.searchParams.get('subjectId');
  if (!userId || !subjectId)
    return NextResponse.json({ error: 'userId, subjectId 필요' }, { status: 400 });

  const db = createAdminClient();
  const { error, count } = await db
    .from('keywords')
    .delete({ count: 'exact' })
    .eq('owner_id', userId)
    .eq('subject_id', subjectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0 });
}
