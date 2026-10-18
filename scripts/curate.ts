/**
 * Pulls Mapillary images for every city in scripts/cities.ts and writes
 * src/data/maps/<map>.json. World/Europe take 360° panoramas only; the maps in
 * FLAT_ALLOWED (Türkiye, city maps) also take regular photos, preferring panoramas.
 *
 *   npm run curate                       all maps
 *   npm run curate -- europe turkey      only these maps
 *   npm run curate -- --only berlin,oslo re-fetch these cities, keep the rest of the files
 *   npm run curate -- --per-city 5       panoramas per city (default 4)
 *   npm run curate -- --fresh            ignore the resume cache
 *   npm run curate -- edirne bursa       city maps: spots spread across one city
 *
 * Reads VITE_MAPILLARY_TOKEN from .env.
 *
 * Dense city centers make the Graph API answer HTTP 500 ("reduce the amount of data")
 * even for small boxes, so each city is searched as a grid of small cells, and any cell
 * that fails is split into four smaller ones (down to ~50 m).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CITY_LISTS, CITY_MAPS, FLAT_ALLOWED, type City, type CityMap } from './cities';

type ListMapId = keyof typeof CITY_LISTS;
type CityMapId = keyof typeof CITY_MAPS;

interface ApiImage {
  id: string;
  is_pano?: boolean;
  captured_at?: number;
  sequence?: string;
  computed_geometry?: { coordinates: [number, number] };
  geometry?: { coordinates: [number, number] };
}

interface Candidate {
  imageId: string;
  isPano: boolean;
  lat: number;
  lng: number;
  sequence: string;
}

interface Location {
  id: string;
  cityId: string;
  imageId: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
}

const MIN_CAPTURED_AT = Date.UTC(2018, 0, 1);
/** Cell size of the search grid and spacing between cell origins (degrees). */
const CELL = 0.004;
const GRID_STEP = 0.006;
const GRID_RADIUS = 4; // 9x9 cells ≈ ±2.7 km north-south around the center
const MIN_CELL = 0.0005;
const MIN_SPACING_M = 250;
/** Stop searching a city once this many candidates (from distinct sequences) are found. */
const ENOUGH_FACTOR = 3;
const MAX_REQUESTS_PER_CITY = 150;
/** Fallback for sparse cities: gap-free scan of ±WIDE_RADIUS. */
const WIDE_RADIUS = 0.05;
const WIDE_CELL = 0.01;
const WIDE_SCAN_BUDGET = 150;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_PARALLEL_REQUESTS = 12;
const PARALLEL_CITIES = 6;
const MAX_RATE_LIMIT_RETRIES = 6;
/** Per-city results survive crashes; rerun to resume. Delete it (or pass --fresh) to start over. */
const CACHE_FILE = resolve('scripts/.curate-cache.json');

// ── CLI ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const only = flag('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const perCity = Number(flag('--per-city') ?? 4);
const fresh = args.includes('--fresh');
if (fresh) args.splice(args.indexOf('--fresh'), 1);
const requested = args.length ? args : [...Object.keys(CITY_LISTS), ...Object.keys(CITY_MAPS)];
for (const m of requested) {
  if (!(m in CITY_LISTS) && !(m in CITY_MAPS)) {
    const all = [...Object.keys(CITY_LISTS), ...Object.keys(CITY_MAPS)];
    console.error(`Unknown map "${m}". Use: ${all.join(', ')}`);
    process.exit(1);
  }
}
const maps = requested.filter((m): m is ListMapId => m in CITY_LISTS);
const cityMaps = requested.filter((m): m is CityMapId => m in CITY_MAPS);

function loadToken(): string {
  try {
    process.loadEnvFile(resolve('.env'));
  } catch {
    // fall through
  }
  const token = process.env.VITE_MAPILLARY_TOKEN;
  if (!token) {
    console.error('VITE_MAPILLARY_TOKEN missing. Copy .env.example to .env and set it.');
    process.exit(1);
  }
  return token;
}
const token = loadToken();

// ── Request plumbing ────────────────────────────────────────────────────
let rateLimited = 0;
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL_REQUESTS) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

interface CityStats {
  requests: number;
  failures: number;
  /** Request budget for this city / city map. */
  cap: number;
  /** Results per request; dense city-map cells need more than the default. */
  limit?: number;
  /** false = regular photos are fine too. */
  panoOnly: boolean;
}

