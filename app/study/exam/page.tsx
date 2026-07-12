'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useSubjects } from '@/hooks/useSubjects';
import { useKeywords } from '@/hooks/useKeywords';
import { useExams } from '@/hooks/useExams';
import { useGamification } from '@/hooks/useGamification';
import { recordAttempt, recordSession, wrongExamIds } from '@/lib/api';
import { GamifyStyles, GamifyHud, Confetti, XpFloat, ComboBadge, Mascot } from '@/components/Gamify';
import { pickRotating } from '@/lib/rotation';
import { balanceAnswers } from '@/lib/examShuffle';
import { generateExamFromKeywords, isSyntheticExamId } from '@/lib/examGen';
import { isEnglishWordSubject, isKoreanHistorySubject } from '@/lib/defaultData';
import { loadDefaultExam } from '@/lib/defaultDataLoad';
import { parseQuestionDisplay } from '@/lib/examDisplay';
import { bumpQuestSession, bumpQuestCombo } from '@/lib/quests';
import { playCorrect, playCombo, playWrong, playFinish, isSoundOn, toggleSound } from '@/lib/sound';
import type { ExamQuestion } from '@/lib/types';

type Phase = 'setup' | 'session' | 'done';
const NUMS = ['①', '②', '③', '④', '⑤'];
const MAX_HEARTS = 5;

