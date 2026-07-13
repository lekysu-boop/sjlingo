'use client';
import { useEffect, useState } from 'react';
import type { GamifyState } from '@/lib/types';

// ============================================================
//  게이미피케이션 공용 UI 컴포넌트 (인라인 스타일 + 전역 keyframes).
//  study/keyword, study/exam 세션에서 재사용합니다.
// ============================================================

// 전역 keyframes 주입 (한 번만)
export function GamifyStyles() {
  return (
    <style>{`
      @keyframes gm-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.25);opacity:1}100%{transform:scale(1);opacity:1}}
      @keyframes gm-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-11px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}}
      @keyframes gm-fall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(420px) rotate(560deg);opacity:0}}
      @keyframes gm-flame{0%,100%{transform:scale(1)}50%{transform:scale(1.35) rotate(-4deg)}}
      @keyframes gm-float{0%{transform:translate(-50%,0);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-70px);opacity:0}}
      @keyframes gm-heartbreak{0%{transform:scale(1)}40%{transform:scale(1.4)}100%{transform:scale(.9);opacity:.35}}
      @keyframes gm-jump{0%,100%{transform:translateY(0)}30%{transform:translateY(-24px)}50%{transform:translateY(0)}65%{transform:translateY(-11px)}}
      @keyframes gm-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
      @keyframes gm-glow{0%,100%{box-shadow:0 0 0 0 rgba(255,183,3,.5)}50%{box-shadow:0 0 0 14px rgba(255,183,3,0)}}
    `}</style>
  );
}

const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a78bff', '#ec4899'];

// 콘페티 버스트 — trigger(seq)가 바뀔 때마다 재생
export function Confetti({ trigger, count = 16, loop = false }: { trigger: number; count?: number; loop?: boolean }) {
  const [bits, setBits] = useState<{ left: string; color: string; dur: string; delay: string }[]>([]);
  useEffect(() => {
    if (!trigger && !loop) return;
    setBits(Array.from({ length: count }, (_, i) => ({
      left: Math.round(Math.random() * 100) + '%',
      color: COLORS[i % COLORS.length],
      dur: (0.9 + Math.random() * 0.7).toFixed(2) + 's',
      delay: (Math.random() * 0.3).toFixed(2) + 's',
    })));
  }, [trigger, count, loop]);
  if (!bits.length) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}>
      {bits.map((b, i) => (
        <div key={i} style={{ position: 'absolute', left: b.left, top: -16, width: 10, height: 14, background: b.color, borderRadius: 2, animation: `gm-fall ${b.dur} ease-in ${b.delay} ${loop ? 'infinite' : 'forwards'}` }} />
      ))}
    </div>
  );
}

// "+N XP" 플로터
export function XpFloat({ trigger, amount }: { trigger: number; amount: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1100);
    return () => clearTimeout(t);
  }, [trigger]);
  if (!show || !amount) return null;
  return (
    <div style={{ position: 'absolute', left: '50%', top: '42%', fontSize: 26, fontWeight: 900, color: '#16a34a', animation: 'gm-float 1.1s ease forwards', pointerEvents: 'none', textShadow: '0 2px 0 #fff', zIndex: 6 }}>
      +{amount} XP
    </div>
  );
}

