'use client';
import { useEffect, useState, useCallback } from 'react';
import type { Subject } from '@/lib/types';
import { listSubjects, createSubject } from '@/lib/api';

// 사용자의 과목 목록 + 선택 상태 관리.
export function useSubjects(userId: string | null) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setSubjects([]); return []; }
    setLoading(true);
    try {
      const list = await listSubjects(userId);
      setSubjects(list);
      setCurrentId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? null));
      return list;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (name: string, emoji: string, color: string) => {
    if (!userId) return;
    const s = await createSubject({ userId, name, emoji, color });
    await refresh();
    setCurrentId(s.id);
    return s;
  }, [userId, refresh]);

  const current = subjects.find((s) => s.id === currentId) ?? null;
  return { subjects, current, currentId, setCurrentId, loading, refresh, add };
}
