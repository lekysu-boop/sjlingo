'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useUser } from '@/hooks/useUser';
import { getProgress, sendCheer } from '@/lib/api';
import type { UserProgress, Profile } from '@/lib/types';

// 통계·응원 화면: 모든 사용자의 진도율 카드 + 선택 사용자의 월간 차트 + 응원.
export default function StatsPage() {
  const router = useRouter();
  const { userId } = useSession();
  const { users } = useUser();
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { if (userId === null) router.replace('/'); }, [userId, router]);

  // 모든 사용자 진도 병렬 로드
  useEffect(() => {
    users.forEach(async (u) => {
      if (!progress[u.id]) {
        try { setProgress((p) => ({ ...p, [u.id]: await getProgress(u.id) })); } catch {}
      }
    });
    if (!selected && userId) setSelected(userId);
  }, [users, userId]); // eslint-disable-line

  async function cheer(id: string) {
    const r = await sendCheer(id, userId ?? undefined);
    setProgress((p) => ({ ...p, [id]: { ...(p[id] as UserProgress), cheers: r.cheers } }));
  }

  const sel = users.find((u) => u.id === selected) ?? null;
  const selP = selected ? progress[selected] : undefined;

  return (
    <div style={wrap}><div style={phone}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.push('/home')} style={iconBtn}>←</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>학습 통계 · 응원</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>친구들과 서로 진도를 응원해요</div>
        </div>
      </div>

      {/* 사용자 진도 카드들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {users.map((u) => {
          const p = progress[u.id];
          const active = u.id === selected;
          return (
            <div key={u.id} style={{ background: '#fff', borderRadius: 18, padding: 14, boxShadow: '0 10px 26px -18px rgba(15,23,42,.3)', border: `2px solid ${active ? u.color : '#fff'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setSelected(u.id)} style={{ ...bare, flex: 1, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <span style={{ fontSize: 26 }}>{u.emoji}</span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 900, color: '#0f172a', textAlign: 'left' }}>{u.name}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>키워드 {p?.kwRate ?? 0}% · 기출 {p?.exRate ?? 0}%</span>
                  </span>
                </button>
                <Ring pct={p?.overall ?? 0} color={u.color} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setSelected(u.id)} style={{ ...smallBtn, background: '#f8fafc', color: '#475569' }}>📊 진도 상세</button>
                <button onClick={() => cheer(u.id)} style={{ ...smallBtn, background: '#fff7ed', color: '#ea580c' }}>👏 응원 {p?.cheers ?? 0}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 선택 사용자 상세 */}
      {sel && (
        <div style={{ animation: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>{sel.emoji} {sel.name}님의 상세</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <Stat big={`${selP?.kwRate ?? 0}%`} label="키워드 암기율" sub={`${selP?.known ?? 0} / ${selP?.totalKw ?? 0}개`} c="#2563eb" bg="#eff6ff" />
            <Stat big={`${selP?.exRate ?? 0}%`} label="기출 정답률" sub={`${selP?.exCorrect ?? 0} / ${selP?.exAnswered ?? 0}문항`} c="#7c3aed" bg="#f3e8ff" />
          </div>

          <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>📅 월간 학습량</div>
          {selP && selP.monthly.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 8, height: 150, background: '#f8fafc', borderRadius: 16, padding: '16px 12px 12px' }}>
              {selP.monthly.map((m, i) => {
                const max = Math.max(1, ...selP.monthly.map((x) => x.total));
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b' }}>{m.total}</div>
                    <div style={{ width: '60%', maxWidth: 26, height: `${(m.total / max) * 100}%`, background: 'linear-gradient(180deg,#3b82f6,#2563eb)', borderRadius: '7px 7px 0 0', minHeight: 4 }} />
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8' }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 13, padding: '20px 0', background: '#f8fafc', borderRadius: 16 }}>아직 학습 기록이 없어요. 학습을 시작하면 월별로 쌓여요!</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff7ed', borderRadius: 16, padding: 14, marginTop: 16 }}>
            <span style={{ fontSize: 26 }}>👏</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>받은 응원 {selP?.cheers ?? 0}개</div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>친구들이 보낸 응원이에요</div>
            </div>
            <button onClick={() => cheer(sel.id)} style={{ background: '#ea580c', color: '#fff', border: 'none', fontWeight: 900, fontSize: 13, padding: '10px 16px', borderRadius: 12, cursor: 'pointer' }}>응원 보내기</button>
          </div>
        </div>
      )}
    </div></div>
  );
}

const Ring = ({ pct, color }: { pct: number; color: string }) => {
  const off = (138.2 * (1 - pct / 100)).toFixed(1);
  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg viewBox="0 0 52 52" style={{ width: 52, height: 52, transform: 'rotate(-90deg)' }}>
        <circle cx="26" cy="26" r="22" fill="none" stroke="#eef2f7" strokeWidth="6" />
        <circle cx="26" cy="26" r="22" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray="138.2" strokeDashoffset={off} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{pct}%</div>
    </div>
  );
};
const Stat = ({ big, label, sub, c, bg }: { big: string; label: string; sub: string; c: string; bg: string }) => (
  <div style={{ flex: 1, background: bg, borderRadius: 16, padding: 16, textAlign: 'center' }}>
    <div style={{ fontSize: 28, fontWeight: 900, color: c }}>{big}</div>
    <div style={{ fontSize: 12, fontWeight: 800, color: c, marginTop: 2 }}>{label}</div>
    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginTop: 2 }}>{sub}</div>
  </div>
);

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const phone: React.CSSProperties = { width: 380, minHeight: 700, background: '#f4f6fa', borderRadius: 32, padding: '24px 20px', boxShadow: '0 30px 60px -30px rgba(15,23,42,.4)' };
const iconBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 12, background: '#fff', border: 'none', fontSize: 18, color: '#334155', cursor: 'pointer', boxShadow: '0 6px 16px -10px rgba(15,23,42,.4)' };
const bare: React.CSSProperties = { background: 'none', border: 'none', padding: 0 };
const smallBtn: React.CSSProperties = { flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 12.5, padding: 9, borderRadius: 11, border: 'none', cursor: 'pointer' };
