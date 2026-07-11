'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useSession } from '@/hooks/useSession';
import { createUser, getProgress } from '@/lib/api';
import type { UserProgress } from '@/lib/types';

// 로그인 / 사용자 선택 화면.
// 프로토타입 v3의 첫 화면을 실제 API에 연결한 참고 구현입니다.
// (홈·학습·데이터 화면도 같은 패턴으로 lib/api.ts 를 호출해 구성하면 됩니다.)
export default function LoginPage() {
  const router = useRouter();
  const { setUserId } = useSession();
  const { users, loading, error, login, refresh } = useUser();
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  // 로그인하면 세션에 사용자 기록 후 홈으로 이동
  function enter(id: string) {
    login(id);
    setUserId(id);
    router.push('/home');
  }

  // 각 사용자의 진도율을 병렬로 불러오기
  useEffect(() => {
    users.forEach(async (u) => {
      if (!progress[u.id]) {
        try {
          const p = await getProgress(u.id);
          setProgress((prev) => ({ ...prev, [u.id]: p }));
        } catch {}
      }
    });
  }, [users]); // eslint-disable-line

  async function handleCreate() {
    if (!name.trim()) return;
    const u = await createUser({ name: name.trim(), emoji: '🦊', color: '#2563eb' });
    await refresh();
    setName('');
    setRegistering(false);
    enter(u.id);
  }

  if (loading) return <Centered>불러오는 중…</Centered>;
  if (error) {
    return (
      <Centered>
        <div style={{ ...errorCard, maxWidth: 380 }}>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#0f172a' }}>데이터베이스에 연결하지 못했어요</div>
          <div style={{ color: '#64748b', lineHeight: 1.6, fontSize: 13.5 }}>
            개발 서버와 Supabase 환경변수·네트워크 연결을 확인해 주세요.
          </div>
          <code style={{ color: '#b91c1c', background: '#fef2f2', borderRadius: 10, padding: 10, fontSize: 12, wordBreak: 'break-all' }}>{error}</code>
          <button onClick={() => window.location.reload()} style={btn}>다시 시도</button>
        </div>
      </Centered>
    );
  }

  return (
    <Centered>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1 style={{ fontSize: 25, fontWeight: 900, textAlign: 'center' }}>암기 마스터</h1>
        <p style={{ color: '#64748b', textAlign: 'center', marginBottom: 20 }}>누가 학습할까요?</p>

        {users.map((u) => {
          const p = progress[u.id];
          return (
            <div key={u.id} style={card}>
              <button onClick={() => enter(u.id)} style={{ ...rowBtn, flex: 1 }}>
                <span style={{ fontSize: 26 }}>{u.emoji}</span>
                <span style={{ fontWeight: 800 }}>{u.name}</span>
                {p && <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12 }}>
                  키워드 {p.kwRate}% · 기출 {p.exRate}%
                </span>}
              </button>
              {/* 로그인 전에는 "누가 보냈는지"를 알 수 없어 응원은 통계 화면에서만 가능 — 여기서는 받은 응원 수만 표시 */}
              <span style={cheerBtn}>👏 {p?.cheers ?? 0}</span>
            </div>
          );
        })}

        {registering ? (
          <div style={{ ...card, flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="이름 (예: 김지호)" style={input} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRegistering(false)} style={btnGray}>취소</button>
              <button onClick={handleCreate} style={{ ...btn, flex: 1 }}>등록하고 시작</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setRegistering(true)} style={dashed}>＋ 신규 사용자 등록</button>
        )}
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>{children}</div>;
}

const card: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 18, padding: 12, marginBottom: 10, boxShadow: '0 10px 26px -18px rgba(15,23,42,.3)' };
const rowBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, border: 'none', background: 'none', cursor: 'pointer', padding: 6, fontSize: 16 };
const cheerBtn: React.CSSProperties = { background: '#fff7ed', color: '#ea580c', fontWeight: 800, borderRadius: 12, padding: '10px 14px', fontSize: 14 };
const btn: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontWeight: 900, cursor: 'pointer' };
const btnGray: React.CSSProperties = { background: '#eef2f7', color: '#334155', border: 'none', borderRadius: 14, padding: '14px 20px', fontWeight: 900, cursor: 'pointer' };
const dashed: React.CSSProperties = { width: '100%', border: '2px dashed #cbd5e1', background: '#fff', color: '#64748b', fontWeight: 800, padding: 16, borderRadius: 18, cursor: 'pointer' };
const input: React.CSSProperties = { border: '2px solid #e2e8f0', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 700, outline: 'none', fontFamily: 'inherit' };
const errorCard: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center', background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 14px 32px -20px rgba(15,23,42,.35)' };
