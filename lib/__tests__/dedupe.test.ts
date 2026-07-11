// ============================================================================
//  lib/__tests__/dedupe.test.ts  —  중복 판정 로직 테스트
// ----------------------------------------------------------------------------
//  키워드(암기코드)와 기출문제의 "이미 등록된 것인지" 판정 규칙을 검증합니다.
//  실행: npm run test
// ============================================================================
import { describe, it, expect } from 'vitest';
import { normCode, kwDup, exDup, dedupeKeywords, dedupeExactExams } from '../dedupe';

describe('normCode — 암기코드 정규화 (공백/슬래시 제거)', () => {
  it('공백과 슬래시를 없앤다', () => {
    expect(normCode('불태유 / 소태')).toBe('불태유소태');
  });
});

describe('kwDup — 암기코드 중복 판정', () => {
  it('공백만 다르면 같은 것으로 본다', () => {
    expect(kwDup({ code: '탕평책' }, { code: '탕 평 책' })).toBe(true);
  });
  it('내용이 다르면 다른 것', () => {
    expect(kwDup({ code: '탕평책' }, { code: '균역법' })).toBe(false);
  });
});

describe('exDup — 기출문제 중복 판정 (5단어 이상 겹치면 중복)', () => {
  it('문제 지문이 완전히 같으면 중복', () => {
    const a = { question: '세종이 창제한 문자는 무엇인가?' };
    expect(exDup(a, { question: '세종이 창제한 문자는 무엇인가?' })).toBe(true);
  });
  it('겹치는 단어가 적으면 다른 문제', () => {
    const a = { question: '세종이 창제한 문자는?' };
    const b = { question: '광종이 시행한 노비안검법의 목적은?' };
    expect(exDup(a, b)).toBe(false);
  });
});

describe('dedupeKeywords — 대량 입력에서 중복 걸러내기', () => {
  it('기존과 겹치는 것은 스킵하고 새 것만 추린다', () => {
    const existing = [{ code: '탕평책' }];
    const incoming = [{ code: '탕 평 책' }, { code: '균역법' }, { code: '균역법' }];
    const r = dedupeKeywords(existing, incoming);
    expect(r.added).toBe(1);   // 균역법 1개만 추가
    expect(r.skipped).toBe(2); // 탕평책(중복) + 균역법(자기들끼리 중복) 2개 스킵
  });
});

describe('dedupeExactExams — 정제 시트의 정확한 중복만 제거', () => {
  it('공통 문구가 있어도 문제 전문이 다르면 둘 다 유지한다', () => {
    const incoming = [
      { question: '구석기 시대의 생활 모습으로 옳은 것은?' },
      { question: '신석기 시대의 생활 모습으로 옳은 것은?' },
      { question: '구석기 시대의 생활 모습으로 옳은 것은?' },
    ];
    const result = dedupeExactExams([], incoming);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(1);
  });
});