// 상단 HUD: XP 링 + 스트릭 + 코인 + (세션) 하트
// hearts: 이번 세션에서 남은 기회. 학습 화면이 세션마다 5개로 리셋해 관리한다.
export function GamifyHud({ state, hearts, maxHearts = 5, heartBreakIdx }: { state: GamifyState | null; hearts?: number; maxHearts?: number; heartBreakIdx?: number | null }) {
  if (!state) return null;
  const ring = 314;
  const off = ring * (1 - Math.min(1, state.todayXp / state.dailyGoal));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
        <svg viewBox="0 0 110 110" style={{ width: 48, height: 48, transform: 'rotate(-90deg)' }}>
          <circle cx="55" cy="55" r="50" fill="none" stroke="#eef2f7" strokeWidth="10" />
          <circle cx="55" cy="55" r="50" fill="none" stroke="#22c55e" strokeWidth="10" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.4,1.4,.5,1)' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#16a34a', lineHeight: 1 }}>{state.todayXp}</div>
          <div style={{ fontSize: 8, fontWeight: 800, color: '#94a3b8' }}>/{state.dailyGoal}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff7ed', borderRadius: 13, padding: '8px 12px' }}>
        <span style={{ fontSize: 18, animation: 'gm-flame 1.5s ease-in-out infinite', display: 'inline-block' }}>🔥</span>
        <span style={{ fontSize: 15, fontWeight: 900, color: '#ea580c' }}>{state.streak}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fefce8', borderRadius: 13, padding: '8px 11px' }}>
        <span style={{ fontSize: 15 }}>🪙</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: '#ca8a04' }}>{state.coins}</span>
      </div>
      {hearts !== undefined && (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {Array.from({ length: maxHearts }, (_, i) => {
            // fill: 1=꽉 찬 하트, 0.5=중요도 중/하 오답 절반 차감된 하트, 0=빈 하트
            const fill = Math.max(0, Math.min(1, hearts - i));
            const breaking = heartBreakIdx != null && i === Math.floor(heartBreakIdx);
            return (
              <span key={i} style={{ position: 'relative', width: 18, height: 18, fontSize: 18, display: 'inline-block', animation: breaking ? 'gm-heartbreak .5s ease forwards' : 'none' }}>
                <span style={{ position: 'absolute', inset: 0 }}>🤍</span>
                {fill > 0 && <span style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, overflow: 'hidden' }}>❤️</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 하트 소진 확인 모달: 세션 중 하트를 다 썼을 때 계속할지 묻는다.
// 계속하면 남은 문제(카드)를 끝까지 풀고, 그만두면 지금까지 결과로 바로 종료한다.
export function HeartsGate({ onContinue, onStop }: { onContinue: () => void; onStop: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 340, background: '#fff', borderRadius: 22, padding: '24px 22px', textAlign: 'center' }}>
        <div style={{ fontSize: 38 }}>💔</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: '8px 0 6px' }}>하트를 다 썼어요</div>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, lineHeight: 1.6, marginBottom: 18 }}>계속 진행하시겠습니까?<br />남은 문제를 마저 풀 수 있어요.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onStop} style={{ flex: 1, background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 14, padding: 14, borderRadius: 14, cursor: 'pointer' }}>그만하기</button>
          <button onClick={onContinue} style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 900, fontSize: 14, padding: 14, borderRadius: 14, cursor: 'pointer' }}>계속하기</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Mascot — 듀오링고의 올빼미처럼, 답을 낼 때마다 반응해 주는 응원 캐릭터
