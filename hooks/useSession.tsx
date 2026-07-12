'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 앱 전역의 "현재 사용자 / 현재 과목" 세션.
// page.tsx(로그인)에서 setUser, 홈에서 setSubject 하며, 학습 페이지들이 읽습니다.
interface SessionState {
  userId: string | null;
  subjectId: string | null;
  setUserId: (id: string | null) => void;
  setSubjectId: (id: string | null) => void;
  // localStorage 복원이 끝났는지. SSR/첫 렌더에는 항상 userId=null이라, 이 값을
  // 확인하지 않고 "userId === null → 로그인으로" 리다이렉트하면 새로고침할 때마다
  // 로그인 화면으로 튕겨나가는 문제가 생긴다 (복원되기 전 null을 "로그아웃"으로 오인).
  ready: boolean;
}

const Ctx = createContext<SessionState | null>(null);
const LS_USER = 'amgi_current_user';
const LS_SUBJECT = 'amgi_current_subject';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [subjectId, setSubjectIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUserIdState(localStorage.getItem(LS_USER));
    setSubjectIdState(localStorage.getItem(LS_SUBJECT));
    setReady(true);
  }, []);

  const setUserId = (id: string | null) => {
    id ? localStorage.setItem(LS_USER, id) : localStorage.removeItem(LS_USER);
    setUserIdState(id);
  };
  const setSubjectId = (id: string | null) => {
    id ? localStorage.setItem(LS_SUBJECT, id) : localStorage.removeItem(LS_SUBJECT);
    setSubjectIdState(id);
  };

  return <Ctx.Provider value={{ userId, subjectId, setUserId, setSubjectId, ready }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