type QueryOutcome =
  | { kind: 'ok'; data: ApiImage[] }
  | { kind: 'refused' }
  | { kind: 'rate-limited'; retryAfter: number };

/** null = the API refused (500 / timeout); caller may split the cell. */
async function query(bbox: number[], stats: CityStats): Promise<ApiImage[] | null> {
  stats.requests++;
  const url = new URL('https://graph.mapillary.com/images');
  url.searchParams.set('access_token', token);
  url.searchParams.set('fields', 'id,is_pano,captured_at,sequence,computed_geometry,geometry');
  if (stats.panoOnly) url.searchParams.set('is_pano', 'true');
  url.searchParams.set('bbox', bbox.join(','));
  url.searchParams.set('limit', String(stats.limit ?? 50));
  for (let attempt = 0; ; attempt++) {
    const result = await limited(async (): Promise<QueryOutcome> => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (res.ok) return { kind: 'ok', data: ((await res.json()) as { data: ApiImage[] }).data };
        const body = await res.text();
        if (res.status === 500) return { kind: 'refused' };
        if (res.status === 429) return { kind: 'rate-limited', retryAfter: Number(res.headers.get('retry-after')) || 0 };
        throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
      } catch (err) {
        if (err instanceof Error && err.name === 'TimeoutError') return { kind: 'refused' };
        throw err;
      }
    });
    if (result.kind === 'ok') return result.data;
    if (result.kind === 'refused') {
      stats.failures++;
      return null;
    }
    // Rate limited: back off (honouring Retry-After) and try the same request again.
    if (attempt >= MAX_RATE_LIMIT_RETRIES) throw new Error('HTTP 429: still rate limited after retries');
    const waitMs = result.retryAfter ? result.retryAfter * 1000 : 2000 * 2 ** attempt;
    rateLimited++;
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 60_000)));
  }
}

/** Queries a cell; on refusal splits it into four, recursively, down to MIN_CELL. */
async function queryCell(west: number, south: number, size: number, stats: CityStats): Promise<ApiImage[]> {
  if (stats.requests >= stats.cap) return [];
  const data = await query([west, south, west + size, south + size], stats);
  if (data) return data;
  if (size / 2 < MIN_CELL) return [];
  const h = size / 2;
  const parts = await Promise.all([
    queryCell(west, south, h, stats),
    queryCell(west + h, south, h, stats),
    queryCell(west, south + h, h, stats),
    queryCell(west + h, south + h, h, stats),
  ]);
  return parts.flat();
}

// ── Selection ───────────────────────────────────────────────────────────
function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function toCandidate(img: ApiImage): Candidate | null {
  const geo = img.computed_geometry ?? img.geometry;
  if (!geo || (img.captured_at ?? 0) < MIN_CAPTURED_AT) return null;
  const [lng, lat] = geo.coordinates;
  return { imageId: img.id, isPano: img.is_pano === true, lat, lng, sequence: img.sequence ?? img.id };
}

/** Grid cells ordered from the center outwards (with a little shuffle within each ring). */
function gridCells(city: City): [number, number][] {
  const cells: { d: number; cell: [number, number] }[] = [];
  for (let i = -GRID_RADIUS; i <= GRID_RADIUS; i++)
    for (let j = -GRID_RADIUS; j <= GRID_RADIUS; j++) {
      const ring = Math.max(Math.abs(i), Math.abs(j));
      cells.push({
        d: ring + Math.random() * 0.9,
        cell: [city.lng + j * GRID_STEP - CELL / 2, city.lat + i * GRID_STEP - CELL / 2],
      });
    }
  return cells.sort((a, b) => a.d - b.d).map((c) => c.cell);
}

