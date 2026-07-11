// ============================================================================
//  lib/srs.ts — 망각곡선(에빙하우스) 기반 간격 반복(Spaced Repetition) 로직
// ----------------------------------------------------------------------------
//  [원리] 사람은 외운 직후부터 빠르게 잊는다(망각곡선). 잊기 직전에 다시 보면
//  기억이 오래 가고, 복습 간격을 점점 늘려도 유지된다. 그래서:
//    - 카드마다 "상자(box)" 레벨을 둔다 (라이트너 시스템).
//    - 외웠음 → 상자 +1 (복습 간격이 늘어남: 1일 → 3일 → 7일 → 14일 → 30일)
//    - 못 외움 → 상자 0으로 리셋 (다시 처음부터 짧은 간격)
//    - "복습 예정일(due)"이 지난 카드를 우선 출제한다.
//
//  저장은 localStorage(기기별)를 사용한다 — 서버 스키마 변경 없이 동작하고,
//  개인 학습 기기(폰/태블릿) 기준으로는 충분하다. 순수 함수로 분리해 테스트한다.
// ============================================================================

// 상자 레벨별 다음 복습까지의 간격(일). box 0 = 오늘 다시(즉시 복습 대상).
export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
export const MAX_BOX = SRS_INTERVALS_DAYS.length - 1;

export interface SrsEntry {
  box: number;  // 0 ~ MAX_BOX
  due: string;  // 다음 복습 예정일 (YYYY-MM-DD)
}
export type SrsMap = Record<string, SrsEntry>; // keywordId → 상태

const DAY_MS = 86400000;

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 학습 결과 반영: 외웠으면 상자를 올려 간격을 늘리고, 틀리면 처음으로.
export function srsReview(entry: SrsEntry | undefined, known: boolean, now = new Date()): SrsEntry {
  const box = known ? Math.min((entry?.box ?? 0) + 1, MAX_BOX) : 0;
  const due = dateStr(new Date(now.getTime() + SRS_INTERVALS_DAYS[box] * DAY_MS));
  return { box, due };
}

// 이 카드가 지금 복습 대상인가?
// "복습"은 학습한 적이 있는(기록이 있는) 카드에만 해당한다.
// 한 번도 안 본 새 카드는 복습이 아니라 일반 학습 대상 — 새 과목을 추가했을 때
// 전체 키워드가 "오늘 복습 N개"로 잘못 잡히던 문제를 막는다.
export function isDue(entry: SrsEntry | undefined, now = new Date()): boolean {
  if (!entry) return false;
  return entry.due <= dateStr(now);
}

// 목록에서 복습 대상만 추린다 (due가 오래 지난 것 = 가장 잊었을 카드 먼저).
export function dueItems<T extends { id: string }>(items: T[], map: SrsMap, now = new Date()): T[] {
  return items
    .filter((it) => isDue(map[it.id], now))
    .sort((a, b) => (map[a.id].due < map[b.id].due ? -1 : 1));
}

// ---- localStorage 입출력 (브라우저 전용, 실패해도 조용히 무시) ----
function storageKey(userId: string, subjectId: string): string {
  return `amgi_srs_${userId}_${subjectId}`;
}
export function loadSrs(userId: string | null, subjectId: string | null): SrsMap {
  if (!userId || !subjectId || typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(storageKey(userId, subjectId)) || '{}'); }
  catch { return {}; }
}
export function saveSrs(userId: string | null, subjectId: string | null, map: SrsMap): void {
  if (!userId || !subjectId || typeof window === 'undefined') return;
  try { localStorage.setItem(storageKey(userId, subjectId), JSON.stringify(map)); } catch {}
}
