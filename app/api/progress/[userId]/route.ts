import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MonthlyStat, UserProgress } from '@/lib/types';

export const runtime = 'nodejs';

// GET /api/progress/:userId — 진도율·월간·응원 집계
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const userId = params.userId;
  const db = createAdminClient();

  // 키워드 암기율: 전체 키워드 대비 known=true 개수
  const [{ count: totalKw }, { count: known }, attempts, kwEvents, { count: cheers }] =
    await Promise.all([
      db.from('keywords').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
      db.from('keyword_progress').select('*', { count: 'exact', head: true }).eq('owner_id', userId).eq('known', true),
      db.from('exam_attempts').select('correct, created_at').eq('owner_id', userId),
      db.from('keyword_events').select('created_at').eq('owner_id', userId),
      db.from('cheers').select('*', { count: 'exact', head: true }).eq('to_id', userId),
    ]);

  const exAnswered = attempts.data?.length ?? 0;
  const exCorrect = attempts.data?.filter((a) => a.correct).length ?? 0;

  const kwRate = totalKw ? Math.round(((known ?? 0) / totalKw) * 100) : 0;
  const exRate = exAnswered ? Math.round((exCorrect / exAnswered) * 100) : 0;
  let overall = 0;
  if (totalKw && exAnswered) overall = Math.round((kwRate + exRate) / 2);
  else if (totalKw) overall = kwRate;
  else if (exAnswered) overall = exRate;

  // 월간 집계 (최근 6개월)
  const buckets: Record<string, { kw: number; exA: number; exC: number }> = {};
  const bump = (iso: string, key: 'kw' | 'exA' | 'exC', n = 1) => {
    const m = iso.slice(0, 7);
    (buckets[m] ??= { kw: 0, exA: 0, exC: 0 })[key] += n;
  };
  kwEvents.data?.forEach((e) => bump(e.created_at, 'kw'));
  attempts.data?.forEach((a) => {
    bump(a.created_at, 'exA');
    if (a.correct) bump(a.created_at, 'exC');
  });
  const months: MonthlyStat[] = Object.keys(buckets)
    .sort()
    .slice(-6)
    .map((k) => {
      const b = buckets[k];
      return { label: `${parseInt(k.slice(5))}월`, kw: b.kw, exA: b.exA, exC: b.exC, total: b.kw + b.exA };
    });

  const result: UserProgress = {
    kwRate, exRate, overall,
    known: known ?? 0, totalKw: totalKw ?? 0,
    exCorrect, exAnswered, cheers: cheers ?? 0, monthly: months,
  };
  return NextResponse.json(result);
}
