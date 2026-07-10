'use client'; // 이 파일이 브라우저에서 실행됨을 선언 (React 훅은 브라우저 전용)
import { useEffect, useState, useCallback } from 'react';
import type { Keyword } from '@/lib/types'; // "import type" = 타입만 가져옴 (실행 코드에는 안 남음)
import { listKeywords } from '@/lib/api';

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
  const [items, setItems] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || !subjectId) { setItems([]); return; }
    setLoading(true);
    try {
      setItems(await listKeywords(userId, subjectId));
    } finally {
      setLoading(false);
    }
  }, [userId, subjectId]);

  useEffect(() => { refresh(); }, [refresh]);

  // 학습범위 칩: 고정값이 아니라 데이터에서 뽑아냅니다.
  const eras = ['전체', ...Array.from(new Set(items.map((k) => k.era).filter(Boolean)))];

  return { items, eras, loading, refresh };
}
