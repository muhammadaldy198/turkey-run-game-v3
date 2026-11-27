// Sound, synthesized only (no assets): a jump blip, a corn ding, a stumble thud, a gobble,
// a gate chime, a win arpeggio and the dinner bell. The context is created on the first
// user gesture; in a headless run there is no gesture and nothing plays. Every function is
// a no-op until unlock() has run.

let context = null;

export function unlockAudio() {
  try {
    if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null;
  }
}

function tone(freq, dur, type, gain, when) {
  if (!context) return;
  try {
    const t0 = context.currentTime + (when || 0);
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    amp.gain.setValueAtTime(gain || 0.12, t0);
    amp.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(amp);
    amp.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // Sound is garnish; a failure here never breaks the game.
  }
}

export function playJump() {
  tone(320, 0.12, 'triangle', 0.1);
  tone(520, 0.1, 'triangle', 0.08, 0.05);
}

export function playCorn() {
  tone(880, 0.08, 'sine', 0.1);
}

export function playStumble() {
  tone(140, 0.18, 'sawtooth', 0.14);
}

export function playGobble() {
  tone(220, 0.1, 'square', 0.08);
  tone(180, 0.12, 'square', 0.08, 0.09);
}

export function playGate() {
  tone(660, 0.1, 'sine', 0.1);
  tone(990, 0.16, 'sine', 0.1, 0.09);
}

export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.11));
}

export function playBell() {
  tone(196, 0.9, 'sine', 0.16);
  tone(196, 0.9, 'sine', 0.14, 0.5);
}
