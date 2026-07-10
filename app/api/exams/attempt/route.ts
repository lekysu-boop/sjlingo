import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
// Supabase(내부적으로 fetch 사용) 응답을 Next.js가 자동 캐싱하지 않도록 강제.
// 이게 없으면 같은 조회가 예전 결과로 고정되어, DB가 바뀌어도 화면에 반영되지 않는다.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// POST /api/exams/attempt — 기출 풀이 결과 기록
// body: { userId, questionId, correct: boolean }
export async function POST(req: NextRequest) {
  const { userId, questionId, correct } = await req.json();
  if (!userId || !questionId || typeof correct !== 'boolean')
    return NextResponse.json({ error: 'userId, questionId, correct 필요' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db
    .from('exam_attempts')
    .insert({ owner_id: userId, question_id: questionId, correct });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// GET /api/exams/attempt?userId=&subjectId= — 자주 틀리는 문제 id 목록(오답 반복용)
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 });

  const db = createAdminClient();
  // 최근 시도 기준 문제별 정답/오답 집계 → 오답이 정답보다 많거나 마지막이 오답인 문제
  const { data, error } = await db
    .from('exam_attempts')
    .select('question_id, correct, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byQ: Record<string, { wrong: number; total: number; last: boolean }> = {};
  (data || []).forEach((r) => {
    const q = (byQ[r.question_id] ??= { wrong: 0, total: 0, last: true });
    q.total++;
    if (!r.correct) q.wrong++;
    q.last = r.correct;
  });
  const wrongIds = Object.keys(byQ).filter((id) => !byQ[id].last || byQ[id].wrong * 2 >= byQ[id].total);
  return NextResponse.json({ wrongIds });
}
