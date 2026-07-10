'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useKeywords } from '@/hooks/useKeywords';
import { useGamification } from '@/hooks/useGamification';
import { recordKeyword } from '@/lib/api';
import { GamifyStyles, GamifyHud, Confetti, XpFloat, ComboBadge } from '@/components/Gamify';
import { frontCode, GameMode } from '@/lib/gamemode';
import { pickRotating } from '@/lib/rotation';
import type { Keyword } from '@/lib/types';

type Phase = 'setup' | 'session' | 'done';

export default function KeywordStudyPage() {
  const router = useRouter();
  const { userId, subjectId } = useSession();
  const { items, eras, refresh } = useKeywords(userId, subjectId);
  const gam = useGamification(userId);

  const [phase, setPhase] = useState<Phase>('setup');
  const [era, setEra] = useState('전체');
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<GameMode>('full');

  const [deck, setDeck] = useState<Keyword[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [again, setAgain] = useState(0);
  const [combo, setCombo] = useState(0);
  const [heartBreak, setHeartBreak] = useState<number | null>(null);
  const [masks, setMasks] = useState<string[]>([]);

  useEffect(() => { if (userId === null) router.replace('/'); }, [userId, router]);
  useEffect(() => {
    if (gam.fx.kind === 'wrong') { setHeartBreak(gam.state?.hearts ?? null); const t = setTimeout(() => setHeartBreak(null), 600); return () => clearTimeout(t); }
  }, [gam.fx.seq]); // eslint-disable-line

  function start() {
    const filtered = items.filter((k) => era === '전체' || k.era === era);
    if (!filtered.length) return;
    // "최대한 중복 없이" 로테이션: 최근 출제 기록(seen)을 localStorage 에서 읽어
    // 안 본 키워드를 우선 출제하고, 순서도 무작위로 섞는다.
    const seenKey = `amgi_seen_kw_${userId}_${subjectId}_${era}`;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch {}
    const n = count === 999 ? filtered.length : Math.min(count, filtered.length);
    const result = pickRotating(filtered, seen, n);
    try { localStorage.setItem(seenKey, JSON.stringify(result.seen)); } catch {}
    const pool = result.picked;
    setDeck(pool);
    setMasks(pool.map((c) => frontCode(c.code, mode))); // partial 마스크를 카드별로 한 번 고정
    setIdx(0); setFlipped(false); setKnown(0); setAgain(0); setCombo(0);
    setPhase('session');
  }

  async function mark(isKnown: boolean) {
    const card = deck[idx];
    if (userId) recordKeyword(userId, card.id, isKnown).catch(() => {});
    if (isKnown) { setKnown((n) => n + 1); setCombo((c) => c + 1); gam.onCorrect(combo + 1); }
    else { setAgain((n) => n + 1); setCombo(0); gam.onWrong(); }
    if (idx + 1 >= deck.length) { setPhase('done'); gam.completeSession(); refresh(); }
    else { setIdx(idx + 1); setFlipped(false); }
  }

  const card = deck[idx];
  const front = mode === 'full' ? card?.code : masks[idx];

  return (
    <div style={wrap}><GamifyStyles /><div style={phone}>
      {/* 상단바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={() => router.push('/home')} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>키워드 인출 학습</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{items.length}개 등록됨</div>
        </div>
      </div>
      {phase === 'session' && <div style={{ marginBottom: 14 }}><GamifyHud state={gam.state} heartBreakIdx={heartBreak} /></div>}

      {phase === 'setup' && (items.length === 0 ? (
        <Empty onGo={() => router.push('/data')} />
      ) : (
        <>
          <Section title="📌 학습 범위">
            {eras.map((e) => (
              <Pick key={e} active={era === e} color="#2563eb" onClick={() => setEra(e)}>
                {e} <small style={{ opacity: .6 }}>{items.filter((k) => e === '전체' || k.era === e).length}</small>
              </Pick>
            ))}
          </Section>
          <Section title="🎮 암기코드 게임 모드">
            {([['full', '🔡 전체'], ['choseong', '🈳 초성만'], ['partial', '🎬 일부만']] as const).map(([m, label]) => (
              <Pick key={m} active={mode === m} color="#2563eb" onClick={() => setMode(m)} grow>{label}</Pick>
            ))}
          </Section>
          <Section title="🎯 한 번에 학습할 개수">
            {[10, 20, 30, 999].map((c) => (
              <Pick key={c} active={count === c} color="#2563eb" onClick={() => setCount(c)} grow>{c === 999 ? '전체' : c}</Pick>
            ))}
          </Section>
          <button onClick={start} style={primary('#2563eb')}>학습 시작하기</button>
        </>
      ))}

      {phase === 'session' && card && (
        <div style={{ position: 'relative' }}>
          <Confetti trigger={gam.fx.kind === 'correct' ? gam.fx.seq : 0} count={16} />
          <XpFloat trigger={gam.fx.kind === 'correct' ? gam.fx.seq : 0} amount={gam.fx.gainedXp ?? 0} />
          <Progress value={idx} total={deck.length} known={known} again={again} />
          <div style={{ marginTop: 8 }}><ComboBadge combo={combo} /></div>
          <div style={{ perspective: 1600, height: 340, marginTop: 12 }} onClick={() => setFlipped((f) => !f)}>
            <div style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform .55s', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'none', cursor: 'pointer' }}>
              {/* 앞면 */}
              <div style={{ ...face, background: '#fff', border: '1px solid #eef2f7' }}>
                <span style={pill('#eff6ff', '#2563eb')}>{card.era}</span>
                <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700, margin: '16px 0' }}>이 암기코드, 설명할 수 있나요?</div>
                {mode !== 'full' && <span style={pill('#eef2ff', '#4f46e5')}>🎮 {mode === 'choseong' ? '초성만' : '일부만'} 모드</span>}
                <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: 2, marginTop: 10, lineHeight: 1.35 }}>{front}</div>
                <div style={{ marginTop: 20, color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>👆 탭해서 설명 확인</div>
              </div>
              {/* 뒷면 */}
              <div style={{ ...face, transform: 'rotateY(180deg)', background: 'linear-gradient(160deg,#1e3a8a,#1d4ed8)', color: '#fff', overflow: 'auto', justifyContent: 'flex-start', textAlign: 'left' }}>
                <div style={{ fontSize: 21, fontWeight: 900, marginBottom: 12 }}>{card.code}</div>
                <div style={{ background: '#fbbf24', color: '#78350f', borderRadius: 16, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, marginBottom: 4 }}>📖 역사적 핵심 개념</div>
                  <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.4 }}>{card.concept}</div>
                </div>
                {card.principle && (
                  <div style={{ background: 'rgba(255,255,255,.12)', borderRadius: 16, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, opacity: .8, marginBottom: 4 }}>💡 연상 기법·매칭 원리</div>
                    <div style={{ fontSize: 14, lineHeight: 1.6 }}>{card.principle}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
            <button onClick={() => mark(false)} style={{ ...rate, background: '#fff', border: '2px solid #fecaca', color: '#dc2626' }}>❌ 다시 학습</button>
            <button onClick={() => mark(true)} style={{ ...rate, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>✅ 외웠음</button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ ...resultCard, position: 'relative', overflow: 'hidden' }}>
          <Confetti trigger={1} count={28} loop />
          <div style={{ fontSize: 44, animation: 'gm-jump 1.3s ease-in-out infinite', zIndex: 1 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', zIndex: 1 }}>키워드 학습 완료!</div>
          {gam.state && <div style={{ fontSize: 13, fontWeight: 800, color: '#ea580c', zIndex: 1 }}>🔥 {gam.state.streak}일 연속 · 🪙 +20</div>}
          <div style={{ display: 'flex', gap: 12, margin: '10px 0', zIndex: 1 }}>
            <Score n={known} label="외웠음" c="#16a34a" bg="#dcfce7" />
            <Score n={again} label="복습 대상" c="#dc2626" bg="#fee2e2" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setPhase('setup')} style={gray}>다시 설정</button>
            <button onClick={() => router.push('/home')} style={primary('#2563eb', true)}>홈으로</button>
          </div>
        </div>
      )}
    </div></div>
  );
}

