// 공용 타입 정의 — 프론트/서버 공유
//
// [TypeScript 타입이란?]
// Java 의 class/DTO 필드 선언과 비슷합니다. "이 객체는 이런 필드를 가진다"를
// 컴파일 시점에 검사해 오타·타입 실수를 잡아줍니다. 실행 시에는 사라집니다
// (순수 JavaScript 로 변환됨). interface 는 Java 의 인터페이스가 아니라
// "구조를 설명하는 타입"에 가깝습니다.
//
// 필드 뒤 '?' 는 "선택 사항(없을 수도 있음)"을 뜻합니다. (nullable 과 유사)

export interface Profile {
  id: string;
  name: string;
  // --- 이메일 인증 확장용 필드 (지금은 보통 비어 있음) ---
  email?: string | null;         // 이메일 로그인으로 확장 시 사용
  auth_provider?: string;        // 'guest' | 'email' | 'google' ...
  auth_user_id?: string | null;  // Supabase Auth 의 사용자 id 와 연결
  // --- 화면 표시용 ---
  emoji: string;
  color: string;
  created_at?: string;
}

export interface Subject {
  id: string;
  owner_id: string;
  name: string;
  emoji: string;
  color: string;
  created_at?: string;
}

export interface Keyword {
  id: string;
  owner_id: string;
  subject_id: string;
  era: string;
  code: string;       // 앞면 키워드
  concept: string;    // 뜻·핵심 개념
  principle: string;  // 연상법·부가 설명
  day: string;        // 회차/단원(선택)
  importance: number; // 중요도 1=하 2=중 3=상
  created_at?: string;
}

// 신규 등록/가져오기 시 서버로 보내는 입력형 (id/owner 제외, 중요도는 선택 — 기본 2)
export type KeywordInput = Omit<Keyword, 'id' | 'owner_id' | 'created_at' | 'subject_id' | 'importance'> & { importance?: number };

export interface ExamQuestion {
  id: string;
  owner_id: string;
  subject_id: string;
  era: string;
  question: string;
  options: string[];
  answer: number;     // 0-based
  explain: string;
  importance: number; // 중요도 1=하 2=중 3=상
  created_at?: string;
}

export type ExamInput = Omit<ExamQuestion, 'id' | 'owner_id' | 'created_at' | 'subject_id' | 'importance'> & { importance?: number };

export interface MonthlyStat {
  label: string;   // "3월"
  kw: number;      // 키워드 학습 횟수
  exA: number;     // 기출 응답 수
  exC: number;     // 기출 정답 수
  total: number;   // kw + exA
}

// 과목별 통계 (study_sessions 를 과목 단위로 집계)
export interface SubjectStat {
  id: string;
  name: string;
  emoji: string;
  kwRate: number | null;  // 세션 가중평균 암기율 % (기록 없으면 null)
  exRate: number | null;  // 세션 가중평균 정답률 %
  studyMin: number;       // 공부시간(분)
  xp: number;             // 이 과목에서 얻은 XP (정답 수 × 10 기준)
  coins: number;          // 이 과목의 공부시간 보상 코인 (1분 = 1코인 기준)
  sessions: number;       // 세션 수
}

export interface UserProgress {
  kwRate: number;      // 키워드 암기율 % (세션 가중평균, 세션 기록 없으면 상태 기반)
  exRate: number;      // 기출 정답률 %
  overall: number;     // 전체 진도율 %
  known: number;
  totalKw: number;
  exCorrect: number;
  exAnswered: number;
  cheers: number;
  studyMin: number;    // 총 공부시간(분) — 실제 문제 푼 시간
  bySubject: SubjectStat[]; // 과목별 통계
  monthly: MonthlyStat[];
}

export interface ApiError { error: string; }

// ---------- 게이미피케이션 ----------
export interface GamifyState {
  streak: number;
  freezes: number;
  totalXp: number;
  todayXp: number;
  dailyGoal: number;
  hearts: number;
  maxHearts: number;
  coins: number;
  nextHeartInMin: number | null; // 다음 하트 회복까지 남은 분 (null이면 풀)
}

export interface LeagueEntry {
  id: string;
  name: string;
  emoji: string;
  xp: number;        // 이번 주 XP
  studyMin: number;  // 이번 주 공부시간(분)
  quality: number;   // 이번 주 과목별 평균 정답률(암기율·정답률 평균, 0~100)
  score: number;     // 순위 점수 = 공부시간×3 + XP + 평균 정답률
  rank: number;
  me: boolean;
  promote: boolean;
}

// 학습 이벤트 → 서버에 보내는 보상 요청
export interface RewardResult {
  state: GamifyState;
  gainedXp: number;
  gainedCoins: number;  // 세션 완료 시 공부시간 비례 코인 (1분 = 1코인)
  streakUp: boolean;
  leveledGoal: boolean; // 오늘 목표 달성 순간
}
