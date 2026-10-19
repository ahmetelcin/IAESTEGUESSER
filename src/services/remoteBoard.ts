import { byRank, dayKey, onBoard, type BoardFilter, type LeaderboardEntry } from './leaderboard';
import type { ScoreSubmission } from './scoreRules';
import { defaultStorage, readJson, writeJson, type StorageLike } from './storage';

/**
 * Shared leaderboard (stand + phones) behind netlify/functions/scores.ts.
 *
 * The game never waits for it: scores go into an outbox in localStorage first and are
 * sent in the background; whatever can't be delivered is retried later (next game,
 * `online` event, a timer). Boards come back as null when the server can't be reached,
 * and callers keep showing the local leaderboard.
 */

export const OUTBOX_KEY = 'stajyer-nerede:outbox:v1';
const TIMEOUT_MS = 5000;

export interface RemoteBoard {
  /** Queues the game and tries to send it. Resolves to its rank today (null = unranked), or undefined if not delivered yet. */
  submit(entry: ScoreSubmission): Promise<number | null | undefined>;
  /** Top entries from the server plus this device's undelivered ones; null when unreachable. */
  board(filter: BoardFilter, limit: number, now?: Date): Promise<LeaderboardEntry[] | null>;
  /** Retries everything in the outbox. */
  flush(): Promise<void>;
  readonly pending: number;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Random id for a game; also works where crypto.randomUUID is missing. */
export function newEntryId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function createRemoteBoard(opts: {
  apiBase: string;
  storage?: StorageLike | null;
  fetch?: FetchLike;
  timeoutMs?: number;
}): RemoteBoard {
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const doFetch: FetchLike = opts.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const base = opts.apiBase.replace(/\/+$/, '');
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;

  const stored = readJson(storage, OUTBOX_KEY);
  let outbox: ScoreSubmission[] = Array.isArray(stored) ? stored : [];
  const save = () => writeJson(storage, OUTBOX_KEY, outbox);
  const remove = (id: string) => {
    outbox = outbox.filter((e) => e.id !== id);
    save();
  };

  const request = (path: string, init?: RequestInit) =>
    doFetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });

  /**
   * 'sent' (with rank) / 'rejected' (the server will never take it: drop it) /
   * 'failed' (offline, timeout, 5xx, rate limit: keep it for later).
   */
  async function send(entry: ScoreSubmission): Promise<{ status: 'sent'; rank: number | null } | { status: 'rejected' | 'failed' }> {
    try {
      const res = await request('/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { rank?: unknown };
        return { status: 'sent', rank: typeof body.rank === 'number' ? body.rank : null };
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) return { status: 'rejected' };
      return { status: 'failed' };
    } catch {
      return { status: 'failed' };
    }
  }

  let flushing: Promise<void> | null = null;
  function flush(): Promise<void> {
    flushing ??= (async () => {
      for (const entry of [...outbox]) {
        const r = await send(entry);
        if (r.status === 'failed') break; // still offline: try again later
        remove(entry.id);
      }
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  return {
    get pending() {
      return outbox.length;
    },
    async submit(entry) {
      if (!outbox.some((e) => e.id === entry.id)) {
        outbox.push(entry);
        save();
      }
      await flushing; // don't send the same entry twice in parallel
      if (!outbox.some((e) => e.id === entry.id)) return undefined;
      const r = await send(entry);
      if (r.status === 'failed') return undefined;
      remove(entry.id);
      void flush(); // we're online: deliver older ones too
      return r.status === 'sent' ? r.rank : undefined;
    },
    async board(filter, limit, now = new Date()) {
      const today = dayKey(now);
      const params = new URLSearchParams({
        mapId: filter.mapId,
        mode: filter.mode,
        period: filter.period,
        day: today,
        limit: String(limit),
      });
      let entries: LeaderboardEntry[];
      try {
        const res = await request(`/scores?${params}`);
        if (!res.ok) return null;
        const body = (await res.json()) as { entries?: unknown };
        if (!Array.isArray(body.entries)) return null;
        entries = body.entries as LeaderboardEntry[];
      } catch {
        return null;
      }
      // Games from this device that haven't reached the server yet still show up.
      const ids = new Set(entries.map((e) => e.id));
      const pending = outbox.filter((e) => !ids.has(e.id) && onBoard(e, filter, today));
      return [...entries, ...pending].sort(byRank).slice(0, limit);
    },
    flush,
  };
}
