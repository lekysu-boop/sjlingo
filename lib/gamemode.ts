// 암기코드 게임 모드 변환 (프로토타입 v3와 동일 규칙)
//  - full:     원문 그대로
//  - choseong: 한글을 초성으로 (탕평책 → ㅌㅍㅊ)
//  - partial:  단어별로 무작위 위치의 글자를 ○ 로 가림 (최소 1글자는 보이게)

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function isHangul(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3;
}

export function toChoseong(str: string): string {
  return str.split('').map((ch) => {
    const c = ch.charCodeAt(0);
    if (isHangul(ch)) return CHO[Math.floor((c - 0xac00) / 588)];
    return ch;
  }).join('');
}

export function toPartial(str: string): string {
  return str.split(/(\s|\/)/).map((word) => {
    if (word === ' ' || word === '/' || word === '') return word;
    const idxs: number[] = [];
    for (let i = 0; i < word.length; i++) if (isHangul(word[i])) idxs.push(i);
    if (idxs.length <= 1) return word;
    const hideN = Math.max(1, Math.min(idxs.length - 1, Math.round(idxs.length * 0.45)));
    const pool = idxs.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const hide = new Set(pool.slice(0, hideN));
    return word.split('').map((ch, i) => (hide.has(i) ? '○' : ch)).join('');
  }).join('');
}

export type GameMode = 'full' | 'choseong' | 'partial';

export function frontCode(code: string, mode: GameMode): string {
  if (mode === 'choseong') return toChoseong(code);
  if (mode === 'partial') return toPartial(code);
  return code;
}
