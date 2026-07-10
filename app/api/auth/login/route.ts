// ============================================================================
//  /api/auth/login  —  이메일 + 비밀번호로 로그인
// ----------------------------------------------------------------------------
//  [흐름]
//   1) 이메일로 사용자 조회
//   2) 저장된 password_hash 와 입력 비밀번호를 bcrypt.compare 로 대조
//   3) 맞으면 사용자 정보 반환(해시는 제외), 틀리면 401
//
//  [보안 팁] "이메일이 없음" 과 "비밀번호가 틀림" 을 구분해서 알려주면
//  공격자가 어떤 이메일이 가입돼 있는지 알아낼 수 있습니다. 그래서 두 경우
//  모두 동일한 메시지로 응답합니다. (계정 열거 공격 방지)
//
//  [참고] 지금은 로그인 성공 시 사용자 정보를 그대로 반환하는 "가벼운" 방식입니다.
//  실제 서비스로 키우려면 여기서 세션 토큰(JWT)이나 Supabase Auth 세션을 발급해
//  이후 요청의 신원을 검증하는 단계를 추가합니다. (schema.sql 옵션 B 참고)
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!isValidEmail(email) || !password) {
    return NextResponse.json({ error: '이메일과 비밀번호를 입력해 주세요' }, { status: 400 });
  }

  const db = createAdminClient();

  // 1) 이메일로 사용자 찾기 (비밀번호 해시 포함해서 가져옴 — 서버에서만 다룸)
  const { data: user } = await db
    .from('profiles')
    .select('id, name, email, emoji, color, password_hash, auth_provider')
    .eq('email', email)
    .maybeSingle();

  // 2) 사용자가 없거나 이메일 계정이 아니면 → 동일 메시지로 401 (계정 열거 방지)
  const FAIL = NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않아요' }, { status: 401 });
  if (!user || !user.password_hash) return FAIL;

  // 3) 입력 비밀번호와 저장된 해시 대조. (Spring 의 passwordEncoder.matches 와 동일)
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return FAIL;

  // 성공: 민감한 필드(password_hash)는 빼고 반환.
  // '...' 는 "전개(spread)" — 객체를 펼쳐 복사합니다. 여기선 필요한 필드만 새 객체로.
  return NextResponse.json({
    id: user.id, name: user.name, email: user.email, emoji: user.emoji, color: user.color,
  });
}
