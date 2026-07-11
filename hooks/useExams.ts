'use client';
import { useEffect, useState, useCallback } from 'react';
import type { ExamQuestion } from '@/lib/types';
import { listExams } from '@/lib/api';
import { getCache, setCache } from '@/lib/dataCache';

const cacheKey = (userId: string, subjectId: string) => `ex:${userId}:${subjectId}`;

// 선택된 사용자+과목의 기출문제 목록 + 학습범위(era) 동적 추출.
export function useExams(userId: string | null, subjectId: string | null) {
  const [items, setItems] = useState<ExamQuestion[]>(
    () => (userId && subjectId && getCache<ExamQuestion[]>(cacheKey(userId, subjectId))) || [],
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || !subjectId) { setItems([]); return; }
    setLoading(true);
    try {
      const data = await listExams(userId, subjectId);
      setCache(cacheKey(userId, subjectId), data);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [userId, subjectId]);

  // 캐시가 있으면 그대로 쓰고 서버 재조회를 건너뛴다 (useKeywords와 동일한 전략).
  useEffect(() => {
    if (!userId || !subjectId) { setItems([]); return; }
    const cached = getCache<ExamQuestion[]>(cacheKey(userId, subjectId));
    if (cached) { setItems(cached); return; }
    refresh();
  }, [userId, subjectId, refresh]);

  const eras = ['전체', ...Array.from(new Set(items.map((q) => q.era).filter(Boolean)))];
  return { items, eras, loading, refresh };
}
