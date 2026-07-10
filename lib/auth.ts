// ============================================================================
//  lib/auth.ts  —  이메일 로그인용 순수 유틸 (검증 규칙)
// ----------------------------------------------------------------------------
//  비밀번호 해싱 자체는 서버 라우트에서 bcrypt 로 처리하고, 여기에는
//  "부작용 없는" 검증 함수만 둡니다. (테스트하기 쉽도록 순수 함수로 분리)
//  Spring 으로 치면 Validator 클래스에 해당합니다.
// ============================================================================

// 이메일 형식이 맞는지 아주 기본적인 검사.
// (완벽한 정규식은 과하므로, 실무에서도 이 수준 + 실제 인증메일 발송으로 확인합니다.)
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// 비밀번호 규칙: 최소 8자. (원하면 대문자/숫자 조건을 여기서 강화)
export function isValidPassword(pw: string): boolean {
  return typeof pw === 'string' && pw.length >= 8;
}

// 회원가입 입력 전체를 검증해, 문제가 있으면 메시지를 반환(없으면 null).
export function validateSignup(input: { email?: string; password?: string; name?: string }): string | null {
  if (!input.name || !input.name.trim()) return '이름을 입력해 주세요';
  if (!input.email || !isValidEmail(input.email)) return '올바른 이메일 형식이 아니에요';
  if (!input.password || !isValidPassword(input.password)) return '비밀번호는 8자 이상이어야 해요';
  return null;
}