function shuffle<T>(a: T[]): T[] { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const Empty = ({ onGo }: { onGo: () => void }) => (
  <div style={{ background: '#fff', borderRadius: 20, padding: '26px 20px', textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(15,23,42,.25)' }}>
    <div style={{ fontSize: 40 }}>📭</div>
    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '8px 0 4px' }}>등록된 키워드가 없어요</div>
    <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 14 }}>데이터 관리에서 기본 데이터를 넣거나 구글 시트를 연결해 주세요</div>
    <button onClick={onGo} style={primary('#2563eb', true)}>데이터 관리로 가기</button>
  </div>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{title}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
  </div>
);
const Pick = ({ active, color, onClick, children, grow }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode; grow?: boolean }) => (
  <button onClick={onClick} style={{ flex: grow ? 1 : undefined, fontSize: 14, fontWeight: 900, padding: grow ? '13px 0' : '9px 15px', borderRadius: 14, cursor: 'pointer', background: active ? color : '#fff', color: active ? '#fff' : '#475569', border: `2px solid ${active ? color : '#e2e8f0'}` }}>{children}</button>
);
const Progress = ({ value, total, known, again }: { value: number; total: number; known: number; again: number }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 10, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / total) * 100}%`, background: 'linear-gradient(90deg,#3b82f6,#22c55e)', borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 900, color: '#334155' }}>{value + 1}/{total}</span>
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <span style={{ flex: 1, textAlign: 'center', background: '#dcfce7', color: '#16a34a', borderRadius: 12, padding: 8, fontWeight: 800, fontSize: 13 }}>✅ 외웠음 {known}</span>
      <span style={{ flex: 1, textAlign: 'center', background: '#fee2e2', color: '#dc2626', borderRadius: 12, padding: 8, fontWeight: 800, fontSize: 13 }}>🔁 복습 {again}</span>
    </div>
  </div>
);
const Score = ({ n, label, c, bg }: { n: number; label: string; c: string; bg: string }) => (
  <div style={{ background: bg, borderRadius: 16, padding: '12px 20px', textAlign: 'center' }}>
    <div style={{ fontSize: 24, fontWeight: 900, color: c }}>{n}</div>
    <div style={{ fontSize: 12, fontWeight: 800, color: c }}>{label}</div>
  </div>
);

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const phone: React.CSSProperties = { width: 380, minHeight: 700, background: '#f4f6fa', borderRadius: 32, padding: '24px 20px', boxShadow: '0 30px 60px -30px rgba(15,23,42,.4)' };
const iconBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 12, background: '#fff', border: 'none', fontSize: 18, color: '#334155', cursor: 'pointer', boxShadow: '0 6px 16px -10px rgba(15,23,42,.4)' };
const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 28, boxShadow: '0 26px 50px -22px rgba(15,23,42,.35)', padding: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
const rate: React.CSSProperties = { flex: 1, border: 'none', borderRadius: 20, padding: 16, fontSize: 15, fontWeight: 900, cursor: 'pointer' };
const resultCard: React.CSSProperties = { background: '#fff', borderRadius: 28, padding: '30px 24px', boxShadow: '0 26px 50px -22px rgba(15,23,42,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', marginTop: 20 };
const gray: React.CSSProperties = { background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 14, padding: '13px 20px', borderRadius: 15, cursor: 'pointer' };
const pill = (bg: string, c: string): React.CSSProperties => ({ background: bg, color: c, fontWeight: 800, fontSize: 12, padding: '5px 12px', borderRadius: 99 });
const primary = (c: string, small = false): React.CSSProperties => ({ width: small ? undefined : '100%', flex: small ? 1 : undefined, background: c, color: '#fff', border: 'none', fontWeight: 900, fontSize: small ? 14 : 17, padding: small ? '13px 22px' : 17, borderRadius: small ? 15 : 18, cursor: 'pointer' });
