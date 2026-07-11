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
  const [submitting, setSubmitting] = useState(false); // 중복 클릭으로 같은 이름이 두 번 등록되는 것을 막는 잠금
  const [dupeConfirm, setDupeConfirm] = useState<string | null>(null); // 중복 이름 확인 대기 중이면 그 이름
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

  const normalizeName = (n: string) => n.trim().toLowerCase();

  // 이미 쓰이고 있는 이름이면 "이름 (2)", "이름 (3)"... 처럼 비어 있는 다음 번호를 붙인다.
  function nextAvailableName(base: string): string {
    const taken = new Set(users.map((u) => normalizeName(u.name)));
    if (!taken.has(normalizeName(base))) return base;
    let i = 2;
    while (taken.has(normalizeName(`${base} (${i})`))) i++;
    return `${base} (${i})`;
  }

  async function doCreate(finalName: string) {
    if (submitting) return; // 등록 중 중복 클릭으로 같은 이름이 두 번 만들어지는 것을 막는다
    setSubmitting(true);
    try {
      const u = await createUser({ name: finalName, emoji: '🦊', color: '#2563eb' });
      await refresh();
      setName('');
      setRegistering(false);
      setDupeConfirm(null);
      login(u.id);
      setUserId(u.id);
      router.push('/onboarding'); // 신규 계정은 홈 화면 전에 웰컴 가이드를 한 번 보여준다
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    const isDuplicate = users.some((u) => normalizeName(u.name) === normalizeName(trimmed));
    if (isDuplicate) { setDupeConfirm(trimmed); return; }
    await doCreate(trimmed);
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
              <button onClick={() => setRegistering(false)} disabled={submitting} style={btnGray}>취소</button>
              <button onClick={handleCreate} disabled={submitting} style={{ ...btn, flex: 1, opacity: submitting ? .6 : 1 }}>{submitting ? '등록 중…' : '등록하고 시작'}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setRegistering(true)} style={dashed}>＋ 신규 사용자 등록</button>
        )}
      </div>

      {/* 이미 같은 이름의 사용자가 있을 때만 뜨는 중복 확인 모달 */}
      {dupeConfirm && (
        <div onClick={() => !submitting && setDupeConfirm(null)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: '#fff', borderRadius: 22, padding: '24px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 38 }}>🤔</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: '8px 0 6px' }}>이미 있는 이름이에요</div>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, lineHeight: 1.6, marginBottom: 18 }}>
              &lsquo;{dupeConfirm}&rsquo; 이름의 사용자가 이미 있어요.<br />그래도 새 사용자로 등록할까요?<br />
              <b style={{ color: '#0f172a' }}>&lsquo;{nextAvailableName(dupeConfirm)}&rsquo;</b> 이름으로 등록돼요.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDupeConfirm(null)} disabled={submitting} style={{ flex: 1, background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 14, padding: 14, borderRadius: 14, cursor: 'pointer' }}>취소</button>
              <button onClick={() => doCreate(nextAvailableName(dupeConfirm))} disabled={submitting} style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 900, fontSize: 14, padding: 14, borderRadius: 14, cursor: 'pointer', opacity: submitting ? .6 : 1 }}>{submitting ? '등록 중…' : '등록'}</button>
            </div>
          </div>
        </div>
      )}
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
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16 };
