import type { Location } from '../data/maps';
import { haversineKm, type LatLng } from './geo';
import { scoreFor, type MapId } from './scoring';

export interface RoundResult {
  location: Location;
  /** null when the timer ran out without a pin. */
  guess: LatLng | null;
  km: number | null;
  score: number;
}

export interface SessionOptions {
  pool: Location[];
  rounds: number;
  mapId: MapId;
  /** Location id to avoid (e.g. the one shown behind the menu). */
  exclude?: string;
}

export interface Session {
  readonly mapId: MapId;
  readonly locations: readonly Location[];
  readonly totalRounds: number;
  /** 1-based. */
  readonly roundNumber: number;
  readonly current: Location;
  readonly isLastRound: boolean;
  readonly results: readonly RoundResult[];
  readonly totalScore: number;
  submit(guess: LatLng | null): RoundResult;
  /** Swaps the current round's location for an unused one (e.g. its panorama failed to load). */
  replaceCurrent(): boolean;
  next(): void;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createSession({ pool, rounds, mapId, exclude }: SessionOptions): Session {
  const filtered = pool.filter((l) => l.id !== exclude);
  const source = filtered.length >= rounds ? filtered : pool;
  const locations = shuffle(source).slice(0, Math.min(rounds, source.length));
  const dropped = new Set<string>();
  const results: RoundResult[] = [];
  let index = 0;

  return {
    mapId,
    locations,
    totalRounds: locations.length,
    get roundNumber() {
      return index + 1;
    },
    get current() {
      return locations[index];
    },
    get isLastRound() {
      return index === locations.length - 1;
    },
    results,
    get totalScore() {
      return results.reduce((sum, r) => sum + r.score, 0);
    },
    submit(guess) {
      if (results.length > index) throw new Error('Round already submitted');
      const location = locations[index];
      const km = guess ? haversineKm(guess, location) : null;
      const result: RoundResult = { location, guess, km, score: km === null ? 0 : scoreFor(km, mapId) };
      results.push(result);
      return result;
    },
    replaceCurrent() {
      const used = new Set(locations.map((l) => l.id));
      const spare = shuffle(source).find((l) => !used.has(l.id) && !dropped.has(l.id));
      if (!spare) return false;
      dropped.add(locations[index].id);
      locations[index] = spare;
      return true;
    },
    next() {
      if (results.length <= index) throw new Error('Submit before advancing');
      if (index >= locations.length - 1) throw new Error('No more rounds');
      index++;
    },
  };
}
