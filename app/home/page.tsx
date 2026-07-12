'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useUser } from '@/hooks/useUser';
import { useSubjects } from '@/hooks/useSubjects';
import { useStudySummary } from '@/hooks/useStudySummary';
import { useGamification } from '@/hooks/useGamification';
import { GamifyStyles, Confetti } from '@/components/Gamify';
import { TabBar } from '@/components/TabBar';
import { DAILY_QUESTS, loadQuestDay, markClaimed, questProgress, type QuestDay } from '@/lib/quests';
import { claimQuest } from '@/lib/api';
import { playChest } from '@/lib/sound';

// 홈: 과목 선택 + 오늘의 퀘스트 + 두 학습 프로그램 진입.
// 이 컴포넌트는 업무 로직을 직접 계산하기보다 useSubjects/useStudySummary/
// useGamification 훅의 결과를 조립하는 Dashboard(View) 역할을 합니다.
export default function HomePage() {
  const router = useRouter();
  const { userId, subjectId, setUserId, setSubjectId, ready } = useSession();
  const { users } = useUser();
  const { subjects, currentId, setCurrentId, add } = useSubjects(userId, subjectId);
  const summary = useStudySummary(userId, subjectId);
  const gam = useGamification(userId);

  // 일일 퀘스트 진행도(localStorage)와 보물상자 연출 상태.
  // localStorage 는 브라우저 전용이라 렌더 후 effect 에서 읽는다 (SSR 불일치 방지).
  const [questDay, setQuestDay] = useState<QuestDay>({ sessions: 0, bestCombo: 0, claimed: [] });
  const [questOpen, setQuestOpen] = useState(false); // 퀘스트 상세 펼침 (기본: 접힘)
  const [chest, setChest] = useState<{ tier: string; coins: number } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    if (!claimError) return;
    const t = setTimeout(() => setClaimError(null), 3000);
    return () => clearTimeout(t);
  }, [claimError]);

  // 로그인 안 됐으면 로그인으로
  useEffect(() => { if (ready && userId === null) router.replace('/'); }, [ready, userId, router]);
  // 과목 훅의 선택을 세션에 동기화
  useEffect(() => { if (currentId && currentId !== subjectId) setSubjectId(currentId); }, [currentId]); // eslint-disable-line
  useEffect(() => { setQuestDay(loadQuestDay(userId)); }, [userId]);

  const me = users.find((u) => u.id === userId);
  const todayXp = gam.state?.todayXp ?? 0;
  const questsDone = DAILY_QUESTS.filter((q) => questDay.claimed.includes(q.id)).length;
  // 달성했지만 아직 상자를 안 연 퀘스트 수 (접힌 상태에서 🎁 알림용)
  const claimable = DAILY_QUESTS.filter((q) => !questDay.claimed.includes(q.id) && questProgress(q, questDay, todayXp) >= q.target).length;

  // 퀘스트 보상 수령 → 서버가 상자 등급·코인을 추첨해 지급
  async function onClaim(questId: string) {
    if (!userId || claiming) return;
    setClaiming(true); setClaimError(null);
    try {
      const r = await claimQuest(userId, questId);
      markClaimed(userId, questId);
      setQuestDay(loadQuestDay(userId));
      playChest();
      setChest({ tier: r.tier, coins: r.coins });
      gam.applyState(r.state); // 응답에 이미 최신 상태가 있어 재조회 없이 HUD 코인 갱신
    } catch {
      setClaimError('보상을 받지 못했어요. 다시 시도해 주세요.');
    }
    finally { setClaiming(false); }
  }

  async function addSubject() {
    const name = prompt('새 과목 이름 (예: 영어 단어)');
    if (name?.trim()) await add(name.trim(), '📚', '#7c3aed');
  }

  return (
    <div className="app-wrap">
      <GamifyStyles />
      <div className="app-phone with-tabbar">
        {/* 헤더 */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: me?.color ?? '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{me?.emoji ?? '👤'}</div>
            <div>
              <div style={{ fontSize: 13.5, color: '#64748b', fontWeight: 700 }}>반가워요 👋</div>
              <div style={{ fontSize: 21, fontWeight: 900, color: '#0f172a' }}>{me?.name ?? ''}님</div>
            </div>
          </div>
          <button onClick={() => { setUserId(null); router.push('/'); }} style={switchBtn}>전환</button>
        </header>

        {/* 상태 요약 — 한 줄로 단순화. 역할이 하나씩: 🔥 꾸준함(연속일) · ⚡ 오늘의 실력 점수 · 🪙 공부시간 보상
            (하트는 전역 상태가 아니라 학습 세션 안에서만 존재) */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '13px 18px', marginBottom: 12, boxShadow: '0 10px 26px -18px rgba(15,23,42,.3)', display: 'flex', alignItems: 'center', gap: 22 }}>
          <span style={statItem} title="연속 학습일">🔥 <b style={statNum}>{gam.state?.streak ?? 0}</b><small style={statSub}>일</small></span>
          <span style={statItem} title="오늘 XP / 일일 목표">⚡ <b style={statNum}>{todayXp}</b><small style={statSub}>/{gam.state?.dailyGoal ?? 100}</small></span>
          <span style={statItem} title="코인 (공부시간 1분 = 1코인)">🪙 <b style={statNum}>{gam.state?.coins ?? 0}</b></span>
        </div>

        {/* 오늘의 퀘스트 — 기본은 한 줄 접힘, 탭하면 상세 (받을 상자가 있으면 🎁 표시) */}
        <div style={{ background: '#fff', borderRadius: 18, marginBottom: 18, boxShadow: '0 10px 26px -18px rgba(15,23,42,.3)', overflow: 'hidden' }}>
          <button onClick={() => setQuestOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '13px 18px', textAlign: 'left' }}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 900, color: '#0f172a' }}>📆 오늘의 퀘스트 <span style={{ color: '#94a3b8' }}>{questsDone}/3</span></span>
            {claimable > 0 && <span style={{ fontSize: 18, animation: 'gm-jump 1.2s ease infinite', display: 'inline-block' }}>🎁</span>}
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 900 }}>{questOpen ? '▲' : '▼'}</span>
          </button>
          {questOpen && (
            <div style={{ padding: '0 18px 12px' }}>
              {DAILY_QUESTS.map((q) => {
                const prog = questProgress(q, questDay, todayXp);
                const done = prog >= q.target;
                const claimed = questDay.claimed.includes(q.id);
                return (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                    <span style={{ fontSize: 21, width: 28, textAlign: 'center' }}>{q.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: claimed ? '#94a3b8' : '#334155', textDecoration: claimed ? 'line-through' : 'none' }}>{q.title}</div>
                      <div style={{ height: 8, background: '#eef2f7', borderRadius: 99, marginTop: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round((prog / q.target) * 100)}%`, background: claimed ? '#cbd5e1' : 'linear-gradient(90deg,#f59e0b,#f97316)', borderRadius: 99, transition: 'width .4s ease' }} />
                      </div>
                    </div>
                    {claimed
                      ? <span style={{ fontSize: 19 }}>✅</span>
                      : done
                        ? <button onClick={() => onClaim(q.id)} disabled={claiming} style={{ background: 'linear-gradient(120deg,#f59e0b,#f97316)', color: '#fff', border: 'none', fontWeight: 900, fontSize: 13, padding: '9px 14px', borderRadius: 11, cursor: 'pointer', animation: 'gm-glow 1.6s ease infinite', flexShrink: 0 }}>🎁 열기</button>
                        : <span style={{ fontSize: 13, fontWeight: 900, color: '#94a3b8', flexShrink: 0 }}>{prog}/{q.target}</span>}
                  </div>
                );
              })}
              {claimError && (
                <div aria-live="polite" style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '9px 12px', borderRadius: 11 }}>⚠️ {claimError}</div>
              )}
            </div>
          )}
        </div>

        {/* 과목 칩 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: '#94a3b8' }}>과목 선택</span>
          <button onClick={addSubject} style={linkBtn}>＋ 과목 추가</button>
        </div>
        <div style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 6, marginBottom: 20 }}>
          {subjects.map((s) => {
            const active = s.id === currentId;
            return (
              <button key={s.id} onClick={() => setCurrentId(s.id)} style={{ ...chip, background: active ? s.color : '#fff', color: active ? '#fff' : '#475569', border: `2px solid ${active ? s.color : '#e2e8f0'}` }}>
                <span style={{ fontSize: 17 }}>{s.emoji}</span> {s.name}
              </button>
            );
          })}
        </div>

        {/* 메뉴: PROGRAM 1 → 키워드 인출 학습 */}
        <button onClick={() => router.push('/study/keyword')} style={{ ...programCard, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 18px 36px -14px rgba(37,99,235,.6)' }}>
          <Badge>PROGRAM 1</Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 23, fontWeight: 900 }}>키워드 인출 학습</div>
            <span style={{ fontSize: 22 }}>›</span>
          </div>
          <div style={{ fontSize: 14.5, opacity: .92, marginTop: 4, lineHeight: 1.5 }}>키워드를 보고 뜻과 원리를 떠올리는 인출 반복 훈련</div>
          <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
            <Stat>📚 {summary.kwCount}개</Stat>
            {summary.dueCount > 0 && <Stat>🧠 오늘 복습 {summary.dueCount}개</Stat>}
          </div>
        </button>

        {/* 메뉴: PROGRAM 2 → 기출문제 풀이 */}
        <button onClick={() => router.push('/study/exam')} style={{ ...programCard, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 18px 36px -14px rgba(124,58,237,.55)', marginTop: 14 }}>
          <Badge>PROGRAM 2</Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 23, fontWeight: 900 }}>기출문제 풀이</div>
            <span style={{ fontSize: 22 }}>›</span>
          </div>
          <div style={{ fontSize: 14.5, opacity: .92, marginTop: 4, lineHeight: 1.5 }}>분류별 기출을 반복해서 풀고 자주 틀리는 문제만 집중 공략</div>
          <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
            <Stat>📝 {summary.exCount}문항</Stat>
          </div>
        </button>

        {/* 보물상자 연출 — 등급(브론즈/실버/골드)이 무작위라 열 때마다 두근두근 */}
        {chest && (
          <div onClick={() => setChest(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 320, background: '#fff', borderRadius: 26, padding: '30px 22px 24px', textAlign: 'center', overflow: 'hidden' }}>
              <Confetti trigger={1} count={24} />
              <div style={{ fontSize: 62, animation: 'gm-jump 1s ease', display: 'inline-block' }}>{chest.tier === 'gold' ? '🏆' : chest.tier === 'silver' ? '🎁' : '📦'}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: chest.tier === 'gold' ? '#ca8a04' : chest.tier === 'silver' ? '#64748b' : '#b45309', marginTop: 4 }}>
                {chest.tier === 'gold' ? '✨ 골드 상자!! 대박!' : chest.tier === 'silver' ? '실버 상자!' : '브론즈 상자'}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: '8px 0 4px' }}>🪙 +{chest.coins} 코인</div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, marginBottom: 16 }}>퀘스트 완료 보상이에요</div>
              <button onClick={() => setChest(null)} style={{ width: '100%', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 900, fontSize: 15, padding: 14, borderRadius: 14, cursor: 'pointer' }}>받기!</button>
            </div>
          </div>
        )}

        {/* 하단 탭 */}
        <TabBar active="home" />
      </div>
    </div>
  );
}

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,.2)', padding: '4px 11px', borderRadius: 99, marginBottom: 8 }}>{children}</span>
);
const Stat = ({ children }: { children: React.ReactNode }) => (
  <span style={{ background: 'rgba(255,255,255,.16)', borderRadius: 10, padding: '7px 12px', fontSize: 13.5, fontWeight: 800 }}>{children}</span>
);

const statItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, fontSize: 17 };
const statNum: React.CSSProperties = { fontSize: 16, fontWeight: 900, color: '#0f172a' };
const statSub: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#94a3b8' };
const switchBtn: React.CSSProperties = { fontSize: 12.5, fontWeight: 800, color: '#94a3b8', background: '#fff', padding: '9px 14px', borderRadius: 12, border: 'none', cursor: 'pointer' };
const linkBtn: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' };
const chip: React.CSSProperties = { flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 800, padding: '12px 18px', borderRadius: 15, cursor: 'pointer' };
const programCard: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', borderRadius: 26, padding: 22, color: '#fff' };
