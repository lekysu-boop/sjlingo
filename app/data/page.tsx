'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useKeywords } from '@/hooks/useKeywords';
import { useExams } from '@/hooks/useExams';
import { addKeywords, addExams, updateKeyword, updateExam, deleteKeyword, deleteExam, importSheet } from '@/lib/api';
import { DEFAULT_KEYWORDS, DEFAULT_EXAMS } from '@/lib/defaultData';
import type { Keyword, ExamQuestion } from '@/lib/types';

type Tab = 'kw' | 'ex';
// 편집 대상: 신규(add)면 id 없음, 수정(edit)이면 원본 보관
type KwEdit = { mode: 'add' | 'edit'; id?: string; era: string; code: string; concept: string; principle: string; day: string };
type ExEdit = { mode: 'add' | 'edit'; id?: string; era: string; question: string; o: string[]; answer: number; explain: string };

export default function DataPage() {
  const router = useRouter();
  const { userId, subjectId } = useSession();
  const kw = useKeywords(userId, subjectId);
  const ex = useExams(userId, subjectId);

  const [tab, setTab] = useState<Tab>('kw');
  const [sheetUrl, setSheetUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [kwEdit, setKwEdit] = useState<KwEdit | null>(null);
  const [exEdit, setExEdit] = useState<ExEdit | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (userId === null) router.replace('/'); }, [userId, router]);

  // 탭을 바꾸면 스크롤 위치도 목록도 처음(20개)부터 다시 보여준다.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab]);

  const accent = tab === 'kw' ? '#2563eb' : '#7c3aed';
  const tint = tab === 'kw' ? '#eff6ff' : '#f3e8ff';

  async function loadDefault() {
    if (!userId || !subjectId) return;
    setBusy(true); setMsg(null);
    try {
      const r = tab === 'kw'
        ? await addKeywords(userId, subjectId, DEFAULT_KEYWORDS)
        : await addExams(userId, subjectId, DEFAULT_EXAMS);
      setMsg({ text: `✅ ${r.added}개 추가 (중복 ${r.skipped}개 스킵)`, ok: true });
      tab === 'kw' ? kw.refresh() : ex.refresh();
    } catch (e: any) { setMsg({ text: '⚠️ ' + e.message, ok: false }); }
    finally { setBusy(false); }
  }

  async function loadSheet() {
    if (!userId || !subjectId || !sheetUrl.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await importSheet(userId, subjectId, tab === 'kw' ? 'keyword' : 'exam', sheetUrl.trim());
      setMsg({ text: `✅ ${r.added}개 추가 (중복 ${r.skipped}개 스킵 / 총 ${r.parsed}행)`, ok: true });
      setSheetUrl('');
      tab === 'kw' ? kw.refresh() : ex.refresh();
    } catch (e: any) { setMsg({ text: '⚠️ ' + e.message, ok: false }); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (tab === 'kw') { await deleteKeyword(id); kw.refresh(); }
    else { await deleteExam(id); ex.refresh(); }
  }

  // ---- 모달 열기 ----
  function openAdd() {
    setWarn(null);
    if (tab === 'kw') setKwEdit({ mode: 'add', era: '', code: '', concept: '', principle: '', day: '' });
    else setExEdit({ mode: 'add', era: '', question: '', o: ['', '', '', '', ''], answer: 0, explain: '' });
  }
  function openEditKw(k: Keyword) { setWarn(null); setKwEdit({ mode: 'edit', id: k.id, era: k.era, code: k.code, concept: k.concept, principle: k.principle, day: k.day }); }
  function openEditEx(q: ExamQuestion) { setWarn(null); const o = [...q.options, '', '', '', '', ''].slice(0, 5); setExEdit({ mode: 'edit', id: q.id, era: q.era, question: q.question, o, answer: q.answer, explain: q.explain }); }

  // ---- 저장 ----
  async function saveKw() {
    if (!kwEdit || !userId || !subjectId) return;
    if (!kwEdit.code.trim() || !kwEdit.concept.trim()) { setWarn('암기코드와 핵심 개념은 필수예요.'); return; }
    const payload = { era: kwEdit.era.trim() || '기타', code: kwEdit.code.trim(), concept: kwEdit.concept.trim(), principle: kwEdit.principle.trim(), day: kwEdit.day.trim() };
    try {
      if (kwEdit.mode === 'add') {
        const r = await addKeywords(userId, subjectId, [payload]);
        if (r.added === 0) { setWarn('이미 등록된 암기코드예요 (중복).'); return; }
      } else {
        await updateKeyword(kwEdit.id!, payload);
      }
      setKwEdit(null); kw.refresh();
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
    const payload = { era: exEdit.era.trim() || '기타', question: exEdit.question.trim(), options: opts, answer, explain: exEdit.explain.trim() };
    try {
      if (exEdit.mode === 'add') {
        const r = await addExams(userId, subjectId, [payload]);
        if (r.added === 0) { setWarn('비슷한 문제가 이미 등록돼 있어요 (5단어 이상 일치).'); return; }
      } else {
        await updateExam(exEdit.id!, payload);
      }
      setExEdit(null); ex.refresh();
    } catch (e: any) { setWarn(e.message); }
  }

  const list = tab === 'kw' ? kw.items : ex.items;

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
    <div style={wrap}><div style={phone}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>데이터 관리</div>
        <div style={{ fontSize: 12.5, color: '#94a3b8', fontWeight: 600, lineHeight: 1.5 }}>구글 시트(HTTPS·열 이름 자동 인식)를 연결하거나 직접 등록·수정·삭제할 수 있어요.</div>
      </div>

      <div style={{ display: 'flex', background: '#eef2f7', borderRadius: 14, padding: 4, marginBottom: 16 }}>
        <button onClick={() => { setTab('kw'); setMsg(null); }} style={tabBtn(tab === 'kw', '#2563eb')}>키워드 {kw.items.length}</button>
        <button onClick={() => { setTab('ex'); setMsg(null); }} style={tabBtn(tab === 'ex', '#7c3aed')}>기출문제 {ex.items.length}</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 18, padding: 15, boxShadow: '0 10px 30px -20px rgba(15,23,42,.25)', marginBottom: 14, borderTop: `4px solid ${accent}` }}>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 9 }}>구글 시트 공유 링크로 불러오기 <b style={{ color: accent }}>· 열 이름으로 자동 인식</b></div>
        <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..." style={input} />
        <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
          <button onClick={loadSheet} disabled={busy} style={{ flex: 1, background: accent, color: '#fff', border: 'none', fontWeight: 900, fontSize: 14, padding: 12, borderRadius: 13, cursor: 'pointer' }}>{busy ? '불러오는 중…' : '불러오기'}</button>
          <button onClick={loadDefault} disabled={busy} style={{ background: '#eef2f7', color: '#334155', border: 'none', fontWeight: 900, fontSize: 13, padding: '12px 14px', borderRadius: 13, cursor: 'pointer' }}>기본데이터</button>
          <button onClick={openAdd} style={{ background: tint, color: accent, border: 'none', fontWeight: 900, fontSize: 13, padding: '12px 14px', borderRadius: 13, cursor: 'pointer' }}>＋ 직접 추가</button>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: msg.ok ? '#16a34a' : '#dc2626', background: msg.ok ? '#dcfce7' : '#fef2f2', padding: '10px 12px', borderRadius: 11, lineHeight: 1.45 }}>{msg.text}</div>}
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8', marginBottom: 10 }}>등록된 항목 {list.length}개{list.length > visibleCount ? ` · ${visibleCount}개 표시 중` : ''}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 13, padding: '24px 0' }}>아직 등록된 항목이 없어요. '기본데이터'나 '＋ 직접 추가'로 시작하세요.</div>}
        {tab === 'kw' && kw.items.slice(0, visibleCount).map((k) => (
          <Row key={k.id} accent={accent} tint={tint} era={k.era} title={k.code} sub={k.concept} onEdit={() => openEditKw(k)} onDelete={() => remove(k.id)} />
        ))}
        {tab === 'ex' && ex.items.slice(0, visibleCount).map((q) => (
          <Row key={q.id} accent={accent} tint={tint} era={q.era} title={q.question} sub={'정답: ' + (q.options[q.answer] ?? '')} onEdit={() => openEditEx(q)} onDelete={() => remove(q.id)} />
        ))}
        {visibleCount < list.length && (
          <div ref={sentinelRef} style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: 12, padding: '10px 0' }}>불러오는 중…</div>
        )}
      </div>

      <nav style={tabbar}>
        <button onClick={() => router.push('/home')} style={navBtn('#94a3b8')}>🏠<br />홈</button>
        <button onClick={() => router.push('/stats')} style={navBtn('#94a3b8')}>📊<br />통계</button>
        <span style={{ ...navItem, color: accent }}>🗄️<br />데이터</span>
      </nav>

      {/* ---- 키워드 추가/수정 모달 ---- */}
      {kwEdit && (
        <Modal title={(kwEdit.mode === 'add' ? '키워드 추가' : '키워드 수정')} accent="#2563eb" warn={warn} onClose={() => setKwEdit(null)} onSave={saveKw}>
          <EraField label="시대/주제 *" value={kwEdit.era} ph="예: 선사시대" options={kw.eras.filter((e) => e !== '전체')} onChange={(v) => setKwEdit({ ...kwEdit, era: v })} />
          <Field label="암기코드 *" value={kwEdit.code} ph="예: 웰컴구 동막개" onChange={(v) => setKwEdit({ ...kwEdit, code: v })} />
          <Field label="역사적 핵심 개념 *" value={kwEdit.concept} ph="이 암기코드가 뜻하는 개념 (여러 줄 입력 가능)" onChange={(v) => setKwEdit({ ...kwEdit, concept: v })} textarea />
          <Field label="연상 기법·매칭 원리" value={kwEdit.principle} ph="어떻게 연상하는지" onChange={(v) => setKwEdit({ ...kwEdit, principle: v })} textarea />
          <Field label="회차 (선택)" value={kwEdit.day} ph="예: Day-01" onChange={(v) => setKwEdit({ ...kwEdit, day: v })} />
        </Modal>
      )}

      {/* ---- 기출 추가/수정 모달 ---- */}
      {exEdit && (
        <Modal title={(exEdit.mode === 'add' ? '기출문제 추가' : '기출문제 수정')} accent="#7c3aed" warn={warn} onClose={() => setExEdit(null)} onSave={saveEx}>
          <EraField label="시대/범위 *" value={exEdit.era} ph="예: 조선" options={ex.eras.filter((e) => e !== '전체')} onChange={(v) => setExEdit({ ...exEdit, era: v })} />
          <Field label="문제 *" value={exEdit.question} ph="문제 지문 (여러 줄 입력 가능)" onChange={(v) => setExEdit({ ...exEdit, question: v })} textarea />
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 6 }}>보기 <span style={{ color: '#94a3b8', fontWeight: 600 }}>· 2~5개, 빈 칸은 무시</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {exEdit.o.map((opt, i) => (
              <input key={i} value={opt} onChange={(e) => { const o = exEdit.o.slice(); o[i] = e.target.value; setExEdit({ ...exEdit, o }); }} placeholder={`보기 ${i + 1}${i < 2 ? ' *' : ' (선택)'}`} style={input} />
            ))}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#475569', marginBottom: 6 }}>정답 선택 <span style={{ color: '#94a3b8', fontWeight: 600 }}>(내용을 입력한 보기 중에서)</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {exEdit.o.map((opt, i) => opt.trim() === '' ? null : (
              <button key={i} onClick={() => setExEdit({ ...exEdit, answer: i })} style={{ flex: '1 0 18%', fontSize: 15, fontWeight: 900, padding: '12px 0', borderRadius: 12, cursor: 'pointer', background: exEdit.answer === i ? '#7c3aed' : '#fff', color: exEdit.answer === i ? '#fff' : '#475569', border: `2px solid ${exEdit.answer === i ? '#7c3aed' : '#e2e8f0'}` }}>보기{i + 1}</button>
            ))}
          </div>
          <Field label="해설 (선택)" value={exEdit.explain} ph="정답 해설" onChange={(v) => setExEdit({ ...exEdit, explain: v })} textarea />
        </Modal>
      )}
    </div></div>
  );
}

