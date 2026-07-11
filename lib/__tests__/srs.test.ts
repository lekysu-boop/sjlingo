import { describe, it, expect } from 'vitest';
import { srsReview, isDue, dueItems, SRS_INTERVALS_DAYS, MAX_BOX, type SrsMap } from '../srs';

const now = new Date('2026-07-10T09:00:00Z');

describe('srsReview', () => {
  it('새 카드를 외우면 상자 1 (1일 뒤 복습)', () => {
    const e = srsReview(undefined, true, now);
    expect(e.box).toBe(1);
    expect(e.due).toBe('2026-07-11');
  });
  it('외울 때마다 상자가 올라가고 간격이 늘어난다 (1→3→7→14→30일)', () => {
    let e = srsReview(undefined, true, now);
    e = srsReview(e, true, now);
    expect(e.box).toBe(2);
    expect(e.due).toBe('2026-07-13'); // +3일
    e = srsReview(e, true, now);
    expect(e.due).toBe('2026-07-17'); // +7일
  });
  it('최대 상자를 넘지 않는다', () => {
    let e = { box: MAX_BOX, due: '2026-07-10' };
    e = srsReview(e, true, now);
    expect(e.box).toBe(MAX_BOX);
    expect(e.due).toBe(`2026-08-09`); // +30일
  });
  it('틀리면 상자 0으로 리셋되어 오늘 다시 복습 대상', () => {
    const e = srsReview({ box: 4, due: '2026-08-01' }, false, now);
    expect(e.box).toBe(0);
    expect(e.due).toBe('2026-07-10');
    expect(isDue(e, now)).toBe(true);
  });
});

describe('isDue', () => {
  it('기록 없는 새 카드는 복습 대상이 아님 (복습 = 학습한 적 있는 카드만)', () => {
    expect(isDue(undefined, now)).toBe(false);
  });
  it('예정일이 지났으면 대상, 미래면 비대상', () => {
    expect(isDue({ box: 2, due: '2026-07-09' }, now)).toBe(true);
    expect(isDue({ box: 2, due: '2026-07-10' }, now)).toBe(true);
    expect(isDue({ box: 2, due: '2026-07-11' }, now)).toBe(false);
  });
});

describe('dueItems', () => {
  it('학습 기록이 있는 카드 중 밀린 것만, 가장 오래 밀린 것부터 정렬', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const map: SrsMap = {
      a: { box: 1, due: '2026-07-08' }, // 이틀 밀림
      b: { box: 3, due: '2026-09-01' }, // 아직 멀었음 → 제외
      c: { box: 1, due: '2026-07-10' }, // 오늘
      // d: 기록 없음 → 새 카드 → 복습 목록에서 제외 (새 과목 오탐 방지)
    };
    const due = dueItems(items, map, now);
    expect(due.map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('SRS_INTERVALS_DAYS', () => {
  it('망각곡선을 따라 간격이 단조 증가한다', () => {
    for (let i = 1; i < SRS_INTERVALS_DAYS.length; i++) {
      expect(SRS_INTERVALS_DAYS[i]).toBeGreaterThan(SRS_INTERVALS_DAYS[i - 1]);
    }
  });
});
