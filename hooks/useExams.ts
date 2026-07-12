'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import type { ExamQuestion } from '@/lib/types';
import { listExams } from '@/lib/api';
import { getCache, setCache, examsCacheKey as cacheKey, examCountCacheKey } from '@/lib/dataCache';

// 선택된 사용자+과목의 기출문제 목록 + 학습범위(era) 동적 추출.
export function useExams(userId: string | null, subjectId: string | null) {
  const requestedKey = userId && subjectId ? cacheKey(userId, subjectId) : null;
  const [items, setItems] = useState<ExamQuestion[]>(
    () => (requestedKey && getCache<ExamQuestion[]>(requestedKey)) || [],
  );
  const [loadedKey, setLoadedKey] = useState<string | null>(
    () => (requestedKey && getCache<ExamQuestion[]>(requestedKey) ? requestedKey : null),
  );
  const [loading, setLoading] = useState(
    () => Boolean(requestedKey && !getCache<ExamQuestion[]>(requestedKey)),
  );
  const activeKeyRef = useRef(requestedKey);
  activeKeyRef.current = requestedKey;

  const refresh = useCallback(async () => {
    if (!userId || !subjectId) { setItems([]); setLoadedKey(null); return; }
    const requestKey = cacheKey(userId, subjectId);
    setLoading(true);
    try {
      const data = await listExams(userId, subjectId);
      setCache(requestKey, data);
      // 홈 화면 요약(useStudySummary)이 참조하는 개수 캐시도 같이 최신화한다.
      setCache(examCountCacheKey(userId, subjectId), data.length);
      if (activeKeyRef.current === requestKey) { setItems(data); setLoadedKey(requestKey); }
    } finally {
      setLoading(false);
    }
  }, [userId, subjectId]);

  // 캐시가 있으면 그대로 쓰고 서버 재조회를 건너뛴다 (useKeywords와 동일한 전략).
  useEffect(() => {
    if (!userId || !subjectId) { setItems([]); setLoadedKey(null); setLoading(false); return; }
    const cached = getCache<ExamQuestion[]>(cacheKey(userId, subjectId));
    if (cached) { setItems(cached); setLoadedKey(cacheKey(userId, subjectId)); setLoading(false); return; }
    refresh();
  }, [userId, subjectId, refresh]);

  // 시트 데이터에 실제로 "전체"라는 분류값이 섞여 있어도(예: 요약 행) 중복 key가
  // 생기지 않도록 Set으로 한 번에 감싸 유일성을 보장한다.
  const eras = Array.from(new Set(['전체', ...items.map((q) => q.era).filter(Boolean)]));
  return { items, eras, loading: loading || Boolean(requestedKey && loadedKey !== requestedKey), refresh };
}
