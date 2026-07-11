// ============================================================================
//  lib/quests.ts — 일일 퀘스트 (듀오링고의 Daily Quests 차용)
// ----------------------------------------------------------------------------
//  매일 3개의 작은 목표를 주고, 달성하면 "보물상자"(랜덤 코인)를 연다.
//  - XP 퀘스트 진행도: 서버의 todayXp 를 그대로 사용
//  - 세션/콤보 퀘스트 진행도: 학습 화면이 bumpQuestSession/bumpQuestCombo 로
//    localStorage 에 기록 (기기별, 날짜별로 자동 리셋)
//  보상 수령 여부(claimed)도 같은 곳에 저장하고, 코인 지급은 서버 API 가 한다.
// ============================================================================

export interface QuestDef {
  id: 'xp' | 'sessions' | 'combo';
  icon: string;
  title: string;
  target: number;
}

export const DAILY_QUESTS: QuestDef[] = [
  { id: 'xp', icon: '⚡', title: 'XP 60 모으기', target: 60 },
  { id: 'sessions', icon: '🎯', title: '학습 세션 2회 완료하기', target: 2 },
  { id: 'combo', icon: '🔥', title: '5콤보 달성하기', target: 5 },
];

export interface QuestDay {
  sessions: number;   // 오늘 완료한 세션 수
  bestCombo: number;  // 오늘 최고 콤보
  claimed: string[];  // 보상을 받은 퀘스트 id 목록
}

const EMPTY: QuestDay = { sessions: 0, bestCombo: 0, claimed: [] };

function key(userId: string): string {
  return `amgi_quests_${userId}_${new Date().toISOString().slice(0, 10)}`;
}

export function loadQuestDay(userId: string | null): QuestDay {
  if (!userId || typeof window === 'undefined') return { ...EMPTY };
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(key(userId)) || '{}') }; }
  catch { return { ...EMPTY }; }
}

function save(userId: string, day: QuestDay): void {
  try { localStorage.setItem(key(userId), JSON.stringify(day)); } catch {}
}

// 학습 세션 1회 완료 (study 페이지의 세션 종료 시 호출)
export function bumpQuestSession(userId: string | null): void {
  if (!userId || typeof window === 'undefined') return;
  const d = loadQuestDay(userId);
  save(userId, { ...d, sessions: d.sessions + 1 });
}

// 콤보 갱신 (더 높은 콤보를 찍었을 때만 기록)
export function bumpQuestCombo(userId: string | null, combo: number): void {
  if (!userId || typeof window === 'undefined') return;
  const d = loadQuestDay(userId);
  if (combo > d.bestCombo) save(userId, { ...d, bestCombo: combo });
}

// 보상 수령 표시
export function markClaimed(userId: string | null, questId: string): void {
  if (!userId || typeof window === 'undefined') return;
  const d = loadQuestDay(userId);
  if (!d.claimed.includes(questId)) save(userId, { ...d, claimed: [...d.claimed, questId] });
}

// 퀘스트별 현재 진행도 계산 (todayXp 는 서버 상태에서 받아 넘긴다)
export function questProgress(def: QuestDef, day: QuestDay, todayXp: number): number {
  if (def.id === 'xp') return Math.min(todayXp, def.target);
  if (def.id === 'sessions') return Math.min(day.sessions, def.target);
  return Math.min(day.bestCombo, def.target);
}
