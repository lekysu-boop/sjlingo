import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { weekStart } from '@/lib/gamify';
import type { LeagueEntry } from '@/lib/types';

export const runtime = 'nodejs';
// Supabase(내부적으로 fetch 사용) 응답을 Next.js가 자동 캐싱하지 않도록 강제.
// 이게 없으면 같은 조회가 예전 결과로 고정되어, DB가 바뀌어도 화면에 반영되지 않는다.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET /api/gamify/league?userId=... — 이번 주 XP 리더보드
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const db = createAdminClient();
  const ws = weekStart();

  const { data: scores } = await db
    .from('league_scores')
    .select('owner_id, xp')
    .eq('week_start', ws)
    .order('xp', { ascending: false })
    .limit(20);

  const ids = (scores || []).map((s) => s.owner_id);
  const { data: profs } = ids.length
    ? await db.from('profiles').select('id, name, emoji').in('id', ids)
    : { data: [] as any[] };
  const pmap = new Map((profs || []).map((p) => [p.id, p]));

  const league: LeagueEntry[] = (scores || []).map((s, i) => {
    const p = pmap.get(s.owner_id);
    return {
      id: s.owner_id,
      name: p?.name ?? '학습자',
      emoji: p?.emoji ?? '🦊',
      xp: s.xp,
      rank: i + 1,
      me: s.owner_id === userId,
      promote: i < 3,
    };
  });

  return NextResponse.json(league);
}
