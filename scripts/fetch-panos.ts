/**
 * Fetches one real 360° Mapillary panorama per city and writes src/data/maps/world.json.
 * Usage: npm run fetch-panos [cityId ...]   (reads VITE_MAPILLARY_TOKEN from .env)
 * With city ids it only probes and prints, without writing world.json.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface City {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

interface ApiImage {
  id: string;
  captured_at?: number;
  computed_geometry?: { type: 'Point'; coordinates: [number, number] };
  geometry?: { type: 'Point'; coordinates: [number, number] };
}

const CITIES: City[] = [
  { id: 'istanbul', city: 'İstanbul', country: 'Türkiye', lat: 41.0082, lng: 28.9784 },
  { id: 'lisbon', city: 'Lizbon', country: 'Portekiz', lat: 38.7223, lng: -9.1393 },
  { id: 'warsaw', city: 'Varşova', country: 'Polonya', lat: 52.2297, lng: 21.0122 },
  { id: 'prague', city: 'Prag', country: 'Çekya', lat: 50.0755, lng: 14.4378 },
  { id: 'budapest', city: 'Budapeşte', country: 'Macaristan', lat: 47.4979, lng: 19.0402 },
  { id: 'tokyo', city: 'Tokyo', country: 'Japonya', lat: 35.6812, lng: 139.7671 },
  { id: 'sao-paulo', city: 'São Paulo', country: 'Brezilya', lat: -23.5505, lng: -46.6333 },
  { id: 'toronto', city: 'Toronto', country: 'Kanada', lat: 43.6532, lng: -79.3832 },
  { id: 'cape-town', city: 'Cape Town', country: 'Güney Afrika', lat: -33.9249, lng: 18.4241 },
  { id: 'auckland', city: 'Auckland', country: 'Yeni Zelanda', lat: -36.8485, lng: 174.7633 },
];

// The Graph API often answers HTTP 500 ("reduce the amount of data") in very dense
// city centers, even for tiny boxes. So we also probe a few points ~3 km away.
const PROBE_OFFSETS: [number, number][] = [
  [0, 0],
  [0.03, 0],
  [-0.03, 0],
  [0, 0.04],
  [0, -0.04],
];
const BBOX_HALF = [0.005, 0.01];
const MIN_CAPTURED_AT = Date.UTC(2018, 0, 1);
const REQUEST_TIMEOUT_MS = 20_000;

function loadToken(): string {
  try {
    process.loadEnvFile(resolve('.env'));
  } catch {
    // fall through to env check
  }
  const token = process.env.VITE_MAPILLARY_TOKEN;
  if (!token) {
    console.error('VITE_MAPILLARY_TOKEN missing. Copy .env.example to .env and set it.');
    process.exit(1);
  }
  return token;
}

type QueryResult = { ok: true; data: ApiImage[] } | { ok: false };

async function queryPanos(token: string, bbox: string): Promise<QueryResult> {
  const url = new URL('https://graph.mapillary.com/images');
  url.searchParams.set('access_token', token);
  url.searchParams.set('fields', 'id,captured_at,computed_geometry,geometry');
  url.searchParams.set('is_pano', 'true');
  url.searchParams.set('bbox', bbox);
  url.searchParams.set('limit', '50');
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (res.ok) return { ok: true, data: ((await res.json()) as { data: ApiImage[] }).data };
    if (res.status !== 500) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  } catch (err) {
    if (!(err instanceof Error && err.name === 'TimeoutError')) throw err;
  }
  return { ok: false };
}

type FindResult =
  | { status: 'found'; count: number; location: Record<string, unknown> }
  | { status: 'empty' | 'api-error' };

async function findPano(token: string, c: City): Promise<FindResult> {
  let anyAnswer = false;
  for (const [dLat, dLng] of PROBE_OFFSETS) {
    const lat0 = c.lat + dLat;
    const lng0 = c.lng + dLng;
    for (const half of BBOX_HALF) {
      const bbox = [lng0 - half, lat0 - half, lng0 + half, lat0 + half].join(',');
      const result = await queryPanos(token, bbox);
      if (!result.ok) break; // a bigger box at this point would fail too
      anyAnswer = true;
      const candidates = result.data.filter(
        (img) => (img.computed_geometry ?? img.geometry) && (img.captured_at ?? 0) >= MIN_CAPTURED_AT,
      );
      if (candidates.length > 0) {
        const img = candidates[Math.floor(Math.random() * candidates.length)];
        const [lng, lat] = (img.computed_geometry ?? img.geometry)!.coordinates;
        const location = { id: c.id, imageId: img.id, lat, lng, city: c.city, country: c.country };
        return { status: 'found', count: candidates.length, location };
      }
    }
  }
  return { status: anyAnswer ? 'empty' : 'api-error' };
}

async function main() {
  const token = loadToken();
  const only = process.argv.slice(2);
  const cities = only.length ? CITIES.filter((c) => only.includes(c.id)) : CITIES;
  const results = await Promise.all(cities.map((c) => findPano(token, c)));

  const locations: Record<string, unknown>[] = [];
  cities.forEach((c, i) => {
    const r = results[i];
    if (r.status === 'found') {
      locations.push(r.location);
      console.log(`✓ ${c.city}: ${r.count} panos (picked ${r.location.imageId})`);
    } else if (r.status === 'empty') {
      console.warn(`✗ ${c.city}: 0 panos`);
    } else {
      console.warn(`✗ ${c.city}: API error (HTTP 500 / timeout at every probe)`);
    }
  });
  if (only.length) return; // dry probe, don't overwrite world.json

  const out = resolve('src/data/maps/world.json');
  writeFileSync(out, JSON.stringify(locations, null, 2) + '\n');
  console.log(`Wrote ${locations.length} locations to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
