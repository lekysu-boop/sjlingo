// ============================================================================
//  lib/rotation.ts  —  "최대한 중복되지 않게" 문제를 골라 섞는 로직
// ----------------------------------------------------------------------------
//  [문제] 매 세션마다 그냥 무작위로 N개를 뽑으면, 방금 푼 문제가 다음 세션에
//  또 나올 수 있습니다(중복). 특히 전체 문제보다 적게 뽑을 때 심합니다.
//
//  [해결] "최근에 본 문제(seenIds)"를 기억해 두고, 아직 안 본 문제를 먼저 채웁니다.
//  전체를 한 바퀴 다 보면 기록을 비우고 다시 시작합니다. → 한 바퀴 도는 동안은
//  중복이 없고, 매번 순서도 무작위로 섞입니다.
//
//  순수 함수라 화면/DB 와 무관하게 테스트할 수 있습니다. (localStorage 읽기/쓰기는
//  이 함수를 호출하는 화면 쪽에서 담당)
// ============================================================================

// 배열을 무작위로 섞음 (Fisher-Yates). 원본을 바꾸지 않고 새 배열 반환.
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 항목들(items)에서 count개를 "중복 최소화 + 무작위"로 고른다.
//  - id 로 각 항목을 구분 (keyword.id, exam.id)
//  - seenIds: 지난 세션들에서 이미 출제했던 id 목록
//  반환: picked(이번에 낼 항목들, 섞인 순서) / seen(다음에 저장할 새 seen 목록)
export function pickRotating<T extends { id: string }>(
  items: T[],
  seenIds: string[],
  count: number
): { picked: T[]; seen: string[] } {
  if (items.length === 0) return { picked: [], seen: [] };

  const take = count >= items.length ? items.length : count;
  const seenSet = new Set(seenIds);

  // 아직 안 본 것 / 이미 본 것으로 나눠 각각 섞는다.
  const unseen = shuffle(items.filter((it) => !seenSet.has(it.id)));
  const seen = shuffle(items.filter((it) => seenSet.has(it.id)));

  // 안 본 것을 먼저, 부족하면 본 것으로 채운다.
  const picked = [...unseen, ...seen].slice(0, take);

  // seen 기록 갱신: 이번에 낸 것들을 추가.
  let newSeen = [...seenIds, ...picked.map((p) => p.id)];
  // 전체를 한 바퀴 다 봤으면(모든 항목이 seen), 이번 세트만 남기고 초기화 → 다음 바퀴 시작.
  const allIds = new Set(items.map((it) => it.id));
  const seenAll = [...allIds].every((id) => newSeen.includes(id));
  if (seenAll) newSeen = picked.map((p) => p.id);

  return { picked, seen: newSeen };
}
