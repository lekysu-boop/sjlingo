'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useSubjects } from '@/hooks/useSubjects';
import { useKeywords } from '@/hooks/useKeywords';
import { useExams } from '@/hooks/useExams';
import { useStudySummary } from '@/hooks/useStudySummary';
import { addKeywords, addExams, updateKeyword, updateExam, deleteKeyword, deleteExam, deleteAllKeywords, deleteAllExams, importSheet } from '@/lib/api';
import {
  DEFAULT_KEYWORDS,
  DEFAULT_EXAMS,
  KOREAN_HISTORY_KEYWORD_SHEET_URL,
  KOREAN_HISTORY_BASIC_EXAM_SHEET_URL,
  KOREAN_HISTORY_ADVANCED_EXAM_SHEET_URL,
  ENGLISH_WORD_KEYWORD_SHEET_URL,
  isKoreanHistorySubject,
  isEnglishWordSubject,
} from '@/lib/defaultData';
import { TabBar } from '@/components/TabBar';
import { clearLocalStudyState } from '@/lib/localCleanup';
import type { Keyword, ExamQuestion } from '@/lib/types';

type Tab = 'kw' | 'ex';
// 편집 대상: 신규(add)면 id 없음, 수정(edit)이면 원본 보관
type KwEdit = { mode: 'add' | 'edit'; id?: string; era: string; code: string; concept: string; principle: string; day: string; importance: number };
type ExEdit = { mode: 'add' | 'edit'; id?: string; era: string; question: string; o: string[]; answer: number; explain: string; importance: number };
type ImportResult = { added: number; skipped: number; parsed: number; rejected?: number };

function importSummary(label: string, result: ImportResult): string {
  const rejected = result.rejected ? ` / 정답 미확정 ${result.rejected}개 제외` : '';
  return `✅ ${label} ${result.added}개 추가 (중복 ${result.skipped}개 스킵 / 유효 ${result.parsed}행${rejected})`;
}

