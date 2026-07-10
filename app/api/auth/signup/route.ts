// ============================================================================
//  /api/auth/signup  —  이메일 + 비밀번호로 회원가입
// ----------------------------------------------------------------------------
//  [이 API 가 하는 일]
//   1) 입력값 검증 (이메일 형식, 비밀번호 길이)
//   2) 이메일 중복 확인
//   3) 비밀번호를 bcrypt 로 "단방향 해싱"해서 저장 (원문은 절대 저장 안 함)
//   4) 신규 사용자에게 기본 과목(한국사) 자동 생성
//
//  [Spring 대응] @PostMapping("/auth/signup") + BCryptPasswordEncoder.encode(pw)
//
//  [지금 UI 와의 관계]
//   현재 화면은 "이름만 골라 시작"하는 guest 모드입니다. 이 API 는 그와 별개로
//   이메일 회원가입을 받을 수 있게 미리 만들어 둔 것입니다. 화면에 이메일
//   가입 폼을 붙이고 싶을 때 이 엔드포인트를 호출하면 됩니다. (UI 변경은 선택)
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateSignup } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 1) 입력 검증. 문제가 있으면 400(Bad Request) 과 함께 메시지 반환.
  const invalid = validateSignup(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const email = body.email.trim().toLowerCase();
  const name = body.name.trim();
  const db = createAdminClient();

  // 2) 이메일 중복 확인. maybeSingle() = 0건 또는 1건 (없어도 에러 아님).
  const existing = await db.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing.data) return NextResponse.json({ error: '이미 가입된 이메일이에요' }, { status: 409 });

  // 3) 비밀번호 해싱. bcrypt.hash(원문, 라운드수).
  //    "라운드"가 클수록 느리지만 더 안전합니다. 10 이 일반적인 기본값입니다.
  //    해시는 매번 값이 달라지지만(salt 포함) compare 로 검증할 수 있습니다.
  const passwordHash = await bcrypt.hash(body.password, 10);

  // INSERT INTO profiles(...) — auth_provider 를 'email' 로 표시.
  const { data, error } = await db
    .from('profiles')
    .insert({
      name,
      email,
      auth_provider: 'email',
      password_hash: passwordHash,
      emoji: body.emoji || '🦊',
      color: body.color || '#2563eb',
    })
    .select('id, name, email, emoji, color') // 비밀번호 해시는 절대 응답에 포함하지 않음!
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 4) 기본 과목 자동 생성
  await db.from('subjects').insert({ owner_id: data.id, name: '한국사', emoji: '🏯', color: '#2563eb' });

  return NextResponse.json(data, { status: 201 });
}
