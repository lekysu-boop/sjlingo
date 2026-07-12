'use client'; // 이 파일이 브라우저에서 실행됨을 선언 (React 훅은 브라우저 전용)
import { useEffect, useState, useCallback, useRef } from 'react';
import type { Keyword } from '@/lib/types'; // "import type" = 타입만 가져옴 (실행 코드에는 안 남음)
import { listKeywords } from '@/lib/api';
import { getCache, setCache, keywordsCacheKey as cacheKey, keywordIdsCacheKey } from '@/lib/dataCache';

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
  const requestedKey = userId && subjectId ? cacheKey(userId, subjectId) : null;
  const [items, setItems] = useState<Keyword[]>(
    () => (requestedKey && getCache<Keyword[]>(requestedKey)) || [],
  );
  const [loadedKey, setLoadedKey] = useState<string | null>(
    () => (requestedKey && getCache<Keyword[]>(requestedKey) ? requestedKey : null),
  );
  const [loading, setLoading] = useState(
    () => Boolean(requestedKey && !getCache<Keyword[]>(requestedKey)),
  );
  const activeKeyRef = useRef(requestedKey);
  activeKeyRef.current = requestedKey;

  const refresh = useCallback(async () => {
    if (!userId || !subjectId) { setItems([]); setLoadedKey(null); return; }
    const requestKey = cacheKey(userId, subjectId);
    setLoading(true);
    try {
      const data = await listKeywords(userId, subjectId);
      setCache(requestKey, data);
      // 홈 화면 요약(useStudySummary)이 참조하는 id 캐시도 같이 최신화해
      // 별도 재조회 없이 등록 개수·오늘 복습 개수가 즉시 맞아떨어지게 한다.
      setCache(keywordIdsCacheKey(userId, subjectId), data.map((k) => k.id));
      if (activeKeyRef.current === requestKey) { setItems(data); setLoadedKey(requestKey); }
    } finally {
      setLoading(false);
    }
  }, [userId, subjectId]);

  // 캐시가 있으면 그대로 쓰고 서버 재조회를 건너뛴다. 등록/수정/삭제 화면이
  // 그 자리에서 refresh()를 호출해 캐시를 최신화하므로, 학습 페이지는 데이터가
  // 실제로 바뀌었을 때만(=캐시가 없을 때) 다시 가져오면 된다.
  useEffect(() => {
    if (!userId || !subjectId) { setItems([]); setLoadedKey(null); setLoading(false); return; }
    const cached = getCache<Keyword[]>(cacheKey(userId, subjectId));
    if (cached) { setItems(cached); setLoadedKey(cacheKey(userId, subjectId)); setLoading(false); return; }
    refresh();
  }, [userId, subjectId, refresh]);

  // 학습범위 칩: 고정값이 아니라 데이터에서 뽑아냅니다.
  // 시트 데이터에 실제로 "전체"라는 분류값이 섞여 있어도(예: 요약 행) 중복 key가
  // 생기지 않도록 Set으로 한 번에 감싸 유일성을 보장한다.
  const eras = Array.from(new Set(['전체', ...items.map((k) => k.era).filter(Boolean)]));

  return { items, eras, loading: loading || Boolean(requestedKey && loadedKey !== requestedKey), refresh };
}
