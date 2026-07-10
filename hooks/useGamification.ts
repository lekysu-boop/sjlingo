'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import type { GamifyState } from '@/lib/types';
import { getGamify, reward as apiReward } from '@/lib/api';

// 게이미피케이션 상태 + 학습 이벤트 보상 처리.
// 세션 페이지에서: onCorrect(combo) / onWrong() / completeSession() 호출.
// 반환되는 fx(효과 신호)로 콘페티·XP플로터·스트릭업 애니메이션을 트리거합니다.
export interface GamifyFx {
  kind: 'correct' | 'wrong' | 'goal' | 'streak' | null;
  gainedXp?: number;
  streak?: number;
  seq: number; // 매 이벤트마다 증가 — useEffect 의존성으로 사용
}

export function useGamification(userId: string | null) {
  const [state, setState] = useState<GamifyState | null>(null);
  const [fx, setFx] = useState<GamifyFx>({ kind: null, seq: 0 });
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) { setState(null); return; }
    try { setState(await getGamify(userId)); } catch {}
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const fire = (kind: GamifyFx['kind'], extra: Partial<GamifyFx> = {}) => {
    seq.current += 1;
    setFx({ kind, seq: seq.current, ...extra });
  };

  const onCorrect = useCallback(async (combo: number) => {
    if (!userId) return;
    try {
      const r = await apiReward({ userId, correct: true, combo });
      setState(r.state);
      fire('correct', { gainedXp: r.gainedXp });
      if (r.leveledGoal) setTimeout(() => fire('goal'), 400);
    } catch {}
  }, [userId]);

  const onWrong = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await apiReward({ userId, correct: false });
      setState(r.state);
      fire('wrong');
    } catch {}
  }, [userId]);

  const completeSession = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await apiReward({ userId, correct: false, sessionComplete: true });
      // 세션 완료는 하트를 깎지 않음(서버에서 sessionComplete 시 하트 유지).
      setState(r.state);
      if (r.streakUp) fire('streak', { streak: r.state.streak });
    } catch {}
  }, [userId]);

  return { state, fx, refresh, onCorrect, onWrong, completeSession };
}
