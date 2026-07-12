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
  rejected: number;
}

const valueAt = (row: string[], index: number, fallback = '') =>
  index >= 0 && row[index] != null ? row[index].trim() : fallback;

// 한능검 시트는 존재하지 않는 5번째 보기를 빈 칸 대신 '-'로 표시하기도 합니다.
const isOptionPlaceholder = (value: string) => value === '' || /^[-–—]$/.test(value);

const QUESTION_CANDIDATES = ['문제', '문항', '질문', 'question', 'questiontext', '문제내용', '문제 내용', '문제번호', '문제 번호'];
const ANSWER_CANDIDATES = ['정답', '해답', '답', 'answer', '정답선택', '정답 선택', '정답번호', '정답 번호', '답안'];
const isOptionLabel = (label: string) => /보기|선택지|opt|choice/i.test((label || '').replace(/\s/g, ''));
const CIRCLED_ANSWERS = ['①', '②', '③', '④', '⑤'];

const normalizeHeader = (label: string) =>
  (label || '').replace(/^\uFEFF/, '').replace(/\s/g, '').toLowerCase();

/** `문항번호`보다 실제 `문제` 본문 열을 우선합니다. */
function findQuestionColumn(header: string[]): number {
  const exactNames = new Set(['문제', '문항', '질문', 'question', 'questiontext', '문제내용']);
  const exact = header.findIndex((label) => exactNames.has(normalizeHeader(label)));
  if (exact >= 0) return exact;

  return header.findIndex((label) => {
    const normalized = normalizeHeader(label);
    return !normalized.includes('번호') && QUESTION_CANDIDATES.some((candidate) =>
      normalized.includes(normalizeHeader(candidate)),
    );
  });
}

function parseOriginalAnswerIndex(answerRaw: string, sourceOptions: string[]): number {
  const normalized = answerRaw.trim();
  const circled = CIRCLED_ANSWERS.indexOf(normalized);
  if (circled >= 0) return circled;

  const numbered = normalized.match(/^(?:정답\s*[:：]?\s*)?([1-5])(?:번)?$/i);
  if (numbered) return Number(numbered[1]) - 1;

  return sourceOptions.findIndex((option) => option.trim() === normalized);
}

/**
 * 기출문제 헤더 행을 찾습니다. 정답 열은 이름 없이 보기 열 바로 뒤에만 있는 시트도 있어
 * (예: 정제 마스터 시트), 문제 열 + (이름 붙은 정답 열 또는 보기 열 1개 이상)만 요구합니다.
 */
function findExamHeaderIndex(rows: string[][]): number {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const questionIndex = findQuestionColumn(row);
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
  if (headerIndex < 0) return { headerIndex, items: [], rejected: 0 };

  const header = rows[headerIndex];
  const eraIndex = findColumn(header, ['시대', '범위', 'era']);
  const questionIndex = findQuestionColumn(header);
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

  let rejected = 0;
  const items = rows
    .slice(headerIndex + 1)
    .map((row): ExamInput | null => {
      const sourceOptionIndexes = optionIndexes.length ? optionIndexes : [2, 3, 4, 5];
      const sourceOptions = sourceOptionIndexes.map((columnIndex) => valueAt(row, columnIndex));
      const keptOptions = sourceOptions
        .map((text, originalIndex) => ({
          text,
          originalIndex,
        }))
        .filter((option) => !isOptionPlaceholder(option.text));

      const options = keptOptions.map((option) => option.text);
      const originalAnswer = parseOriginalAnswerIndex(valueAt(row, answerIndex), sourceOptions);
      const answer = keptOptions.findIndex((option) => option.originalIndex === originalAnswer);

      // 정답 없음/빈 값/제거된 보기를 임의로 1번 처리하면 오답 데이터가 되므로 제외합니다.
      if (answer < 0 || answer >= options.length) {
        if (valueAt(row, questionIndex) !== '' && options.length >= 2) rejected++;
        return null;
      }

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
    .filter((item): item is ExamInput => item !== null && item.question !== '' && item.options.length >= 2);

  return { headerIndex, items, rejected };
}
