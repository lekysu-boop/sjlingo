// ============================================================================
//  lib/sound.ts — 학습 효과음 (Web Audio 로 즉석 합성, 음원 파일 불필요)
// ----------------------------------------------------------------------------
//  정답/오답/보물상자에 짧은 효과음을 낸다. 게임처럼 "손맛"을 주는 요소.
//  localStorage 'amgi_sound' 로 켜기/끄기를 기억한다 (기본: 켜짐).
//  브라우저 자동재생 정책상 첫 사용자 입력 이후에만 소리가 난다.
// ============================================================================

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

export function isSoundOn(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('amgi_sound') !== 'off';
}
export function toggleSound(): boolean {
  const next = !isSoundOn();
  try { localStorage.setItem('amgi_sound', next ? 'on' : 'off'); } catch {}
  return next;
}

// 단일 톤: freq(Hz), dur(초), delay(초 뒤 시작)
function tone(freq: number, dur: number, delay = 0, type: OscillatorType = 'sine', vol = 0.12) {
  const a = ac();
  if (!a || !isSoundOn()) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur); // 뚝 끊기지 않게 감쇠
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

// 정답: 밝은 2음 상승
export function playCorrect() { tone(660, 0.09); tone(880, 0.14, 0.08); }
// 콤보(3연속 이상): 3음 아르페지오
export function playCombo() { tone(660, 0.08); tone(830, 0.08, 0.07); tone(1046, 0.16, 0.14); }
// 오답: 낮은 톤 (부드럽게 — 벌주는 소리가 아니라 알려주는 소리)
export function playWrong() { tone(250, 0.16, 0, 'triangle', 0.1); tone(200, 0.2, 0.12, 'triangle', 0.08); }
// 보물상자: 팡파레
export function playChest() { tone(523, 0.1); tone(659, 0.1, 0.09); tone(784, 0.1, 0.18); tone(1046, 0.28, 0.27); }
// 세션 완료: 마무리 멜로디
export function playFinish() { tone(523, 0.12); tone(659, 0.12, 0.1); tone(784, 0.25, 0.2); }
