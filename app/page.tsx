'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useSession } from '@/hooks/useSession';
import { createUser, getProgress, sendCheer } from '@/lib/api';
import type { UserProgress } from '@/lib/types';

// 로그인 / 사용자 선택 화면.
// 프로토타입 v3의 첫 화면을 실제 API에 연결한 참고 구현입니다.
// (홈·학습·데이터 화면도 같은 패턴으로 lib/api.ts 를 호출해 구성하면 됩니다.)
export default function LoginPage() {
  const router = useRouter();
  const { setUserId } = useSession();
  const { users, current, loading, login, logout, refresh } = useUser();
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');


  const aaa = 1;
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
        try { setProgress((p) => ({ ...p, [u.id]: await getProgress(u.id) })); } catch {}
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

  return (
    <Centered>
      <div style={{ width: 360 }}>
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
              <button onClick={async () => setProgress((s) => ({ ...s, [u.id]: { ...(s[u.id]!), cheers: (await sendCheer(u.id)).cheers } }))} style={cheerBtn}>
                👏 {p?.cheers ?? 0}
              </button>
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
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</div>;
}

const card: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 18, padding: 12, marginBottom: 10, boxShadow: '0 10px 26px -18px rgba(15,23,42,.3)' };
const rowBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, border: 'none', background: 'none', cursor: 'pointer', padding: 6, fontSize: 16 };
const cheerBtn: React.CSSProperties = { border: 'none', background: '#fff7ed', color: '#ea580c', fontWeight: 800, borderRadius: 12, padding: '10px 14px', cursor: 'pointer' };
const btn: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontWeight: 900, cursor: 'pointer' };
const btnGray: React.CSSProperties = { background: '#eef2f7', color: '#334155', border: 'none', borderRadius: 14, padding: '14px 20px', fontWeight: 900, cursor: 'pointer' };
const dashed: React.CSSProperties = { width: '100%', border: '2px dashed #cbd5e1', background: '#fff', color: '#64748b', fontWeight: 800, padding: 16, borderRadius: 18, cursor: 'pointer' };
const input: React.CSSProperties = { border: '2px solid #e2e8f0', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 700, outline: 'none', fontFamily: 'inherit' };
