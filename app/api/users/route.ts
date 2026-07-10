// ============================================================================
//  /api/users  —  사용자(프로필) 목록 조회 & 신규 등록 API
// ----------------------------------------------------------------------------
//  [이 파일이 하는 일 — Spring 개발자를 위한 비유]
//  Spring 으로 치면 @RestController 하나입니다.
//    - GET  /api/users  → 사용자 목록 반환   (SELECT * FROM profiles)
//    - POST /api/users  → 사용자 1명 등록    (INSERT INTO profiles ...)
//
//  Next.js 에서는 컨트롤러 클래스를 만들지 않습니다. 대신
//  "app/api/<경로>/route.ts" 파일에 GET/POST 라는 이름의 함수를 export 하면
//  그 함수가 곧 해당 URL 의 핸들러가 됩니다. (파일 위치 = URL 경로)
//    app/api/users/route.ts        → /api/users
//    app/api/users/[id]/route.ts   → /api/users/123  ([id]는 경로 변수)
// ============================================================================

// import 는 Java 의 import 와 같습니다. { } 로 특정 항목만 골라 가져옵니다.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin'; // '@/' 는 프로젝트 최상위 폴더

// 이 API 는 Node.js 런타임(서버)에서 실행하라는 선언입니다.
// (Next.js 에는 더 가벼운 'edge' 런타임도 있지만, DB 라이브러리 호환을 위해 nodejs 사용)
export const runtime = 'nodejs';

// ----------------------------------------------------------------------------
//  GET /api/users  —  로그인 화면에 뿌릴 사용자 목록
// ----------------------------------------------------------------------------
//  * async 함수 : "비동기" 함수. 내부에서 await 를 쓸 수 있습니다.
//    Java 로 치면 결과가 늦게 오는 작업(DB, 네트워크)을 기다리는 동안
//    스레드를 막지 않는 방식입니다. await 앞에 붙은 작업이 끝날 때까지
//    "기다렸다가" 다음 줄로 넘어갑니다. (Future.get() 과 비슷하지만 문법이 간결)
export async function GET() {
  const db = createAdminClient(); // DB 접속 핸들 얻기 (JDBC 의 Connection 과 유사)

  // Supabase 쿼리 빌더. 아래 한 줄은 SQL 로:
  //   SELECT * FROM profiles ORDER BY created_at ASC;
  //
  // { data, error } 는 "구조 분해 할당"입니다. Java 에는 없는 문법으로,
  // 반환된 객체에서 data 필드와 error 필드를 한 번에 꺼내 변수로 만듭니다.
  //   const result = await db...;  const data = result.data;  const error = result.error;
  // 위 세 줄을 아래 한 줄로 줄인 것입니다.
  const { data, error } = await db
    .from('profiles')                             // FROM profiles
    .select('*')                                  // SELECT *
    .order('created_at', { ascending: true });    // ORDER BY created_at ASC

  // 에러가 있으면 HTTP 500 과 함께 에러 메시지를 JSON 으로 반환.
  // NextResponse.json(...) 은 Spring 의 ResponseEntity.ok(body) 에 해당합니다.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data); // 정상: 200 OK + 사용자 배열(JSON)
}

// ----------------------------------------------------------------------------
//  POST /api/users  —  신규 사용자 등록
// ----------------------------------------------------------------------------
//  [이메일 인증 확장 설계]
//  지금은 이름만 받습니다(auth_provider='guest'). 하지만 profiles 테이블에는
//  email / auth_provider / auth_user_id 컬럼이 이미 있어서, 나중에
//  이메일 회원가입을 붙일 때 이 함수에 email 처리만 추가하면 됩니다.
//  (UI 는 그대로 두고 서버만 확장 가능하도록 설계)
export async function POST(req: NextRequest) {
  // 요청 본문(JSON)을 객체로 파싱. Spring 의 @RequestBody 자동 바인딩을
  // 여기서는 직접 await req.json() 으로 합니다.
  const body = await req.json();

  // 입력값 정리 및 검증.
  // (body.name || '') : body.name 이 없으면(undefined/null) 빈 문자열을 대신 씀.
  //   Java 의 삼항연산자 (name != null ? name : "") 와 같은 역할의 관용구입니다.
  const name = (body.name || '').trim();
  const email = (body.email || '').trim() || null; // 이메일은 지금 선택 사항
  if (!name) return NextResponse.json({ error: '이름을 입력해 주세요' }, { status: 400 });

  const db = createAdminClient();

  // 이메일이 넘어온 경우, 이미 가입된 이메일인지 확인 (중복 가입 방지).
  // 이메일 인증으로 확장할 때 이 블록이 그대로 쓰입니다.
  if (email) {
    const dup = await db.from('profiles').select('id').eq('email', email).maybeSingle();
    if (dup.data) return NextResponse.json({ error: '이미 등록된 이메일이에요' }, { status: 409 });
  }

  // INSERT INTO profiles(name, email, auth_provider, emoji, color) VALUES (...)
  // .select().single() : 방금 넣은 행을 되돌려 받아 1건으로 반환.
  //   (Oracle 의 INSERT ... RETURNING 과 같은 개념)
  const { data, error } = await db
    .from('profiles')
    .insert({
      name,
      email,                       // 지금은 보통 null
      auth_provider: 'guest',      // 이메일 인증 붙이면 'email' 로 저장
      emoji: body.emoji || '🦊',
      color: body.color || '#2563eb',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 신규 사용자에게 기본 과목(한국사)을 하나 자동 생성해 줍니다.
  // (가입 직후 빈 화면 대신 바로 시작할 수 있도록)
  await db.from('subjects').insert({
    owner_id: data.id, name: '한국사', emoji: '🏯', color: '#2563eb',
  });

  // 201 Created : 새 리소스가 만들어졌음을 뜻하는 표준 HTTP 상태 코드.
  return NextResponse.json(data, { status: 201 });
}
