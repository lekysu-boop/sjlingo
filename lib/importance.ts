// 중요도(1=하, 2=중, 3=상) 관련 공용 헬퍼

// 정규화: 1~3 숫자 또는 '상/중/하' 문자열 → 1~3 (그 외는 기본 2)
export function clampImportance(v: unknown): number {
  const n = typeof v === 'string'
    ? ({ 상: 3, 중: 2, 하: 1 } as Record<string, number>)[v.trim()] ?? parseInt(v)
    : Number(v);
  return n >= 1 && n <= 3 ? Math.round(n) : 2;
}

// 별 표시: 3 → ★★★
export const stars = (n: number): string => '★'.repeat(clampImportance(n));
