import { describe, expect, it } from 'vitest';
import { parseQuestionDisplay } from '../examDisplay';

describe('parseQuestionDisplay', () => {
  it('실제 통합 시트의 회차와 제시 자료 표기를 지문에서 분리한다', () => {
    expect(parseQuestionDisplay('[57회 기본 1번 / 1점] [그림 설명] 전곡리 축제에서 적절한 활동은?')).toEqual({
      meta: '57회 기본 1번 / 1점',
      image: '그림 설명',
      text: '전곡리 축제에서 적절한 활동은?',
    });
  });

  it('일반 대괄호로 시작하는 지문은 회차 메타로 오인하지 않는다', () => {
    expect(parseQuestionDisplay('[보기]에 해당하는 사실은?').text).toBe('[보기]에 해당하는 사실은?');
  });
});
