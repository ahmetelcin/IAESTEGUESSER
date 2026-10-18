import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY, createSettings } from './settings';
import type { StorageLike } from './storage';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('settings', () => {
  it('starts with the defaults', () => {
    expect(createSettings(memoryStorage()).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and reloads changes', () => {
    const storage = memoryStorage();
    createSettings(storage).set({ rounds: 3, roundSeconds: 90 });
    expect(createSettings(storage).get()).toEqual({ rounds: 3, roundSeconds: 90 });
  });

  it('clamps and rounds out-of-range values', () => {
    const s = createSettings(memoryStorage());
    expect(s.set({ rounds: 0, roundSeconds: 5 })).toEqual({ rounds: 1, roundSeconds: 15 });
    expect(s.set({ rounds: 99, roundSeconds: 10_000 })).toEqual({ rounds: 10, roundSeconds: 600 });
    expect(s.set({ rounds: 2.6, roundSeconds: 44.4 })).toEqual({ rounds: 3, roundSeconds: 44 });
  });

  it('ignores non-numbers', () => {
    const s = createSettings(memoryStorage());
    expect(s.set({ rounds: Number.NaN })).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults on corrupt or partial storage', () => {
    const storage = memoryStorage();
    storage.data.set(SETTINGS_KEY, '{oops');
    expect(createSettings(storage).get()).toEqual(DEFAULT_SETTINGS);
    storage.data.set(SETTINGS_KEY, JSON.stringify({ rounds: 7 }));
    expect(createSettings(storage).get()).toEqual({ ...DEFAULT_SETTINGS, rounds: 7 });
  });

  it('works when storage throws', () => {
    const s = createSettings({
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(s.set({ rounds: 4 }).rounds).toBe(4);
    expect(s.get().rounds).toBe(4);
  });

  it('resets to defaults', () => {
    const s = createSettings(memoryStorage());
    s.set({ rounds: 2 });
    expect(s.reset()).toEqual(DEFAULT_SETTINGS);
  });
});
