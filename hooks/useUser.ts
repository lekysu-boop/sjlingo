// 'use client' : 이 파일은 "브라우저에서 실행되는 코드"라는 표시입니다.
// Next.js 는 기본적으로 코드를 서버에서 실행합니다(=서버 컴포넌트).
// 그런데 화면 상태(state)나 클릭 이벤트, localStorage 처럼 브라우저에서만
// 되는 일을 하려면 이 선언이 파일 맨 위에 있어야 합니다.
'use client';

// React 의 "훅(Hook)". 훅은 함수형 컴포넌트에 상태·생명주기를 붙여주는 도구입니다.
//  - useState  : 값 + 그 값을 바꾸는 함수를 만든다 (화면에 반영되는 변수)
//  - useEffect : 특정 시점에 실행되는 코드 (Spring 의 @PostConstruct 같은 초기화 등)
//  - useCallback : 함수를 "기억"해 불필요한 재생성을 막는다 (성능 최적화)
import { useEffect, useState, useCallback } from 'react';
import type { Profile } from '@/lib/types';
import { listUsers } from '@/lib/api';

// localStorage 에 "현재 로그인한 사용자 id"를 저장할 때 쓰는 키 이름.
// localStorage 는 브라우저에 값을 영구 저장하는 공간입니다(쿠키와 비슷하지만 더 큼).
// 여기에 사용자 id 를 넣어 두면 앱을 다시 열어도 자동 로그인이 됩니다.
const LS_KEY = 'amgi_current_user';

// ============================================================================
//  useUser  —  "로그인/사용자 선택" 로직을 담은 커스텀 훅
// ----------------------------------------------------------------------------
//  [비유] Spring 의 Service 빈 하나라고 생각하면 됩니다. 화면(컴포넌트)은
//  이 훅을 호출해서 users(목록), current(로그인한 사람), login(), logout() 등을
//  받아 쓰기만 하면 됩니다. 데이터를 어떻게 가져오고 저장하는지는 여기 숨깁니다.
//
//  현재는 "이름만 골라 로그인"하는 가벼운 방식입니다. 나중에 이메일/비밀번호
//  로그인으로 바꿀 때도 화면 코드는 그대로 두고 이 훅의 내부만 교체하면 됩니다.
// ============================================================================
export function useUser() {
  // useState 반환값 [값, 세터]. 배열 구조 분해로 두 개를 한 번에 받습니다.
  // 세터(setUsers 등)를 호출하면 React 가 화면을 자동으로 다시 그립니다.
  const [users, setUsers] = useState<Profile[]>([]);          // 전체 사용자 목록
  const [currentId, setCurrentId] = useState<string | null>(null); // 로그인한 id
  const [loading, setLoading] = useState(true);                // 첫 로딩 중 여부

  // 서버에서 사용자 목록을 다시 불러오는 함수.
  // async/await : listUsers() 가 네트워크로 데이터를 받아올 때까지 기다립니다.
  const refresh = useCallback(async () => {
    const list = await listUsers(); // GET /api/users 호출
    setUsers(list);
    return list;
  }, []);

  // useEffect(fn, []) : []("의존성 배열"이 빔) → 컴포넌트가 처음 화면에 뜰 때
  // 딱 한 번 실행됩니다. Spring 의 초기화 콜백과 비슷합니다.
  useEffect(() => {
    // 즉시 실행 async 함수. (useEffect 자체는 async 가 될 수 없어서 안에서 감쌈)
    (async () => {
      const list = await refresh();
      // 브라우저에 저장해 둔 이전 로그인 id 를 읽어 자동 로그인.
      const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
      // some(...) : 목록 안에 그 id 가 실제로 있는지 확인(삭제된 사용자 방지).
      // (u) => u.id === saved 는 "화살표 함수". Java 의 람다 u -> u.getId().equals(saved) 와 같습니다.
      if (saved && list.some((u) => u.id === saved)) setCurrentId(saved);
      setLoading(false);
    })();
  }, [refresh]);

  // 로그인: id 를 localStorage 에 저장하고 상태에도 반영.
  const login = useCallback((id: string) => {
    localStorage.setItem(LS_KEY, id);
    setCurrentId(id);
  }, []);

  // 로그아웃: 저장된 id 제거.
  const logout = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setCurrentId(null);
  }, []);

  // 현재 로그인한 사용자 객체를 목록에서 찾음. 없으면 null.
  // '?? null' : 앞의 값이 undefined/null 이면 null 을 대신 쓴다(널 병합 연산자).
  const current = users.find((u) => u.id === currentId) ?? null;

  // 화면이 사용할 값·함수들을 객체로 묶어 반환. (Service 의 public 메서드 모음과 비슷)
  return { users, current, currentId, loading, login, logout, refresh, setUsers };
}