// ============================================================================
//  데이터 관리 프로그램
// ----------------------------------------------------------------------------
//  한 화면에서 키워드/기출 탭을 공유하되, 실제 조회·저장 API와 편집 상태는 분리합니다.
//  데이터 유입 경로는 ① 기본데이터 ② 임의 Google Sheet ③ 직접 CRUD 세 가지입니다.
//  세 경로 모두 서버의 동일한 중복 판정 규칙을 거치므로 화면과 DB 기준이 어긋나지 않습니다.
// ============================================================================
export default function DataPage() {
  const router = useRouter();
  const { userId, subjectId, ready } = useSession();
  const [tab, setTab] = useState<Tab>('kw');
  // 세션에는 id만 있으므로 과목 목록에서 현재 과목명을 복원합니다.
  // 이 이름으로 한국사 전용 기본 소스와 범용 내장 샘플 중 하나를 선택합니다.
  const { current: currentSubject, loading: subjectsLoading } = useSubjects(userId, subjectId);
  // 상세 본문은 현재 탭만 조회합니다. 반대 탭은 가벼운 개수 조회만 사용해
  // 데이터 관리 첫 진입 때 1,700여 기출 해설까지 동시에 받지 않도록 합니다.
  const kw = useKeywords(userId, tab === 'kw' ? subjectId : null);
  const ex = useExams(userId, tab === 'ex' ? subjectId : null);
  const summary = useStudySummary(userId, subjectId);

  const [sheetUrl, setSheetUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [kwEdit, setKwEdit] = useState<KwEdit | null>(null);
  const [exEdit, setExEdit] = useState<ExEdit | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  // ---- 조회(검색·필터·펼침) 상태 ----
  const [q, setQ] = useState('');                    // 텍스트 검색어
  const [eraFilter, setEraFilter] = useState('전체'); // 분류/주제 필터
  const [impFilter, setImpFilter] = useState(0);     // 중요도 필터: 0=전체, 2=★★ 이상, 3=★★★만
  const [expandedId, setExpandedId] = useState<string | null>(null); // 상세 펼친 행
  const [confirmAll, setConfirmAll] = useState(false); // 전체 삭제 확인 모달
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (ready && userId === null) router.replace('/'); }, [ready, userId, router]);

  // 탭을 바꾸면 검색·필터·목록을 처음 상태로 되돌린다.
  useEffect(() => { setQ(''); setEraFilter('전체'); setImpFilter(0); }, [tab]);
  // 검색어/필터가 바뀌면 목록도 처음(20개)부터 다시 보여준다.
  useEffect(() => { setVisibleCount(PAGE_SIZE); setExpandedId(null); }, [tab, q, eraFilter, impFilter]);

  const accent = tab === 'kw' ? '#2563eb' : '#7c3aed';
  const tint = tab === 'kw' ? '#eff6ff' : '#f3e8ff';
  const eras = tab === 'kw' ? kw.eras : ex.eras;

  // 검색어(암기코드·개념·문제·보기 등)와 시대 필터를 적용한 목록.
  const filteredKw = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return kw.items.filter((k) =>
      (eraFilter === '전체' || k.era === eraFilter) &&
      (impFilter === 0 || (k.importance ?? 2) >= impFilter) &&
      (!needle || [k.code, k.concept, k.principle, k.day].some((f) => (f || '').toLowerCase().includes(needle))));
  }, [kw.items, q, eraFilter, impFilter]);
  const filteredEx = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ex.items.filter((x) =>
      (eraFilter === '전체' || x.era === eraFilter) &&
      (impFilter === 0 || (x.importance ?? 2) >= impFilter) &&
      (!needle || [x.question, x.explain, ...x.options].some((f) => (f || '').toLowerCase().includes(needle))));
  }, [ex.items, q, eraFilter, impFilter]);
  const list = tab === 'kw' ? filteredKw : filteredEx;
  const total = tab === 'kw' ? kw.items.length : ex.items.length;
  const currentLoading = tab === 'kw' ? kw.loading : ex.loading;
  const keywordCount = tab === 'kw' ? kw.items.length : summary.kwCount;
  const examCount = tab === 'ex' ? ex.items.length : summary.exCount;
  const isKoreanHistory = isKoreanHistorySubject(currentSubject?.name);
  const isEnglishWord = isEnglishWordSubject(currentSubject?.name);
  const useKoreanHistoryKeywordSheet = tab === 'kw' && isKoreanHistory;
  const useKoreanHistoryExamPresets = tab === 'ex' && isKoreanHistory;
  const useEnglishKeywordSheet = tab === 'kw' && !isKoreanHistory && isEnglishWord;

  async function refreshCurrent() {
    await (tab === 'kw' ? kw.refresh() : ex.refresh());
    await summary.refresh();
  }

  // "기본데이터"는 과목/탭에 따라 소스가 달라집니다.
  // - 한국사 키워드: 최종 통합 Google Sheet
  // - 영어 단어 키워드: 영단어 마스터 Google Sheet
  // - 그 외 키워드 및 기출: 코드에 포함된 작은 실습용 샘플
  // 서버 API가 기존 DB와 유입 데이터 내부의 중복을 모두 제거하므로 여러 번 눌러도 안전합니다.
  async function loadDefault() {
    if (!userId || !subjectId) return;
    setBusy(true);
    setBusyText(useKoreanHistoryKeywordSheet ? '암기코드를 가져오는 중…' : useEnglishKeywordSheet ? '영어 단어를 가져오는 중…' : '기본 데이터를 추가하는 중…');
    setMsg(null);
    try {
      if (useKoreanHistoryKeywordSheet) {
        const r = await importSheet(userId, subjectId, 'keyword', KOREAN_HISTORY_KEYWORD_SHEET_URL);
        setMsg({ text: importSummary('한국사 암기코드', r), ok: true });
        await refreshCurrent();
        return;
      }
      if (useEnglishKeywordSheet) {
        const r = await importSheet(userId, subjectId, 'keyword', ENGLISH_WORD_KEYWORD_SHEET_URL);
        setMsg({ text: `✅ 영어 단어 기본데이터 ${r.added}개 추가 (중복 ${r.skipped}개 스킵 / 총 ${r.parsed}행)`, ok: true });
        await refreshCurrent();
        return;
      }
      const r = tab === 'kw'
        ? await addKeywords(userId, subjectId, DEFAULT_KEYWORDS)
        : await addExams(userId, subjectId, DEFAULT_EXAMS);
      setMsg({ text: `✅ ${r.added}개 추가 (중복 ${r.skipped}개 스킵)`, ok: true });
      await refreshCurrent();
    } catch (e: any) { setMsg({ text: '⚠️ ' + e.message, ok: false }); }
    finally { setBusy(false); setBusyText(null); }
  }

  // 한국사 기출 기본/심화는 서로 다른 최종 통합 시트를 사용합니다.
  async function loadKoreanHistoryExam(level: 'basic' | 'advanced') {
    if (!userId || !subjectId) return;
    const url = level === 'basic'
      ? KOREAN_HISTORY_BASIC_EXAM_SHEET_URL
      : KOREAN_HISTORY_ADVANCED_EXAM_SHEET_URL;
    const label = level === 'basic' ? '기본적재' : '심화적재';
    setBusy(true); setBusyText(`한국사 ${label} 처리 중…`); setMsg(null);
    try {
      const r = await importSheet(userId, subjectId, 'exam', url);
      setMsg({ text: importSummary(`한국사 ${label}`, r), ok: true });
      await refreshCurrent();
    } catch (e: any) { setMsg({ text: '⚠️ ' + e.message, ok: false }); }
    finally { setBusy(false); setBusyText(null); }
  }

  async function loadSheet() {
    if (!userId || !subjectId || !sheetUrl.trim()) return;
    setBusy(true); setBusyText('Google Sheet를 분석하고 적재하는 중…'); setMsg(null);
    try {
      const r = await importSheet(userId, subjectId, tab === 'kw' ? 'keyword' : 'exam', sheetUrl.trim());
      setMsg({ text: importSummary('Google Sheet', r), ok: true });
      setSheetUrl('');
      await refreshCurrent();
    } catch (e: any) { setMsg({ text: '⚠️ ' + e.message, ok: false }); }
    finally { setBusy(false); setBusyText(null); }
  }

  async function remove(id: string) {
    try {
      if (tab === 'kw') await deleteKeyword(id);
      else await deleteExam(id);
      setMsg({ text: `🗑 ${tab === 'kw' ? '키워드' : '기출문제'} 삭제했어요`, ok: true });
      await refreshCurrent();
    } catch (e: any) {
      setMsg({ text: '⚠️ ' + e.message, ok: false });
    }
  }

  // 현재 탭(키워드/기출)의 데이터를 전부 삭제한다. 확인 모달을 거쳐서만 호출됨.
  async function removeAll() {
    if (!userId || !subjectId) return;
    setBusy(true); setBusyText(`${tab === 'kw' ? '키워드' : '기출문제'} 전체 삭제 중…`); setMsg(null);
    try {
      const r = tab === 'kw'
        ? await deleteAllKeywords(userId, subjectId)
        : await deleteAllExams(userId, subjectId);
      clearLocalStudyState(userId, subjectId, tab);
      setMsg({ text: `🗑 ${r.deleted}개 모두 삭제했어요`, ok: true });
      setConfirmAll(false);
      await refreshCurrent();
    } catch (e: any) { setMsg({ text: '⚠️ ' + e.message, ok: false }); }
    finally { setBusy(false); setBusyText(null); }
  }

  // ---- 모달 열기 ----
  function openAdd() {
    setWarn(null);
    if (tab === 'kw') setKwEdit({ mode: 'add', era: '', code: '', concept: '', principle: '', day: '', importance: 2 });
    else setExEdit({ mode: 'add', era: '', question: '', o: ['', '', '', '', ''], answer: 0, explain: '', importance: 2 });
  }
  function openEditKw(k: Keyword) { setWarn(null); setKwEdit({ mode: 'edit', id: k.id, era: k.era, code: k.code, concept: k.concept, principle: k.principle, day: k.day, importance: k.importance ?? 2 }); }
  function openEditEx(q2: ExamQuestion) { setWarn(null); const o = [...q2.options, '', '', '', '', ''].slice(0, 5); setExEdit({ mode: 'edit', id: q2.id, era: q2.era, question: q2.question, o, answer: q2.answer, explain: q2.explain, importance: q2.importance ?? 2 }); }

  // ---- 저장 ----
  async function saveKw() {
    if (!kwEdit || !userId || !subjectId) return;
    if (!kwEdit.code.trim() || !kwEdit.concept.trim()) { setWarn('키워드와 뜻은 필수예요.'); return; }
    const payload = { era: kwEdit.era.trim() || '기타', code: kwEdit.code.trim(), concept: kwEdit.concept.trim(), principle: kwEdit.principle.trim(), day: kwEdit.day.trim(), importance: kwEdit.importance };
    try {
      if (kwEdit.mode === 'add') {
        const r = await addKeywords(userId, subjectId, [payload]);
        if (r.added === 0) { setWarn('이미 등록된 키워드예요 (중복).'); return; }
      } else {
        await updateKeyword(kwEdit.id!, payload);
      }
      setKwEdit(null); await refreshCurrent();
    } catch (e: any) { setWarn(e.message); }
  }
  async function saveEx() {
    if (!exEdit || !userId || !subjectId) return;
    // 빈 보기를 제거하되, 정답 인덱스를 압축된 배열 기준으로 다시 매핑
    const kept: { text: string; orig: number }[] = [];
    exEdit.o.forEach((x, i) => { if (x.trim() !== '') kept.push({ text: x.trim(), orig: i }); });
    const opts = kept.map((k) => k.text);
    if (!exEdit.question.trim() || opts.length < 2) { setWarn('문제와 보기 2개 이상은 필수예요.'); return; }
    let answer = kept.findIndex((k) => k.orig === exEdit.answer);
    if (answer < 0) answer = 0; // 정답으로 고른 보기가 비어 있으면 첫 보기로
    const payload = { era: exEdit.era.trim() || '기타', question: exEdit.question.trim(), options: opts, answer, explain: exEdit.explain.trim(), importance: exEdit.importance };
    try {
      if (exEdit.mode === 'add') {
        const r = await addExams(userId, subjectId, [payload]);
        if (r.added === 0) { setWarn('비슷한 문제가 이미 등록돼 있어요 (5단어 이상 일치).'); return; }
      } else {
        await updateExam(exEdit.id!, payload);
      }
      setExEdit(null); await refreshCurrent();
    } catch (e: any) { setWarn(e.message); }
  }

  // 목록 끝의 sentinel 이 화면에 보이면 20개씩 더 불러온다 (무한 스크롤).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((v) => Math.min(v + PAGE_SIZE, list.length));
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length]);

  return (
    <div className="app-wrap"><div className="app-phone with-tabbar">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <button onClick={() => router.push('/home')} style={backBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>데이터 관리</div>
          <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600, lineHeight: 1.5 }}>구글 시트(HTTPS·열 이름 자동 인식)를 연결하거나 직접 등록·수정·삭제할 수 있어요.</div>
        </div>
      </div>

      <div style={{ display: 'flex', background: '#eef2f7', borderRadius: 14, padding: 4, marginBottom: 16 }}>
        <button onClick={() => { setTab('kw'); setMsg(null); }} style={tabBtn(tab === 'kw', '#2563eb')}>키워드 {tab === 'kw' && kw.loading ? '…' : keywordCount}</button>
        <button onClick={() => { setTab('ex'); setMsg(null); }} style={tabBtn(tab === 'ex', '#7c3aed')}>기출문제 {tab === 'ex' && ex.loading ? '…' : examCount}</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 18, padding: 15, boxShadow: '0 10px 30px -20px rgba(15,23,42,.25)', marginBottom: 14, borderTop: `4px solid ${accent}` }}>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 9 }}>구글 시트 공유 링크로 불러오기 <b style={{ color: accent }}>· 열 이름으로 자동 인식</b></div>
        <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} disabled={busy} placeholder="https://docs.google.com/spreadsheets/..." style={input} />
        <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
          <button onClick={loadSheet} disabled={busy} style={{ flex: 1, background: accent, color: '#fff', border: 'none', fontWeight: 900, fontSize: 14, padding: 12, borderRadius: 13, cursor: 'pointer' }}>{busy ? '처리 중…' : '불러오기'}</button>
          {useKoreanHistoryExamPresets ? (
            <>
              <button
                onClick={() => loadKoreanHistoryExam('basic')}
                disabled={busy || subjectsLoading}
                title="한능검 기본 기출 최종 Google Sheet에서 가져옵니다."
                style={{ background: '#ede9fe', color: '#6d28d9', border: 'none', fontWeight: 900, fontSize: 13, padding: '12px 14px', borderRadius: 13, cursor: 'pointer' }}
              >기본적재</button>
              <button
                onClick={() => loadKoreanHistoryExam('advanced')}
                disabled={busy || subjectsLoading}
                title="한능검 심화 기출 최종 Google Sheet에서 가져옵니다."
                style={{ background: '#fae8ff', color: '#a21caf', border: 'none', fontWeight: 900, fontSize: 13, padding: '12px 14px', borderRadius: 13, cursor: 'pointer' }}
              >심화적재</button>
            </>
          ) : (
            <button
              onClick={loadDefault}
              disabled={busy || subjectsLoading}
              title={useKoreanHistoryKeywordSheet ? '한능검 마스터 Google Sheet에서 키워드를 가져옵니다.' : useEnglishKeywordSheet ? '영어 단어 마스터 Google Sheet에서 키워드를 가져옵니다.' : '앱에 포함된 실습용 샘플을 추가합니다.'}
              style={useKoreanHistoryKeywordSheet
                ? { background: '#dbeafe', color: '#1d4ed8', border: 'none', fontWeight: 900, fontSize: 13, padding: '12px 14px', borderRadius: 13, cursor: 'pointer' }
                : { background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 13, padding: '12px 14px', borderRadius: 13, cursor: 'pointer' }}
            >{useKoreanHistoryKeywordSheet ? '암기코드 적재' : useEnglishKeywordSheet ? '단어 적재' : '기본데이터'}</button>
          )}
          <button onClick={openAdd} style={{ background: tint, color: accent, border: 'none', fontWeight: 900, fontSize: 13, padding: '12px 14px', borderRadius: 13, cursor: 'pointer' }}>＋ 직접 추가</button>
        </div>
        {busyText && <div aria-live="polite" style={{ marginTop: 10, fontSize: 12.5, fontWeight: 800, color: '#4338ca', background: '#eef2ff', padding: '10px 12px', borderRadius: 11 }}>⏳ {busyText}</div>}
        {msg && <div aria-live="polite" style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: msg.ok ? '#16a34a' : '#dc2626', background: msg.ok ? '#dcfce7' : '#fef2f2', padding: '10px 12px', borderRadius: 11, lineHeight: 1.45 }}>{msg.text}</div>}
      </div>

      {/* ---- 조회: 검색 + 시대 필터 ---- */}
      {total > 0 && (
        <div style={{ marginBottom: 12 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'kw' ? '🔍 키워드·뜻·연상법 검색' : '🔍 문제·보기·해설 검색'} style={{ ...input, background: '#fff' }} />
          {eras.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 9, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
              {eras.map((e) => (
                <button key={e} onClick={() => setEraFilter(e)} style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, padding: '7px 13px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', background: eraFilter === e ? accent : '#fff', color: eraFilter === e ? '#fff' : '#475569', border: `1.5px solid ${eraFilter === e ? accent : '#e2e8f0'}` }}>{e}</button>
              ))}
            </div>
          )}
          {/* 중요도 필터 */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {([[0, '중요도 전체'], [2, '★★ 이상'], [3, '★★★만']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setImpFilter(v)} style={{ fontSize: 12, fontWeight: 800, padding: '7px 13px', borderRadius: 99, cursor: 'pointer', background: impFilter === v ? '#f59e0b' : '#fff', color: impFilter === v ? '#fff' : '#b45309', border: `1.5px solid ${impFilter === v ? '#f59e0b' : '#fde68a'}` }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#94a3b8' }}>
          {q.trim() || eraFilter !== '전체' ? `검색 결과 ${list.length}개 / 전체 ${total}개` : `등록된 항목 ${list.length}개`}{list.length > visibleCount ? ` · ${visibleCount}개 표시 중` : ''}
        </div>
        {total > 0 && (
          <button onClick={() => setConfirmAll(true)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', fontWeight: 800, fontSize: 12, padding: '7px 12px', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>🗑 전체 삭제</button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {currentLoading && <div aria-live="polite" style={{ textAlign: 'center', color: '#6366f1', fontWeight: 800, fontSize: 13, padding: '24px 0' }}>⏳ 데이터를 불러오는 중…</div>}
        {!currentLoading && total === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 13, padding: '24px 0' }}>아직 등록된 항목이 없어요. ‘기본데이터’나 ‘＋ 직접 추가’로 시작하세요.</div>}
        {total > 0 && list.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 13, padding: '24px 0' }}>조건에 맞는 항목이 없어요. 검색어나 필터를 바꿔 보세요.</div>}
        {tab === 'kw' && filteredKw.slice(0, visibleCount).map((k) => (
          <Row key={k.id} accent={accent} tint={tint} era={k.era} day={k.day} imp={k.importance ?? 2} title={k.code} sub={k.concept}
            detail={k.principle ? `💡 ${k.principle}` : ''}
            expanded={expandedId === k.id} onToggle={() => setExpandedId(expandedId === k.id ? null : k.id)}
            onEdit={() => openEditKw(k)} onDelete={() => remove(k.id)} />
        ))}
        {tab === 'ex' && filteredEx.slice(0, visibleCount).map((x) => (
          // 지문·해설의 "**굵게**" 마커는 목록에서는 걷어내고 보여준다
          <Row key={x.id} accent={accent} tint={tint} era={x.era} day="" imp={x.importance ?? 2} title={x.question.replace(/\*\*/g, '')} sub={'정답: ' + (x.options[x.answer] ?? '')}
            detail={x.options.map((o, i) => `${i === x.answer ? '✅' : '▫️'} ${o}`).join('\n') + (x.explain ? `\n\n💡 ${x.explain.replace(/\*\*/g, '')}` : '')}
            expanded={expandedId === x.id} onToggle={() => setExpandedId(expandedId === x.id ? null : x.id)}
            onEdit={() => openEditEx(x)} onDelete={() => remove(x.id)} />
        ))}
        {visibleCount < list.length && (
          <div ref={sentinelRef} style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 12, padding: '10px 0' }}>불러오는 중…</div>
        )}
      </div>

      <TabBar active="data" />

      {/* ---- 키워드 추가/수정 모달 ---- */}
      {kwEdit && (
        <Modal title={(kwEdit.mode === 'add' ? '키워드 추가' : '키워드 수정')} accent="#2563eb" warn={warn} onClose={() => setKwEdit(null)} onSave={saveKw}>
          {/* 과목 중립 용어 사용 — 한국사면 시대, 영어 단어면 품사/단원처럼 자유롭게 */}
          <EraField label="분류/주제 *" value={kwEdit.era} ph="예: 선사시대, 동사, 1단원" options={kw.eras.filter((e) => e !== '전체')} onChange={(v) => setKwEdit({ ...kwEdit, era: v })} />
          <Field label="키워드 *" value={kwEdit.code} ph="암기할 대상 (예: 웰컴구 동막개, apple)" onChange={(v) => setKwEdit({ ...kwEdit, code: v })} />
          <Field label="뜻·핵심 개념 *" value={kwEdit.concept} ph="키워드의 뜻이나 개념 (여러 줄 입력 가능)" onChange={(v) => setKwEdit({ ...kwEdit, concept: v })} textarea rows={4} />
          <Field label="연상법·부가 설명 (선택)" value={kwEdit.principle} ph="외우는 요령, 예문 등 (예: 웰컴 + 구 + 동막개 처럼 + 로 구분하면 카드에서 줄별로 표시돼요)" onChange={(v) => setKwEdit({ ...kwEdit, principle: v })} textarea rows={4} />
          <Field label="회차/단원 (선택)" value={kwEdit.day} ph="예: Day-01, 3과" onChange={(v) => setKwEdit({ ...kwEdit, day: v })} />
          <ImpField value={kwEdit.importance} onChange={(v) => setKwEdit({ ...kwEdit, importance: v })} />
        </Modal>
      )}

      {/* ---- 기출 추가/수정 모달 ---- */}
      {exEdit && (
        <Modal title={(exEdit.mode === 'add' ? '기출문제 추가' : '기출문제 수정')} accent="#7c3aed" warn={warn} onClose={() => setExEdit(null)} onSave={saveEx}>
          <EraField label="분류/범위 *" value={exEdit.era} ph="예: 조선, 문법, 2단원" options={ex.eras.filter((e) => e !== '전체')} onChange={(v) => setExEdit({ ...exEdit, era: v })} />
          <Field label="문제 *" value={exEdit.question} ph="문제 지문 (여러 줄 입력 가능)" onChange={(v) => setExEdit({ ...exEdit, question: v })} textarea rows={4} />
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 6 }}>보기 <span style={{ color: '#94a3b8', fontWeight: 600 }}>· 2~5개, 빈 칸은 무시</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {/* 보기가 문장형(40~55자)이라 한 줄 input 으로는 잘려 보인다 → 2줄 textarea */}
            {exEdit.o.map((opt, i) => (
              <textarea key={i} rows={2} value={opt} onChange={(e) => { const o = exEdit.o.slice(); o[i] = e.target.value; setExEdit({ ...exEdit, o }); }} placeholder={`보기 ${i + 1}${i < 2 ? ' *' : ' (선택)'}`} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
            ))}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 6 }}>정답 선택 <span style={{ color: '#94a3b8', fontWeight: 600 }}>(내용을 입력한 보기 중에서)</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {exEdit.o.map((opt, i) => opt.trim() === '' ? null : (
              <button key={i} onClick={() => setExEdit({ ...exEdit, answer: i })} style={{ flex: '1 0 18%', fontSize: 15, fontWeight: 900, padding: '12px 0', borderRadius: 12, cursor: 'pointer', background: exEdit.answer === i ? '#7c3aed' : '#fff', color: exEdit.answer === i ? '#fff' : '#475569', border: `2px solid ${exEdit.answer === i ? '#7c3aed' : '#e2e8f0'}` }}>보기{i + 1}</button>
            ))}
          </div>
          <Field label="해설 (선택)" value={exEdit.explain} ph="정답 해설 (길게 입력 가능)" onChange={(v) => setExEdit({ ...exEdit, explain: v })} textarea rows={6} />
          <ImpField value={exEdit.importance} onChange={(v) => setExEdit({ ...exEdit, importance: v })} />
        </Modal>
      )}

      {/* ---- 전체 삭제 확인 모달 ---- */}
      {confirmAll && (
        <div onClick={() => setConfirmAll(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: '#fff', borderRadius: 22, padding: '24px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 38 }}>⚠️</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: '8px 0 6px' }}>{tab === 'kw' ? '키워드' : '기출문제'} 전체 삭제</div>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, lineHeight: 1.6, marginBottom: 18 }}>
              등록된 {tab === 'kw' ? '키워드' : '기출문제'} <b style={{ color: '#dc2626' }}>{total}개</b>가 모두 삭제되고<br />관련 학습 기록도 함께 사라져요.<br />이 작업은 되돌릴 수 없어요.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmAll(false)} style={{ flex: 1, background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 14, padding: 14, borderRadius: 14, cursor: 'pointer' }}>취소</button>
              <button onClick={removeAll} disabled={busy} style={{ flex: 1, background: '#dc2626', color: '#fff', border: 'none', fontWeight: 900, fontSize: 14, padding: 14, borderRadius: 14, cursor: 'pointer', opacity: busy ? .6 : 1 }}>{busy ? '삭제 중…' : '모두 삭제'}</button>
            </div>
          </div>
        </div>
      )}
    </div></div>
  );
}

