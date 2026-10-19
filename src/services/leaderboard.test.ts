import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  createLeaderboard,
  dayKey,
  leaderboardCsv,
  type BoardFilter,
  type LeaderboardEntry,
  type StorageLike,
} from './leaderboard';

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

const TODAY_WORLD: BoardFilter = { mode: 'moving', mapId: 'world', period: 'today' };
const game = (name: string, score: number, over: Partial<LeaderboardEntry> = {}) => ({
  name,
  score,
  mapId: 'world' as const,
  mode: 'moving' as const,
  rounds: 5,
  ...over,
});
const names = (entries: LeaderboardEntry[]) => entries.map((e) => e.name);

describe('leaderboard', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('starts empty', () => {
    expect(createLeaderboard(storage).board(TODAY_WORLD, DAY1)).toEqual([]);
  });

  it('sorts by score, highest first', () => {
    const lb = createLeaderboard(storage);
    lb.add(game('Ada', 12000), DAY1);
    lb.add(game('Can', 18000), DAY1);
    lb.add(game('Ece', 9000), DAY1);
    expect(names(lb.board(TODAY_WORLD, DAY1))).toEqual(['Can', 'Ada', 'Ece']);
  });

  it('returns the 1-based rank on today’s board for the same mode and map', () => {
    const lb = createLeaderboard(storage);
    expect(lb.add(game('Ada', 12000), DAY1)).toBe(1);
    expect(lb.add(game('Can', 18000), DAY1)).toBe(1);
    expect(lb.add(game('Ece', 15000), DAY1)).toBe(2);
    expect(lb.add(game('Efe', 100), DAY1)).toBe(4);
    // Other boards don't count against you.
    expect(lb.add(game('Nur', 50, { mode: 'nmpz' }), DAY1)).toBe(1);
    expect(lb.add(game('Tan', 60, { mapId: 'turkey' }), DAY1)).toBe(1);
  });

  it('ranks the earlier game first on equal scores', () => {
    const lb = createLeaderboard(storage);
    lb.add(game('Ilk', 10000), DAY1);
    expect(lb.add(game('Sonra', 10000), DAY1_LATER)).toBe(2);
    expect(names(lb.board(TODAY_WORLD, DAY1))).toEqual(['Ilk', 'Sonra']);
  });

  it('filters by mode and map', () => {
    const lb = createLeaderboard(storage);
    lb.add(game('Dunya', 1), DAY1);
    lb.add(game('Nmpz', 2, { mode: 'nmpz' }), DAY1);
    lb.add(game('Turkiye', 3, { mapId: 'turkey' }), DAY1);
    expect(names(lb.board(TODAY_WORLD, DAY1))).toEqual(['Dunya']);
    expect(names(lb.board({ ...TODAY_WORLD, mode: 'nmpz' }, DAY1))).toEqual(['Nmpz']);
    expect(names(lb.board({ ...TODAY_WORLD, mapId: 'turkey' }, DAY1))).toEqual(['Turkiye']);
  });

  it('"all" combines every map and/or mode, still only 5-round games', () => {
    const lb = createLeaderboard(storage);
    lb.add(game('Dunya', 1), DAY1);
    lb.add(game('Nmpz', 2, { mode: 'nmpz' }), DAY1);
    lb.add(game('Turkiye', 3, { mapId: 'turkey' }), DAY1);
    lb.add(game('Kisa', 4, { mapId: 'europe', rounds: 3 }), DAY1);
    expect(names(lb.board({ ...TODAY_WORLD, mapId: 'all', mode: 'all' }, DAY1))).toEqual(['Turkiye', 'Nmpz', 'Dunya']);
    expect(names(lb.board({ ...TODAY_WORLD, mapId: 'all' }, DAY1))).toEqual(['Turkiye', 'Dunya']);
    expect(names(lb.board({ ...TODAY_WORLD, mode: 'all' }, DAY1))).toEqual(['Nmpz', 'Dunya']);
  });

  it('today vs all time', () => {
    const lb = createLeaderboard(storage);
    lb.add(game('Dun', 20000), DAY1);
    lb.add(game('Bugun', 5000), DAY2);
    expect(names(lb.board(TODAY_WORLD, DAY2))).toEqual(['Bugun']);
    expect(names(lb.board({ ...TODAY_WORLD, period: 'all' }, DAY2))).toEqual(['Dun', 'Bugun']);
    expect(lb.add(game('Yeni', 1000), DAY2)).toBe(2);
  });

  it('only ranks 5-round games, but still stores the others', () => {
    const lb = createLeaderboard(storage);
    expect(lb.add(game('Kisa', 9000, { rounds: 3 }), DAY1)).toBeNull();
    expect(lb.add(game('Uzun', 30000, { rounds: 10 }), DAY1)).toBeNull();
    expect(lb.board(TODAY_WORLD, DAY1)).toEqual([]);
    expect(lb.all()).toHaveLength(2);
  });

  it('limits the list', () => {
    const lb = createLeaderboard(storage);
    for (let i = 0; i < 15; i++) lb.add(game(`P${i}`, i * 100), DAY1);
    const top = lb.board(TODAY_WORLD, DAY1, 10);
    expect(top).toHaveLength(10);
    expect(top[0].name).toBe('P14');
  });

  it('persists across instances', () => {
    createLeaderboard(storage).add(game('Ada', 12000), DAY1);
    expect(createLeaderboard(storage).board(TODAY_WORLD, DAY1)).toHaveLength(1);
  });

  it('fills in fields missing from older saves', () => {
    storage.data.set(
      STORAGE_KEY,
      JSON.stringify([
        // Phase 2: no mode, no rounds (always Moving, 5 rounds back then).
        { name: 'Eski', score: 5, mapId: 'world', day: dayKey(DAY1), ts: 1 },
        // No map at all: the leaderboard predates the other maps.
        { name: 'Haritasiz', score: 4, day: dayKey(DAY1), ts: 2 },
        // City-map scores stay on their city map.
        { name: 'Edirneli', score: 3, mapId: 'edirne', mode: 'moving', rounds: 5, day: dayKey(DAY1), ts: 3 },
      ]),
    );
    const lb = createLeaderboard(storage);
    expect(names(lb.board(TODAY_WORLD, DAY1))).toEqual(['Eski', 'Haritasiz']);
    expect(names(lb.board({ ...TODAY_WORLD, mapId: 'edirne' }, DAY1))).toEqual(['Edirneli']);
    expect(lb.all().every((e) => e.mode && e.rounds && e.mapId)).toBe(true);
  });

  it('clears all entries', () => {
    const lb = createLeaderboard(storage);
    lb.add(game('Ada', 12000), DAY1);
    lb.clear();
    expect(lb.all()).toEqual([]);
    expect(createLeaderboard(storage).all()).toEqual([]);
  });

  it('ignores corrupt stored data', () => {
    storage.data.set(STORAGE_KEY, '{not json');
    const lb = createLeaderboard(storage);
    expect(lb.all()).toEqual([]);
    expect(lb.add(game('Ada', 1), DAY1)).toBe(1);
  });

  it('drops malformed entries', () => {
    storage.data.set(
      STORAGE_KEY,
      JSON.stringify([{ name: 'Ok', score: 5, mapId: 'world', day: dayKey(DAY1), ts: 1 }, { foo: 1 }, null]),
    );
    expect(names(createLeaderboard(storage).all())).toEqual(['Ok']);
  });

  it('keeps working in memory when storage throws', () => {
    const lb = createLeaderboard(throwingStorage);
    expect(lb.add(game('Ada', 12000), DAY1)).toBe(1);
    expect(lb.board(TODAY_WORLD, DAY1)).toHaveLength(1);
  });

  it('works with no storage at all', () => {
    const lb = createLeaderboard(null);
    lb.add(game('Ada', 12000), DAY1);
    expect(lb.board(TODAY_WORLD, DAY1)).toHaveLength(1);
  });
});