//  상황(첫 정답 / 콤보 / 대콤보 / 오답 / 연속 오답 / 목표 / 스트릭)별로
//  메시지 풀을 나눠, 같은 이벤트여도 매번 다른 말이 나온다. (중고생 톤)
// ----------------------------------------------------------------------------
const MSG = {
  // 일반 정답
  cheer: [
    '오 바로 맞히네? 좀 치는데 😎', 'ㅇㅈ! 완벽 정답~', '굿굿 이 감각 그대로 가자 🏄',
    '척 보면 척이지 👀', '어렵지 않았죠~ 다음 문제 ㄱㄱ', '깔끔하게 정답! 기분 좋다 ✨',
    '오늘 컨디션 좋은데? 쭉 가자~', '이 정도면 시험장 가도 되겠는데?',
  ],
  // 3~4 콤보
  combo3: [
    '3연속?! 폼 미쳤다 🔥', '콤보 쌓이는 소리 들린다 📈', '지금 완전 흐름 탔어~ 끊지 마!',
    '오늘 좀 되는 날인데? 😏', '무빙 좋다~ 이대로 클리어 가자',
  ],
  // 5콤보 이상
  combo5: [
    '5콤보 실화냐?! 미쳤다 진짜 🤯', '아니 이걸 다 맞혀? 천재 인정 👑', '이 구역 에이스 등장 🏆',
    '전설의 시작인가… ⚡', '멈출 수 없는 콤보 기계 ㄷㄷ', '지금 리그 1등 각 제대로 잡았다 🎯',
  ],
  // 일반 오답
  oops: [
    '아깝… 진짜 한 끗 차이 😭', '삐끗! 괜찮아 다시 ㄱㄱ', '이건 함정픽이었다… 다음엔 안 속지 😤',
    '틀린 건 뇌에 더 오래 남는대, 오히려 이득 😌', '어? 이거 복습함으로 저장~ 다음에 잡자',
    '노 프라블럼~ 한 문제일 뿐이야', '지금 틀려야 시험장에서 안 틀리지 💪',
  ],
  // 연속 2번 이상 오답
  oops2: [
    '잠깐 스탑! 숨 한번 쉬고 가자 🧘', '멘탈 부여잡기~ 다음 건 맞힐 각이야', '어려운 구간이네;; 천천히 읽어보자 🔍',
    '괜찮아 괜찮아, 여기서 반등 가자 📈', '연속 오답은 실력이 크는 소리… 진짜임 🌱',
  ],
  // 오늘 목표 달성
  goal: ['오늘 목표 클리어!! 🎉 폼 미쳤다', '일일 목표 달성! 이게 되네 ㄷㄷ 🏅', '목표 깼다! 오늘 할 일 다 한 사람 = 나 😎'],
  // 스트릭 갱신
  streak: ['스트릭 이어짐 🔥 꾸준함 무엇~', '연속 학습 기록 갱신! 내일도 콜? 🤙', '매일 하는 사람은 못 이겨… 그게 너야 🔥'],
};

export function Mascot({ kind, seq, combo = 0, wrongStreak = 0, emoji = '🦉' }: { kind: 'correct' | 'wrong' | 'goal' | 'streak' | null; seq: number; combo?: number; wrongStreak?: number; emoji?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!seq || !kind) return;
    // 상황에 맞는 메시지 풀 선택
    const pool =
      kind === 'goal' ? MSG.goal
      : kind === 'streak' ? MSG.streak
      : kind === 'wrong' ? (wrongStreak >= 2 ? MSG.oops2 : MSG.oops)
      : combo >= 5 ? MSG.combo5
      : combo >= 3 ? MSG.combo3
      : MSG.cheer;
    setMsg(pool[Math.floor(Math.random() * pool.length)]);
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [seq]); // eslint-disable-line
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 46 }}>
      <span style={{ fontSize: 30, display: 'inline-block', animation: msg ? (kind === 'wrong' ? 'gm-shake .5s ease' : 'gm-jump .8s ease') : 'gm-wiggle 3s ease-in-out infinite' }}>{emoji}</span>
      {msg && (
        <div key={seq} style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: '14px 14px 14px 4px', padding: '8px 12px', fontSize: 13.5, fontWeight: 800, color: '#334155', animation: 'gm-pop .3s ease', boxShadow: '0 6px 14px -8px rgba(15,23,42,.3)' }}>{msg}</div>
      )}
    </div>
  );
}

// 콤보 배지
export function ComboBadge({ combo }: { combo: number }) {
  if (combo < 2) return null;
  return (
    <div style={{ textAlign: 'center' }}>
      <span key={combo} style={{ display: 'inline-block', background: 'linear-gradient(120deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 900, fontSize: 14, padding: '5px 16px', borderRadius: 99, animation: 'gm-pop .4s ease', boxShadow: '0 6px 16px -4px rgba(239,68,68,.5)' }}>🔥 {combo} 연속 정답!</span>
    </div>
  );
}