const Row = ({ accent, tint, era, title, sub, onEdit, onDelete }: { accent: string; tint: string; era: string; title: string; sub: string; onEdit: () => void; onDelete: () => void }) => (
  <div style={{ background: '#fff', borderRadius: 15, padding: '13px 14px', boxShadow: '0 6px 18px -14px rgba(15,23,42,.3)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: accent, background: tint, padding: '2px 8px', borderRadius: 99 }}>{era}</span>
      <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', lineHeight: 1.35, marginTop: 3 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{sub}</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
      <button onClick={onEdit} style={{ width: 32, height: 32, borderRadius: 9, background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer' }}>✏️</button>
      <button onClick={onDelete} style={{ width: 32, height: 32, borderRadius: 9, background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer' }}>🗑</button>
    </div>
  </div>
);

const Modal = ({ title, accent, warn, onClose, onSave, children }: { title: string; accent: string; warn: string | null; onClose: () => void; onSave: () => void; children: React.ReactNode }) => (
  <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'flex-end', borderRadius: 32, zIndex: 40 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '92%', background: '#fff', borderRadius: '28px 28px 32px 32px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

const tabBtn = (active: boolean, c: string): React.CSSProperties => ({ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 900, padding: 10, borderRadius: 11, border: 'none', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? c : '#94a3b8' });
const navBtn = (c: string): React.CSSProperties => ({ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 800, textAlign: 'center', lineHeight: 1.7, color: c });
const navItem: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, textAlign: 'center', lineHeight: 1.7 };
const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const phone: React.CSSProperties = { width: 380, minHeight: 700, background: '#f4f6fa', borderRadius: 32, padding: '24px 20px 88px', position: 'relative', boxShadow: '0 30px 60px -30px rgba(15,23,42,.4)' };
const input: React.CSSProperties = { width: '100%', border: '2px solid #e2e8f0', borderRadius: 13, padding: '12px 13px', fontSize: 13, fontWeight: 600, color: '#0f172a', outline: 'none', fontFamily: 'inherit' };
const tabbar: React.CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, height: 72, background: 'rgba(255,255,255,.94)', borderTop: '1px solid #eef2f7', borderRadius: '0 0 32px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', paddingTop: 8 };
