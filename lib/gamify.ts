// ============================================================
//  게이미피케이션 순수 로직 (서버에서 사용).
//  스트릭 판정, 하트 회복, XP·보너스, 주(week) 계산 등 부작용 없는 함수.
// ============================================================

export const MAX_HEARTS = 5;
export const HEART_REGEN_MIN = 30; // 하트 1개 회복에 걸리는 분

export function todayStr(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// 이번 주 월요일(YYYY-MM-DD)
export function weekStart(d = new Date()): string {
  const x = new Date(d);
  const day = (x.getUTCDay() + 6) % 7; // 월=0
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

// 두 날짜(YYYY-MM-DD) 사이 일수 차
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

// 콤보에 따른 XP: 기본 10, 3콤보 이상 +5 보너스
export function xpFor(combo: number, base = 10): number {
  return base + (combo >= 3 ? 5 : 0);
}

// 오답 시 깎이는 하트 양: 중요도 상(3)은 1개, 중/하(1~2)는 0.5개
export function heartCost(importance: number): number {
  return importance >= 3 ? 1 : 0.5;
}

// 시간 경과에 따른 하트 회복량 계산
export function regenHearts(hearts: number, updatedISO: string, now = new Date()): { hearts: number; updatedISO: string } {
  if (hearts >= MAX_HEARTS) return { hearts, updatedISO: now.toISOString() };
  const elapsedMin = (now.getTime() - Date.parse(updatedISO)) / 60000;
  const regen = Math.floor(elapsedMin / HEART_REGEN_MIN);
  if (regen <= 0) return { hearts, updatedISO };
  const next = Math.min(MAX_HEARTS, hearts + regen);
  // 회복 후 남은 시간을 반영해 기준 시각을 앞당김
  const consumedMin = (next - hearts) * HEART_REGEN_MIN;
  return { hearts: next, updatedISO: new Date(Date.parse(updatedISO) + consumedMin * 60000).toISOString() };
}

export function nextHeartInMin(hearts: number, updatedISO: string, now = new Date()): number | null {
  if (hearts >= MAX_HEARTS) return null;
  const elapsedMin = (now.getTime() - Date.parse(updatedISO)) / 60000;
  return Math.max(0, Math.ceil(HEART_REGEN_MIN - (elapsedMin % HEART_REGEN_MIN)));
}

// 학습일 기준 스트릭 갱신. 반환: 새 streak, 오늘 처음인지(firstToday)
export function bumpStreak(streak: number, lastActive: string | null, today: string): { streak: number; firstToday: boolean; freezeUsed: boolean } {
  if (lastActive === today) return { streak, firstToday: false, freezeUsed: false };
  if (!lastActive) return { streak: 1, firstToday: true, freezeUsed: false };
  const diff = dayDiff(lastActive, today);
  if (diff === 1) return { streak: streak + 1, firstToday: true, freezeUsed: false };
  // 하루 이상 건너뜀 → 스트릭 리셋 후 오늘부터 1
  return { streak: 1, firstToday: true, freezeUsed: false };
}
