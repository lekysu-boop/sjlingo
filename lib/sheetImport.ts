import { clampImportance } from './importance';
import { findColumn } from './googleSheet';
import type { ExamInput } from './types';

// ============================================================================
//  Google Sheet 행 -> 기출문제 DTO 변환
// ----------------------------------------------------------------------------
//  Route Handler에서 데이터 모양 변환만 분리한 순수 함수입니다. Supabase나 네트워크가
//  없어도 실제 시트와 같은 배열을 넣어 보기/정답/중요도 매핑을 테스트할 수 있습니다.
// ============================================================================

export interface ParsedExamSheet {
  headerIndex: number;
  items: ExamInput[];
}

const valueAt = (row: string[], index: number, fallback = '') =>
  index >= 0 && row[index] != null ? row[index].trim() : fallback;

// 한능검 시트는 존재하지 않는 5번째 보기를 빈 칸 대신 '-'로 표시하기도 합니다.
const isOptionPlaceholder = (value: string) => value === '' || /^[-–—]$/.test(value);

const QUESTION_CANDIDATES = ['문제', '문항', '질문', 'question', 'questiontext', '문제내용', '문제 내용', '문제번호', '문제 번호'];
const ANSWER_CANDIDATES = ['정답', '해답', '답', 'answer', '정답선택', '정답 선택', '정답번호', '정답 번호', '답안'];
const isOptionLabel = (label: string) => /보기|선택지|opt|choice/i.test((label || '').replace(/\s/g, ''));

/**
 * 기출문제 헤더 행을 찾습니다. 정답 열은 이름 없이 보기 열 바로 뒤에만 있는 시트도 있어
 * (예: 정제 마스터 시트), 문제 열 + (이름 붙은 정답 열 또는 보기 열 1개 이상)만 요구합니다.
 */
function findExamHeaderIndex(rows: string[][]): number {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const questionIndex = findColumn(row, QUESTION_CANDIDATES);
    if (questionIndex < 0) continue;
    const hasNamedAnswer = findColumn(row, ANSWER_CANDIDATES) >= 0;
    const hasOptionColumn = row.some((label, index) => index !== questionIndex && isOptionLabel(label));
    if (hasNamedAnswer || hasOptionColumn) return rowIndex;
  }
  return -1;
}

/** 헤더 이름을 기준으로 기출문제 행을 파싱합니다. 헤더가 없으면 headerIndex=-1입니다. */
export function parseExamSheetRows(rows: string[][]): ParsedExamSheet {
  const headerIndex = findExamHeaderIndex(rows);
  if (headerIndex < 0) return { headerIndex, items: [] };

  const header = rows[headerIndex];
  const eraIndex = findColumn(header, ['시대', '범위', 'era']);
  const questionIndex = findColumn(header, QUESTION_CANDIDATES);
  let answerIndex = findColumn(header, ANSWER_CANDIDATES);
  const explanationIndex = findColumn(header, ['해설', '풀이', 'explain']);
  const importanceIndex = findColumn(header, ['중요도', '중요', 'importance']);

  const labeledOptionIndexes: number[] = [];
  header.forEach((label, index) => {
    // '정답 선택', '해설 (선택)'은 보기 열이 아니므로 이미 찾은 특수 열을 제외합니다.
    if (index === answerIndex || index === explanationIndex || index === importanceIndex) return;
    if (isOptionLabel(label)) labeledOptionIndexes.push(index);
  });
  // 보기 열 이름이 하나만 인식된 헤더(예: '보기1'만 명시)는 실제 보기 수를 알 수 없으므로
  // 최소 2개 이상 이름이 붙은 경우에만 그 위치를 신뢰하고, 그 외에는 기본 위치를 씁니다.
  const optionIndexes = labeledOptionIndexes.length >= 2 ? labeledOptionIndexes : [];

  // 정답 열 이름이 비어 있는 시트 대응: 보기 열들 바로 다음의 이름 없는 열을 정답 열로 간주합니다.
  if (answerIndex < 0 && optionIndexes.length) {
    const afterOptions = Math.max(...optionIndexes) + 1;
    if ((header[afterOptions] ?? '').trim() === '') answerIndex = afterOptions;
  }

  const items = rows
    .slice(headerIndex + 1)
    .map((row): ExamInput => {
      const sourceOptionIndexes = optionIndexes.length ? optionIndexes : [2, 3, 4, 5];
      const keptOptions = sourceOptionIndexes
        .map((columnIndex, originalIndex) => ({
          text: valueAt(row, columnIndex),
          originalIndex,
        }))
        .filter((option) => !isOptionPlaceholder(option.text));

      const options = keptOptions.map((option) => option.text);
      const answerRaw = valueAt(row, answerIndex, '1');
      const answerNumber = Number.parseInt(answerRaw, 10);
      let answer = Number.isNaN(answerNumber)
        ? options.findIndex((option) => option === answerRaw)
        : keptOptions.findIndex((option) => option.originalIndex === answerNumber - 1);

      // 원본 정답이 비어 있거나 제거된 보기('-')를 가리키면 첫 보기로 안전하게 보정합니다.
      if (answer < 0 || answer >= options.length) answer = 0;

      return {
        era: valueAt(row, eraIndex >= 0 ? eraIndex : 0, '기타'),
        question: valueAt(row, questionIndex >= 0 ? questionIndex : 1),
        options,
        answer,
        explain: valueAt(row, explanationIndex),
        importance: clampImportance(valueAt(row, importanceIndex, '2')),
      };
    })
    // '▶ 선사시대' 같은 구분 행에는 문제/보기가 없으므로 실제 문항에서 제외합니다.
    .filter((item) => item.question !== '' && item.options.length >= 2);

  return { headerIndex, items };
}
