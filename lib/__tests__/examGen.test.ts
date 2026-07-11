import { describe, expect, it } from 'vitest';
import { generateExamFromKeywords, isSyntheticExamId } from '../examGen';
import type { Keyword } from '../types';

function makeKeyword(over: Partial<Keyword>): Keyword {
  return {
    id: 'id', owner_id: 'u', subject_id: 's', era: '일반/학술',
    code: 'essential', concept: '필수적인', principle: '', day: '', importance: 2,
    ...over,
  };
}

describe('generateExamFromKeywords', () => {
  it('키워드가 2개 미만이면 문제를 만들지 않는다', () => {
    expect(generateExamFromKeywords([makeKeyword({})])).toEqual([]);
    expect(generateExamFromKeywords([])).toEqual([]);
  });

  it('각 키워드마다 정답이 포함된 4지선다 문제를 만든다', () => {
    const keywords = [
      makeKeyword({ id: '1', code: 'essential', concept: '필수적인' }),
      makeKeyword({ id: '2', code: 'necessary', concept: '필요한' }),
      makeKeyword({ id: '3', code: 'survey', concept: '조사' }),
      makeKeyword({ id: '4', code: 'gather', concept: '모으다' }),
      makeKeyword({ id: '5', code: 'reduce', concept: '줄이다' }),
    ];
    const exams = generateExamFromKeywords(keywords);
    expect(exams).toHaveLength(5);
    exams.forEach((q) => {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(4);
      expect(q.options[q.answer]).toBeTruthy();
      expect(new Set(q.options).size).toBe(q.options.length); // 중복 보기 없음
      expect(isSyntheticExamId(q.id)).toBe(true);
      expect(q.explain).toContain(q.options[q.answer]);
    });
  });

  it('뜻이 같은 다른 키워드는 오답 보기로 쓰지 않는다', () => {
    const keywords = [
      makeKeyword({ id: '1', code: 'essential', concept: '필수적인' }),
      makeKeyword({ id: '2', code: 'necessary', concept: '필수적인' }), // 동일한 뜻
      makeKeyword({ id: '3', code: 'survey', concept: '조사' }),
    ];
    const exams = generateExamFromKeywords(keywords);
    const q = exams.find((e) => e.id === 'synthetic:1')!;
    // '필수적인' 중복 없이 정답 자리에 한 번만 있어야 함
    expect(q.options.filter((o) => o === '필수적인')).toHaveLength(1);
  });
});
