import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MAX_HEARTS, regenHearts, nextHeartInMin, todayStr } from '@/lib/gamify';
import type { GamifyState } from '@/lib/types';

export const runtime = 'nodejs';

// gamify_state 행을 읽고 없으면 생성. 하트 회복·오늘 XP 리셋을 반영해 저장.
async function loadState(db: ReturnType<typeof createAdminClient>, userId: string) {
  let { data } = await db.from('gamify_state').select('*').eq('owner_id', userId).maybeSingle();
  if (!data) {
    const ins = await db.from('gamify_state').insert({ owner_id: userId }).select().single();
    data = ins.data;
  }
  const now = new Date();
  const today = todayStr(now);
  const patch: Record<string, unknown> = {};

  // 하트 시간 회복
  const reg = regenHearts(data.hearts, data.hearts_updated, now);
  if (reg.hearts !== data.hearts) { data.hearts = reg.hearts; data.hearts_updated = reg.updatedISO; patch.hearts = reg.hearts; patch.hearts_updated = reg.updatedISO; }

  // 날짜가 바뀌면 오늘 XP 리셋
  if (data.today_date !== today) { data.today_xp = 0; data.today_date = today; patch.today_xp = 0; patch.today_date = today; }

  if (Object.keys(patch).length) await db.from('gamify_state').update(patch).eq('owner_id', userId);
  return data;
}

function toState(d: any): GamifyState {
  return {
    streak: d.streak, freezes: d.freezes, totalXp: d.total_xp,
    todayXp: d.today_xp, dailyGoal: d.daily_goal, hearts: d.hearts,
    maxHearts: MAX_HEARTS, coins: d.coins, nextHeartInMin: nextHeartInMin(d.hearts, d.hearts_updated),
  };
}

// GET /api/gamify/:userId — 현재 게이미피케이션 상태
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const db = createAdminClient();
  const d = await loadState(db, params.userId);
  return NextResponse.json(toState(d));
}
