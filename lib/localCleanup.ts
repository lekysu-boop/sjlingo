// 과목의 키워드/기출문제를 전체 삭제할 때, 그 과목에 대해 브라우저에 남아있던
// 로컬 학습 상태(최근 출제 기록·망각곡선)도 함께 지운다. era별로 키가 나뉘어 있어
// (amgi_seen_kw_유저_과목_시대) 지우지 않으면 과목/시대를 오래 쓸수록 죽은 키가
// localStorage에 계속 쌓인다.
export function clearLocalStudyState(userId: string, subjectId: string, kind: 'kw' | 'ex'): void {
  if (typeof window === 'undefined') return;
  const prefix = kind === 'kw' ? `amgi_seen_kw_${userId}_${subjectId}_` : `amgi_seen_ex_${userId}_${subjectId}_`;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) localStorage.removeItem(key);
  }
  // 망각곡선(SRS)은 키워드에만 쓰인다.
  if (kind === 'kw') localStorage.removeItem(`amgi_srs_${userId}_${subjectId}`);
}
