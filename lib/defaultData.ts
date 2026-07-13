// 기본 샘플 데이터 (Supabase에 데이터가 없을 때 "기본데이터 넣기"로 주입)
import type { KeywordInput, ExamInput } from './types';

// 한국사 키워드는 작은 내장 샘플 대신 최종 통합본의 첫 탭(암기코드)을 사용합니다.
export const KOREAN_HISTORY_KEYWORD_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1O_f_xTbwFByE52a86pfNCAQbTIGofkcwmmfaCSdno2o/edit?usp=sharing';

// 한국사 기출문제는 난이도별 최종 통합본의 첫 탭(전체통합)을 사용합니다.
export const KOREAN_HISTORY_BASIC_EXAM_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1U1CjPfvykkcGrWTyt__RgCHMhuqSvlRygPtmoXCkafU/edit?usp=sharing';

export const KOREAN_HISTORY_ADVANCED_EXAM_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1lmQ3bFWvlQl7M8S0M9DBSf1TQlW2uGIQs2TElrToB2I/edit?usp=sharing';

/** 사용자가 과목명을 조금 다르게 지어도 한국사 기본 소스를 선택합니다. */
export function isKoreanHistorySubject(name?: string | null): boolean {
  const normalized = (name ?? '').replace(/\s/g, '').toLowerCase();
  return normalized.includes('한국사') || normalized.includes('한능검');
}

// 한국사 기본 시트(한능검_암기코드_최종통합본)에 실제로 등장하는 시대 순서.
// 학습 범위 칩을 등록 순서(=데이터 양 순으로 보이기 쉬움) 대신 실제 역사 흐름대로 보여주기 위한 기준.
export const KOREAN_HISTORY_ERA_ORDER = [
  '선사시대', '고조선', '여러 나라의 성장', '삼국 및 가야', '남북국 시대',
  '고려 시대', '조선 시대', '근대 개항기', '일제 강점기', '현대사',
];

// 학습범위 칩 정렬: 한국사 과목만 시대순으로 재배열하고, 그 외 과목은 등록 순서를 그대로 둔다.
// eras[0]은 항상 '전체'이므로 그대로 맨 앞에 두고, 기준 목록에 없는 값(사용자 직접 입력 등)은 뒤에 그대로 붙인다.
export function sortEras(eras: string[], isKoreanHistory: boolean): string[] {
  if (!isKoreanHistory) return eras;
  const [all, ...rest] = eras;
  const known = KOREAN_HISTORY_ERA_ORDER.filter((e) => rest.includes(e));
  const unknown = rest.filter((e) => !KOREAN_HISTORY_ERA_ORDER.includes(e));
  return all === undefined ? [...known, ...unknown] : [all, ...known, ...unknown];
}

// 영어 단어 키워드 마스터 시트. 탭이 하나뿐이라 gid=0(첫 탭) 그대로 사용합니다.
export const ENGLISH_WORD_KEYWORD_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/11dAo2NXz17xBz9ve7m5HEkF-ybPXinqCaIqgJoMNgUM/edit?usp=sharing#gid=0';

/** 사용자가 과목명을 조금 다르게 지어도 영어 단어 기본 소스를 선택합니다. */
export function isEnglishWordSubject(name?: string | null): boolean {
  const normalized = (name ?? '').replace(/\s/g, '').toLowerCase();
  return normalized.includes('영어') || normalized.includes('영단어');
}

export const DEFAULT_KEYWORDS: KeywordInput[] = [
  { era: '선사시대', day: 'Day-01', code: '웰컴구 동막개', concept: '구석기 시대 생활상과 도구', principle: "구석기는 동굴/막집(동막) 생활을 했고, 뗀석기 도구는 대부분 '-개'(긁개·찍개·찌르개)로 끝난다." },
  { era: '선사시대', day: 'Day-01', code: '농삼실라빛', concept: '신석기 시대 생활상과 도구', principle: '농경 시작(농), 동삼동 유적(삼), 신석기(신), 가락바퀴·뼈바늘(라), 빗살무늬토기(빛).' },
  { era: '선사시대', day: 'Day-01', code: '청개고비벼반', concept: '청동기 시대 생활상과 도구', principle: '청동기(청), 계급 출현(개), 고인돌(고), 비파형 동검(비), 벼농사(벼), 반달돌칼(반).' },
  { era: '고조선', day: 'Day-01', code: '사구팔고조', concept: '고조선의 사회상과 8조법', principle: '사람을 죽인 자는 사형(사), 고조선(고조)의 8조법(팔)을 의미한다.' },
  { era: '여러 나라', day: 'Day-01', code: '부영고', concept: '부여의 제천행사와 시기', principle: "부여의 제천행사 '영고'는 추운 북쪽 특성상 12월에 거행했다." },
  { era: '여러 나라', day: 'Day-01', code: '동무랑 책들고 단과반', concept: '동예의 문화와 특산물', principle: '동예(동)의 무천(무), 책화(책), 족외혼(외), 단궁(단)·과하마(과)·반어피(반) 특산물.' },
  { era: '삼국시대', day: 'Day-02', code: '백정 신화 제고', concept: '삼국의 귀족회의 명칭', principle: '백제 정사암(백정), 신라 화백(신화), 고구려 제가회의(제고).' },
  { era: '삼국시대', day: 'Day-02', code: '불태유 소태', concept: '고구려 소수림왕의 체제 정비', principle: '소수림왕의 불교 수용·태학 설립·율령 반포(불태유), 소수림=태학(소태).' },
];

export const DEFAULT_EXAMS: ExamInput[] = [
  { era: '삼국시대', question: '신라의 신분제도로 골품에 따라 관직 승진에 제한을 둔 제도는?', options: ['골품제', '화백제도', '화랑도', '8조법'], answer: 0, explain: '골품제는 신라의 폐쇄적 신분제로 관직과 일상생활까지 규정했다.' },
  { era: '고려', question: '고려 광종이 불법으로 노비가 된 자를 조사해 해방한 법은?', options: ['노비안검법', '전시과', '과전법', '호패법'], answer: 0, explain: '노비안검법으로 호족 기반을 약화하고 왕권을 강화했다.' },
  { era: '조선', question: '성종 때 완성된 조선의 기본 법전은?', options: ['경국대전', '대전회통', '속대전', '경제육전'], answer: 0, explain: '경국대전은 조선 통치의 기준이 된 기본 법전이다.' },
  { era: '조선', question: '세종이 백성을 위해 창제한 문자는?', options: ['훈민정음', '이두', '향찰', '구결'], answer: 0, explain: '훈민정음은 "백성을 가르치는 바른 소리"라는 뜻이다.' },
  { era: '조선', question: '영조·정조가 붕당의 폐단을 막고자 인재를 고루 등용한 정책은?', options: ['탕평책', '대동법', '호패법', '균역법'], answer: 0, explain: '탕평책은 붕당 간 균형을 꾀해 왕권을 강화한 정책이다.' },
  { era: '근현대', question: '1894년 신분제 폐지 등 근대적 개혁을 추진한 사건은?', options: ['갑오개혁', '갑신정변', '을미사변', '아관파천'], answer: 0, explain: '갑오개혁으로 신분제·과거제가 폐지되었다.' },
  { era: '조선', question: '다음 중 조선 후기 실학자가 아닌 인물은?', options: ['정약용', '박지원', '유형원', '이황', '홍대용'], answer: 3, explain: '이황은 조선 전기의 성리학자로, 실학자가 아니다. (5지선다 예시)' },
];
