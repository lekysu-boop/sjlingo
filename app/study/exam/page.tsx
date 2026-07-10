'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useExams } from '@/hooks/useExams';
import { useGamification } from '@/hooks/useGamification';
import { recordAttempt } from '@/lib/api';
import { GamifyStyles, GamifyHud, Confetti, XpFloat, ComboBadge } from '@/components/Gamify';
import { pickRotating } from '@/lib/rotation';
import type { ExamQuestion } from '@/lib/types';

type Phase = 'setup' | 'session' | 'done';
const NUMS = ['①', '②', '③', '④', '⑤'];

export default function ExamStudyPage() {
  const router = useRouter();
  const { userId, subjectId } = useSession();
  const { items, eras, refresh } = useExams(userId, subjectId);
  const gam = useGamification(userId);

  const [phase, setPhase] = useState<Phase>('setup');
  const [era, setEra] = useState('전체');
  const [count, setCount] = useState(10);

  const [deck, setDeck] = useState<ExamQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [combo, setCombo] = useState(0);
  const [heartBreak, setHeartBreak] = useState<number | null>(null);

  useEffect(() => { if (userId === null) router.replace('/'); }, [userId, router]);

  // 오답 시 하트가 깨지는 표시를 잠깐 노출
  useEffect(() => {
    if (gam.fx.kind === 'wrong') { setHeartBreak(gam.state?.hearts ?? null); const t = setTimeout(() => setHeartBreak(null), 600); return () => clearTimeout(t); }
  }, [gam.fx.seq]); // eslint-disable-line

  function start() {
    const filtered = items.filter((q) => era === '전체' || q.era === era);
    if (!filtered.length) return;
    // "최대한 중복 없이" 로테이션: 안 본 문제를 우선 출제 + 순서 무작위
    const seenKey = `amgi_seen_ex_${userId}_${subjectId}_${era}`;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch {}
    const n = count === 999 ? filtered.length : Math.min(count, filtered.length);
    const result = pickRotating(filtered, seen, n);
    try { localStorage.setItem(seenKey, JSON.stringify(result.seen)); } catch {}
    // 보기 순서를 섞어 정답 위치를 세션 전체에 고르게 분산
    const pool = balanceAnswers(result.picked);
    setDeck(pool); setIdx(0); setPick(null); setCorrect(0); setWrong(0); setCombo(0);
    setPhase('session');
  }

  function choose(i: number) {
    if (pick !== null) return;
    const q = deck[idx];
    const right = i === q.answer;
    setPick(i);
    if (right) { setCorrect((n) => n + 1); setCombo((c) => c + 1); gam.onCorrect(combo + 1); }
    else { setWrong((n) => n + 1); setCombo(0); gam.onWrong(); }
    if (userId) recordAttempt(userId, q.id, right).catch(() => {});
  }

  function next() {
    if (idx + 1 >= deck.length) { setPhase('done'); gam.completeSession(); refresh(); }
    else { setIdx(idx + 1); setPick(null); }
  }

  const q = deck[idx];
  const isRight = pick !== null && pick === q?.answer;
  const isLast = idx + 1 >= deck.length;

  return (
    <div style={wrap}><GamifyStyles /><div style={phone}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={() => router.push('/home')} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>기출문제 풀이</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{items.length}문항 등록됨</div>
        </div>
      </div>
      {phase === 'session' && <div style={{ marginBottom: 14 }}><GamifyHud state={gam.state} heartBreakIdx={heartBreak} /></div>}

      {phase === 'setup' && (items.length === 0 ? (
        <Empty onGo={() => router.push('/data')} />
      ) : (
        <>
          <Section title="🏛️ 학습 범위">
            {eras.map((e) => (
              <Pick key={e} active={era === e} onClick={() => setEra(e)}>
                {e} <small style={{ opacity: .6 }}>{items.filter((q) => e === '전체' || q.era === e).length}</small>
              </Pick>
            ))}
          </Section>
          <Section title="🎯 풀이할 문항 수">
            {[5, 10, 20, 999].map((c) => (
              <Pick key={c} active={count === c} onClick={() => setCount(c)} grow>{c === 999 ? '전체' : c}</Pick>
            ))}
          </Section>
          <button onClick={start} style={primary}>문제 풀이 시작</button>
        </>
      ))}

      {phase === 'session' && q && (
        <div style={{ position: 'relative' }}>
          <Confetti trigger={gam.fx.kind === 'correct' ? gam.fx.seq : 0} count={16} />
          <XpFloat trigger={gam.fx.kind === 'correct' ? gam.fx.seq : 0} amount={gam.fx.gainedXp ?? 0} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 10, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(idx / deck.length) * 100}%`, background: 'linear-gradient(90deg,#8b5cf6,#6d28d9)', borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#334155' }}>{idx + 1}/{deck.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
            <span style={{ flex: 1, textAlign: 'center', background: '#dcfce7', color: '#16a34a', borderRadius: 12, padding: 8, fontWeight: 800, fontSize: 13 }}>✅ 정답 {correct}</span>
            <span style={{ flex: 1, textAlign: 'center', background: '#fee2e2', color: '#dc2626', borderRadius: 12, padding: 8, fontWeight: 800, fontSize: 13 }}>❌ 오답 {wrong}</span>
          </div>
          <ComboBadge combo={combo} />

          <span style={{ display: 'inline-block', background: '#f3e8ff', color: '#7c3aed', fontWeight: 800, fontSize: 12, padding: '6px 13px', borderRadius: 99, margin: '10px 0 12px' }}>{q.era}</span>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', lineHeight: 1.5, marginBottom: 18 }}>Q. {q.question}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {q.options.map((o, i) => {
              let bg = '#fff', border = '#e2e8f0', color = '#0f172a', mark = '';
              if (pick !== null) {
                if (i === q.answer) { bg = '#dcfce7'; border = '#22c55e'; color = '#15803d'; mark = '✓'; }
                else if (i === pick) { bg = '#fee2e2'; border = '#ef4444'; color = '#b91c1c'; mark = '✕'; }
              }
              return (
                <button key={i} onClick={() => choose(i)} disabled={pick !== null} style={{ display: 'flex', alignItems: 'center', gap: 13, background: bg, border: `2px solid ${border}`, color, borderRadius: 16, padding: '15px 16px', cursor: pick === null ? 'pointer' : 'default', textAlign: 'left', fontSize: 16, fontWeight: 700 }}>
                  <span style={{ fontSize: 18 }}>{NUMS[i]}</span>
                  <span style={{ flex: 1 }}>{o}</span>
                  {mark && <span style={{ fontWeight: 900 }}>{mark}</span>}
                </button>
              );
            })}
          </div>

          {pick !== null && (
            <div style={{ marginTop: 16, background: isRight ? '#dcfce7' : '#fef2f2', borderRadius: 16, padding: 15 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: isRight ? '#16a34a' : '#dc2626', marginBottom: 5 }}>{isRight ? '✅ 정답이에요!' : '❌ 오답 · 복습함에 추가됐어요'}</div>
              {q.explain && <div style={{ fontSize: 14, color: '#334155', fontWeight: 500, lineHeight: 1.55 }}>{q.explain}</div>}
              <button onClick={next} style={{ marginTop: 12, width: '100%', background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 900, fontSize: 15, padding: 13, borderRadius: 14, cursor: 'pointer' }}>{isLast ? '결과 보기 →' : '다음 문제 →'}</button>
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div style={{ ...resultCard, position: 'relative', overflow: 'hidden' }}>
          <Confetti trigger={1} count={28} loop />
          <div style={{ fontSize: 44, animation: 'gm-jump 1.3s ease-in-out infinite', zIndex: 1 }}>🏆</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', zIndex: 1 }}>기출 풀이 완료!</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed', zIndex: 1 }}>정답률 {Math.round((correct / deck.length) * 100)}%</div>
          {gam.state && <div style={{ fontSize: 13, fontWeight: 800, color: '#ea580c', zIndex: 1 }}>🔥 {gam.state.streak}일 연속 · 🪙 +20</div>}
          <div style={{ display: 'flex', gap: 12, margin: '10px 0', zIndex: 1 }}>
            <Score n={correct} label="정답" c="#16a34a" bg="#dcfce7" />
            <Score n={wrong} label="복습 대상" c="#dc2626" bg="#fee2e2" />
          </div>
          <div style={{ display: 'flex', gap: 10, zIndex: 1 }}>
            <button onClick={() => setPhase('setup')} style={gray}>다시 설정</button>
            <button onClick={() => router.push('/home')} style={{ ...primary, width: undefined, flex: 1, fontSize: 14, padding: '13px 22px' }}>홈으로</button>
          </div>
        </div>
      )}
    </div></div>
  );
}

function shuffle<T>(a: T[]): T[] { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ----------------------------------------------------------------------------
//  balanceAnswers — 정답 보기의 "위치"를 세션 전체에 고르게 분산
// ----------------------------------------------------------------------------
//  문제 데이터의 정답이 특정 번호(예: 항상 1번)에 몰려 있으면, 학습자가 내용을
//  안 보고 "감"으로 찍게 됩니다. 이를 막기 위해, 각 문제의 보기 순서를 섞되
//  "정답이 몇 번 자리에 오는지"를 세션 내에서 최대한 균등하게 맞춥니다.
//  (예: 20문제면 1·2·3·4번 자리에 정답이 약 5개씩 분포)
//
//  방법: 지금까지 각 자리(0,1,2,3,4)가 정답으로 쓰인 횟수를 세어두고, 다음 문제의
//  정답을 "가장 덜 쓰인 자리"에 놓습니다. 나머지 보기는 남은 자리에 무작위로 채웁니다.
//  보기 개수가 다른 문제(4지/5지)가 섞여 있어도 각 문제의 보기 수 범위 안에서 처리됩니다.
function balanceAnswers(questions: ExamQuestion[]): ExamQuestion[] {
  const usage: number[] = []; // usage[p] = p번 자리가 정답으로 쓰인 횟수
  const usedCount = (p: number) => usage[p] ?? 0;

  return questions.map((q) => {
    const n = q.options.length;

    // 1) 0..n-1 자리 중 "가장 덜 쓰인" 자리를 정답 위치로 선택 (동점이면 무작위)
    let target = 0;
    let min = Infinity;
    for (let p = 0; p < n; p++) {
      const c = usedCount(p);
      if (c < min || (c === min && Math.random() < 0.5)) { min = c; target = p; }
    }
    usage[target] = usedCount(target) + 1;

    // 2) 정답과 오답들을 분리하고, 오답은 무작위로 섞음
    const correctText = q.options[q.answer];
    const others = shuffle(q.options.filter((_, i) => i !== q.answer));

    // 3) 새 보기 배열: target 자리에 정답, 나머지 자리에 섞인 오답을 순서대로 채움
    const newOptions: string[] = [];
    let oi = 0;
    for (let p = 0; p < n; p++) {
      newOptions[p] = p === target ? correctText : others[oi++];
    }

    return { ...q, options: newOptions, answer: target };
  });
}

const Empty = ({ onGo }: { onGo: () => void }) => (
  <div style={{ background: '#fff', borderRadius: 20, padding: '26px 20px', textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(15,23,42,.25)' }}>
    <div style={{ fontSize: 40 }}>📭</div>
    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '8px 0 4px' }}>등록된 문제가 없어요</div>
    <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 14 }}>데이터 관리에서 기본 데이터를 넣거나 구글 시트를 연결해 주세요</div>
    <button onClick={onGo} style={{ ...primary, width: undefined, fontSize: 14, padding: '13px 22px' }}>데이터 관리로 가기</button>
  </div>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{title}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
  </div>
);
const Pick = ({ active, onClick, children, grow }: { active: boolean; onClick: () => void; children: React.ReactNode; grow?: boolean }) => (
  <button onClick={onClick} style={{ flex: grow ? 1 : undefined, fontSize: 14, fontWeight: 900, padding: grow ? '14px 0' : '9px 15px', borderRadius: 14, cursor: 'pointer', background: active ? '#7c3aed' : '#fff', color: active ? '#fff' : '#475569', border: `2px solid ${active ? '#7c3aed' : '#e2e8f0'}` }}>{children}</button>
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
const resultCard: React.CSSProperties = { background: '#fff', borderRadius: 28, padding: '30px 24px', boxShadow: '0 26px 50px -22px rgba(15,23,42,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', marginTop: 20 };
const gray: React.CSSProperties = { background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 14, padding: '13px 20px', borderRadius: 15, cursor: 'pointer' };
const primary: React.CSSProperties = { width: '100%', background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 900, fontSize: 17, padding: 17, borderRadius: 18, cursor: 'pointer' };
