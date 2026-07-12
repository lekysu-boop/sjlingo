const PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/** Supabase의 기본 1,000행 응답 한도를 넘어 모든 행을 읽습니다. */
export async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ data: T[]; error: PageResult<T>['error'] }> {
  const data: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await loadPage(from, from + PAGE_SIZE - 1);
    if (page.error) return { data, error: page.error };

    const rows = page.data ?? [];
    data.push(...rows);
    if (rows.length < PAGE_SIZE) return { data, error: null };
  }
}