// ============================================================================
//  PROGRAM 2: 기출문제 풀이
// ----------------------------------------------------------------------------
//  PROGRAM 1과 같은 setup -> session -> done 상태 머신을 사용하지만, 카드의 자기평가
//  대신 보기 선택으로 정오답을 즉시 판정합니다. exam_attempts는 오답 복습과 통계의
//  공통 원천이며, 세션 종료 시 study_sessions에 시간/정답률을 별도로 집계합니다.
// ============================================================================
export default function ExamStudyPage() {
  const router = useRouter();
  const { userId, subjectId, ready } = useSession();
  const { current: currentSubject } = useSubjects(userId, subjectId);
  const { items: examItems, eras: examEras, loading: examsLoading, refresh: refreshExams } = useExams(userId, subjectId);
  const kw = useKeywords(userId, subjectId);
  const gam = useGamification(userId);

  // 영어 단어 과목은 등록된 기출문제가 없으면, 등록된 키워드(단어+뜻)로 그 자리에서
  // 4지선다 문제를 만들어 풉니다. 등록된 기출문제가 하나라도 있으면 항상 그것을 우선합니다.
  const isEnglishWord = isEnglishWordSubject(currentSubject?.name);
  const isKoreanHistory = isKoreanHistorySubject(currentSubject?.name);

  // 화면 진입 시 등록된 기출문제가 하나도 없으면(+ 영어 단어처럼 자동 생성도 안 되면),
  // 데이터 관리로 나가지 않고 이 자리에서 바로 기본 데이터를 불러올 수 있게 한다.
  const [loadingLevel, setLoadingLevel] = useState<'basic' | 'advanced' | null>(null);
  const [loadDoneMsg, setLoadDoneMsg] = useState<string | null>(null);

  async function loadDefault(level: 'basic' | 'advanced' = 'basic') {
    if (!userId || !subjectId) return;
    setLoadingLevel(level); setLoadDoneMsg(null);
    try {
      const r = await loadDefaultExam(userId, subjectId, currentSubject?.name, level);
      await refreshExams();
      setLoadDoneMsg(`✅ ${r.label} ${r.added}개를 불러왔어요. 이제 학습할 수 있어요!`);
    } catch (e: any) {
      setLoadDoneMsg('⚠️ ' + e.message);
    } finally {
      setLoadingLevel(null);
    }
  }

  useEffect(() => {
    if (!loadDoneMsg) return;
    const t = setTimeout(() => setLoadDoneMsg(null), 4000);
    return () => clearTimeout(t);
  }, [loadDoneMsg]);
  const generatedItems = useMemo(
    () => (examItems.length === 0 && isEnglishWord ? generateExamFromKeywords(kw.items) : []),
    [examItems.length, isEnglishWord, kw.items],
  );
  const items = examItems.length ? examItems : generatedItems;
  const eras = useMemo(
    () => (examItems.length ? examEras : Array.from(new Set(['전체', ...generatedItems.map((q) => q.era)]))),
    [examItems.length, examEras, generatedItems],
  );
  const dataLoading = examsLoading || (isEnglishWord && kw.loading);
  const eraCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.era, (counts.get(item.era) ?? 0) + 1));
    // 실제 시트 데이터에 "전체"라는 분류값이 섞여 있어도(예: 요약 행) 등록 개수와
    // 어긋나지 않도록 항상 마지막에 실제 전체 개수로 덮어쓴다.
    counts.set('전체', items.length);
    return counts;
  }, [items]);

  const [phase, setPhase] = useState<Phase>('setup');
  const [era, setEra] = useState('전체');
  const [count, setCount] = useState(10);
  const [imp, setImp] = useState(0); // 중요도 필터: 0=전체, 2=★★ 이상, 3=★★★만

  const [deck, setDeck] = useState<ExamQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0); // 연속 오답 수 (마스코트 위로 메시지용)
  // 세션 하트: 학습을 시작할 때마다 10개로 리셋, 틀리면 1개 소모(0 밑으로는 내려가지 않음).
  // 다 떨어져도 세션은 끝나지 않고 계속 풀 수 있다 — 순수 피드백용 표시.
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [heartBreak, setHeartBreak] = useState<number | null>(null);
  const [earnedCoins, setEarnedCoins] = useState(0); // 이번 세션 공부시간 코인
  const [missed, setMissed] = useState<ExamQuestion[]>([]); // 결과 화면에서 오답 복기용
  const [sound, setSound] = useState(true);
  const topRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0); // 세션 시작 시각 (공부시간 계산용)

  // 지금까지 틀린 문제 id (서버 기록). 현재 과목의 문제와 교집합만 "오답 복습" 대상.
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (ready && userId === null) router.replace('/'); }, [ready, userId, router]);
  useEffect(() => { setSound(isSoundOn()); }, []);
  useEffect(() => {
    if (userId) wrongExamIds(userId).then((r) => setWrongIds(new Set(r.wrongIds))).catch(() => {});
  }, [userId]);

  // 오답 복습 풀: 현재 과목 문제 중 틀린 기록이 있는 것 (과목이 여러 개여도 현재 과목만)
  // 하트 애니메이션 타이머 등 무관한 상태 변화로 리렌더될 때마다 최대 1700개
  // 배열을 다시 필터링하지 않도록, 실제로 바뀌는 값에만 의존해 재계산한다.
  const wrongPool = useMemo(() => items.filter((q) => wrongIds.has(q.id)), [items, wrongIds]);

  // 지문·보기가 길어 페이지가 스크롤된 상태에서 다음 문제로 넘어가면
  // 화면을 문제 상단으로 되돌려 준다.
  useEffect(() => {
    if (phase === 'session') topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [idx, phase]);

  // review=true 면 "틀렸던 문제"만으로 세션을 구성한다 (분류/중요도 필터와 무관하게 전부).
  function start(review = false) {
    const filtered = review
      ? wrongPool
      : items.filter((q) => (era === '전체' || q.era === era) && (imp === 0 || (q.importance ?? 2) >= imp));
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
    setDeck(pool); setIdx(0); setPick(null); setCorrect(0); setWrong(0); setCombo(0); setWrongStreak(0);
    setHearts(MAX_HEARTS); setMissed([]); setEarnedCoins(0); // 세션 하트 리셋
    startedAt.current = Date.now();
    setPhase('session');
  }

  // 세션 종료 공통 처리: 스트릭·시간 코인·퀘스트·통계 기록. 하트가 다 떨어져도 끝까지
  // 풀 수 있으므로, 세션은 항상 deck을 전부 풀었을 때만 끝난다.
  function finishSession(finalCorrect: number) {
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    setPhase('done');
    gam.completeSession(durationSec / 60).then((r) => setEarnedCoins(r?.gainedCoins ?? 0));
    bumpQuestSession(userId);
    playFinish();
    // 세션 결과 기록 → 통계(공부시간·가중평균)와 리그 순위의 원천
    if (userId && subjectId) {
      recordSession({ userId, subjectId, kind: 'ex', total: deck.length, correct: finalCorrect, durationSec }).catch(() => {});
      // 오답 목록 갱신 (이번 세션에서 맞힌 오답은 목록에서 빠짐)
      wrongExamIds(userId).then((r) => setWrongIds(new Set(r.wrongIds))).catch(() => {});
    }
  }

  function choose(i: number) {
    if (pick !== null) return;
    const q = deck[idx];
    const right = i === q.answer;
    setPick(i);
    if (right) {
      const c = combo + 1;
      setCorrect((n) => n + 1); setCombo(c); setWrongStreak(0); gam.onCorrect(c);
      bumpQuestCombo(userId, c);
      c >= 3 ? playCombo() : playCorrect();
    } else {
      setWrongStreak((w) => w + 1);
      // 세션 하트 1개 소모(0 밑으로는 안 내려감) + 깨지는 애니메이션. 하트가 다
      // 떨어져도 세션을 막지 않고 계속 풀 수 있다 — 순수 피드백용.
      const left = Math.max(0, hearts - 1);
      setHearts(left);
      setHeartBreak(left);
      setTimeout(() => setHeartBreak(null), 600);
      setWrong((n) => n + 1); setCombo(0); gam.onWrong();
      setMissed((m) => [...m, q]); // 결과 화면 오답 복기용
      playWrong();
    }
    // 즉석 생성 문제는 DB에 없는 id라 exam_attempts FK를 만족하지 못하므로 기록하지 않는다.
    if (userId && !isSyntheticExamId(q.id)) recordAttempt(userId, q.id, right).catch(() => {});
  }

  function next() {
    if (idx + 1 >= deck.length) {
      finishSession(correct);
    } else { setIdx(idx + 1); setPick(null); }
  }

  const q = deck[idx];
  // idx가 바뀔 때만 새 객체가 되는 q에 의존 — 하트 애니메이션 등 무관한 리렌더마다
  // 정규식 파싱을 반복하지 않는다.
  const qp = useMemo(() => (q ? parseQuestionDisplay(q.question) : null), [q]);
  const isRight = pick !== null && pick === q?.answer;
  const isLast = idx + 1 >= deck.length;

  return (
    <div className="app-wrap"><GamifyStyles /><div className="app-phone">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={() => router.push('/home')} style={iconBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>기출문제 풀이</div>
          <div style={{ fontSize: 13.5, color: '#94a3b8', fontWeight: 600 }}>
            {examItems.length ? `${examItems.length}문항 등록됨` : `${items.length}문항 · 키워드로 자동 생성`}
          </div>
        </div>
        <button onClick={() => setSound(toggleSound())} style={iconBtn} title="효과음 켜기/끄기">{sound ? '🔊' : '🔇'}</button>
      </div>
      {phase === 'session' && <div style={{ marginBottom: 14 }}><GamifyHud state={gam.state} hearts={hearts} maxHearts={MAX_HEARTS} heartBreakIdx={heartBreak} /></div>}

      {phase === 'setup' && loadDoneMsg && (
        <div aria-live="polite" style={{ marginBottom: 14, fontSize: 12.5, fontWeight: 800, color: loadDoneMsg.startsWith('⚠️') ? '#dc2626' : '#16a34a', background: loadDoneMsg.startsWith('⚠️') ? '#fef2f2' : '#dcfce7', padding: '10px 12px', borderRadius: 11 }}>{loadDoneMsg}</div>
      )}

      {phase === 'setup' && (dataLoading ? (
        <LoadingState label="기출문제를 불러오는 중…" />
      ) : items.length === 0 ? (
        <EmptyExam
          loadingLevel={loadingLevel}
          isKoreanHistory={isKoreanHistory}
          isEnglishWord={isEnglishWord}
          onLoadBasic={() => loadDefault('basic')}
          onLoadAdvanced={() => loadDefault('advanced')}
          onLoadDefault={() => loadDefault()}
          onGo={() => router.push('/data')}
        />
      ) : (
        <>
          {/* 오답 다시 풀기 — 현재 과목에서 틀린 기록이 있는 문제만 */}
          {wrongPool.length > 0 && (
            <button onClick={() => start(true)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', borderRadius: 20, padding: '16px 18px', marginBottom: 18, color: '#fff', background: 'linear-gradient(135deg,#f43f5e,#e11d48)', boxShadow: '0 14px 30px -12px rgba(244,63,94,.55)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>🔁</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>오답 다시 풀기 {wrongPool.length}개</div>
                  <div style={{ fontSize: 11.5, opacity: .9, fontWeight: 700, marginTop: 2 }}>틀렸던 문제만 골라 다시 풀어요 — 맞히면 목록에서 빠져요</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 900, background: 'rgba(255,255,255,.22)', padding: '8px 12px', borderRadius: 12 }}>시작 →</span>
              </div>
            </button>
          )}
          <Section title="🏛️ 학습 범위">
            {eras.map((e) => (
              <Pick key={e} active={era === e} onClick={() => setEra(e)}>
                {e} <small style={{ opacity: .6 }}>{eraCounts.get(e) ?? 0}</small>
              </Pick>
            ))}
          </Section>
          <Section title="⭐ 중요도">
            {([[0, '전체'], [2, '★★ 이상'], [3, '★★★만']] as const).map(([v, label]) => (
              <Pick key={v} active={imp === v} onClick={() => setImp(v)} grow>{label}</Pick>
            ))}
          </Section>
          <Section title="🎯 풀이할 문항 수">
            {[5, 10, 20, 999].map((c) => (
              <Pick key={c} active={count === c} onClick={() => setCount(c)} grow>{c === 999 ? '전체' : c}</Pick>
            ))}
          </Section>
          <button onClick={() => start()} style={primary}>문제 풀이 시작</button>
        </>
      ))}

      {phase === 'session' && q && qp && (
        <div style={{ position: 'relative' }}>
          <div ref={topRef} style={{ position: 'absolute', top: -90 }} />
          <Confetti trigger={gam.fx.kind === 'correct' ? gam.fx.seq : 0} count={16} />
          <XpFloat trigger={gam.fx.kind === 'correct' ? gam.fx.seq : 0} amount={gam.fx.gainedXp ?? 0} />
          {/* 진행률~문제 지문까지를 한 덩어리로 묶어, 정답/오답 오버레이가 이 영역만
              정확히 덮도록 한다 (아래 보기 목록은 항상 그대로 보임). */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 10, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(idx / deck.length) * 100}%`, background: 'linear-gradient(90deg,#8b5cf6,#6d28d9)', borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#334155' }}>{idx + 1}/{deck.length}</span>
            </div>

            {/* 마스코트와 정답/오답 카운트를 한 줄로 압축해 상단 높이를 아낀다 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Mascot kind={gam.fx.kind} seq={gam.fx.seq} combo={combo} wrongStreak={wrongStreak} emoji="🦉" />
              </div>
              <span style={{ flexShrink: 0, background: '#dcfce7', color: '#16a34a', borderRadius: 10, padding: '6px 11px', fontWeight: 800, fontSize: 12.5 }}>✅ {correct}</span>
              <span style={{ flexShrink: 0, background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '6px 11px', fontWeight: 800, fontSize: 12.5 }}>❌ {wrong}</span>
            </div>
            <ComboBadge combo={combo} />

            {/* [이미지: ...] 표기는 실제 사진 대신 자료 설명 상자로 보여준다 */}
            {qp.image && (
              <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 14, padding: '12px 14px', marginBottom: 10, fontSize: 12.5, fontWeight: 700, color: '#64748b', lineHeight: 1.5 }}>🖼️ 제시 자료 · {qp.image}</div>
            )}
            {/* 시대·중요도·회차 메타를 문제 번호 앞에 배지로 붙여 별도 줄 없이 공간을 아낀다.
                문항번호는 원본 데이터 대신 이번 세션에서 푸는 순서(Q{idx+1})를 쓴다.
                글자 크기도 지문 길이에 맞춰 계단식으로 조절한다. */}
            <div style={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.6, wordBreak: 'keep-all' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', padding: '3px 9px', borderRadius: 99, marginRight: 6, display: 'inline-block' }}>{q.era}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#f59e0b', letterSpacing: 1, marginRight: 6 }}>{'★'.repeat(q.importance ?? 2)}</span>
              {qp.meta && <span style={{ fontSize: 12, fontWeight: 800, color: '#a16207', background: '#fef9c3', padding: '3px 9px', borderRadius: 99, marginRight: 6, display: 'inline-block' }}>📋 {qp.meta}</span>}
              <span style={{ fontSize: fitFont(qp.text.length, [[30, 21], [50, 19], [70, 18], [90, 17]], 16) }}>Q{idx + 1}. {qp.text}</span>
            </div>

            {/* 정답/오답 피드백 — 진행률~지문 영역을 정확히 덮는 오버레이로 띄워서
                문제·보기 레이아웃을 아래로 밀어내지 않는다. */}
            {pick !== null && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', animation: 'gm-pop .25s ease' }}>
                <div style={{ width: '100%', background: isRight ? '#dcfce7' : '#fef2f2', borderRadius: 16, padding: 15, boxShadow: '0 16px 34px -14px rgba(15,23,42,.4)', overflow: 'auto' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: isRight ? '#16a34a' : '#dc2626', marginBottom: 5 }}>{isRight ? '✅ 정답이에요!' : '❌ 오답 · 복습함에 추가됐어요'}</div>
                  {/* 해설이 길어(샘플 평균 490자) 상자 안에서만 스크롤되게 하고,
                      **굵게** 마크와 줄바꿈을 살려 읽기 편하게 렌더링 */}
                  {q.explain && (
                    <div style={{ fontSize: 14, color: '#334155', fontWeight: 500, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'keep-all', background: 'rgba(255,255,255,.65)', borderRadius: 11, padding: '11px 13px' }}>
                      <Bold text={q.explain} />
                    </div>
                  )}
                  <button onClick={next} style={{ marginTop: 12, width: '100%', background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 900, fontSize: 15, padding: 13, borderRadius: 14, cursor: 'pointer' }}>{isLast ? '결과 보기 →' : '다음 문제 →'}</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {q.options.map((o, i) => {
              let bg = '#fff', border = '#e2e8f0', color = '#0f172a', mark = '';
              if (pick !== null) {
                if (i === q.answer) { bg = '#dcfce7'; border = '#22c55e'; color = '#15803d'; mark = '✓'; }
                else if (i === pick) { bg = '#fee2e2'; border = '#ef4444'; color = '#b91c1c'; mark = '✕'; }
              }
              return (
                // 보기가 문장형(40~55자)이라 2줄이 되는 경우가 많다 → 번호를 위쪽 정렬
                <button key={i} onClick={() => choose(i)} disabled={pick !== null} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: bg, border: `2px solid ${border}`, color, borderRadius: 15, padding: '14px 15px', cursor: pick === null ? 'pointer' : 'default', textAlign: 'left', fontSize: 15.5, fontWeight: 700, lineHeight: 1.55 }}>
                  <span style={{ fontSize: 17, lineHeight: 1.3 }}>{NUMS[i]}</span>
                  <span style={{ flex: 1, wordBreak: 'keep-all' }}>{o}</span>
                  {mark && <span style={{ fontWeight: 900 }}>{mark}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ ...resultCard, position: 'relative', overflow: 'hidden' }}>
          <Confetti trigger={1} count={28} loop />
          <div style={{ fontSize: 44, animation: 'gm-jump 1.3s ease-in-out infinite', zIndex: 1 }}>🏆</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', zIndex: 1 }}>기출 풀이 완료!</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed', zIndex: 1 }}>정답률 {Math.round((correct / Math.max(1, correct + wrong)) * 100)}%</div>
          {gam.state && <div style={{ fontSize: 13.5, fontWeight: 800, color: '#ea580c', zIndex: 1 }}>🔥 {gam.state.streak}일 연속{earnedCoins > 0 ? ` · 🪙 +${earnedCoins} (공부시간 보상)` : ''}</div>}
          <div style={{ display: 'flex', gap: 12, margin: '10px 0', zIndex: 1 }}>
            <Score n={correct} label="정답" c="#16a34a" bg="#dcfce7" />
            <Score n={wrong} label="복습 대상" c="#dc2626" bg="#fee2e2" />
          </div>

          {/* 틀린 문제 복기 — 문제를 간략히 보여주고 정답·해설로 바로 이어서 복습할 수 있게 한다 */}
          {missed.length > 0 && (
            <div style={{ alignSelf: 'stretch', width: '100%', textAlign: 'left', zIndex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>❌ 틀린 문제 다시 보기 ({missed.length}개)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflow: 'auto' }}>
                {missed.map((mq, i) => {
                  const mqp = parseQuestionDisplay(mq.question);
                  return (
                    <div key={`${mq.id}-${i}`} style={{ background: '#fef2f2', borderRadius: 14, padding: '11px 13px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.5, marginBottom: 4, wordBreak: 'keep-all' }}>Q. {mqp.text}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#16a34a', marginBottom: mq.explain ? 4 : 0 }}>정답: {mq.options[mq.answer]}</div>
                      {mq.explain && (
                        <div style={{ fontSize: 12, color: '#475569', fontWeight: 500, lineHeight: 1.55, wordBreak: 'keep-all' }}>
                          <Bold text={mq.explain} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, zIndex: 1 }}>
            <button onClick={() => setPhase('setup')} style={gray}>다시 설정</button>
            <button onClick={() => router.push('/home')} style={{ ...primary, width: undefined, flex: 1, fontSize: 14, padding: '13px 22px' }}>홈으로</button>
          </div>
        </div>
      )}
    </div></div>
  );
}

// ----------------------------------------------------------------------------
//  parseQuestion — 엑셀 샘플의 지문 형식을 화면 요소로 분해
// ----------------------------------------------------------------------------
//  "**[57회 심화 1번 / 1점]** [이미지: 유물 발굴 고인돌] 실제 지문..." 형태에서
//   · 맨 앞 **[...]** → 회차/배점 메타 (뱃지로 표시)
// "**굵게**" 마크다운을 <b> 로 렌더링 (해설 텍스트용)
const Bold = ({ text }: { text: string }) => (
  <>{text.split('**').map((seg, i) => (i % 2 ? <b key={i}>{seg}</b> : seg))}</>
);

// 글자 수에 따라 폰트 크기를 계단식으로 결정.
// steps: [최대 글자 수, 폰트 크기] 목록 (오름차순). 모두 초과하면 min 사용.
function fitFont(len: number, steps: [number, number][], min: number): number {
  for (const [maxLen, size] of steps) if (len <= maxLen) return size;
  return min;
}

// 기출문제가 하나도 없을 때: 데이터 관리 화면으로 나가지 않고 그 자리에서 바로
// 기본 데이터를 물어보고 적재한다. 한국사는 기본/심화를 고르게 하고, 영어 단어는
// 키워드만 있으면 자동 생성되므로(그래도 없다면) 데이터 관리로 안내한다.
const EmptyExam = ({ loadingLevel, isKoreanHistory, isEnglishWord, onLoadBasic, onLoadAdvanced, onLoadDefault, onGo }: {
  loadingLevel: 'basic' | 'advanced' | null;
  isKoreanHistory: boolean;
  isEnglishWord: boolean;
  onLoadBasic: () => void;
  onLoadAdvanced: () => void;
  onLoadDefault: () => void;
  onGo: () => void;
}) => {
  const busy = loadingLevel !== null;
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '26px 20px', textAlign: 'center', boxShadow: '0 10px 30px -18px rgba(15,23,42,.25)' }}>
      <div style={{ fontSize: 40 }}>{busy ? '⏳' : '📭'}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '8px 0 4px' }}>
        {busy ? `${loadingLevel === 'advanced' ? '심화' : '기본'} 기출문제를 불러오는 중…` : '등록된 문제가 없어요'}
      </div>
      {!busy && isKoreanHistory && (
        <>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 14 }}>기본/심화 중 골라서 지금 바로 불러올 수 있어요</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={onLoadBasic} style={{ flex: 1, background: '#ede9fe', color: '#6d28d9', border: 'none', fontWeight: 900, fontSize: 14, padding: 14, borderRadius: 15, cursor: 'pointer' }}>기본적재</button>
            <button onClick={onLoadAdvanced} style={{ flex: 1, background: '#fae8ff', color: '#a21caf', border: 'none', fontWeight: 900, fontSize: 14, padding: 14, borderRadius: 15, cursor: 'pointer' }}>심화적재</button>
          </div>
          <button onClick={onGo} style={{ background: 'none', border: 'none', color: '#94a3b8', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 6 }}>직접 구글 시트로 불러올래요 →</button>
        </>
      )}
      {!busy && !isKoreanHistory && isEnglishWord && (
        <>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 14 }}>영어 단어를 등록하면 그 자리에서 문제를 자동으로 만들어 드려요</div>
          <button onClick={onGo} style={{ ...primary, width: undefined, fontSize: 14, padding: '13px 22px' }}>데이터 관리로 가기</button>
        </>
      )}
      {!busy && !isKoreanHistory && !isEnglishWord && (
        <>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 14 }}>기본 기출문제를 지금 바로 불러와서 시작할 수 있어요</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={onLoadDefault} style={{ ...primary, width: '100%' }}>기본 기출문제 불러오기</button>
            <button onClick={onGo} style={{ background: 'none', border: 'none', color: '#94a3b8', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 6 }}>직접 구글 시트로 불러올래요 →</button>
          </div>
        </>
      )}
    </div>
  );
};
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
const Pick = ({ active, onClick, children, grow }: { active: boolean; onClick: () => void; children: React.ReactNode; grow?: boolean }) => (
  <button onClick={onClick} style={{ flex: grow ? 1 : undefined, fontSize: 15, fontWeight: 900, padding: grow ? '14px 0' : '10px 17px', borderRadius: 14, cursor: 'pointer', background: active ? '#7c3aed' : '#fff', color: active ? '#fff' : '#475569', border: `2px solid ${active ? '#7c3aed' : '#e2e8f0'}` }}>{children}</button>
);
const Score = ({ n, label, c, bg }: { n: number; label: string; c: string; bg: string }) => (
  <div style={{ background: bg, borderRadius: 16, padding: '12px 20px', textAlign: 'center' }}>
    <div style={{ fontSize: 24, fontWeight: 900, color: c }}>{n}</div>
    <div style={{ fontSize: 12, fontWeight: 800, color: c }}>{label}</div>
  </div>
);

const iconBtn: React.CSSProperties = { width: 44, height: 44, borderRadius: 12, background: '#fff', border: 'none', fontSize: 18, color: '#334155', cursor: 'pointer', boxShadow: '0 6px 16px -10px rgba(15,23,42,.4)' };
const resultCard: React.CSSProperties = { background: '#fff', borderRadius: 28, padding: '30px 24px', boxShadow: '0 26px 50px -22px rgba(15,23,42,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', marginTop: 20 };
const gray: React.CSSProperties = { background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 14, padding: '13px 20px', borderRadius: 15, cursor: 'pointer' };
const primary: React.CSSProperties = { width: '100%', background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 900, fontSize: 17, padding: 17, borderRadius: 18, cursor: 'pointer' };