// 목록 한 줄. 긴 텍스트는 2줄로 접어 보여주고, 본문을 탭하면 전체 내용(연상법·보기·해설)이 펼쳐진다.
const Row = ({ accent, tint, era, day, imp, title, sub, detail, expanded, onToggle, onEdit, onDelete }: { accent: string; tint: string; era: string; day: string; imp: number; title: string; sub: string; detail: string; expanded: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) => (
  <div style={{ background: '#fff', borderRadius: 15, padding: '13px 14px', boxShadow: '0 6px 18px -14px rgba(15,23,42,.3)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    <button onClick={onToggle} aria-expanded={expanded} style={{ flex: 1, minWidth: 0, display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: accent, background: tint, padding: '3px 10px', borderRadius: 99 }}>{era}</span>
        {day && <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '3px 10px', borderRadius: 99 }}>{day}</span>}
        <span style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b', letterSpacing: 1 }}>{'★'.repeat(imp)}</span>
      </div>
      <div style={{ fontSize: 16.5, fontWeight: 900, color: '#0f172a', lineHeight: 1.4, marginTop: 4, ...(expanded ? {} : clamp2) }}>{title}</div>
      <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600, marginTop: 3, lineHeight: 1.55, ...(expanded ? {} : clamp2) }}>{sub}</div>
      {expanded && detail && (
        <div style={{ fontSize: 14, color: '#475569', fontWeight: 600, marginTop: 8, background: '#f8fafc', borderRadius: 11, padding: '11px 13px', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{detail}</div>
      )}
      <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 700, marginTop: 5 }}>{expanded ? '▲ 접기' : '▼ 자세히'}</div>
    </button>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
      <button onClick={onEdit} style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', fontSize: 15 }}>✏️</button>
      <button onClick={onDelete} style={{ width: 38, height: 38, borderRadius: 10, background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: 15 }}>🗑</button>
    </div>
  </div>
);

