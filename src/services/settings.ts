import { ROUNDS_PER_GAME, ROUND_SECONDS } from '../config';
import { defaultStorage, readJson, writeJson, type StorageLike } from './storage';

export const SETTINGS_KEY = 'stajyer-nerede:settings:v1';

/** Stand settings changed from the admin panel. */
export interface Settings {
  rounds: number;
  roundSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = { rounds: ROUNDS_PER_GAME, roundSeconds: ROUND_SECONDS };

export const SETTINGS_LIMITS: Record<keyof Settings, [min: number, max: number]> = {
  rounds: [1, 10],
  roundSeconds: [15, 600],
};

export interface SettingsStore {
  get(): Settings;
  set(changes: Partial<Settings>): Settings;
  reset(): Settings;
}

function clean(input: Partial<Record<keyof Settings, unknown>>, base: Settings): Settings {
  const out = { ...base };
  for (const key of Object.keys(SETTINGS_LIMITS) as (keyof Settings)[]) {
    const v = input[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const [min, max] = SETTINGS_LIMITS[key];
    out[key] = Math.min(max, Math.max(min, Math.round(v)));
  }
  return out;
}

export function createSettings(storage: StorageLike | null = defaultStorage()): SettingsStore {
  const stored = readJson(storage, SETTINGS_KEY);
  let current = clean(stored && typeof stored === 'object' ? stored : {}, DEFAULT_SETTINGS);

  return {
    get: () => ({ ...current }),
    set(changes) {
      current = clean(changes, current);
      writeJson(storage, SETTINGS_KEY, current);
      return { ...current };
    },
    reset() {
      current = { ...DEFAULT_SETTINGS };
      writeJson(storage, SETTINGS_KEY, current);
      return { ...current };
    },
  };
}
