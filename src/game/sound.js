/**
 * Tiny WebAudio synthesizer — no audio files needed.
 * Every sound is a handful of oscillator notes.
 */
let ctx = null;
let enabled = true;

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

function getContext() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function note({ freq = 440, type = 'square', start = 0, duration = 0.1, volume = 0.08, slide = 0 }) {
  const ac = getContext();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t0 = ac.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

const SOUNDS = {
  click: () => note({ freq: 660, type: 'square', duration: 0.06, volume: 0.04 }),
  hover: () => note({ freq: 880, type: 'sine', duration: 0.04, volume: 0.02 }),
  type: () => note({ freq: 1200, type: 'triangle', duration: 0.03, volume: 0.015 }),
  success: () => {
    [523, 659, 784, 1047].forEach((f, i) => note({ freq: f, type: 'square', start: i * 0.08, duration: 0.18, volume: 0.06 }));
  },
  fail: () => {
    note({ freq: 220, type: 'sawtooth', duration: 0.25, volume: 0.05, slide: -120 });
    note({ freq: 180, type: 'square', start: 0.12, duration: 0.25, volume: 0.04, slide: -80 });
  },
  star: () => {
    note({ freq: 1318, type: 'sine', duration: 0.25, volume: 0.06 });
    note({ freq: 1760, type: 'sine', start: 0.05, duration: 0.3, volume: 0.05 });
  },
  unlock: () => {
    [392, 523, 659, 784, 1047].forEach((f, i) => note({ freq: f, type: 'triangle', start: i * 0.06, duration: 0.2, volume: 0.05 }));
  },
  victory: () => {
    const melody = [523, 523, 523, 659, 784, 659, 784, 1047];
    melody.forEach((f, i) => note({ freq: f, type: 'square', start: i * 0.11, duration: 0.22, volume: 0.06 }));
    [262, 330, 392, 523].forEach((f, i) => note({ freq: f, type: 'triangle', start: 0.9 + i * 0.05, duration: 0.6, volume: 0.04 }));
  },
  hit: () => {
    note({ freq: 180, type: 'square', duration: 0.12, volume: 0.07, slide: -90 });
    note({ freq: 900, type: 'sawtooth', start: 0.02, duration: 0.08, volume: 0.04, slide: -600 });
    [523, 784].forEach((f, i) => note({ freq: f, type: 'square', start: 0.15 + i * 0.07, duration: 0.12, volume: 0.05 }));
  },
  pop: () => note({ freq: 500, type: 'sine', duration: 0.08, volume: 0.05, slide: 300 }),
  boss: () => {
    [110, 138, 110, 165].forEach((f, i) => note({ freq: f, type: 'sawtooth', start: i * 0.18, duration: 0.3, volume: 0.05 }));
  },
};

export function play(name) {
  if (!enabled) return;
  try {
    SOUNDS[name]?.();
  } catch {
    /* audio is optional */
  }
}
