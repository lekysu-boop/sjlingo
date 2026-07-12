import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from '../supabase/pagination';

describe('fetchAllPages', () => {
  it('Supabase 기본 한도인 1,000행을 넘어 끝 페이지까지 합친다', async () => {
    const source = Array.from({ length: 1750 }, (_, id) => ({ id }));
    const loadPage = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    const result = await fetchAllPages(loadPage);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1750);
    expect(loadPage).toHaveBeenNthCalledWith(1, 0, 999);
    expect(loadPage).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});
