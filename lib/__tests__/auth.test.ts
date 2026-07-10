// ============================================================================
//  lib/__tests__/auth.test.ts  —  이메일 로그인 입력 검증 테스트
// ----------------------------------------------------------------------------
//  실행: npm run test
// ============================================================================
import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidPassword, validateSignup } from '../auth';

describe('isValidEmail', () => {
  it('정상 이메일은 통과', () => {
    expect(isValidEmail('user@test.com')).toBe(true);
  });
  it('@ 나 도메인이 없으면 실패', () => {
    expect(isValidEmail('user')).toBe(false);
    expect(isValidEmail('user@test')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('8자 이상만 통과', () => {
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('123')).toBe(false);
  });
});

describe('validateSignup — 회원가입 입력 전체 검증', () => {
  it('모두 정상이면 null(문제 없음) 반환', () => {
    expect(validateSignup({ name: '지호', email: 'a@b.com', password: '12345678' })).toBeNull();
  });
  it('이름이 없으면 이름 관련 메시지', () => {
    expect(validateSignup({ email: 'a@b.com', password: '12345678' })).toMatch(/이름/);
  });
  it('비밀번호가 짧으면 비밀번호 관련 메시지', () => {
    expect(validateSignup({ name: '지호', email: 'a@b.com', password: '123' })).toMatch(/비밀번호/);
  });
});
