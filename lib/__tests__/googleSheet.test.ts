// Google Sheet 가져오기의 DB 바깥 경계(URL/CSV/헤더 탐색)를 검증합니다.
import { describe, expect, it } from 'vitest';
import { findColumn, findHeaderRow, parseCsv, toGoogleSheetCsvUrl } from '../googleSheet';
import { KOREAN_HISTORY_BASIC_EXAM_SHEET_URL } from '../defaultData';

describe('toGoogleSheetCsvUrl', () => {
  it('공유 URL의 문서 id와 탭 gid를 CSV URL에 보존한다', () => {
    const url = 'https://docs.google.com/spreadsheets/d/abc_123/edit?usp=sharing#gid=2484287';
    expect(toGoogleSheetCsvUrl(url)).toBe(
      'https://docs.google.com/spreadsheets/d/abc_123/gviz/tq?tqx=out:csv&gid=2484287',
    );
  });

  it('Google Sheets 문서 id가 없는 URL은 거부한다', () => {
    expect(toGoogleSheetCsvUrl('https://example.com/not-a-sheet')).toBeNull();
  });

  it('한국사 기본적재 URL은 TOC가 아닌 실제 데이터 탭 gid를 사용한다', () => {
    expect(toGoogleSheetCsvUrl(KOREAN_HISTORY_BASIC_EXAM_SHEET_URL)).toBe(
      'https://docs.google.com/spreadsheets/d/1nb5gkJcjacVIvY1U2bVnZKnaDv6bCT_NNEM6IM-MpN0/gviz/tq?tqx=out:csv&gid=1701503140',
    );
  });
});

describe('parseCsv', () => {
  it('쉼표·줄바꿈·큰따옴표가 든 셀을 보존한다', () => {
    const csv = '암기코드,설명\n"공연단","공주, 연천\n단양의 ""앞글자"""';
    expect(parseCsv(csv)).toEqual([
      ['암기코드', '설명'],
      ['공연단', '공주, 연천\n단양의 "앞글자"'],
    ]);
  });
});

describe('헤더 자동 탐색', () => {
  const rows = [
    ['Day-01~11 마스터 종합판'],
    ['총 암기코드 개수:', '674'],
    ['시대/주제', '암기코드', '역사적 핵심 개념', '연상 기법·매칭 원리'],
  ];

  it('공백이 달라도 열 이름을 찾는다', () => {
    expect(findColumn(rows[2], ['핵심개념'])).toBe(2);
  });

  it('제목 아래 실제 헤더 행을 찾는다', () => {
    expect(findHeaderRow(rows, [['암기코드'], ['핵심개념', '개념']])).toBe(2);
  });

  it('필수 열이 없으면 -1을 반환한다', () => {
    expect(findHeaderRow(rows, [['문제'], ['정답']])).toBe(-1);
  });
});
