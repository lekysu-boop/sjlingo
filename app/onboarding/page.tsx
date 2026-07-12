'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { markOnboarded } from '@/lib/onboarding';

// 신규 계정을 만든 직후, 홈 화면에 들어가기 전에 한 번만 보여주는 웰컴 가이드.
// app/page.tsx 의 doCreate() 에서만 이 경로로 보내며, 기존 사용자로 로그인할 때는
// 거치지 않는다 (markOnboarded 는 이 화면을 끝까지/건너뛰기로 마쳤을 때만 기록된다).
const SLIDES = [
  {
    emoji: '🎉',
    title: '암기 마스터에 오신 걸 환영해요!',
    desc: '한능검 같은 시험 준비를 위해 키워드 암기와 기출문제 풀이를 도와주는 학습 앱이에요. 딱 30초만 훑어볼게요.',
    bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
  },
  {
    emoji: '📚',
    title: 'PROGRAM 1 · 키워드 인출 학습',
    desc: '키워드를 보고 뜻과 원리를 스스로 떠올려보는 인출 반복 훈련이에요. 망각곡선에 맞춰 오늘 복습할 키워드도 알려줘요.',
    bg: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
  },
  {
    emoji: '📝',
    title: 'PROGRAM 2 · 기출문제 풀이',
    desc: '보기를 골라 바로 정오답을 확인하는 기출문제 풀이예요. 틀린 문제는 오답노트에 자동으로 모여서 다시 풀어볼 수 있어요.',
    bg: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
  },
  {
    emoji: '⚙️',
    title: '데이터 준비, 신경 쓰지 마세요',
    desc: '키워드나 기출문제 화면에 처음 들어가면 데이터가 없을 때 바로 물어봐요. 한능검은 기본/심화를 골라 자동으로 불러오고, 다른 과목도 버튼 한 번이면 바로 시작할 수 있어요. 하단 "데이터" 탭에서 언제든 직접 구글 시트로 불러올 수도 있어요.',
    bg: 'linear-gradient(135deg,#0891b2,#0e7490)',
  },
  {
    emoji: '🔥',
    title: '꾸준함이 힘, 게임처럼 즐기기',
    desc: '매일 학습하면 스트릭 🔥과 XP ⚡가 쌓이고, 공부한 시간만큼 코인 🪙도 모여요. 리그에서 친구와 순위도 겨뤄보세요.',
    bg: 'linear-gradient(135deg,#f59e0b,#f97316)',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { userId, ready } = useSession();
  const [step, setStep] = useState(0);

  useEffect(() => { if (ready && userId === null) router.replace('/'); }, [ready, userId, router]);

  function finish() {
    if (userId) markOnboarded(userId);
    router.push('/home');
  }

  const isLast = step === SLIDES.length - 1;
  const s = SLIDES[step];

  return (
    <div className="app-wrap"><div className="app-phone" style={{ display: 'flex', flexDirection: 'column' }}>
      <button onClick={finish} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#94a3b8', fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 8 }}>
        건너뛰기
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 20, padding: '0 8px' }}>
        <div style={{ width: 100, height: 100, borderRadius: 30, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, boxShadow: '0 22px 44px -18px rgba(15,23,42,.45)' }}>
          {s.emoji}
        </div>
        <div style={{ fontSize: 21, fontWeight: 900, color: '#0f172a', lineHeight: 1.4 }}>{s.title}</div>
        <div style={{ fontSize: 14.5, color: '#64748b', fontWeight: 600, lineHeight: 1.7, maxWidth: 320 }}>{s.desc}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
        {SLIDES.map((_, i) => (
          <span key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 99, background: i === step ? '#2563eb' : '#e2e8f0', transition: 'all .25s ease' }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {step > 0 && (
          <button onClick={() => setStep((v) => v - 1)} style={{ background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 15, padding: '16px 20px', borderRadius: 16, cursor: 'pointer' }}>
            이전
          </button>
        )}
        <button
          onClick={() => (isLast ? finish() : setStep((v) => v + 1))}
          style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 900, fontSize: 16, padding: 16, borderRadius: 18, cursor: 'pointer' }}
        >
          {isLast ? '시작하기' : '다음'}
        </button>
      </div>
    </div></div>
  );
}
