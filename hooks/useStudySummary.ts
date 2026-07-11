'use client';
import { useEffect, useState, useCallback } from 'react';
import { listKeywordIds, countExams } from '@/lib/api';
import { getCache, setCache, keywordIdsCacheKey as kwIdsKey, examCountCacheKey as exCountKey } from '@/lib/dataCache';
import { loadSrs, dueItems } from '@/lib/srs';

// 홈 화면 카드에 필요한 건 "등록 개수"와 "오늘 복습 개수"뿐이라, 개념/원리/해설 같은
// 무거운 텍스트 컬럼까지 받는 useKeywords/useExams 대신 id/개수만 가볍게 가져온다.
export function useStudySummary(userId: string | null, subjectId: string | null) {
  const [kwIds, setKwIds] = useState<string[]>(() => {
    if (!userId || !subjectId) return [];
    return getCache<string[]>(kwIdsKey(userId, subjectId)) ?? [];
  });
  const [exCount, setExCount] = useState<number>(() => {
    if (!userId || !subjectId) return 0;
    return getCache<number>(exCountKey(userId, subjectId)) ?? 0;
  });

  const refresh = useCallback(async () => {
    if (!userId || !subjectId) { setKwIds([]); setExCount(0); return; }
    const [ids, ec] = await Promise.all([listKeywordIds(userId, subjectId), countExams(userId, subjectId)]);
    const idList = ids.map((r) => r.id);
    setCache(kwIdsKey(userId, subjectId), idList);
    setCache(exCountKey(userId, subjectId), ec.count);
    setKwIds(idList);
    setExCount(ec.count);
  }, [userId, subjectId]);

  useEffect(() => {
    if (!userId || !subjectId) { setKwIds([]); setExCount(0); return; }
    const cachedIds = getCache<string[]>(kwIdsKey(userId, subjectId));
    const cachedCount = getCache<number>(exCountKey(userId, subjectId));
    if (cachedIds && cachedCount !== undefined) { setKwIds(cachedIds); setExCount(cachedCount); return; }
    refresh();
  }, [userId, subjectId, refresh]);

  const dueCount = userId && subjectId
    ? dueItems(kwIds.map((id) => ({ id })), loadSrs(userId, subjectId)).length
    : 0;

  return { kwCount: kwIds.length, exCount, dueCount, refresh };
}
