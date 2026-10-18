import type { Mode } from '../game/modes';
import type { MapId } from '../game/scoring';
import { defaultStorage, readJson, writeJson, type StorageLike } from './storage';

export type { StorageLike };

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
  /** Missing on entries saved before phase 4. */
  mode?: Mode;
  rounds?: number;
}

export interface Leaderboard {
  /** Adds an entry and returns its 1-based rank among that day's entries. */
  add(entry: Pick<LeaderboardEntry, 'name' | 'score' | 'mapId' | 'mode' | 'rounds'>, now?: Date): number;
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

export function createLeaderboard(storage: StorageLike | null = defaultStorage()): Leaderboard {
  let entries = load();

  function load(): LeaderboardEntry[] {
    const parsed = readJson(storage, STORAGE_KEY);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  }

  // Storage blocked or full: writeJson swallows it and the in-memory list keeps working.
  const save = () => writeJson(storage, STORAGE_KEY, entries);

  const forDay = (day: string) => entries.filter((e) => e.day === day).sort(byRank);

  return {
    add({ name, score, mapId, mode, rounds }, now = new Date()) {
      const entry: LeaderboardEntry = { name, score, mapId, mode, rounds, day: dayKey(now), ts: now.getTime() };
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
