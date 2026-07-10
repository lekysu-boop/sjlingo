import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MAX_HEARTS, regenHearts, nextHeartInMin, todayStr, weekStart, bumpStreak, xpFor } from '@/lib/gamify';
import type { GamifyState, RewardResult } from '@/lib/types';

export const runtime = 'nodejs';

function toState(d: any): GamifyState {
  return {
    streak: d.streak, freezes: d.freezes, totalXp: d.total_xp,
    todayXp: d.today_xp, dailyGoal: d.daily_goal, hearts: d.hearts,
    maxHearts: MAX_HEARTS, coins: d.coins, nextHeartInMin: nextHeartInMin(d.hearts, d.hearts_updated),
  };
}

// POST /api/gamify/reward
//  body: { userId, correct: boolean, combo?: number, sessionComplete?: boolean }
//  - correct=true  → XP 획득(콤보 보너스), 리그 점수 반영
//  - correct=false → 하트 1 감소
//  - sessionComplete=true → 스트릭 갱신
export async function POST(req: NextRequest) {
  const { userId, correct, combo = 0, sessionComplete = false } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 });

  const db = createAdminClient();
  let { data } = await db.from('gamify_state').select('*').eq('owner_id', userId).maybeSingle();
  if (!data) { const ins = await db.from('gamify_state').insert({ owner_id: userId }).select().single(); data = ins.data; }

  const now = new Date();
  const today = todayStr(now);

  // 하트 회복 선반영
  const reg = regenHearts(data.hearts, data.hearts_updated, now);
  data.hearts = reg.hearts; data.hearts_updated = reg.updatedISO;
  // 날짜 경과 시 오늘 XP 리셋
  if (data.today_date !== today) { data.today_xp = 0; data.today_date = today; }

  let gainedXp = 0, streakUp = false, leveledGoal = false;

  if (correct) {
    gainedXp = xpFor(combo);
    const beforeGoalHit = data.today_xp >= data.daily_goal;
    data.today_xp += gainedXp;
    data.total_xp += gainedXp;
    if (!beforeGoalHit && data.today_xp >= data.daily_goal) leveledGoal = true;
  } else {
    if (!sessionComplete && data.hearts > 0) { data.hearts -= 1; data.hearts_updated = now.toISOString(); }
  }

  if (sessionComplete) {
    const b = bumpStreak(data.streak, data.last_active, today);
    if (b.streak !== data.streak) streakUp = b.streak > data.streak;
    data.streak = b.streak;
    data.last_active = today;
    data.coins += 20; // 세션 완료 보상
  }

  data.updated_at = now.toISOString();
  await db.from('gamify_state').update({
    streak: data.streak, last_active: data.last_active, total_xp: data.total_xp,
    today_xp: data.today_xp, today_date: data.today_date, hearts: data.hearts,
    hearts_updated: data.hearts_updated, coins: data.coins, updated_at: data.updated_at,
  }).eq('owner_id', userId);

  // 주간 리그 점수 반영 (정답 XP만)
  if (gainedXp > 0) {
    const ws = weekStart(now);
    const { data: row } = await db.from('league_scores').select('xp').eq('owner_id', userId).eq('week_start', ws).maybeSingle();
    const newXp = (row?.xp ?? 0) + gainedXp;
    await db.from('league_scores').upsert({ owner_id: userId, week_start: ws, xp: newXp }, { onConflict: 'owner_id,week_start' });
  }

  const result: RewardResult = { state: toState(data), gainedXp, streakUp, leveledGoal };
  return NextResponse.json(result);
}
