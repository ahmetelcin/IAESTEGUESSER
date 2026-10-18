import { describe, expect, it } from 'vitest';
import { createSession } from './session';

const loc = (id: string, lat = 0, lng = 0, cityId = id) => ({
  id,
  cityId,
  imageId: `img-${id}`,
  lat,
  lng,
  city: cityId,
  country: 'X',
});
const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => loc(id));

describe('game session', () => {
  it('picks the requested number of distinct locations', () => {
    const s = createSession({ pool: POOL, rounds: 5, mapId: 'world' });
    const ids = s.locations.map((l) => l.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it('never repeats a city when there are enough cities', () => {
    // 6 cities with 3 panoramas each.
    const pool = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((c) => [1, 2, 3].map((n) => loc(`${c}-${n}`, 0, 0, c)));
    for (let i = 0; i < 30; i++) {
      const s = createSession({ pool, rounds: 5, mapId: 'world' });
      expect(new Set(s.locations.map((l) => l.cityId)).size).toBe(5);
    }
  });

  it('fills up with repeat cities only when there are too few cities', () => {
    const pool = ['a', 'b'].flatMap((c) => [1, 2, 3].map((n) => loc(`${c}-${n}`, 0, 0, c)));
    const s = createSession({ pool, rounds: 5, mapId: 'world' });
    expect(s.totalRounds).toBe(5);
    expect(new Set(s.locations.map((l) => l.id)).size).toBe(5);
    // The first two rounds are different cities.
    expect(s.locations[0].cityId).not.toBe(s.locations[1].cityId);
  });

  it('excludes the whole city of the excluded location', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((c) => [1, 2].map((n) => loc(`${c}-${n}`, 0, 0, c)));
    for (let i = 0; i < 20; i++) {
      const s = createSession({ pool, rounds: 5, mapId: 'world', exclude: 'a-1' });
      expect(s.locations.map((l) => l.cityId)).not.toContain('a');
    }
  });

  it('caps rounds at the pool size', () => {
    const s = createSession({ pool: POOL.slice(0, 3), rounds: 5, mapId: 'world' });
    expect(s.totalRounds).toBe(3);
  });

  it('excludes a given location when the pool is big enough', () => {
    for (let i = 0; i < 20; i++) {
      const s = createSession({ pool: POOL.slice(0, 6), rounds: 5, mapId: 'world', exclude: 'a' });
      expect(s.locations.map((l) => l.id)).not.toContain('a');
    }
  });

  it('scores guesses and advances rounds', () => {
    const pool = [loc('p', 48.8566, 2.3522), loc('q', 41.0082, 28.9784)];
    const s = createSession({ pool, rounds: 2, mapId: 'world' });
    expect(s.roundNumber).toBe(1);
    const first = s.current;
    const r1 = s.submit({ lat: first.lat, lng: first.lng });
    expect(r1.score).toBe(5000);
    expect(r1.km).toBe(0);
    expect(s.isLastRound).toBe(false);
    s.next();
    expect(s.roundNumber).toBe(2);
    expect(s.isLastRound).toBe(true);
    const r2 = s.submit(null);
    expect(r2.score).toBe(0);
    expect(r2.km).toBeNull();
    expect(s.totalScore).toBe(5000);
    expect(s.results).toHaveLength(2);
  });

  it('refuses to submit twice in one round or advance past the end', () => {
    const s = createSession({ pool: POOL, rounds: 1, mapId: 'world' });
    s.submit(null);
    expect(() => s.submit(null)).toThrow();
    expect(() => s.next()).toThrow();
  });

  it('replaces the current location with an unused one', () => {
    const s = createSession({ pool: POOL.slice(0, 3), rounds: 2, mapId: 'world' });
    const before = s.locations.map((l) => l.id);
    expect(s.replaceCurrent()).toBe(true);
    const after = s.locations.map((l) => l.id);
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(new Set(after).size).toBe(2);
    // The only unused location is now the dropped one... which is excluded, so nothing is left.
    expect(s.replaceCurrent()).toBe(false);
  });

  it('exposes the upcoming location for preloading', () => {
    const s = createSession({ pool: POOL, rounds: 2, mapId: 'world' });
    expect(s.upcoming).toBe(s.locations[1]);
    s.submit(null);
    s.next();
    expect(s.upcoming).toBeNull();
  });

  it('refuses to advance before submitting', () => {
    const s = createSession({ pool: POOL, rounds: 2, mapId: 'world' });
    expect(() => s.next()).toThrow();
  });
});
