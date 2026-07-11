import type { Keyword, ExamQuestion } from './types';

function shuffle<T>(a: T[]): T[] {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MAX_OPTIONS = 4;
const SYNTHETIC_PREFIX = 'synthetic:';

/** 세션 전용으로 즉석에서 만든 문제인지 확인합니다 (DB에 없는 id라 시도 기록을 남기지 않음). */
export const isSyntheticExamId = (id: string) => id.startsWith(SYNTHETIC_PREFIX);

/**
 * 등록된 기출문제가 없을 때, 키워드(단어+뜻)만으로 그 자리에서 4지선다 문제를 만듭니다.
 * DB에 저장하지 않는 세션 전용 문제라 id에 'synthetic:' 접두사를 붙여 구분합니다
 * (exam_attempts.question_id는 exam_questions를 참조하는 FK라 실제로 저장할 수 없음).
 */
export function generateExamFromKeywords(keywords: Keyword[]): ExamQuestion[] {
  const pool = keywords.filter((k) => k.code.trim() && k.concept.trim());
  if (pool.length < 2) return [];

  return shuffle(pool).map((k) => {
    const distractors = shuffle(pool.filter((o) => o.id !== k.id && o.concept.trim() !== k.concept.trim()))
      .slice(0, MAX_OPTIONS - 1)
      .map((o) => o.concept);
    const options = shuffle([k.concept, ...distractors]);
    const answer = options.indexOf(k.concept);

    return {
      id: `${SYNTHETIC_PREFIX}${k.id}`,
      owner_id: k.owner_id,
      subject_id: k.subject_id,
      era: k.era,
      question: `다음 단어의 뜻으로 알맞은 것은?\n"${k.code}"`,
      options,
      answer,
      explain: `정답은 '${k.concept}' 입니다.${k.principle ? ` 💡 ${k.principle}` : ''}`,
      importance: k.importance ?? 2,
    };
  });
}
