'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { getLeague } from '@/lib/api';
import { GamifyStyles } from '@/components/Gamify';
import { TabBar } from '@/components/TabBar';
import type { LeagueEntry } from '@/lib/types';

// 주간 리그·리더보드: 이번 주 XP 순위. 상위 3명 승급.
export default function LeaguePage() {
  const router = useRouter();
  const { userId } = useSession();
  const [league, setLeague] = useState<LeagueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (userId === null) router.replace('/'); }, [userId, router]);
  useEffect(() => {
    if (!userId) return;
    getLeague(userId).then((l) => { setLeague(l); setLoading(false); }).catch(() => setLoading(false));
  }, [userId]);

  const max = league.length ? Math.max(...league.map((p) => p.score), 1) : 1;

  return (
    <div className="app-wrap">
      <GamifyStyles />
      <div className="app-phone with-tabbar">
        <div style={{ textAlign: 'center', marginBottom: 16, paddingTop: 6 }}>
          <div style={{ fontSize: 44 }}>🏆</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#0f172a' }}>골드 리그</div>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700, lineHeight: 1.5 }}>이번 주 공부시간×3 + XP + 평균 정답률 합산 순위<br />상위 3명 승급!</div>
        </div>

        {loading && <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700, padding: '30px 0' }}>불러오는 중…</div>}
        {!loading && league.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 13, padding: '30px 20px', lineHeight: 1.6 }}>
            아직 이번 주 기록이 없어요.<br />학습을 시작하면 XP가 쌓이고 순위에 올라요!
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {league.map((p, i) => {
            const rankColor = i === 0 ? '#f59e0b' : i < 3 ? '#22c55e' : '#94a3b8';
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: p.me ? '#eff6ff' : '#fff', border: `2px solid ${p.me ? '#93c5fd' : '#f1f5f9'}`, borderRadius: 16, padding: '11px 14px', boxShadow: '0 6px 18px -14px rgba(15,23,42,.3)' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: rankColor, width: 26, textAlign: 'center', flexShrink: 0 }}>{p.rank}</div>
                <div style={{ fontSize: 24 }}>{p.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 900, color: '#0f172a' }}>{p.name}{p.me ? ' (나)' : ''}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', marginTop: 1 }}>⏱ {p.studyMin}분 · ⚡ {p.xp} XP · 🎯 평균 {p.quality}%</div>
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, marginTop: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(p.score / max * 100)}%`, background: p.me ? 'linear-gradient(90deg,#3b82f6,#22c55e)' : '#cbd5e1', borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{p.score}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>점</div>
                </div>
                {p.promote && <div style={{ fontSize: 15 }}>⬆️</div>}
              </div>
            );
          })}
        </div>

        <TabBar active="league" />
      </div>
    </div>
  );
}

