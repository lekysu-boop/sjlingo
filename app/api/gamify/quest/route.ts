import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MAX_HEARTS, nextHeartInMin } from '@/lib/gamify';
import type { GamifyState } from '@/lib/types';

export const runtime = 'nodejs';

// POST /api/gamify/quest — 일일 퀘스트 달성 보상: 보물상자 열기
//  body: { userId, questId }
//  듀오링고의 상자 메커니즘 차용: 등급(브론즈/실버/골드)이 무작위로 정해지고
//  등급에 따라 코인이 다르게 나온다 (보상 크기의 불확실성 = 재미 요소).
//  달성/수령 여부 판정은 클라이언트(localStorage)가 담당하는 가벼운 구조다.
export async function POST(req: NextRequest) {
  const { userId, questId } = await req.json();
  if (!userId || !questId)
    return NextResponse.json({ error: 'userId, questId 필요' }, { status: 400 });

  // 상자 등급 추첨: 골드 10% / 실버 30% / 브론즈 60%
  const r = Math.random();
  const tier = r < 0.1 ? 'gold' : r < 0.4 ? 'silver' : 'bronze';
  const coins =
    tier === 'gold' ? 60 + Math.floor(Math.random() * 41)      // 60~100
    : tier === 'silver' ? 30 + Math.floor(Math.random() * 21)  // 30~50
    : 15 + Math.floor(Math.random() * 11);                     // 15~25

  const db = createAdminClient();
  let { data } = await db.from('gamify_state').select('*').eq('owner_id', userId).maybeSingle();
  if (!data) { const ins = await db.from('gamify_state').insert({ owner_id: userId }).select().single(); data = ins.data; }

  data.coins += coins;
  await db.from('gamify_state').update({ coins: data.coins, updated_at: new Date().toISOString() }).eq('owner_id', userId);

  const state: GamifyState = {
    streak: data.streak, freezes: data.freezes, totalXp: data.total_xp,
    todayXp: data.today_xp, dailyGoal: data.daily_goal, hearts: data.hearts,
    maxHearts: MAX_HEARTS, coins: data.coins, nextHeartInMin: nextHeartInMin(data.hearts, data.hearts_updated),
  };
  return NextResponse.json({ tier, coins, state });
}