// 추가/수정 모달.
// [중요] 오버레이는 position: fixed 로 "브라우저 화면" 기준으로 띄운다.
// 이전에는 absolute(컨테이너 기준)여서 목록이 길어지면(수십 개 등록 시)
// 모달이 화면 밖 컨테이너 맨 아래에 렌더링되어 보이지 않는 버그가 있었다.
const Modal = ({ title, accent, warn, onClose, onSave, children }: { title: string; accent: string; warn: string | null; onClose: () => void; onSave: () => void; children: React.ReactNode }) => (
  <div onClick={onClose} style={overlay}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '88vh', background: '#fff', borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>{title}</div>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: '#eef2f7', color: '#334155', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
        {children}
        {warn && <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>{warn}</div>}
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 15, padding: '15px 20px', borderRadius: 15, cursor: 'pointer' }}>취소</button>
        <button onClick={onSave} style={{ flex: 1, background: accent, color: '#fff', border: 'none', fontWeight: 900, fontSize: 15, padding: 15, borderRadius: 15, cursor: 'pointer' }}>저장</button>
      </div>
    </div>
  </div>
);

const Field = ({ label, value, ph, onChange, textarea, rows }: { label: string; value: string; ph: string; onChange: (v: string) => void; textarea?: boolean; rows?: number }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 6 }}>{label}</div>
    {textarea
      ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} rows={rows ?? 3} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
      : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} style={input} />}
  </div>
);

