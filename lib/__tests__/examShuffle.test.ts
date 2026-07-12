import { describe, expect, it } from 'vitest';
import { balanceAnswers } from '../examShuffle';
import type { ExamQuestion } from '../types';

// 실제 버그 재현: 정답 위치를 섞은 뒤에도 해설의 "정답은 N번입니다" 문구가
// 예전 번호를 그대로 가리켜서, 화면에 체크 표시된 보기와 해설의 번호가 어긋났다.
function makeQuestion(): ExamQuestion {
  return {
    id: '1', owner_id: 'u', subject_id: 's', era: '일제 강점기', importance: 2,
    question: '일제가 강요한 국기 게양과 충성 서사는?',
    options: ['황국 신민 서사 암송 강요', '조선 사상범 보호 관찰령', '회사령 제정 유도', '태형 집행 강요'],
    answer: 2, // '회사령 제정 유도' — 원본 시트 기준 3번째 보기
    explain: '정답은 3번입니다. 개항기 및 일제 강점기 역사 흐름과 정확히 일치합니다.',
  };
}

describe('balanceAnswers — 보기 위치를 섞어도 해설 번호가 어긋나지 않는다', () => {
  it('정답 텍스트가 실제 answer 위치에 있고, 해설의 번호도 그 위치를 가리킨다', () => {
    for (let i = 0; i < 30; i++) {
      const [result] = balanceAnswers([makeQuestion()]);
      expect(result.options[result.answer]).toBe('회사령 제정 유도');
      expect(result.explain).toContain(`정답은 ${result.answer + 1}번입니다`);
    }
  });

  it('①②③ 형태의 오답 정리 번호도 새 위치에 맞게 다시 쓴다', () => {
    const q: ExamQuestion = {
      id: '2', owner_id: 'u', subject_id: 's', era: '선사시대', importance: 3,
      question: 'Q',
      options: ['동굴이나 막집에서 살았다.', '가락바퀴를 사용했다.', '비파형 동검을 제작했다.', '고인돌을 축조했다.'],
      answer: 0,
      explain: '정답은 1번입니다.\n\n오답 정리:\n② 가락바퀴는 신석기 시대,\n③ 비파형 동검과 ④ 고인돌은 청동기 시대의 대표적인 유물입니다.',
    };
    for (let i = 0; i < 30; i++) {
      const [result] = balanceAnswers([q]);
      // 정답이 옮겨간 자리 번호가 해설 맨 앞 문장에 정확히 반영된다
      expect(result.explain).toMatch(new RegExp(`^정답은 ${result.answer + 1}번입니다`));
    }
  });

  it('"N)" 형태 오답 번호(심화 시트 형식)도 새 위치에 맞게 다시 쓴다', () => {
    const q: ExamQuestion = {
      id: '3', owner_id: 'u', subject_id: 's', era: '선사시대', importance: 1,
      question: 'Q',
      options: ['철제 보습을 이용해 밭을 갈아엎었다.', '사냥과 채집을 하며 임시 동굴에 거주했다.', '농경과 목축이 시작되고 가락바퀴를 썼다.', '비파형 청동검을 제작했다.'],
      answer: 2,
      explain: '정답은 3번입니다. 신석기 시대에는 농경과 목축이 시작되었습니다.\n\n오답 정리:\n1) 철기 시대\n2) 구석기 시대\n4) 청동기 시대',
    };
    for (let i = 0; i < 30; i++) {
      const [result] = balanceAnswers([q]);
      expect(result.explain).toContain(`정답은 ${result.answer + 1}번입니다`);
    }
  });

  it('실제 시트의 원문 기호 정답도 보기 셔플 뒤 새 위치로 바꾼다', () => {
    const q: ExamQuestion = {
      id: '4', owner_id: 'u', subject_id: 's', era: '현대', importance: 2,
      question: '한일 협정이 조인된 박정희 정부 시기의 사실은?',
      options: ['농지 개혁법 제정', '경부 고속 도로 개통', 'OECD 가입', '한미 자유 무역 협정'],
      answer: 1,
      explain: '박정희 정부는 경부 고속 도로를 개통하였다에 해당하므로 정답은 ②이다.',
    };
    const circled = ['①', '②', '③', '④', '⑤'];

    for (let i = 0; i < 30; i++) {
      const [result] = balanceAnswers([q]);
      expect(result.options[result.answer]).toBe('경부 고속 도로 개통');
      expect(result.explain).toContain(`정답은 ${circled[result.answer]}이다`);
    }
  });
});
