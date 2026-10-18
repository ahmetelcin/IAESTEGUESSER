import type { MapId } from '../game/scoring';

export const STORAGE_KEY = 'stajyer-nerede:leaderboard:v1';
/** Hard cap so a busy stand day can't grow localStorage without bound. */
const MAX_ENTRIES = 2000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  mapId: MapId;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  ts: number;
}

export interface Leaderboard {
  /** Adds an entry and returns its 1-based rank among that day's entries. */
  add(entry: Pick<LeaderboardEntry, 'name' | 'score' | 'mapId'>, now?: Date): number;
  today(now?: Date, limit?: number): LeaderboardEntry[];
  all(): LeaderboardEntry[];
  clear(): void;
}

export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const byRank = (a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score || a.ts - b.ts;

function isEntry(x: unknown): x is LeaderboardEntry {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.name === 'string' &&
    typeof e.score === 'number' &&
    typeof e.mapId === 'string' &&
    typeof e.day === 'string' &&
    typeof e.ts === 'number'
  );
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createLeaderboard(storage: StorageLike | null = defaultStorage()): Leaderboard {
  let entries = load();

  function load(): LeaderboardEntry[] {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage blocked or full: keep the in-memory list for this session.
    }
  }

  const forDay = (day: string) => entries.filter((e) => e.day === day).sort(byRank);

  return {
    add({ name, score, mapId }, now = new Date()) {
      const entry: LeaderboardEntry = { name, score, mapId, day: dayKey(now), ts: now.getTime() };
      entries.push(entry);
      if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
      save();
      return forDay(entry.day).indexOf(entry) + 1;
    },
    today(now = new Date(), limit = 10) {
      return forDay(dayKey(now)).slice(0, limit);
    },
    all() {
      return [...entries];
    },
    clear() {
      entries = [];
      save();
    },
  };
}
