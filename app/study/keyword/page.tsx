'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useSubjects } from '@/hooks/useSubjects';
import { useKeywords } from '@/hooks/useKeywords';
import { useGamification } from '@/hooks/useGamification';
import { recordKeyword, recordSession } from '@/lib/api';
import { GamifyStyles, GamifyHud, HeartsGate, Confetti, XpFloat, ComboBadge, Mascot } from '@/components/Gamify';
import { frontCode, GameMode } from '@/lib/gamemode';
import { pickRotating } from '@/lib/rotation';
import { heartCost } from '@/lib/gamify';
import { loadSrs, saveSrs, srsReview, dueItems, type SrsMap } from '@/lib/srs';
import { bumpQuestSession, bumpQuestCombo } from '@/lib/quests';
import { playCorrect, playCombo, playWrong, playFinish, isSoundOn, toggleSound } from '@/lib/sound';
import { loadDefaultKeywords } from '@/lib/defaultDataLoad';
import { isKoreanHistorySubject, isEnglishWordSubject } from '@/lib/defaultData';
import type { Keyword } from '@/lib/types';

type Phase = 'setup' | 'session' | 'done';

// ============================================================================
//  PROGRAM 1: 키워드 인출 학습
// ----------------------------------------------------------------------------
//  화면은 phase 하나로 setup -> session -> done 상태를 전환합니다.
//  Supabase에는 학습 이벤트/세션 통계를, localStorage에는 개인 기기용 SRS 복습일과
//  최근 출제 순서를 저장합니다. 즉, 서버 데이터는 통계의 원천이고 로컬 데이터는
//  다음 문제를 고르는 보조 기억장치입니다. 전체 추적 실습은 PROJECT_STUDY_GUIDE.md 참고.
// ============================================================================
export default function KeywordStudyPage() {
  const router = useRouter();
  const { userId, subjectId, ready } = useSession();
  const { current: currentSubject } = useSubjects(userId, subjectId);
  const { items, eras, loading, refresh: refreshKeywords } = useKeywords(userId, subjectId);
  const gam = useGamification(userId);

  // 화면 진입 시 등록된 키워드가 하나도 없으면, 데이터 관리로 나가지 않고
  // 이 자리에서 바로 기본 데이터를 불러올 수 있게 한다.
  const [loadingDefault, setLoadingDefault] = useState(false);
  const [loadDoneMsg, setLoadDoneMsg] = useState<string | null>(null);
  const defaultKeywordLabel = isKoreanHistorySubject(currentSubject?.name)
    ? '한국사 암기코드'
    : isEnglishWordSubject(currentSubject?.name)
      ? '영어 단어'
      : '기본 키워드';

  async function loadDefault() {
    if (!userId || !subjectId) return;
    setLoadingDefault(true); setLoadDoneMsg(null);
    try {
      const r = await loadDefaultKeywords(userId, subjectId, currentSubject?.name);
      await refreshKeywords();
      setLoadDoneMsg(`✅ ${r.label} ${r.added}개를 불러왔어요. 이제 학습할 수 있어요!`);
    } catch (e: any) {
      setLoadDoneMsg('⚠️ ' + e.message);
    } finally {
      setLoadingDefault(false);
    }
  }

  useEffect(() => {
    if (!loadDoneMsg) return;
    const t = setTimeout(() => setLoadDoneMsg(null), 4000);
    return () => clearTimeout(t);
  }, [loadDoneMsg]);

  const [phase, setPhase] = useState<Phase>('setup');
  const [era, setEra] = useState('전체');
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<GameMode>('full');
  const [imp, setImp] = useState(0); // 중요도 필터: 0=전체, 2=★★ 이상, 3=★★★만

  const [deck, setDeck] = useState<Keyword[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [again, setAgain] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0); // 연속 오답 수 (마스코트 위로 메시지용)
  // 세션 하트: 학습을 시작할 때마다 5개로 리셋. 틀리면 중요도 상=1개, 중/하=0.5개 소모.
  // 0이 되면 계속할지 묻고(gate), "그만하기"를 고르면 그 자리에서 세션을 종료한다.
  const [hearts, setHearts] = useState(5);
  const [heartBreak, setHeartBreak] = useState<number | null>(null);
  const [endedByHearts, setEndedByHearts] = useState(false);
  const [heartsExhausted, setHeartsExhausted] = useState(false); // 이미 한 번 계속하기를 선택했는지 (재확인 방지)
  const [heartsGate, setHeartsGate] = useState<{ finalKnown: number; nextIdx: number } | null>(null);
  const [earnedCoins, setEarnedCoins] = useState(0); // 이번 세션 공부시간 코인
  const [masks, setMasks] = useState<string[]>([]);
  // 망각곡선(SRS) 상태: keywordId → { box, due }. localStorage 에서 불러온다.
  const [srsMap, setSrsMap] = useState<SrsMap>({});
  const [sound, setSound] = useState(true);
  const startedAt = useRef(0); // 세션 시작 시각 (공부시간 계산용)

  useEffect(() => { if (ready && userId === null) router.replace('/'); }, [ready, userId, router]);
  useEffect(() => { setSrsMap(loadSrs(userId, subjectId)); }, [userId, subjectId]);
  useEffect(() => { setSound(isSoundOn()); }, []);

  // 선택한 범위(분류 + 중요도) 안에서 "오늘 복습할" 카드 (예정일 지난 것 + 새 카드)
  // 하트 애니메이션 타이머 등 무관한 상태 변화로 리렌더될 때마다 최대 1700개
  // 배열을 다시 필터링하지 않도록, 실제로 바뀌는 값에만 의존해 재계산한다.
  const scoped = useMemo(
    () => items.filter((k) => (era === '전체' || k.era === era) && (imp === 0 || (k.importance ?? 2) >= imp)),
    [items, era, imp],
  );
  const due = useMemo(() => dueItems(scoped, srsMap), [scoped, srsMap]);
  const eraCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.era, (counts.get(item.era) ?? 0) + 1));
    // 실제 시트 데이터에 "전체"라는 분류값이 섞여 있어도(예: 요약 행) 등록 개수와
    // 어긋나지 않도록 항상 마지막에 실제 전체 개수로 덮어쓴다.
    counts.set('전체', items.length);
    return counts;
  }, [items]);

  // review=true 면 망각곡선상 복습 예정 카드만으로 세션을 구성한다.
  function start(review = false) {
    const filtered = review ? due : scoped;
    if (!filtered.length) return;
    const n = count === 999 ? filtered.length : Math.min(count, filtered.length);
    let pool: Keyword[];
    if (review) {
      // 복습 모드: 가장 오래 밀린 카드부터 (dueItems 가 이미 그 순서)
      pool = filtered.slice(0, n);
    } else {
      // "최대한 중복 없이" 로테이션: 최근 출제 기록(seen)을 localStorage 에서 읽어
      // 안 본 키워드를 우선 출제하고, 순서도 무작위로 섞는다.
      const seenKey = `amgi_seen_kw_${userId}_${subjectId}_${era}`;
      let seen: string[] = [];
      try { seen = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch {}
      const result = pickRotating(filtered, seen, n);
      try { localStorage.setItem(seenKey, JSON.stringify(result.seen)); } catch {}
      pool = result.picked;
    }
    setDeck(pool);
    setMasks(pool.map((c) => frontCode(c.code, mode))); // partial 마스크를 카드별로 한 번 고정
    setIdx(0); setFlipped(false); setKnown(0); setAgain(0); setCombo(0); setWrongStreak(0);
    setHearts(5); setEndedByHearts(false); setEarnedCoins(0); // 세션 하트 리셋
    setHeartsExhausted(false); setHeartsGate(null);
    startedAt.current = Date.now();
    setPhase('session');
  }

  // 세션 종료 공통 처리: 스트릭·시간 코인·퀘스트·통계 기록
  function finishSession(finalKnown: number, attempted: number, byHearts: boolean) {
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    setEndedByHearts(byHearts);
    setPhase('done');
    gam.completeSession(durationSec / 60).then((r) => setEarnedCoins(r?.gainedCoins ?? 0));
    bumpQuestSession(userId);
    playFinish();
    // 세션 결과 기록 → 통계(공부시간·가중평균)와 리그 순위의 원천
    if (userId && subjectId) {
      recordSession({ userId, subjectId, kind: 'kw', total: attempted, correct: finalKnown, durationSec }).catch(() => {});
    }
  }

  async function mark(isKnown: boolean) {
    const card = deck[idx];
    if (userId) recordKeyword(userId, card.id, isKnown).catch(() => {});
    // 망각곡선 반영: 외웠으면 복습 간격을 늘리고, 못 외웠으면 처음부터
    const nextMap = { ...srsMap, [card.id]: srsReview(srsMap[card.id], isKnown) };
    setSrsMap(nextMap);
    saveSrs(userId, subjectId, nextMap);

    let heartsLeft = hearts;
    if (isKnown) {
      const c = combo + 1;
      setKnown((n) => n + 1); setCombo(c); setWrongStreak(0); gam.onCorrect(c);
      bumpQuestCombo(userId, c);
      c >= 3 ? playCombo() : playCorrect();
    } else {
      setWrongStreak((w) => w + 1);
      // 세션 하트 소모(중요도 상=1개, 중/하=0.5개) + 깨지는 애니메이션
      heartsLeft = Math.max(0, hearts - heartCost(card.importance ?? 2));
      setHearts(heartsLeft);
      setHeartBreak(heartsLeft);
      setTimeout(() => setHeartBreak(null), 600);
      setAgain((n) => n + 1); setCombo(0); gam.onWrong();
      playWrong();
    }

    const finalKnown = known + (isKnown ? 1 : 0);
    const nextIdx = idx + 1;
    if (!isKnown && heartsLeft <= 0 && !heartsExhausted && nextIdx < deck.length) {
      // 하트가 처음 바닥났고 아직 남은 카드가 있으면 계속할지 물어본다
      setHeartsGate({ finalKnown, nextIdx });
    } else if (nextIdx >= deck.length) {
      finishSession(finalKnown, deck.length, false);
    } else { setIdx(nextIdx); setFlipped(false); }
  }

  function continueAfterHeartsGate() {
    if (!heartsGate) return;
    setHeartsExhausted(true);
    setIdx(heartsGate.nextIdx); setFlipped(false);
    setHeartsGate(null);
  }

  function stopAfterHeartsGate() {
    if (!heartsGate) return;
    finishSession(heartsGate.finalKnown, heartsGate.nextIdx, true); // 여기까지 푼 것만 기록
    setHeartsGate(null);
  }

  const card = deck[idx];
  const front = mode === 'full' ? card?.code : masks[idx];

  return (
    <div className="app-wrap"><GamifyStyles /><div className="app-phone">
      {/* 상단바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={() => router.push('/home')} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>키워드 인출 학습</div>
          <div style={{ fontSize: 13.5, color: '#94a3b8', fontWeight: 600 }}>{items.length}개 등록됨</div>
        </div>
        <button onClick={() => setSound(toggleSound())} style={iconBtn} title="효과음 켜기/끄기">{sound ? '🔊' : '🔇'}</button>
      </div>
      {phase === 'session' && <div style={{ marginBottom: 14 }}><GamifyHud state={gam.state} hearts={hearts} heartBreakIdx={heartBreak} /></div>}
      {heartsGate && <HeartsGate onContinue={continueAfterHeartsGate} onStop={stopAfterHeartsGate} />}

      {phase === 'setup' && loadDoneMsg && (
        <div aria-live="polite" style={{ marginBottom: 14, fontSize: 12.5, fontWeight: 800, color: loadDoneMsg.startsWith('⚠️') ? '#dc2626' : '#16a34a', background: loadDoneMsg.startsWith('⚠️') ? '#fef2f2' : '#dcfce7', padding: '10px 12px', borderRadius: 11 }}>{loadDoneMsg}</div>
      )}

      {phase === 'setup' && (loading ? (
        <LoadingState label="키워드를 불러오는 중…" />
      ) : items.length === 0 ? (
        <EmptyKeyword busy={loadingDefault} label={defaultKeywordLabel} onLoadDefault={loadDefault} onGo={() => router.push('/data')} />
      ) : (
        <>
          {/* 오늘의 복습 — 망각곡선상 "지금 다시 봐야 기억이 굳는" 카드들 */}
          {due.length > 0 && (
            <button onClick={() => start(true)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', borderRadius: 20, padding: '16px 18px', marginBottom: 18, color: '#fff', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 14px 30px -12px rgba(14,165,233,.55)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>🧠</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>오늘의 복습 {due.length}개</div>
                  <div style={{ fontSize: 11.5, opacity: .9, fontWeight: 700, marginTop: 2 }}>잊어버리기 직전에 다시 보면 기억이 오래가요 (망각곡선)</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 900, background: 'rgba(255,255,255,.22)', padding: '8px 12px', borderRadius: 12 }}>시작 →</span>
              </div>
            </button>
          )}
          <Section title="📌 학습 범위">
            {eras.map((e) => (
              <Pick key={e} active={era === e} color="#2563eb" onClick={() => setEra(e)}>
                {e} <small style={{ opacity: .6 }}>{eraCounts.get(e) ?? 0}</small>
              </Pick>
            ))}
          </Section>
          <Section title="⭐ 중요도">
            {([[0, '전체'], [2, '★★ 이상'], [3, '★★★만']] as const).map(([v, label]) => (
              <Pick key={v} active={imp === v} color="#2563eb" onClick={() => setImp(v)} grow>{label}</Pick>
            ))}
          </Section>
          <Section title="🎮 키워드 게임 모드">
            {([['full', '🔡 전체'], ['choseong', '🈳 초성만'], ['partial', '🎬 일부만']] as const).map(([m, label]) => (
              <Pick key={m} active={mode === m} color="#2563eb" onClick={() => setMode(m)} grow>{label}</Pick>
            ))}
          </Section>
          <Section title="🎯 한 번에 학습할 개수">
            {[10, 20, 30, 999].map((c) => (
              <Pick key={c} active={count === c} color="#2563eb" onClick={() => setCount(c)} grow>{c === 999 ? '전체' : c}</Pick>
            ))}
          </Section>
          <button onClick={() => start()} style={primary('#2563eb')}>학습 시작하기</button>
        </>
      ))}

      {phase === 'session' && card && (
        <div style={{ position: 'relative' }}>
          <Confetti trigger={gam.fx.kind === 'correct' ? gam.fx.seq : 0} count={16} />
          <XpFloat trigger={gam.fx.kind === 'correct' ? gam.fx.seq : 0} amount={gam.fx.gainedXp ?? 0} />
          <Progress value={idx} total={deck.length} known={known} again={again} />
          <div style={{ marginTop: 8 }}><ComboBadge combo={combo} /></div>
          <Mascot kind={gam.fx.kind} seq={gam.fx.seq} combo={combo} wrongStreak={wrongStreak} emoji="🦉" />
          <div style={{ perspective: 1600, height: 410, marginTop: 12 }} onClick={() => setFlipped((f) => !f)}>
            <div style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform .55s', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'none', cursor: 'pointer' }}>
              {/* 앞면 */}
              <div style={{ ...face, background: '#fff', border: '1px solid #eef2f7' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                  <span style={pill('#eff6ff', '#2563eb')}>{card.era}</span>
                  {card.day && <span style={pill('#f1f5f9', '#64748b')}>{card.day}</span>}
                  <span style={{ color: '#f59e0b', fontWeight: 900, fontSize: 13, letterSpacing: 1 }}>{'★'.repeat(card.importance ?? 2)}</span>
                </div>
                <div style={{ fontSize: 14.5, color: '#94a3b8', fontWeight: 700, margin: '16px 0' }}>이 키워드, 설명할 수 있나요?</div>
                {mode !== 'full' && <span style={pill('#eef2ff', '#4f46e5')}>🎮 {mode === 'choseong' ? '초성만' : '일부만'} 모드</span>}
                {/* 암기코드 길이에 따라 폰트를 계단식으로: 짧으면 아주 큼직하게, 길면 카드에 맞게 */}
                <div style={{ fontSize: fitFont((front ?? '').length, [[6, 44], [10, 37], [16, 30], [24, 26]], 22), fontWeight: 900, color: '#0f172a', letterSpacing: (front ?? '').length <= 10 ? 2 : 0.5, marginTop: 10, lineHeight: 1.35, wordBreak: 'keep-all' }}>{front}</div>
                <div style={{ marginTop: 20, color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>👆 탭해서 설명 확인</div>
              </div>
              {/* 뒷면 */}
              {/* 뒷면 — 개념·연상법이 여러 문장으로 길 수 있어(엑셀 샘플 기준) 세로 스크롤을 전제로 배치 */}
              <div style={{ ...face, transform: 'rotateY(180deg)', background: 'linear-gradient(160deg,#1e3a8a,#1d4ed8)', color: '#fff', overflow: 'auto', justifyContent: 'flex-start', textAlign: 'left', padding: 20 }}>
                {/* 뒷면도 내용 길이에 맞춰 폰트를 조절 — 짧은 설명은 큼직하게 읽힌다 */}
                <div style={{ fontSize: fitFont(card.code.length, [[8, 27], [14, 23]], 20), fontWeight: 900, marginBottom: 10, flexShrink: 0, wordBreak: 'keep-all' }}>{card.code}</div>
                <div style={{ background: '#fbbf24', color: '#78350f', borderRadius: 16, padding: 14, marginBottom: 10, flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 900, marginBottom: 5 }}>📖 뜻·핵심 개념</div>
                  <div style={{ fontSize: fitFont(card.concept.length, [[40, 20], [80, 18], [140, 16.5]], 15), fontWeight: 800, lineHeight: 1.55, wordBreak: 'keep-all' }}>{card.concept}</div>
                </div>
                {card.principle && (
                  <div style={{ background: 'rgba(255,255,255,.12)', borderRadius: 16, padding: 14, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, opacity: .8, marginBottom: 5 }}>💡 연상법·설명</div>
                    <Principle text={card.principle} />
                  </div>
                )}
                <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, opacity: .55, marginTop: 10, flexShrink: 0 }}>내용이 길면 카드 안에서 스크롤 ↕</div>
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
          <div style={{ fontSize: 44, animation: 'gm-jump 1.3s ease-in-out infinite', zIndex: 1 }}>{endedByHearts ? '💔' : '🎉'}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', zIndex: 1 }}>{endedByHearts ? '하트를 다 썼어요!' : '키워드 학습 완료!'}</div>
          {endedByHearts && <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', zIndex: 1 }}>조금 쉬었다가 다시 도전해요 💪 (푼 만큼은 기록됐어요)</div>}
          {gam.state && <div style={{ fontSize: 13.5, fontWeight: 800, color: '#ea580c', zIndex: 1 }}>🔥 {gam.state.streak}일 연속{earnedCoins > 0 ? ` · 🪙 +${earnedCoins} (공부시간 보상)` : ''}</div>}
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

// 글자 수에 따라 폰트 크기를 계단식으로 결정.
// steps: [최대 글자 수, 폰트 크기] 목록 (오름차순). 모두 초과하면 min 사용.
// 예) fitFont(5, [[6,44],[10,37]], 22) → 44  /  fitFont(30, ...) → 22
function fitFont(len: number, steps: [number, number][], min: number): number {
  for (const [maxLen, size] of steps) if (len <= maxLen) return size;
  return min;
}

// 연상 기법 표시.
// 엑셀 샘플처럼 "웰컴(환영) + 구(구석기) + 동(동굴)" 식으로 ' + ' 구분자가 있으면
// 글자별 대응이 눈에 들어오도록 줄별 목록으로 풀어 보여준다. 구분자가 없으면 문장 그대로.
const Principle = ({ text }: { text: string }) => {
  // 연상법도 길이에 맞춰 폰트 조절: 짧으면 크게, 길면 알맞게
  const size = fitFont(text.length, [[60, 17], [120, 15.5]], 14.5);
  const segs = text.split(/\s\+\s/).map((s) => s.trim()).filter(Boolean);
  if (segs.length < 3) return <div style={{ fontSize: size, lineHeight: 1.65, wordBreak: 'keep-all' }}>{text}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {segs.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 7, fontSize: size, lineHeight: 1.55, wordBreak: 'keep-all' }}>
          <span style={{ opacity: .7, fontWeight: 900 }}>▸</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
};

// 키워드가 하나도 없을 때: 데이터 관리 화면으로 나가지 않고 그 자리에서 바로
// 기본 데이터를 물어보고 적재한다. busy 동안은 모래시계로 진행 중임을 보여준다.
const EmptyKeyword = ({ busy, label, onLoadDefault, onGo }: { busy: boolean; label: string; onLoadDefault: () => void; onGo: () => void }) => (
  <div style={{ background: '#fff', borderRadius: 20, padding: '26px 20px', textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(15,23,42,.25)' }}>
    <div style={{ fontSize: 40 }}>{busy ? '⏳' : '📭'}</div>
    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '8px 0 4px' }}>{busy ? `${label}를 불러오는 중…` : '등록된 키워드가 없어요'}</div>
    {!busy && (
      <>
        <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 14 }}>{label}를 지금 바로 불러와서 시작할 수 있어요</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onLoadDefault} style={primary('#2563eb')}>{label} 불러오기</button>
          <button onClick={onGo} style={{ background: 'none', border: 'none', color: '#94a3b8', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 6 }}>직접 구글 시트로 불러올래요 →</button>
        </div>
      </>
    )}
  </div>
);
const LoadingState = ({ label }: { label: string }) => (
  <div aria-live="polite" style={{ background: '#fff', borderRadius: 20, padding: '30px 20px', textAlign: 'center', color: '#64748b', fontSize: 14, fontWeight: 800 }}>
    <div style={{ fontSize: 30, marginBottom: 8 }}>⏳</div>{label}
  </div>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{title}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
  </div>
);
const Pick = ({ active, color, onClick, children, grow }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode; grow?: boolean }) => (
  <button onClick={onClick} style={{ flex: grow ? 1 : undefined, fontSize: 15, fontWeight: 900, padding: grow ? '14px 0' : '10px 17px', borderRadius: 14, cursor: 'pointer', background: active ? color : '#fff', color: active ? '#fff' : '#475569', border: `2px solid ${active ? color : '#e2e8f0'}` }}>{children}</button>
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

const iconBtn: React.CSSProperties = { width: 44, height: 44, borderRadius: 12, background: '#fff', border: 'none', fontSize: 18, color: '#334155', cursor: 'pointer', boxShadow: '0 6px 16px -10px rgba(15,23,42,.4)' };
const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 28, boxShadow: '0 26px 50px -22px rgba(15,23,42,.35)', padding: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
const rate: React.CSSProperties = { flex: 1, border: 'none', borderRadius: 20, padding: 16, fontSize: 15, fontWeight: 900, cursor: 'pointer' };
const resultCard: React.CSSProperties = { background: '#fff', borderRadius: 28, padding: '30px 24px', boxShadow: '0 26px 50px -22px rgba(15,23,42,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', marginTop: 20 };
const gray: React.CSSProperties = { background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 14, padding: '13px 20px', borderRadius: 15, cursor: 'pointer' };
const pill = (bg: string, c: string): React.CSSProperties => ({ background: bg, color: c, fontWeight: 800, fontSize: 12, padding: '5px 12px', borderRadius: 99 });
const primary = (c: string, small = false): React.CSSProperties => ({ width: small ? undefined : '100%', flex: small ? 1 : undefined, background: c, color: '#fff', border: 'none', fontWeight: 900, fontSize: small ? 14 : 17, padding: small ? '13px 22px' : 17, borderRadius: small ? 15 : 18, cursor: 'pointer' });
