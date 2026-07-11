import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { MAX_HEARTS, todayStr } from '@/lib/gamify';
import type { GamifyState } from '@/lib/types';

export const runtime = 'nodejs';
// Supabase(내부적으로 fetch 사용) 응답을 Next.js가 자동 캐싱하지 않도록 강제.
// 이게 없으면 같은 조회가 예전 결과로 고정되어, DB가 바뀌어도 화면에 반영되지 않는다.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// gamify_state 행을 읽고 없으면 생성. 오늘 XP 리셋을 반영해 저장.
// (하트는 이제 세션 전용 개념이라 서버에서 관리하지 않는다)
async function loadState(db: ReturnType<typeof createAdminClient>, userId: string) {
  let { data } = await db.from('gamify_state').select('*').eq('owner_id', userId).maybeSingle();
  if (!data) {
    const ins = await db.from('gamify_state').insert({ owner_id: userId }).select().single();
    data = ins.data;
  }
  const today = todayStr(new Date());

  // 날짜가 바뀌면 오늘 XP 리셋
  if (data.today_date !== today) {
    data.today_xp = 0; data.today_date = today;
    await db.from('gamify_state').update({ today_xp: 0, today_date: today }).eq('owner_id', userId);
  }
  return data;
}

function toState(d: any): GamifyState {
  return {
    streak: d.streak, freezes: d.freezes, totalXp: d.total_xp,
    todayXp: d.today_xp, dailyGoal: d.daily_goal,
    hearts: MAX_HEARTS, maxHearts: MAX_HEARTS, coins: d.coins, nextHeartInMin: null,
  };
}

// GET /api/gamify/:userId — 현재 게이미피케이션 상태
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  // 요청 객체를 읽지 않고 동적 경로 파라미터만 쓰는 라우트라, dynamic 설정만으로는
  // 캐시를 안 타는 경우가 있어 noStore()로 확실히 막는다.
  noStore();
  const db = createAdminClient();
  const d = await loadState(db, params.userId);
  return NextResponse.json(toState(d));
}
