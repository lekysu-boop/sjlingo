import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MAX_HEARTS, todayStr, weekStart, bumpStreak, xpFor } from '@/lib/gamify';
import type { GamifyState, RewardResult } from '@/lib/types';

export const runtime = 'nodejs';

// 하트는 이제 "세션 안에서만" 쓰는 개념이라 서버 상태에 없다 (화면이 관리).
// 타입 호환을 위해 항상 가득 찬 값으로 내려준다.
function toState(d: any): GamifyState {
  return {
    streak: d.streak, freezes: d.freezes, totalXp: d.total_xp,
    todayXp: d.today_xp, dailyGoal: d.daily_goal,
    hearts: MAX_HEARTS, maxHearts: MAX_HEARTS, coins: d.coins, nextHeartInMin: null,
  };
}

// POST /api/gamify/reward — 단순화된 보상 체계
//  body: { userId, correct: boolean, combo?: number, sessionComplete?: boolean, durationMin?: number }
//  역할이 하나씩만 있다:
//   - ⚡ XP    = 정답의 점수 (정답당 10 + 3콤보 이상 +5) → 일일 목표·리그 순위
//   - 🪙 코인  = 공부시간의 보상 (세션 완료 시 1분 = 1코인, 세션당 최대 60)
//   - 🔥 스트릭 = 꾸준함 (하루 1세션이면 유지)
//   - ❤️ 하트  = 세션 내 기회 (서버 아님 — 학습 화면이 세션마다 5개로 관리)
export async function POST(req: NextRequest) {
  const { userId, correct, combo = 0, sessionComplete = false, durationMin = 0 } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 });

  const db = createAdminClient();
  let { data } = await db.from('gamify_state').select('*').eq('owner_id', userId).maybeSingle();
  if (!data) { const ins = await db.from('gamify_state').insert({ owner_id: userId }).select().single(); data = ins.data; }

  const now = new Date();
  const today = todayStr(now);

  // 날짜 경과 시 오늘 XP 리셋
  if (data.today_date !== today) { data.today_xp = 0; data.today_date = today; }

  let gainedXp = 0, gainedCoins = 0, streakUp = false, leveledGoal = false;

  if (correct) {
    gainedXp = xpFor(combo);
    const beforeGoalHit = data.today_xp >= data.daily_goal;
    data.today_xp += gainedXp;
    data.total_xp += gainedXp;
    if (!beforeGoalHit && data.today_xp >= data.daily_goal) leveledGoal = true;
  }

  if (sessionComplete) {
    const b = bumpStreak(data.streak, data.last_active, today);
    if (b.streak !== data.streak) streakUp = b.streak > data.streak;
    data.streak = b.streak;
    data.last_active = today;
    // 공부시간에 비례한 코인: 1분 = 1코인 (최소 1, 세션당 최대 60)
    gainedCoins = Math.min(60, Math.max(1, Math.round(durationMin)));
    data.coins += gainedCoins;
  }

  data.updated_at = now.toISOString();
  await db.from('gamify_state').update({
    streak: data.streak, last_active: data.last_active, total_xp: data.total_xp,
    today_xp: data.today_xp, today_date: data.today_date,
    coins: data.coins, updated_at: data.updated_at,
  }).eq('owner_id', userId);

  // 주간 리그 점수 반영 (정답 XP만)
  if (gainedXp > 0) {
    const ws = weekStart(now);
    const { data: row } = await db.from('league_scores').select('xp').eq('owner_id', userId).eq('week_start', ws).maybeSingle();
    const newXp = (row?.xp ?? 0) + gainedXp;
    await db.from('league_scores').upsert({ owner_id: userId, week_start: ws, xp: newXp }, { onConflict: 'owner_id,week_start' });
  }

  const result: RewardResult = { state: toState(data), gainedXp, gainedCoins, streakUp, leveledGoal };
  return NextResponse.json(result);
}