// 중요도 선택 (1=하, 2=중, 3=상). 학습 화면에서 "★★★만 / ★★ 이상"으로 골라 풀 수 있다.
const ImpField = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 6 }}>중요도 <span style={{ color: '#94a3b8', fontWeight: 600 }}>· 학습 시 중요한 것만 골라 풀 수 있어요</span></div>
    <div style={{ display: 'flex', gap: 8 }}>
      {([[1, '★ 하'], [2, '★★ 중'], [3, '★★★ 상']] as const).map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} style={{ flex: 1, fontSize: 14, fontWeight: 900, padding: '11px 0', borderRadius: 12, cursor: 'pointer', background: value === v ? '#f59e0b' : '#fff', color: value === v ? '#fff' : '#b45309', border: `2px solid ${value === v ? '#f59e0b' : '#fde68a'}` }}>{label}</button>
      ))}
    </div>
  </div>
);

// 시대/주제 콤보박스 입력.
// HTML 표준 <datalist> 를 쓰면 "기존 값 중에서 고르기 + 직접 입력" 두 가지가
// 모두 됩니다 (select 와 input 의 중간). options 배열은 이미 등록된 구분값 목록.
// [TS 문법] options: string[] → "문자열 배열" 타입이라는 뜻.
const EraField = ({ label, value, ph, options, onChange }: { label: string; value: string; ph: string; options: string[]; onChange: (v: string) => void }) => {
  // React 에서 datalist 는 input 의 list 속성과 datalist 의 id 를 맞춰 연결합니다.
  // 두 모달(키워드/기출)이 동시에 떠 있지 않으므로 고정 id 를 써도 안전합니다.
  const listId = 'era-options';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 6 }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} list={listId} style={input} />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 4 }}>기존 값에서 고르거나 새로 입력하세요</div>
    </div>
  );
};

// 2줄 말줄임 (표준 line-clamp 는 아직 지원이 고르지 않아 -webkit- 계열 사용)
const clamp2: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
// 모달 공통 오버레이 — 반드시 fixed (화면 기준). absolute 를 쓰면 목록이 긴 페이지에서 모달이 화면 밖으로 밀려난다.
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16 };
const tabBtn = (active: boolean, c: string): React.CSSProperties => ({ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 900, padding: 10, borderRadius: 11, border: 'none', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? c : '#94a3b8' });
const backBtn: React.CSSProperties = { width: 44, height: 44, borderRadius: 12, background: '#fff', border: 'none', fontSize: 18, color: '#334155', cursor: 'pointer', boxShadow: '0 6px 16px -10px rgba(15,23,42,.4)', flexShrink: 0 };
const input: React.CSSProperties = { width: '100%', border: '2px solid #e2e8f0', borderRadius: 13, padding: '12px 14px', fontSize: 14.5, fontWeight: 600, color: '#0f172a', outline: 'none', fontFamily: 'inherit' };
