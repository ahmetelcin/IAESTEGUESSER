import { defaultStorage, readJson, writeJson, type StorageLike } from './storage';

/**
 * Short sound effects, synthesized with WebAudio (no audio files, so the single-file
 * stand build stays self-contained). Can be muted; the choice is remembered.
 */

export const SOUND_KEY = 'stajyer-nerede:sound:v1';

export type Effect = 'pin' | 'tick' | 'timeout' | 'fanfare';

export interface Sound {
  readonly enabled: boolean;
  toggle(): boolean;
  play(effect: Effect): void;
  /** Rising chime; more notes for a better round (0–5000). */
  playScore(score: number): void;
  onChange(listener: (enabled: boolean) => void): void;
}

/** How many notes of the score chime a round earns (1–4). */
export function scoreNotes(score: number): number {
  if (score >= 4500) return 4;
  if (score >= 3000) return 3;
  if (score >= 1000) return 2;
  return 1;
}

const C5 = 523.25;
const semis = (n: number) => C5 * 2 ** (n / 12);

export function createSound(storage: StorageLike | null = defaultStorage()): Sound {
  let enabled = readJson(storage, SOUND_KEY) !== false;
  let ctx: AudioContext | null = null;
  const listeners: ((on: boolean) => void)[] = [];

  function audio(): AudioContext | null {
    if (!enabled) return null;
    try {
      ctx ??= new AudioContext();
      // Browsers start it suspended until a user gesture; every sound follows one.
      if (ctx.state === 'suspended') void ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }

  function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', volume = 0.18) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const effects: Record<Effect, () => void> = {
    pin: () => {
      tone(semis(7), 0, 0.08, 'triangle', 0.2);
      tone(semis(12), 0.05, 0.12, 'triangle', 0.16);
    },
    tick: () => tone(semis(19), 0, 0.05, 'square', 0.05),
    timeout: () => {
      tone(semis(0), 0, 0.18, 'sawtooth', 0.08);
      tone(semis(-5), 0.16, 0.3, 'sawtooth', 0.08);
    },
    fanfare: () => [0, 4, 7, 12, 7, 12].forEach((n, i) => tone(semis(n), i * 0.11, i === 5 ? 0.6 : 0.16, 'triangle')),
  };

  return {
    get enabled() {
      return enabled;
    },
    toggle() {
      enabled = !enabled;
      writeJson(storage, SOUND_KEY, enabled);
      if (!enabled) void ctx?.suspend().catch(() => {});
      listeners.forEach((l) => l(enabled));
      return enabled;
    },
    play(effect) {
      if (enabled) effects[effect]();
    },
    playScore(score) {
      if (!enabled) return;
      const steps = [0, 4, 7, 12];
      for (let i = 0; i < scoreNotes(score); i++) tone(semis(steps[i]), i * 0.12, 0.28, 'triangle');
    },
    onChange(listener) {
      listeners.push(listener);
      listener(enabled);
    },
  };
}
