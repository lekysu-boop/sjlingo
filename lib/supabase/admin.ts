// ============================================================================
//  lib/supabase/admin.ts  —  서버 전용 DB 접속 (관리자 권한)
// ----------------------------------------------------------------------------
//  [비유] JDBC 로 DB 에 붙을 때 쓰는 "관리자 계정 Connection 팩토리"입니다.
//  createAdminClient() 를 호출하면 Supabase(PostgreSQL) 에 접속하는 객체를
//  돌려줍니다. 이 객체로 .from('테이블').select()/.insert() 등을 호출합니다.
//
//  [매우 중요 — 보안]
//  이 클라이언트는 'service_role' 키를 씁니다. 이 키는 RLS(행 단위 보안)를
//  통째로 무시하는 "슈퍼 관리자" 권한입니다. Oracle 의 SYS/SYSTEM 계정과
//  비슷합니다. 따라서:
//    - 절대 브라우저(클라이언트 컴포넌트)에서 import 하면 안 됩니다.
//    - 오직 서버(app/api/.../route.ts)에서만 사용합니다.
//    - 키 값은 .env.local 과 배포 서버의 환경변수에만 넣고 깃허브에 올리지 않습니다.
//  "누가 어떤 데이터에 접근 가능한가"는 각 API 라우트에서 owner_id 로 직접 확인합니다.
// ============================================================================
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    // 접속 주소와 키는 코드에 직접 쓰지 않고 환경변수에서 읽습니다.
    // process.env.XXX : OS/배포판의 환경변수. (Java 의 System.getenv("XXX") 와 동일)
    // 뒤의 '!' 는 TypeScript 에게 "이 값은 반드시 있다"고 알리는 표시입니다.
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // 서버에서는 로그인 세션을 유지할 필요가 없으므로 꺼 둡니다.
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
