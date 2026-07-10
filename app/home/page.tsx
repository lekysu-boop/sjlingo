'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useUser } from '@/hooks/useUser';
import { useSubjects } from '@/hooks/useSubjects';
import { useKeywords } from '@/hooks/useKeywords';
import { useExams } from '@/hooks/useExams';
import { useGamification } from '@/hooks/useGamification';
import { GamifyStyles, GamifyHud } from '@/components/Gamify';

// 홈: 과목 선택 + 두 학습 프로그램 진입.
export default function HomePage() {
  const router = useRouter();
  const { userId, subjectId, setUserId, setSubjectId } = useSession();
  const { users } = useUser();
  const { subjects, currentId, setCurrentId, add } = useSubjects(userId);
  const kw = useKeywords(userId, subjectId);
  const ex = useExams(userId, subjectId);
  const gam = useGamification(userId);

  // 로그인 안 됐으면 로그인으로
  useEffect(() => { if (userId === null) router.replace('/'); }, [userId, router]);
  // 과목 훅의 선택을 세션에 동기화
  useEffect(() => { if (currentId && currentId !== subjectId) setSubjectId(currentId); }, [currentId]); // eslint-disable-line

  const me = users.find((u) => u.id === userId);

  async function addSubject() {
    const name = prompt('새 과목 이름 (예: 영어 단어)');
    if (name?.trim()) await add(name.trim(), '📚', '#7c3aed');
  }

  return (
    <div style={wrap}>
      <GamifyStyles />
      <div style={phone}>
        {/* 헤더 */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: me?.color ?? '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{me?.emoji ?? '👤'}</div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>반가워요 👋</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: '#0f172a' }}>{me?.name ?? ''}님</div>
            </div>
          </div>
          <button onClick={() => { setUserId(null); router.push('/'); }} style={switchBtn}>전환</button>
        </header>

        {/* 게이미피케이션 HUD */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '12px 14px', marginBottom: 18, boxShadow: '0 10px 26px -18px rgba(15,23,42,.3)' }}>
          <GamifyHud state={gam.state} />
        </div>

        {/* 과목 칩 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8' }}>과목 선택</span>
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

        {/* 프로그램 1: 키워드 */}
        <button onClick={() => router.push('/study/keyword')} style={{ ...programCard, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 18px 36px -14px rgba(37,99,235,.6)' }}>
          <Badge>PROGRAM 1</Badge>
          <div style={{ fontSize: 21, fontWeight: 900 }}>키워드 인출 학습</div>
          <div style={{ fontSize: 13, opacity: .9, marginTop: 3, lineHeight: 1.5 }}>암기코드를 보고 뜻과 원리를 떠올리는 인출 반복 훈련</div>
          <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
            <Stat>📚 {kw.items.length}개</Stat>
          </div>
        </button>

        {/* 프로그램 2: 기출 */}
        <button onClick={() => router.push('/study/exam')} style={{ ...programCard, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 18px 36px -14px rgba(124,58,237,.55)', marginTop: 14 }}>
          <Badge>PROGRAM 2</Badge>
          <div style={{ fontSize: 21, fontWeight: 900 }}>기출문제 풀이</div>
          <div style={{ fontSize: 13, opacity: .9, marginTop: 3, lineHeight: 1.5 }}>시대별 기출을 반복해서 풀고 자주 틀리는 문제만 집중 공략</div>
          <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
            <Stat>📝 {ex.items.length}문항</Stat>
          </div>
        </button>

        {/* 하단 탭 */}
        <nav style={tabbar}>
          <span style={{ ...tabItem, color: '#2563eb' }}>🏠<br />홈</span>
          <button onClick={() => router.push('/league')} style={{ ...tabItem, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>🏆<br />리그</button>
          <button onClick={() => router.push('/stats')} style={{ ...tabItem, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>📊<br />통계</button>
          <button onClick={() => router.push('/data')} style={{ ...tabItem, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>🗄️<br />데이터</button>
        </nav>
      </div>
    </div>
  );
}

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,.2)', padding: '4px 11px', borderRadius: 99, marginBottom: 8 }}>{children}</span>
);
const Stat = ({ children }: { children: React.ReactNode }) => (
  <span style={{ background: 'rgba(255,255,255,.16)', borderRadius: 10, padding: '6px 11px', fontSize: 12, fontWeight: 700 }}>{children}</span>
);

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const phone: React.CSSProperties = { width: 380, background: '#f4f6fa', borderRadius: 32, padding: '24px 20px 88px', position: 'relative', boxShadow: '0 30px 60px -30px rgba(15,23,42,.4)' };
const switchBtn: React.CSSProperties = { fontSize: 12.5, fontWeight: 800, color: '#94a3b8', background: '#fff', padding: '9px 14px', borderRadius: 12, border: 'none', cursor: 'pointer' };
const linkBtn: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' };
const chip: React.CSSProperties = { flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, padding: '11px 16px', borderRadius: 15, cursor: 'pointer' };
const programCard: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', borderRadius: 26, padding: 22, color: '#fff' };
const tabbar: React.CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, height: 72, background: 'rgba(255,255,255,.94)', borderTop: '1px solid #eef2f7', borderRadius: '0 0 32px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingTop: 8 };
const tabItem: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, textAlign: 'center', lineHeight: 1.7 };
