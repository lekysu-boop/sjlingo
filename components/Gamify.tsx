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

// 상단 HUD: XP 링 + 스트릭 + 코인 + 하트
export function GamifyHud({ state, heartBreakIdx }: { state: GamifyState | null; heartBreakIdx?: number | null }) {
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
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
        {Array.from({ length: state.maxHearts }, (_, i) => {
          const filled = i < state.hearts;
          const breaking = heartBreakIdx != null && i === state.hearts;
          return <span key={i} style={{ fontSize: 18, animation: breaking ? 'gm-heartbreak .5s ease forwards' : 'none', display: 'inline-block' }}>{filled ? '❤️' : '🤍'}</span>;
        })}
      </div>
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