describe('dayKey', () => {
  it('uses the local calendar date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('leaderboardCsv', () => {
  const entry = (over: Partial<LeaderboardEntry>): LeaderboardEntry => ({
    name: 'Ada',
    score: 12345,
    mapId: 'world',
    day: '2026-10-19',
    ts: new Date(2026, 9, 19, 14, 5).getTime(),
    ...over,
  });

  it('starts with a BOM and a Turkish header, semicolon separated', () => {
    const lines = leaderboardCsv([entry({ mode: 'nmpz', rounds: 5 })]).split('\r\n');
    expect(lines[0].charCodeAt(0)).toBe(0xfeff);
    expect(lines[0].slice(1)).toBe('Tarih;Saat;Ad;Puan;Harita;Mod;Tur');
    expect(lines[1]).toBe('2026-10-19;14:05;Ada;12345;world;nmpz;5');
  });

  it('quotes fields with separators or quotes', () => {
    const line = leaderboardCsv([entry({ name: 'A;"B"' })]).split('\r\n')[1];
    expect(line).toContain(';"A;""B""";');
  });

  it('neutralises spreadsheet formulas in names', () => {
    const line = leaderboardCsv([entry({ name: '=HYPERLINK("x")' })]).split('\r\n')[1];
    expect(line).toContain(`;"'=HYPERLINK(""x"")";`);
  });

  it('leaves unknown mode and rounds empty', () => {
    expect(leaderboardCsv([entry({})]).split('\r\n')[1]).toBe('2026-10-19;14:05;Ada;12345;world;;');
  });
});
