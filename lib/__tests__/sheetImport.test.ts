import { describe, expect, it } from 'vitest';
import { parseExamSheetRows } from '../sheetImport';

const HEADER = [
  '시대 대분류',
  '문제',
  '보기 1',
  '보기 2',
  '보기 3',
  '보기 4',
  '보기 5',
  '정답 선택',
  '해설 (선택)',
  '중요도',
  '빈출구분',
  '나의 학습 메모 (선택)',
];

describe('parseExamSheetRows — 한능검 기본 기출 시트 양식', () => {
  it('4행 헤더를 찾고 구분 행을 건너뛰며 문항을 DTO로 변환한다', () => {
    const rows = [
      ['Day-01~11 한능검 기출 기본 정제 마스터 종합판'],
      ['', '정제 완료된 총 기출 문항 수:', '150'],
      [],
      HEADER,
      ['▶ 선사시대'],
      [
        '선사시대',
        '[이미지: 주먹도끼] 이 시대의 생활 모습으로 옳은 것은?',
        '동굴이나 막집에서 살았다.',
        '가락바퀴를 사용했다.',
        '비파형 동검을 제작했다.',
        '고인돌을 축조했다.',
        '-',
        '1',
        '정답은 1번입니다.\n오답 정리도 포함됩니다.',
        '상',
        '상',
        '',
      ],
    ];

    const result = parseExamSheetRows(rows);

    expect(result.headerIndex).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      era: '선사시대',
      options: [
        '동굴이나 막집에서 살았다.',
        '가락바퀴를 사용했다.',
        '비파형 동검을 제작했다.',
        '고인돌을 축조했다.',
      ],
      answer: 0,
      importance: 3,
    });
  });

  it('중간의 빈 보기 제거 후에도 원본 보기 번호를 정답 인덱스로 다시 매핑한다', () => {
    const rows = [
      HEADER,
      ['조선', '문제', '보기 A', '-', '보기 C', '보기 D', '-', '3', '해설', '중'],
    ];

    const [item] = parseExamSheetRows(rows).items;
    expect(item.options).toEqual(['보기 A', '보기 C', '보기 D']);
    expect(item.answer).toBe(1);
    expect(item.importance).toBe(2);
  });

  it('문제 헤더가 없는 시트는 데이터로 오인하지 않는다', () => {
    const result = parseExamSheetRows([['시대', '암기코드', '핵심 개념']]);
    expect(result).toEqual({ headerIndex: -1, items: [] });
  });

  it('문항/해답 형태 헤더에도 대응한다', () => {
    const rows = [
      ['공지', '공지', '공지'],
      ['시대', '문항', '보기1', '보기2', '보기3', '보기4', '해답', '해설', '중요도'],
      ['고려', '질문 내용', 'A', 'B', 'C', 'D', '2', '설명', '중'],
    ];

    const result = parseExamSheetRows(rows);
    expect(result.headerIndex).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ question: '질문 내용', answer: 1, options: ['A', 'B', 'C', 'D'] });
  });

  it('100행 이상 아래 있는 헤더도 찾는다', () => {
    const rows = Array.from({ length: 120 }, (_, index) => [index === 105 ? '시대' : '', index === 105 ? '문제' : '', index === 105 ? '보기1' : '']);
    rows[106] = ['선사시대', '질문', 'A', 'B', 'C', 'D', '1'];

    const result = parseExamSheetRows(rows as string[][]);
    expect(result.headerIndex).toBe(105);
    expect(result.items[0]).toMatchObject({ question: '질문', options: ['A', 'B', 'C', 'D'], answer: 0 });
  });

  it('정답 열 이름이 비어 있어도 보기 열 바로 다음 열을 정답으로 인식한다 (정제 마스터 시트 실제 헤더)', () => {
    const header = ['시대 대분류', '문제', '보기 1', '보기 2', '보기 3', '보기 4', '보기 5', '', '해설 (선택)', '중요도', '빈출구분', '나의 학습 메모 (선택)'];
    const rows = [
      header,
      ['선사시대', '주먹도끼를 사용한 시대의 생활 모습은?', '동굴이나 막집에서 살았다.', '가락바퀴를 사용했다.', '비파형 동검을 제작했다.', '고인돌을 축조했다.', '-', '1', '해설', '상', '상', ''],
    ];

    const result = parseExamSheetRows(rows);
    expect(result.headerIndex).toBe(0);
    expect(result.items[0]).toMatchObject({
      options: ['동굴이나 막집에서 살았다.', '가락바퀴를 사용했다.', '비파형 동검을 제작했다.', '고인돌을 축조했다.'],
      answer: 0,
    });
  });
});
