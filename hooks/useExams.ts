'use client';
import { useEffect, useState, useCallback } from 'react';
import type { ExamQuestion } from '@/lib/types';
import { listExams } from '@/lib/api';

// 선택된 사용자+과목의 기출문제 목록 + 학습범위(era) 동적 추출.
export function useExams(userId: string | null, subjectId: string | null) {
  const [items, setItems] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || !subjectId) { setItems([]); return; }
    setLoading(true);
    try {
      setItems(await listExams(userId, subjectId));
    } finally {
      setLoading(false);
    }
  }, [userId, subjectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const eras = ['전체', ...Array.from(new Set(items.map((q) => q.era).filter(Boolean)))];
  return { items, eras, loading, refresh };
}