async function curateCity(city: City, want: number, panoOnly: boolean) {
  const stats: CityStats = { requests: 0, failures: 0, cap: MAX_REQUESTS_PER_CITY, panoOnly };
  const bySequence = new Map<string, Candidate[]>();
  const cells = gridCells(city);
  const enough = () => bySequence.size >= want * ENOUGH_FACTOR;

  // Work through cells a few at a time so we can stop early once enough is found.
  for (let i = 0; i < cells.length && !enough() && stats.requests < MAX_REQUESTS_PER_CITY; i += 4) {
    const batch = cells.slice(i, i + 4);
    const results = await Promise.all(batch.map(([w, s]) => queryCell(w, s, CELL, stats)));
    for (const img of results.flat()) {
      const c = toCandidate(img);
      if (!c) continue;
      const list = bySequence.get(c.sequence) ?? [];
      if (!list.some((x) => x.imageId === c.imageId)) list.push(c);
      bySequence.set(c.sequence, list);
    }
  }

  // Sparse coverage (outside the center or between grid cells): scan a wider square
  // without gaps before giving up on the city.
  if (bySequence.size < want) {
    stats.cap = stats.requests + WIDE_SCAN_BUDGET;
    stats.limit = 100;
    const wide: [number, number][] = [];
    for (let lat = city.lat - WIDE_RADIUS; lat < city.lat + WIDE_RADIUS; lat += WIDE_CELL)
      for (let lng = city.lng - WIDE_RADIUS; lng < city.lng + WIDE_RADIUS; lng += WIDE_CELL) wide.push([lng, lat]);
    for (let i = 0; i < wide.length; i += 6) {
      const results = await Promise.all(wide.slice(i, i + 6).map(([w, so]) => queryCell(w, so, WIDE_CELL, stats)));
      for (const img of results.flat()) {
        const c = toCandidate(img);
        if (!c) continue;
        const list = bySequence.get(c.sequence) ?? [];
        if (!list.some((x) => x.imageId === c.imageId)) list.push(c);
        bySequence.set(c.sequence, list);
      }
    }
  }

  // One image per sequence, at least MIN_SPACING_M apart; panoramas first.
  const hasPano = (seq: Candidate[]) => seq.some((x) => x.isPano);
  const ordered = shuffle([...bySequence.values()]).sort((a, b) => Number(hasPano(b)) - Number(hasPano(a)));
  const picks: Candidate[] = [];
  for (const seq of ordered) {
    const pool = hasPano(seq) ? seq.filter((x) => x.isPano) : seq;
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (picks.every((p) => distanceM(p, c) >= MIN_SPACING_M)) picks.push(c);
    if (picks.length >= want) break;
  }
  return { picks, sequences: bySequence.size, ...stats };
}

// ── City maps ───────────────────────────────────────────────────────────
const SPOT_CELL = 0.01;
const MAX_REQUESTS_PER_CITY_MAP = 600;

/** Scans the whole square around the city, then spreads picks by farthest-point sampling. */
async function curateCityMap(id: CityMapId, cfg: CityMap): Promise<Location[]> {
  const stats: CityStats = {
    requests: 0,
    failures: 0,
    cap: MAX_REQUESTS_PER_CITY_MAP,
    limit: 200,
    panoOnly: !FLAT_ALLOWED.has(id),
  };
  const cells: [number, number][] = [];
  for (let lat = cfg.lat - cfg.radius; lat < cfg.lat + cfg.radius; lat += SPOT_CELL)
    for (let lng = cfg.lng - cfg.radius; lng < cfg.lng + cfg.radius; lng += SPOT_CELL) cells.push([lng, lat]);

  const byId = new Map<string, Candidate>();
  for (let i = 0; i < cells.length; i += 6) {
    const results = await Promise.all(cells.slice(i, i + 6).map(([w, so]) => queryCell(w, so, SPOT_CELL, stats)));
    for (const img of results.flat()) {
      const c = toCandidate(img);
      if (c) byId.set(c.imageId, c);
    }
  }

  const all = [...byId.values()];
  const picks: Candidate[] = [];
  if (all.length) {
    const panos = all.filter((c) => c.isPano);
    const seedPool = panos.length ? panos : all;
    picks.push(seedPool[Math.floor(Math.random() * seedPool.length)]);
    const minDist = all.map((c) => distanceM(c, picks[0]));
    while (picks.length < cfg.count) {
      let best = -1;
      for (let i = 0; i < all.length; i++) if (best < 0 || minDist[i] > minDist[best]) best = i;
      if (minDist[best] < cfg.spacingM) break;
      const next = all[best];
      picks.push(next);
      for (let i = 0; i < all.length; i++) minDist[i] = Math.min(minDist[i], distanceM(all[i], next));
    }
  }
  console.log(
    `${picks.length >= 5 ? '✓' : '✗'} ${cfg.city.padEnd(16)} ${picks.length} spots, ${picks.filter((p) => p.isPano).length} 360°  (images ${all.length}, requests ${stats.requests}, refused ${stats.failures})`,
  );
  return picks.map((p, i) => {
    const spotId = `${id}-${String(i + 1).padStart(2, '0')}`;
    return { id: spotId, cityId: spotId, imageId: p.imageId, lat: p.lat, lng: p.lng, city: cfg.city, country: cfg.country };
  });
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const panoMaps = maps.filter((m) => !FLAT_ALLOWED.has(m));
  const flatMaps = maps.filter((m) => FLAT_ALLOWED.has(m));
  if (panoMaps.length) await curateLists(panoMaps, true);
  if (flatMaps.length) await curateLists(flatMaps, false);
  for (const id of cityMaps) {
    const locations = await curateCityMap(id, CITY_MAPS[id]);
    writeFileSync(resolve(`src/data/maps/${id}.json`), JSON.stringify(locations, null, 2) + '\n');
    console.log(`${id}: ${locations.length} spots`);
  }
}

