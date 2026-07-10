// ============================================================================
//  lib/__tests__/gamify.test.ts  —  첫 단위 테스트 예시 (Vitest)
// ----------------------------------------------------------------------------
//  [테스트란?] "이 함수에 이런 입력을 주면 이런 결과가 나와야 한다"를 코드로
//  적어두고 자동 검증하는 것입니다. JUnit 의 @Test 와 같은 개념입니다.
//    JUnit                     Vitest
//    @Test void x(){...}   →   it('설명', () => {...})
//    assertEquals(a, b)    →   expect(b).toBe(a)
//    class ...Test         →   describe('묶음 이름', () => {...})
//
//  [실행 방법] 터미널에서:  npm run test
//  (부작용 없는 "순수 함수"만 골라 테스트합니다. DB·네트워크가 없어 빠르고 안정적)
// ============================================================================
import { describe, it, expect } from 'vitest';
import { xpFor, bumpStreak, regenHearts, weekStart, MAX_HEARTS } from '../gamify';

// describe : 관련된 테스트를 묶는 그룹 (JUnit 의 테스트 클래스)
describe('xpFor — 콤보에 따른 XP 계산', () => {
  it('콤보가 3 미만이면 기본 10 XP', () => {
    expect(xpFor(0)).toBe(10);
    expect(xpFor(2)).toBe(10);
  });
  it('콤보 3 이상이면 보너스 +5 (총 15 XP)', () => {
    expect(xpFor(3)).toBe(15);
    expect(xpFor(10)).toBe(15);
  });
});

describe('bumpStreak — 연속 학습일 갱신', () => {
  it('오늘 이미 학습했으면 스트릭 그대로', () => {
    const r = bumpStreak(5, '2026-07-10', '2026-07-10');
    expect(r.streak).toBe(5);
    expect(r.firstToday).toBe(false);
  });
  it('어제 학습했으면 +1', () => {
    const r = bumpStreak(5, '2026-07-09', '2026-07-10');
    expect(r.streak).toBe(6);
    expect(r.firstToday).toBe(true);
  });
  it('하루 이상 건너뛰면 1로 리셋', () => {
    const r = bumpStreak(5, '2026-07-01', '2026-07-10');
    expect(r.streak).toBe(1);
  });
  it('처음 학습(기록 없음)이면 1', () => {
    const r = bumpStreak(0, null, '2026-07-10');
    expect(r.streak).toBe(1);
  });
});

describe('regenHearts — 하트 시간 회복 (30분당 1개)', () => {
  const now = new Date('2026-07-10T12:00:00Z');
  it('이미 가득이면 그대로', () => {
    const r = regenHearts(MAX_HEARTS, '2026-07-10T00:00:00Z', now);
    expect(r.hearts).toBe(MAX_HEARTS);
  });
  it('60분 지나면 2개 회복', () => {
    // 11:00 기준 → 12:00 까지 60분 → 30분당 1개 → 2개 회복
    const r = regenHearts(1, '2026-07-10T11:00:00Z', now);
    expect(r.hearts).toBe(3);
  });
  it('회복해도 최대치를 넘지 않음', () => {
    const r = regenHearts(4, '2026-07-10T00:00:00Z', now); // 아주 오래 지남
    expect(r.hearts).toBe(MAX_HEARTS);
  });
});

describe('weekStart — 그 주 월요일 계산 (리그 주간 기준)', () => {
  it('수요일을 넣으면 그 주 월요일을 반환', () => {
    // 2026-07-08 은 수요일 → 그 주 월요일은 2026-07-06
    expect(weekStart(new Date('2026-07-08T09:00:00Z'))).toBe('2026-07-06');
  });
  it('월요일을 넣으면 자기 자신', () => {
    expect(weekStart(new Date('2026-07-06T00:00:00Z'))).toBe('2026-07-06');
  });
});
