// ============================================================================
//  lib/__tests__/rotation.test.ts  —  문제 로테이션(중복 최소화) 테스트
//  실행: npm run test
// ============================================================================
import { describe, it, expect } from 'vitest';
import { pickRotating } from '../rotation';

const items = [
  { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' },
];

describe('pickRotating — 안 본 문제 우선 + 무작위', () => {
  it('요청 개수만큼 뽑는다', () => {
    const r = pickRotating(items, [], 3);
    expect(r.picked.length).toBe(3);
  });

  it('이미 본 것(seen)은 뒤로 밀리고, 안 본 것이 먼저 뽑힌다', () => {
    // a,b 를 이미 봤다면 → c,d,e 중에서 먼저 뽑혀야 함
    const r = pickRotating(items, ['a', 'b'], 3);
    const ids = r.picked.map((p) => p.id).sort();
    expect(ids).toEqual(['c', 'd', 'e']);
  });

  it('한 바퀴를 다 돌면 seen 기록이 이번 세트로 초기화된다', () => {
    // c,d,e 를 이미 봤고 이번에 a,b 를 뽑으면 전체(a~e)를 다 본 것 → seen 리셋
    const r = pickRotating(items, ['c', 'd', 'e'], 2);
    // 이번에 뽑힌 것만 남아야 함 (다음 바퀴 시작)
    expect(r.seen.sort()).toEqual(r.picked.map((p) => p.id).sort());
    expect(r.seen.length).toBe(2);
  });

  it('count 가 전체보다 크면 전체를 반환', () => {
    const r = pickRotating(items, [], 999);
    expect(r.picked.length).toBe(items.length);
  });

  it('빈 목록은 빈 결과', () => {
    const r = pickRotating([], [], 5);
    expect(r.picked).toEqual([]);
  });
});
