import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { weekStart } from '@/lib/gamify';
import type { LeagueEntry } from '@/lib/types';

export const runtime = 'nodejs';

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
