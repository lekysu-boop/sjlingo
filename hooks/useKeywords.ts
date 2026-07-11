'use client'; // 이 파일이 브라우저에서 실행됨을 선언 (React 훅은 브라우저 전용)
import { useEffect, useState, useCallback } from 'react';
import type { Keyword } from '@/lib/types'; // "import type" = 타입만 가져옴 (실행 코드에는 안 남음)
import { listKeywords } from '@/lib/api';
import { getCache, setCache } from '@/lib/dataCache';

const cacheKey = (userId: string, subjectId: string) => `kw:${userId}:${subjectId}`;

// ----------------------------------------------------------------------------
//  useKeywords — 선택된 사용자+과목의 키워드 목록을 서버에서 불러오는 커스텀 훅
// ----------------------------------------------------------------------------
//  [커스텀 훅이란?] "use~" 로 시작하는 함수로, 여러 화면에서 반복되는
//  "상태 + 데이터 불러오기" 로직을 한 곳에 묶은 것입니다. Spring 으로 치면
//  Service 계층을 화면 쪽에 둔 느낌입니다.
//
//  [TS 문법] userId: string | null → "문자열 또는 null" (유니온 타입).
//  [TS 문법] useState<Keyword[]>([]) → 이 상태는 Keyword 배열이라고 제네릭으로 지정.
export function useKeywords(userId: string | null, subjectId: string | null) {
  const [items, setItems] = useState<Keyword[]>(
    () => (userId && subjectId && getCache<Keyword[]>(cacheKey(userId, subjectId))) || [],
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || !subjectId) { setItems([]); return; }
    setLoading(true);
    try {
      const data = await listKeywords(userId, subjectId);
      setCache(cacheKey(userId, subjectId), data);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [userId, subjectId]);

  // 캐시가 있으면 그대로 쓰고 서버 재조회를 건너뛴다. 등록/수정/삭제 화면이
  // 그 자리에서 refresh()를 호출해 캐시를 최신화하므로, 학습 페이지는 데이터가
  // 실제로 바뀌었을 때만(=캐시가 없을 때) 다시 가져오면 된다.
  useEffect(() => {
    if (!userId || !subjectId) { setItems([]); return; }
    const cached = getCache<Keyword[]>(cacheKey(userId, subjectId));
    if (cached) { setItems(cached); return; }
    refresh();
  }, [userId, subjectId, refresh]);

  // 학습범위 칩: 고정값이 아니라 데이터에서 뽑아냅니다.
  const eras = ['전체', ...Array.from(new Set(items.map((k) => k.era).filter(Boolean)))];

  return { items, eras, loading, refresh };
}
