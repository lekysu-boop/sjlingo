import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// 서버 컴포넌트/Route Handler에서 쿠키 기반 세션이 필요할 때 사용.
// 옵션 B(Supabase Auth)로 승격 시 이 클라이언트로 auth.uid()를 읽습니다.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서 호출된 경우 무시 (미들웨어에서 갱신)
          }
        },
      },
    }
  );
}
