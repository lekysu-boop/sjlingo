import type { Keyword, ExamQuestion } from './types';

// ============================================================
//  중복 판정 로직 (프로토타입 v3와 동일 규칙)
//  - 키워드: 공백/슬래시를 제거한 암기코드가 같으면 중복
//  - 기출:   문제 지문이 완전히 같거나, 5단어 이상 겹치면 중복
//  DB에도 unique index가 있지만, 대량 가져오기 시 서버에서 미리 걸러
//  "추가 n개 / 스킵 m개" 안내를 만들기 위해 사용합니다.
// ============================================================

export function normCode(code: string): string {
  return (code || '').replace(/[\s/]/g, '');
}

export function kwDup(a: { code: string }, b: { code: string }): boolean {
  const na = normCode(a.code);
  return !!na && na === normCode(b.code);
}

function tokens(q: string): string[] {
  return (q || '')
    .split(/\s+/)
    .map((t) => t.replace(/[^\uAC00-\uD7A3a-zA-Z0-9]/g, ''))
    .filter((t) => t.length > 0);
}

export function exDup(a: { question: string }, b: { question: string }): boolean {
  const qa = (a.question || '').trim();
  if (qa && qa === (b.question || '').trim()) return true;
  const A = tokens(a.question);
  const B = new Set(tokens(b.question));
  let n = 0;
  A.forEach((t) => {
    if (B.has(t)) n++;
  });
  return n >= 5;
}

// 기존 목록 + 유입 목록 → 중복 제거하며 병합할 항목만 추출
export function dedupeKeywords<T extends { code: string }>(existing: T[], incoming: T[]) {
  const out: T[] = [];
  let skip = 0;
  incoming.forEach((it) => {
    if (existing.some((e) => kwDup(e, it)) || out.some((e) => kwDup(e, it))) skip++;
    else out.push(it);
  });
  return { toInsert: out, added: out.length, skipped: skip };
}

export function dedupeExams<T extends { question: string }>(existing: T[], incoming: T[]) {
  const out: T[] = [];
  let skip = 0;
  incoming.forEach((it) => {
    if (existing.some((e) => exDup(e, it)) || out.some((e) => exDup(e, it))) skip++;
    else out.push(it);
  });
  return { toInsert: out, added: out.length, skipped: skip };
}
