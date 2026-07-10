'use client';
import { useEffect, useState, useCallback } from 'react';
import type { UserProgress } from '@/lib/types';
import { getProgress } from '@/lib/api';

// 한 사용자의 진도·월간·응원 통계. 학습 후 refresh()로 갱신.
export function useProgress(userId: string | null) {
  const [data, setData] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setData(null); return; }
    setLoading(true);
    try {
      setData(await getProgress(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, refresh };
}