async function curateLists(maps: ListMapId[], panoOnly: boolean) {
  // Cache keys carry the mode: İstanbul is panorama-only in World but not in Türkiye.
  const key = (cityId: string) => `${panoOnly ? 'pano' : 'any'}:${cityId}`;
  const cityById = new Map<string, City>();
  for (const m of maps) for (const c of CITY_LISTS[m]) cityById.set(c.id, c);
  if (only) {
    const unknown = only.filter((id) => !cityById.has(id));
    if (unknown.length) {
      console.error(`Unknown city ids for ${maps.join(', ')}: ${unknown.join(', ')}`);
      process.exit(1);
    }
  }
  const todo = [...cityById.values()].filter((c) => !only || only.includes(c.id));
  console.log(`Curating ${todo.length} cities for ${maps.join(', ')}, ${perCity} ${panoOnly ? '360° panoramas' : 'images (360° preferred)'} each…`);

  // --only always re-fetches; otherwise reuse cached cities from an interrupted run.
  const cache: Record<string, Location[]> =
    !fresh && !only && existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
  const found = new Map<string, Location[]>(Object.entries(cache));
  const cached = todo.filter((c) => found.has(key(c.id))).length;
  if (cached) console.log(`Reusing ${cached} cities from ${CACHE_FILE} (pass --fresh to ignore).`);
  const queue = todo.filter((c) => !found.has(key(c.id)));
  const failed: string[] = [];
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: PARALLEL_CITIES }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        let r: Awaited<ReturnType<typeof curateCity>>;
        try {
          r = await curateCity(c, perCity, panoOnly);
        } catch (err) {
          failed.push(c.city);
          console.log(`! ${c.city.padEnd(16)} error: ${err instanceof Error ? err.message : err}`);
          continue;
        }
        found.set(
          key(c.id),
          r.picks.map((p, i) => ({
            id: `${c.id}-${i + 1}`,
            cityId: c.id,
            imageId: p.imageId,
            lat: p.lat,
            lng: p.lng,
            city: c.city,
            country: c.country,
          })),
        );
        if (!only) writeFileSync(CACHE_FILE, JSON.stringify({ ...cache, ...Object.fromEntries(found) }));
        const mark = r.picks.length === 0 ? '✗' : r.picks.length < perCity ? '~' : '✓';
        console.log(
          `${mark} ${c.city.padEnd(16)} ${r.picks.length} images, ${r.picks.filter((p) => p.isPano).length} 360°  (sequences ${r.sequences}, requests ${r.requests}, refused ${r.failures})`,
        );
      }
    }),
  );
  console.log(
    `Done in ${Math.round((Date.now() - t0) / 1000)} s` +
      (rateLimited ? `, rate-limited ${rateLimited}×` : '') +
      (failed.length ? ` — errors (rerun to retry): ${failed.join(', ')}` : '') +
      '.',
  );

  for (const m of maps) {
    const out = resolve(`src/data/maps/${m}.json`);
    const previous: Location[] =
      only && existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as Location[]) : [];
    const locations = CITY_LISTS[m].flatMap((c) =>
      found.has(key(c.id)) ? found.get(key(c.id))! : previous.filter((l) => l.cityId === c.id),
    );
    writeFileSync(out, JSON.stringify(locations, null, 2) + '\n');
    const cities = new Set(locations.map((l) => l.cityId)).size;
    const missing = CITY_LISTS[m].filter((c) => !locations.some((l) => l.cityId === c.id)).map((c) => c.city);
    console.log(
      `${m}: ${locations.length} images in ${cities}/${CITY_LISTS[m].length} cities` +
        (missing.length ? ` — missing: ${missing.join(', ')}` : ''),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
