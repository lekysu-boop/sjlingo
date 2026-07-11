'use client';
import { useEffect, useState, useCallback } from 'react';
import type { Subject } from '@/lib/types';
import { listSubjects, createSubject } from '@/lib/api';

// 사용자의 과목 목록 + 선택 상태 관리.
// preferredId: 세션(localStorage)에 저장된 "마지막 선택 과목".
// 목록을 새로 불러올 때 무조건 첫 과목으로 리셋하지 않고, 세션의 과목을
// 우선 유지한다 (학습/데이터 화면에 다녀와도 선택이 유지되도록).
export function useSubjects(userId: string | null, preferredId?: string | null) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setSubjects([]); return []; }
    setLoading(true);
    try {
      const list = await listSubjects(userId);
      setSubjects(list);
      setCurrentId((cur) => {
        if (cur && list.some((s) => s.id === cur)) return cur;                 // 이미 유효한 선택이 있으면 유지
        if (preferredId && list.some((s) => s.id === preferredId)) return preferredId; // 세션에 저장된 과목 복원
        return list[0]?.id ?? null;                                            // 그 외에만 첫 과목
      });
      return list;
    } finally {
      setLoading(false);
    }
  }, [userId, preferredId]);

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
