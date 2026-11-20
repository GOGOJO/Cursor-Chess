export type SoundCue = 'move' | 'capture' | 'check' | 'wrong' | 'solve' | 'reveal';

let enabled = false;
let context: AudioContext | null = null;

export function areSoundsEnabled(): boolean {
  return enabled;
}

export function setSoundsEnabled(value: boolean): boolean {
  enabled = value;
  if (value) unlock();
  return enabled;
}

function unlock(): AudioContext | null {
  const Ctor = globalThis.AudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function tone(ctx: AudioContext, frequency: number, at: number, duration: number, gain = 0.035, type: OscillatorType = 'sine'): void {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** Plays a short cue. No-ops while sound is off, or where Web Audio is unavailable. */
export function playSound(cue: SoundCue): void {
  if (!enabled) return;
  const ctx = unlock();
  if (!ctx) return;
  const now = ctx.currentTime;
  switch (cue) {
    case 'move':
      tone(ctx, 620, now, 0.045, 0.028);
      break;
    case 'capture':
      tone(ctx, 196, now, 0.07, 0.04, 'triangle');
      break;
    case 'check':
      tone(ctx, 740, now, 0.06, 0.03);
      tone(ctx, 880, now + 0.07, 0.08, 0.028);
      break;
    case 'wrong':
      tone(ctx, 146, now, 0.11, 0.03, 'triangle');
      break;
    case 'solve':
      tone(ctx, 523, now, 0.09, 0.035);
      tone(ctx, 659, now + 0.08, 0.09, 0.035);
      tone(ctx, 784, now + 0.16, 0.14, 0.04);
      break;
    case 'reveal':
      tone(ctx, 392, now, 0.08, 0.028);
      tone(ctx, 311, now + 0.09, 0.12, 0.026);
      break;
  }
}
