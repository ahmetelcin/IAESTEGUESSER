import { describe, expect, it } from 'vitest';
import { SOUND_KEY, createSound, scoreNotes } from './sound';
import type { StorageLike } from './storage';

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('sound', () => {
  it('is on by default and remembers being muted', () => {
    const storage = memoryStorage();
    const sound = createSound(storage);
    expect(sound.enabled).toBe(true);
    expect(sound.toggle()).toBe(false);
    expect(storage.getItem(SOUND_KEY)).toBe('false');
    expect(createSound(storage).enabled).toBe(false);
  });

  it('tells listeners about the current state and changes', () => {
    const sound = createSound(memoryStorage());
    const seen: boolean[] = [];
    sound.onChange((on) => seen.push(on));
    sound.toggle();
    expect(seen).toEqual([true, false]);
  });

  it('does not throw without WebAudio (tests, old browsers)', () => {
    const sound = createSound(memoryStorage());
    expect(() => sound.play('pin')).not.toThrow();
    expect(() => sound.playScore(5000)).not.toThrow();
  });

  it('gives better rounds a longer chime', () => {
    expect([0, 999, 1000, 3000, 4499, 4500, 5000].map(scoreNotes)).toEqual([1, 1, 2, 3, 3, 4, 4]);
  });
});
