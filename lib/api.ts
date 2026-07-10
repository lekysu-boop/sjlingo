// 프론트엔드에서 서버 REST API를 호출하는 얇은 래퍼.
// 화면 컴포넌트는 이 함수들만 쓰고, fetch 상세는 신경 쓰지 않습니다.
import type { Profile, Subject, Keyword, ExamQuestion, KeywordInput, ExamInput, UserProgress, GamifyState, LeagueEntry, RewardResult } from './types';

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---- 사용자 ----
export const listUsers = () => fetch('/api/users').then(j<Profile[]>);
export const createUser = (body: { name: string; emoji: string; color: string }) =>
  fetch('/api/users', { method: 'POST', body: JSON.stringify(body) }).then(j<Profile>);

// ---- 과목 ----
export const listSubjects = (userId: string) =>
  fetch(`/api/subjects?userId=${userId}`).then(j<Subject[]>);
export const createSubject = (body: { userId: string; name: string; emoji: string; color: string }) =>
  fetch('/api/subjects', { method: 'POST', body: JSON.stringify(body) }).then(j<Subject>);

// ---- 키워드 ----
export const listKeywords = (userId: string, subjectId: string) =>
  fetch(`/api/keywords?userId=${userId}&subjectId=${subjectId}`).then(j<Keyword[]>);
export const addKeywords = (userId: string, subjectId: string, items: KeywordInput[]) =>
  fetch('/api/keywords', { method: 'POST', body: JSON.stringify({ userId, subjectId, items }) })
    .then(j<{ added: number; skipped: number }>);
export const updateKeyword = (id: string, patch: Partial<KeywordInput>) =>
  fetch(`/api/keywords/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(j<Keyword>);
export const deleteKeyword = (id: string) =>
  fetch(`/api/keywords/${id}`, { method: 'DELETE' }).then(j<{ ok: boolean }>);

// ---- 기출 ----
export const listExams = (userId: string, subjectId: string) =>
  fetch(`/api/exams?userId=${userId}&subjectId=${subjectId}`).then(j<ExamQuestion[]>);
export const addExams = (userId: string, subjectId: string, items: ExamInput[]) =>
  fetch('/api/exams', { method: 'POST', body: JSON.stringify({ userId, subjectId, items }) })
    .then(j<{ added: number; skipped: number }>);
export const updateExam = (id: string, patch: Partial<ExamInput>) =>
  fetch(`/api/exams/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(j<ExamQuestion>);
export const deleteExam = (id: string) =>
  fetch(`/api/exams/${id}`, { method: 'DELETE' }).then(j<{ ok: boolean }>);

// ---- 학습 기록 ----
export const recordKeyword = (userId: string, keywordId: string, known: boolean) =>
  fetch('/api/progress/keyword', { method: 'POST', body: JSON.stringify({ userId, keywordId, known }) }).then(j);
export const recordAttempt = (userId: string, questionId: string, correct: boolean) =>
  fetch('/api/exams/attempt', { method: 'POST', body: JSON.stringify({ userId, questionId, correct }) }).then(j);
export const wrongExamIds = (userId: string) =>
  fetch(`/api/exams/attempt?userId=${userId}`).then(j<{ wrongIds: string[] }>);

// ---- 진도·응원 ----
export const getProgress = (userId: string) =>
  fetch(`/api/progress/${userId}`).then(j<UserProgress>);
export const sendCheer = (toId: string, fromId?: string) =>
  fetch('/api/cheers', { method: 'POST', body: JSON.stringify({ toId, fromId }) }).then(j<{ cheers: number }>);

// ---- 구글 시트 가져오기 ----
export const importSheet = (userId: string, subjectId: string, kind: 'keyword' | 'exam', url: string) =>
  fetch('/api/import/sheet', { method: 'POST', body: JSON.stringify({ userId, subjectId, kind, url }) })
    .then(j<{ added: number; skipped: number; parsed: number }>);

// ---- 게이미피케이션 ----
export const getGamify = (userId: string) =>
  fetch(`/api/gamify/${userId}`).then(j<GamifyState>);
export const reward = (body: { userId: string; correct: boolean; combo?: number; sessionComplete?: boolean }) =>
  fetch('/api/gamify/reward', { method: 'POST', body: JSON.stringify(body) }).then(j<RewardResult>);
export const getLeague = (userId: string) =>
  fetch(`/api/gamify/league?userId=${userId}`).then(j<LeagueEntry[]>);

// ---- 이메일 로그인 (선택 기능) ----
// 지금 화면은 이름 기반 로그인이지만, 이메일 가입 폼을 붙이면 이 함수들을 호출합니다.
export const signup = (body: { name: string; email: string; password: string }) =>
  fetch('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }).then(j<Profile>);
export const login = (body: { email: string; password: string }) =>
  fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }).then(j<Profile>);
