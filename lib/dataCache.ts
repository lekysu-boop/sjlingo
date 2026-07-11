// 키워드/기출 목록용 클라이언트 캐시.
// 같은 사용자+과목으로 학습 페이지를 다시 열 때 서버 재조회 없이 즉시 렌더링하기 위함.
// 등록/수정/삭제로 실제 데이터가 바뀐 곳에서만 setCache(=refresh)를 호출해 캐시를 최신화한다.
const mem = new Map<string, unknown>();

function storageKey(key: string) {
  return `amgi_cache_${key}`;
}

export function getCache<T>(key: string): T | undefined {
  if (mem.has(key)) return mem.get(key) as T;
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as T;
    mem.set(key, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

export function setCache<T>(key: string, data: T) {
  mem.set(key, data);
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(storageKey(key), JSON.stringify(data)); } catch {}
}
