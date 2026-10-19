/**
 * Shared leaderboard: one table for the stand and every phone.
 *
 *   POST /api/scores   add a finished game  → { rank }   (rank null = not a ranked game)
 *   GET  /api/scores?mapId=&mode=&period=today|all&day=YYYY-MM-DD&limit=  → { entries }
 *
 * Storage is MongoDB Atlas. The connection string lives only in the Netlify environment
 * (MONGODB_URI); it never reaches the browser or git. Validation rules are shared with the
 * game (src/services/scoreRules.ts).
 */
import type { Config, Context } from '@netlify/functions';
import { createHash } from 'node:crypto';
import { MongoClient, type Collection, type Db } from 'mongodb';
import {
  MAP_IDS,
  MODES,
  RANKED_ROUNDS,
  isDay,
  validateSubmission,
  type ScoreSubmission,
} from '../../src/services/scoreRules';

export const config: Config = { path: '/api/scores' };

/** Submissions per IP per minute. */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const MAX_LIMIT = 20;
const MAX_BODY_BYTES = 2048;

interface StoredScore extends ScoreSubmission {
  receivedAt: Date;
}
interface Hit {
  key: string;
  at: Date;
}

// Reused across invocations of a warm function instance.
let dbPromise: Promise<Db> | null = null;
function db(): Promise<Db> {
  dbPromise ??= (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    const client = await new MongoClient(uri, { maxPoolSize: 3, serverSelectionTimeoutMS: 5000 }).connect();
    const database = client.db(process.env.MONGODB_DB || 'stajyer-nerede');
    await Promise.all([
      database.collection('scores').createIndex({ id: 1 }, { unique: true }),
      database.collection('scores').createIndex({ mapId: 1, mode: 1, rounds: 1, day: 1, score: -1, ts: 1 }),
      database.collection('hits').createIndex({ at: 1 }, { expireAfterSeconds: 600 }),
    ]);
    return database;
  })().catch((err) => {
    dbPromise = null; // try again on the next request
    throw err;
  });
  return dbPromise;
}

// The stand runs from file:// (origin "null"), so any origin may call this.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });

export default async (req: Request, context: Context): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    if (req.method === 'GET') return await list(new URL(req.url));
    if (req.method === 'POST') return await add(req, context);
    return reply({ error: 'method' }, 405);
  } catch (err) {
    console.error(err);
    return reply({ error: 'server' }, 503);
  }
};

async function list(url: URL): Promise<Response> {
  const p = url.searchParams;
  const mapId = p.get('mapId');
  const mode = p.get('mode');
  const period = p.get('period') ?? 'today';
  const day = p.get('day');
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(p.get('limit')) || 10));
  if (!MAP_IDS.includes(mapId as never) || !MODES.includes(mode as never)) return reply({ error: 'filter' }, 400);
  if (period !== 'today' && period !== 'all') return reply({ error: 'period' }, 400);
  if (period === 'today' && !isDay(day)) return reply({ error: 'day' }, 400);

  const scores = (await db()).collection<StoredScore>('scores');
  const entries = await scores
    .find(
      { mapId, mode, rounds: RANKED_ROUNDS, ...(period === 'today' ? { day: day! } : {}) } as never,
      { projection: { _id: 0, receivedAt: 0 } },
    )
    .sort({ score: -1, ts: 1 })
    .limit(limit)
    .toArray();
  return reply({ entries }, 200, { 'Cache-Control': 'no-store' });
}

async function add(req: Request, context: Context): Promise<Response> {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return reply({ error: 'size' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply({ error: 'json' }, 400);
  }
  const check = validateSubmission(body);
  if (!check.ok) return reply({ error: check.error }, 400);
  const entry = check.value;

  const database = await db();
  if (await rateLimited(database.collection<Hit>('hits'), context.ip)) {
    return reply({ error: 'rate' }, 429, { 'Retry-After': '60' });
  }

  const scores = database.collection<StoredScore>('scores');
  // Upsert by id: a game resent from an offline queue is stored once.
  await scores.updateOne({ id: entry.id }, { $setOnInsert: { ...entry, receivedAt: new Date() } }, { upsert: true });
  return reply({ rank: entry.rounds === RANKED_ROUNDS ? await rankOf(scores, entry) : null });
}

/** 1-based place on that day's board for the same map and mode (ties: earlier game first). */
async function rankOf(scores: Collection<StoredScore>, e: ScoreSubmission): Promise<number> {
  const ahead = await scores.countDocuments({
    mapId: e.mapId,
    mode: e.mode,
    rounds: RANKED_ROUNDS,
    day: e.day,
    $or: [{ score: { $gt: e.score } }, { score: e.score, ts: { $lt: e.ts } }],
  });
  return ahead + 1;
}

/** Counts this IP's recent submissions; IPs are stored hashed and expire after 10 minutes. */
async function rateLimited(hits: Collection<Hit>, ip: string | undefined): Promise<boolean> {
  const key = createHash('sha256').update(`stajyer-nerede:${ip ?? 'unknown'}`).digest('hex').slice(0, 32);
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await hits.countDocuments({ key, at: { $gte: since } });
  if (recent >= RATE_LIMIT) return true;
  await hits.insertOne({ key, at: new Date() });
  return false;
}
