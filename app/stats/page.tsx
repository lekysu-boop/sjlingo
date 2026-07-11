'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useUser } from '@/hooks/useUser';
import { getProgress, sendCheer } from '@/lib/api';
import { TabBar } from '@/components/TabBar';
import type { UserProgress, Profile } from '@/lib/types';

// 통계·응원 화면: 모든 사용자의 진도율 카드 + 선택 사용자의 월간 차트 + 응원.
export default function StatsPage() {
  const router = useRouter();
  const { userId } = useSession();
  const { users } = useUser();
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null); // 응원 제한 등 안내 메시지

  useEffect(() => { if (userId === null) router.replace('/'); }, [userId, router]);

  // 모든 사용자 진도 병렬 로드
  useEffect(() => {
    users.forEach(async (u) => {
      if (!progress[u.id]) {
        try {
          const p = await getProgress(u.id);
          setProgress((prev) => ({ ...prev, [u.id]: p }));
        } catch {}
      }
    });
    if (!selected && userId) setSelected(userId);
  }, [users, userId]); // eslint-disable-line

  async function cheer(id: string) {
    try {
      const r = await sendCheer(id, userId ?? undefined);
      setProgress((p) => ({ ...p, [id]: { ...(p[id] as UserProgress), cheers: r.cheers } }));
    } catch (e: any) {
      // 자기 응원 금지 / 하루 2회 제한 등 서버 메시지를 그대로 보여준다
      setToast(e.message);
      setTimeout(() => setToast(null), 2500);
    }
  }

  const sel = users.find((u) => u.id === selected) ?? null;
  const selP = selected ? progress[selected] : undefined;

  return (
    <div className="app-wrap"><div className="app-phone with-tabbar">
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
          <div style={{ fontSize: 15.5, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>{sel.emoji} {sel.name}님의 상세</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <Stat big={`${selP?.kwRate ?? 0}%`} label="키워드 암기율" sub="세션 가중평균" c="#2563eb" bg="#eff6ff" />
            <Stat big={`${selP?.exRate ?? 0}%`} label="기출 정답률" sub="세션 가중평균" c="#7c3aed" bg="#f3e8ff" />
            <Stat big={fmtMin(selP?.studyMin ?? 0)} label="공부시간" sub="문제 푼 시간" c="#0d9488" bg="#f0fdfa" />
          </div>

          {/* 과목별 통계 — 학습 세션을 과목 단위로 집계 (XP·코인은 세션 기록 환산치) */}
          {selP && selP.bySubject.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {selP.bySubject.map((s) => (
                <div key={s.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', boxShadow: '0 6px 18px -14px rgba(15,23,42,.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 21 }}>{s.emoji}</span>
                    <div style={{ flex: 1, fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{s.name}</div>
                    <div style={{ fontSize: 14.5, fontWeight: 900, color: '#0d9488', flexShrink: 0 }}>⏱ {fmtMin(s.studyMin)}</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                    <MiniStat c="#2563eb" bg="#eff6ff">📖 암기율 {s.kwRate === null ? '–' : `${s.kwRate}%`}</MiniStat>
                    <MiniStat c="#7c3aed" bg="#f3e8ff">📝 정답률 {s.exRate === null ? '–' : `${s.exRate}%`}</MiniStat>
                    <MiniStat c="#16a34a" bg="#dcfce7">⚡ {s.xp} XP</MiniStat>
                    <MiniStat c="#ca8a04" bg="#fefce8">🪙 {s.coins}</MiniStat>
                    <MiniStat c="#64748b" bg="#f1f5f9">{s.sessions}세션</MiniStat>
                  </div>
                </div>
              ))}
            </div>
          )}

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

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 96, transform: 'translateX(-50%)', background: '#0f172a', color: '#fff', fontSize: 13.5, fontWeight: 800, padding: '12px 18px', borderRadius: 14, zIndex: 60, boxShadow: '0 10px 26px -10px rgba(15,23,42,.5)', whiteSpace: 'nowrap' }}>{toast}</div>
      )}

      <TabBar active="stats" />
    </div></div>
  );
}

// 과목별 카드 안의 작은 지표 칩
const MiniStat = ({ c, bg, children }: { c: string; bg: string; children: React.ReactNode }) => (
  <span style={{ fontSize: 12, fontWeight: 800, color: c, background: bg, padding: '5px 10px', borderRadius: 99 }}>{children}</span>
);

// 분 → "N시간 M분" / "M분" 표기
const fmtMin = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`);

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
  <div style={{ flex: 1, background: bg, borderRadius: 16, padding: '14px 8px', textAlign: 'center', minWidth: 0 }}>
    {/* "1시간 24분" 같은 긴 값은 자동으로 한 단계 작게 */}
    <div style={{ fontSize: big.length > 5 ? 17 : 26, fontWeight: 900, color: c, lineHeight: 1.3 }}>{big}</div>
    <div style={{ fontSize: 12.5, fontWeight: 800, color: c, marginTop: 2 }}>{label}</div>
    <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 700, marginTop: 2 }}>{sub}</div>
  </div>
);

const iconBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 12, background: '#fff', border: 'none', fontSize: 18, color: '#334155', cursor: 'pointer', boxShadow: '0 6px 16px -10px rgba(15,23,42,.4)' };
const bare: React.CSSProperties = { background: 'none', border: 'none', padding: 0 };
const smallBtn: React.CSSProperties = { flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 12.5, padding: 9, borderRadius: 11, border: 'none', cursor: 'pointer' };
