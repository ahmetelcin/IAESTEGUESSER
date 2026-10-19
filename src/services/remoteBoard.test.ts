import { describe, expect, it } from 'vitest';
import { OUTBOX_KEY, createRemoteBoard } from './remoteBoard';
import type { ScoreSubmission } from './scoreRules';
import type { StorageLike } from './storage';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const entry = (id: string, score: number, extra: Partial<ScoreSubmission> = {}): ScoreSubmission => ({
  id: `game-${id}-000`,
  name: id,
  score,
  mapId: 'world',
  mode: 'moving',
  rounds: 5,
  day: '2026-10-19',
  ts: 1000 + score,
  ...extra,
});

const now = new Date(2026, 9, 19, 15);
const filter = { mapId: 'world', mode: 'moving', period: 'today' } as const;

describe('remote board', () => {
  it('sends a score and returns the server rank', async () => {
    const calls: string[] = [];
    const remote = createRemoteBoard({
      apiBase: 'https://x.test/api/',
      storage: memoryStorage(),
      fetch: async (url, init) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        return json({ rank: 3 });
      },
    });
    expect(await remote.submit(entry('a', 100))).toBe(3);
    expect(calls).toEqual(['POST https://x.test/api/scores']);
    expect(remote.pending).toBe(0);
  });

  it('keeps the score in the outbox when offline and delivers it later', async () => {
    const storage = memoryStorage();
    let online = false;
    const sent: string[] = [];
    const fetch = async (_url: string, init?: RequestInit) => {
      if (!online) throw new TypeError('Failed to fetch');
      sent.push(JSON.parse(String(init?.body)).id);
      return json({ rank: 1 });
    };
    const remote = createRemoteBoard({ apiBase: '/api', storage, fetch });
    expect(await remote.submit(entry('a', 100))).toBeUndefined();
    expect(remote.pending).toBe(1);

    // Survives a reload.
    const reloaded = createRemoteBoard({ apiBase: '/api', storage, fetch });
    expect(reloaded.pending).toBe(1);

    online = true;
    await reloaded.flush();
    expect(sent).toEqual(['game-a-000']);
    expect(reloaded.pending).toBe(0);
    expect(JSON.parse(storage.data.get(OUTBOX_KEY)!)).toEqual([]);
  });

  it('retries on server errors and rate limits, drops what the server rejects', async () => {
    let status = 500;
    const remote = createRemoteBoard({
      apiBase: '/api',
      storage: memoryStorage(),
      fetch: async () => json({ error: 'x' }, status),
    });
    await remote.submit(entry('a', 100));
    expect(remote.pending).toBe(1);
    status = 429;
    await remote.flush();
    expect(remote.pending).toBe(1);
    status = 400;
    await remote.flush();
    expect(remote.pending).toBe(0);
  });

  it('mixes undelivered local games into the shared board', async () => {
    let online = false;
    const remote = createRemoteBoard({
      apiBase: '/api',
      storage: memoryStorage(),
      fetch: async (_url, init) => {
        if (init?.method === 'POST' && !online) throw new TypeError('offline');
        return json({ entries: [entry('srv1', 900), entry('srv2', 100)] });
      },
    });
    await remote.submit(entry('mine', 500));
    await remote.submit(entry('other-map', 999, { mapId: 'europe' }));
    const board = await remote.board(filter, 10, now);
    expect(board?.map((e) => e.name)).toEqual(['srv1', 'mine', 'srv2']);
    expect((await remote.board(filter, 2, now))?.length).toBe(2);
  });

  it('returns null when the board cannot be fetched', async () => {
    const down = createRemoteBoard({ apiBase: '/api', storage: memoryStorage(), fetch: async () => json({}, 503) });
    expect(await down.board(filter, 10, now)).toBeNull();
    const offline = createRemoteBoard({
      apiBase: '/api',
      storage: memoryStorage(),
      fetch: async () => {
        throw new TypeError('offline');
      },
    });
    expect(await offline.board(filter, 10, now)).toBeNull();
  });

  it('asks for today by the player’s local day', async () => {
    let asked = '';
    const remote = createRemoteBoard({
      apiBase: '/api',
      storage: memoryStorage(),
      fetch: async (url) => {
        asked = url;
        return json({ entries: [] });
      },
    });
    await remote.board(filter, 10, now);
    expect(asked).toBe('/api/scores?mapId=world&mode=moving&period=today&day=2026-10-19&limit=10');
  });
});
