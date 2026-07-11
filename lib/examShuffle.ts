import type { ExamQuestion } from './types';

function shuffle<T>(a: T[]): T[] {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CIRCLED = ['①', '②', '③', '④', '⑤'];

/**
 * 해설 텍스트 속 보기 번호(①②③, '1번', '2)')를 새 보기 순서에 맞게 다시 씁니다.
 * 원본 시트 해설은 시트에 적힌 순서를 기준으로 "정답은 3번입니다" 처럼 번호를 직접
 * 언급하는데, balanceAnswers가 보기 순서를 섞으면 이 번호가 실제 화면 위치와
 * 어긋나 버립니다. indexMap(원래 위치 -> 새 위치)으로 그 언급을 맞춰줍니다.
 */
function remapExplainNumbers(explain: string, indexMap: Map<number, number>): string {
  if (!explain) return explain;
  let result = explain.replace(/[①②③④⑤]/g, (m) => {
    const orig = CIRCLED.indexOf(m);
    return indexMap.has(orig) ? CIRCLED[indexMap.get(orig)!] : m;
  });
  result = result.replace(/([1-5])번/g, (m, d) => {
    const orig = Number(d) - 1;
    return indexMap.has(orig) ? `${indexMap.get(orig)! + 1}번` : m;
  });
  result = result.replace(/^([1-5])\)/gm, (m, d) => {
    const orig = Number(d) - 1;
    return indexMap.has(orig) ? `${indexMap.get(orig)! + 1})` : m;
  });
  return result;
}

// ----------------------------------------------------------------------------
//  balanceAnswers — 정답 보기의 "위치"를 세션 전체에 고르게 분산
// ----------------------------------------------------------------------------
//  문제 데이터의 정답이 특정 번호(예: 항상 1번)에 몰려 있으면, 학습자가 내용을
//  안 보고 "감"으로 찍게 됩니다. 이를 막기 위해, 각 문제의 보기 순서를 섞되
//  "정답이 몇 번 자리에 오는지"를 세션 내에서 최대한 균등하게 맞춥니다.
//  (예: 20문제면 1·2·3·4번 자리에 정답이 약 5개씩 분포)
//
//  방법: 지금까지 각 자리(0,1,2,3,4)가 정답으로 쓰인 횟수를 세어두고, 다음 문제의
//  정답을 "가장 덜 쓰인 자리"에 놓습니다. 나머지 보기는 남은 자리에 무작위로 채웁니다.
//  보기 개수가 다른 문제(4지/5지)가 섞여 있어도 각 문제의 보기 수 범위 안에서 처리됩니다.
export function balanceAnswers(questions: ExamQuestion[]): ExamQuestion[] {
  const usage: number[] = []; // usage[p] = p번 자리가 정답으로 쓰인 횟수
  const usedCount = (p: number) => usage[p] ?? 0;

  return questions.map((q) => {
    const n = q.options.length;

    // 1) 0..n-1 자리 중 "가장 덜 쓰인" 자리를 정답 위치로 선택 (동점이면 무작위)
    let target = 0;
    let min = Infinity;
    for (let p = 0; p < n; p++) {
      const c = usedCount(p);
      if (c < min || (c === min && Math.random() < 0.5)) { min = c; target = p; }
    }
    usage[target] = usedCount(target) + 1;

    // 2) 정답과 오답들을 원래 위치(index)와 함께 분리하고, 오답은 무작위로 섞음
    const correctIndex = q.answer;
    const others = shuffle(q.options.map((text, i) => ({ text, i })).filter((o) => o.i !== correctIndex));

    // 3) 새 보기 배열: target 자리에 정답, 나머지 자리에 섞인 오답을 순서대로 채우며
    //    원래 위치 -> 새 위치 매핑도 함께 기록
    const newOptions: string[] = [];
    const indexMap = new Map<number, number>();
    let oi = 0;
    for (let p = 0; p < n; p++) {
      if (p === target) {
        newOptions[p] = q.options[correctIndex];
        indexMap.set(correctIndex, p);
      } else {
        const o = others[oi++];
        newOptions[p] = o.text;
        indexMap.set(o.i, p);
      }
    }

    return { ...q, options: newOptions, answer: target, explain: remapExplainNumbers(q.explain, indexMap) };
  });
}
