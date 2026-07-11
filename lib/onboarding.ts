// 사용자별로 "웰컴 가이드"를 딱 한 번만 보여주기 위한 로컬 저장 플래그.
const KEY_PREFIX = 'amgi_onboarded_';

export function hasSeenOnboarding(userId: string): boolean {
  try { return localStorage.getItem(KEY_PREFIX + userId) === '1'; } catch { return false; }
}

export function markOnboarded(userId: string): void {
  try { localStorage.setItem(KEY_PREFIX + userId, '1'); } catch {}
}
