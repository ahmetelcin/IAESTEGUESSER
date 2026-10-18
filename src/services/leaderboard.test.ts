import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY, createLeaderboard, dayKey, type StorageLike } from './leaderboard';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const throwingStorage: StorageLike = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

const DAY1 = new Date(2026, 9, 19, 10, 0);
const DAY1_LATER = new Date(2026, 9, 19, 18, 0);
const DAY2 = new Date(2026, 9, 20, 9, 0);

describe('leaderboard', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('starts empty', () => {
    expect(createLeaderboard(storage).today(DAY1)).toEqual([]);
  });

  it('returns entries sorted by score, highest first', () => {
    const lb = createLeaderboard(storage);
    lb.add({ name: 'Ada', score: 12000, mapId: 'world' }, DAY1);
    lb.add({ name: 'Can', score: 18000, mapId: 'world' }, DAY1);
    lb.add({ name: 'Ece', score: 9000, mapId: 'world' }, DAY1);
    expect(lb.today(DAY1).map((e) => e.name)).toEqual(['Can', 'Ada', 'Ece']);
  });

  it('returns the 1-based daily rank of the new entry', () => {
    const lb = createLeaderboard(storage);
    expect(lb.add({ name: 'Ada', score: 12000, mapId: 'world' }, DAY1)).toBe(1);
    expect(lb.add({ name: 'Can', score: 18000, mapId: 'world' }, DAY1)).toBe(1);
    expect(lb.add({ name: 'Ece', score: 15000, mapId: 'world' }, DAY1)).toBe(2);
    expect(lb.add({ name: 'Efe', score: 100, mapId: 'world' }, DAY1)).toBe(4);
  });

  it('ranks the earlier entry first on equal scores', () => {
    const lb = createLeaderboard(storage);
    lb.add({ name: 'Ilk', score: 10000, mapId: 'world' }, DAY1);
    expect(lb.add({ name: 'Sonra', score: 10000, mapId: 'world' }, DAY1_LATER)).toBe(2);
    expect(lb.today(DAY1).map((e) => e.name)).toEqual(['Ilk', 'Sonra']);
  });

  it('only counts entries from the same local day', () => {
    const lb = createLeaderboard(storage);
    lb.add({ name: 'Dun', score: 20000, mapId: 'world' }, DAY1);
    lb.add({ name: 'Bugun', score: 5000, mapId: 'world' }, DAY2);
    expect(lb.today(DAY2).map((e) => e.name)).toEqual(['Bugun']);
    expect(lb.add({ name: 'Yeni', score: 1000, mapId: 'world' }, DAY2)).toBe(2);
  });

  it('limits the list', () => {
    const lb = createLeaderboard(storage);
    for (let i = 0; i < 15; i++) lb.add({ name: `P${i}`, score: i * 100, mapId: 'world' }, DAY1);
    const top = lb.today(DAY1, 10);
    expect(top).toHaveLength(10);
    expect(top[0].name).toBe('P14');
  });

  it('persists across instances', () => {
    createLeaderboard(storage).add({ name: 'Ada', score: 12000, mapId: 'world' }, DAY1);
    expect(createLeaderboard(storage).today(DAY1)).toHaveLength(1);
  });

  it('clears all entries', () => {
    const lb = createLeaderboard(storage);
    lb.add({ name: 'Ada', score: 12000, mapId: 'world' }, DAY1);
    lb.clear();
    expect(lb.today(DAY1)).toEqual([]);
    expect(createLeaderboard(storage).today(DAY1)).toEqual([]);
  });

  it('ignores corrupt stored data', () => {
    storage.data.set(STORAGE_KEY, '{not json');
    const lb = createLeaderboard(storage);
    expect(lb.today(DAY1)).toEqual([]);
    expect(lb.add({ name: 'Ada', score: 1, mapId: 'world' }, DAY1)).toBe(1);
  });

  it('drops malformed entries', () => {
    storage.data.set(
      STORAGE_KEY,
      JSON.stringify([{ name: 'Ok', score: 5, mapId: 'world', day: dayKey(DAY1), ts: 1 }, { foo: 1 }, null]),
    );
    expect(createLeaderboard(storage).today(DAY1).map((e) => e.name)).toEqual(['Ok']);
  });

  it('keeps working in memory when storage throws', () => {
    const lb = createLeaderboard(throwingStorage);
    expect(lb.add({ name: 'Ada', score: 12000, mapId: 'world' }, DAY1)).toBe(1);
    expect(lb.today(DAY1)).toHaveLength(1);
  });

  it('works with no storage at all', () => {
    const lb = createLeaderboard(null);
    lb.add({ name: 'Ada', score: 12000, mapId: 'world' }, DAY1);
    expect(lb.today(DAY1)).toHaveLength(1);
  });
});

describe('dayKey', () => {
  it('uses the local calendar date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
