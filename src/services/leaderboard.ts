import type { Mode } from '../game/modes';
import type { MapId } from '../game/scoring';
import { ALL, MAP_IDS, MODES, RANKED_ROUNDS, type BoardMap, type BoardMode } from './scoreRules';
import { defaultStorage, readJson, writeJson, type StorageLike } from './storage';

export type { StorageLike };
export { RANKED_ROUNDS };

export const STORAGE_KEY = 'stajyer-nerede:leaderboard:v1';
/** Hard cap so a busy stand day can't grow localStorage without bound. */
const MAX_ENTRIES = 2000;

export interface LeaderboardEntry {
  name: string;
  score: number;
  mapId: MapId;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  ts: number;
  /** Always set on stored entries (older saves are filled in on load). */
  mode?: Mode;
  rounds?: number;
  /** Shared with the online leaderboard to recognise the same game (older saves have none). */
  id?: string;
}

export type Period = 'today' | 'all';

export interface BoardFilter {
  /** 'all' combines every mode / map (the leaderboard screen's "Tümü" tab). */
  mode: BoardMode;
  mapId: BoardMap;
  period: Period;
}

export interface Leaderboard {
  /**
   * Stores a finished game. Returns its 1-based rank on today's board for the same
   * mode and map, or null when the game isn't ranked (not RANKED_ROUNDS long).
   */
  add(entry: Pick<LeaderboardEntry, 'name' | 'score' | 'mapId' | 'mode' | 'rounds' | 'id'>, now?: Date): number | null;
  board(filter: BoardFilter, now?: Date, limit?: number): LeaderboardEntry[];
  all(): LeaderboardEntry[];
  clear(): void;
}

export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const byRank = (a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score || a.ts - b.ts;

/** Whether an entry belongs on a board (ranked length, same mode and map, and day for "today"). */
export function onBoard(e: LeaderboardEntry, { mode, mapId, period }: BoardFilter, today: string): boolean {
  return (
    e.rounds === RANKED_ROUNDS &&
    (mode === ALL || e.mode === mode) &&
    (mapId === ALL || e.mapId === mapId) &&
    (period === 'all' || e.day === today)
  );
}

/**
 * Validates a stored entry and fills in what older versions didn't save: before phase 4
 * every game was Moving and 5 rounds; the leaderboard started when World was the only map.
 */
function normalize(x: unknown): LeaderboardEntry | null {
  if (!x || typeof x !== 'object') return null;
  const e = x as Record<string, unknown>;
  if (typeof e.name !== 'string' || typeof e.score !== 'number' || typeof e.day !== 'string' || typeof e.ts !== 'number')
    return null;
  const rawMap = typeof e.mapId === 'string' ? e.mapId : 'world';
  if (!MAP_IDS.includes(rawMap as MapId)) return null;
  const mode = MODES.includes(e.mode as Mode) ? (e.mode as Mode) : 'moving';
  const rounds = typeof e.rounds === 'number' ? e.rounds : RANKED_ROUNDS;
  const entry: LeaderboardEntry = { name: e.name, score: e.score, mapId: rawMap as MapId, day: e.day, ts: e.ts, mode, rounds };
  if (typeof e.id === 'string') entry.id = e.id;
  return entry;
}

export function createLeaderboard(storage: StorageLike | null = defaultStorage()): Leaderboard {
  let entries = load();

  function load(): LeaderboardEntry[] {
    const parsed = readJson(storage, STORAGE_KEY);
    return Array.isArray(parsed) ? parsed.map(normalize).filter((e): e is LeaderboardEntry => e !== null) : [];
  }

  // Storage blocked or full: writeJson swallows it and the in-memory list keeps working.
  const save = () => writeJson(storage, STORAGE_KEY, entries);

  const query = (filter: BoardFilter, now: Date) => {
    const day = dayKey(now);
    return entries.filter((e) => onBoard(e, filter, day)).sort(byRank);
  };

  return {
    add({ name, score, mapId, mode = 'moving', rounds = RANKED_ROUNDS, id }, now = new Date()) {
      const entry: LeaderboardEntry = { name, score, mapId, mode, rounds, day: dayKey(now), ts: now.getTime() };
      if (id) entry.id = id;
      entries.push(entry);
      if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
      save();
      if (rounds !== RANKED_ROUNDS) return null;
      return query({ mode, mapId, period: 'today' }, now).indexOf(entry) + 1;
    },
    board(filter, now = new Date(), limit = 10) {
      return query(filter, now).slice(0, limit);
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

function csvField(value: string): string {
  // A leading = + - @ makes Excel/Sheets evaluate the cell; prefix it so names stay text.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) || safe !== value ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Semicolon CSV with a BOM, so Turkish-locale Excel opens it with the right columns and letters. */
export function leaderboardCsv(entries: LeaderboardEntry[]): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const rows = entries.map((e) => {
    const d = new Date(e.ts);
    return [
      dayKey(d),
      `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      csvField(e.name),
      String(e.score),
      e.mapId,
      e.mode ?? '',
      e.rounds === undefined ? '' : String(e.rounds),
    ].join(';');
  });
  return '﻿' + ['Tarih;Saat;Ad;Puan;Harita;Mod;Tur', ...rows].join('\r\n');
}
