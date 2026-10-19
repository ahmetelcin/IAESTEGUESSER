import type { Mode } from '../game/modes';
import type { MapId } from '../game/scoring';

/**
 * Score rules shared by the game and the shared-leaderboard function
 * (netlify/functions/scores.ts), so both sides agree on what a valid entry is.
 */

export const MAP_IDS: readonly MapId[] = ['world', 'europe', 'turkey', 'istanbul', 'edirne', 'bursa'];
export const MODES: readonly Mode[] = ['moving', 'no-move', 'nmpz'];
export const NAME_MAX_LENGTH = 16;
/** Only full-length games are ranked; shorter/longer admin games are stored but not shown. */
export const RANKED_ROUNDS = 5;
export const MAX_ROUND_SCORE = 5000;
export const MAX_ROUNDS = 10;
/** Queued offline scores may arrive this many days late. */
const MAX_DAYS_LATE = 7;

export interface ScoreSubmission {
  /** Client-made id; resending the same entry (offline queue) never duplicates it. */
  id: string;
  name: string;
  score: number;
  mapId: MapId;
  mode: Mode;
  rounds: number;
  /** Player's local calendar day, YYYY-MM-DD. */
  day: string;
  ts: number;
}

export type Validation = { ok: true; value: ScoreSubmission } | { ok: false; error: string };

export function cleanName(name: string): string {
  // Control characters out, runs of whitespace collapsed.
  return name.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v) && !Number.isNaN(Date.parse(v));

/** Whole days between two YYYY-MM-DD strings (b − a). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function validateSubmission(input: unknown, now: Date = new Date()): Validation {
  if (!input || typeof input !== 'object') return { ok: false, error: 'body' };
  const x = input as Record<string, unknown>;

  if (typeof x.id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(x.id)) return { ok: false, error: 'id' };
  if (typeof x.name !== 'string') return { ok: false, error: 'name' };
  const name = cleanName(x.name);
  if (name.length === 0 || name.length > NAME_MAX_LENGTH) return { ok: false, error: 'name' };
  if (!MAP_IDS.includes(x.mapId as MapId)) return { ok: false, error: 'mapId' };
  if (!MODES.includes(x.mode as Mode)) return { ok: false, error: 'mode' };
  const rounds = x.rounds;
  if (typeof rounds !== 'number' || !Number.isInteger(rounds) || rounds < 1 || rounds > MAX_ROUNDS)
    return { ok: false, error: 'rounds' };
  const score = x.score;
  const max = Math.min(RANKED_ROUNDS, rounds) * MAX_ROUND_SCORE;
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > max)
    return { ok: false, error: 'score' };
  if (!isDay(x.day)) return { ok: false, error: 'day' };
  // The client's local day; allow for time zones (±1) and late offline delivery.
  const serverDay = now.toISOString().slice(0, 10);
  const late = daysBetween(x.day, serverDay);
  if (late < -1 || late > MAX_DAYS_LATE) return { ok: false, error: 'day' };
  if (typeof x.ts !== 'number' || !Number.isFinite(x.ts)) return { ok: false, error: 'ts' };

  return {
    ok: true,
    value: { id: x.id, name, score, mapId: x.mapId as MapId, mode: x.mode as Mode, rounds, day: x.day, ts: x.ts },
  };
}
