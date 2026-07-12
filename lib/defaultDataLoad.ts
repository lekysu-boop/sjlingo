// 학습 화면(키워드 인출/기출문제)에서 데이터가 비어 있을 때 그 자리에서 바로
// "기본데이터"를 적재하기 위한 공용 함수. 소스 선택 규칙은 app/data/page.tsx의
// 데이터 관리 화면과 동일하게 과목명으로 판단한다.
import { addKeywords, addExams, importSheet } from './api';
import {
  DEFAULT_KEYWORDS,
  DEFAULT_EXAMS,
  KOREAN_HISTORY_KEYWORD_SHEET_URL,
  KOREAN_HISTORY_BASIC_EXAM_SHEET_URL,
  KOREAN_HISTORY_ADVANCED_EXAM_SHEET_URL,
  ENGLISH_WORD_KEYWORD_SHEET_URL,
  isKoreanHistorySubject,
  isEnglishWordSubject,
} from './defaultData';

export type LoadSummary = { label: string; added: number; skipped: number; parsed?: number; rejected?: number };

export async function loadDefaultKeywords(userId: string, subjectId: string, subjectName?: string | null): Promise<LoadSummary> {
  if (isKoreanHistorySubject(subjectName)) {
    const r = await importSheet(userId, subjectId, 'keyword', KOREAN_HISTORY_KEYWORD_SHEET_URL);
    return { label: '한국사 암기코드', ...r };
  }
  if (isEnglishWordSubject(subjectName)) {
    const r = await importSheet(userId, subjectId, 'keyword', ENGLISH_WORD_KEYWORD_SHEET_URL);
    return { label: '영어 단어', ...r };
  }
  const r = await addKeywords(userId, subjectId, DEFAULT_KEYWORDS);
  return { label: '기본 키워드', ...r };
}

export async function loadDefaultExam(
  userId: string,
  subjectId: string,
  subjectName: string | null | undefined,
  level: 'basic' | 'advanced' = 'basic',
): Promise<LoadSummary> {
  if (isKoreanHistorySubject(subjectName)) {
    const url = level === 'basic' ? KOREAN_HISTORY_BASIC_EXAM_SHEET_URL : KOREAN_HISTORY_ADVANCED_EXAM_SHEET_URL;
    const r = await importSheet(userId, subjectId, 'exam', url);
    return { label: level === 'basic' ? '한국사 기출 기본' : '한국사 기출 심화', ...r };
  }
  const r = await addExams(userId, subjectId, DEFAULT_EXAMS);
  return { label: '기본 기출문제', ...r };
}
