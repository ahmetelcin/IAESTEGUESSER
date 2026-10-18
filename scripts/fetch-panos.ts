/**
 * Fetches one real 360° Mapillary panorama per city and writes src/data/maps/world.json.
 * Usage: npm run fetch-panos   (reads VITE_MAPILLARY_TOKEN from .env)
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
  { id: 'berlin', city: 'Berlin', country: 'Almanya', lat: 52.52, lng: 13.405 },
  { id: 'lisbon', city: 'Lizbon', country: 'Portekiz', lat: 38.7223, lng: -9.1393 },
  { id: 'warsaw', city: 'Varşova', country: 'Polonya', lat: 52.2297, lng: 21.0122 },
  { id: 'vienna', city: 'Viyana', country: 'Avusturya', lat: 48.2082, lng: 16.3738 },
  { id: 'tokyo', city: 'Tokyo', country: 'Japonya', lat: 35.6812, lng: 139.7671 },
  { id: 'sao-paulo', city: 'São Paulo', country: 'Brezilya', lat: -23.5505, lng: -46.6333 },
  { id: 'toronto', city: 'Toronto', country: 'Kanada', lat: 43.6532, lng: -79.3832 },
  { id: 'cape-town', city: 'Cape Town', country: 'Güney Afrika', lat: -33.9249, lng: 18.4241 },
  { id: 'auckland', city: 'Auckland', country: 'Yeni Zelanda', lat: -36.8485, lng: 174.7633 },
];

// Mapillary rejects large bboxes; grow the search box step by step (half-size in degrees).
const BBOX_STEPS = [0.01, 0.025, 0.05];
const MIN_CAPTURED_AT = Date.UTC(2018, 0, 1);

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

async function findPano(token: string, c: City) {
  for (const half of BBOX_STEPS) {
    const bbox = [c.lng - half, c.lat - half, c.lng + half, c.lat + half].join(',');
    const url = new URL('https://graph.mapillary.com/images');
    url.searchParams.set('access_token', token);
    url.searchParams.set('fields', 'id,captured_at,computed_geometry,geometry');
    url.searchParams.set('is_pano', 'true');
    url.searchParams.set('bbox', bbox);
    url.searchParams.set('limit', '50');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`${c.city}: HTTP ${res.status} ${await res.text()}`);
    const { data } = (await res.json()) as { data: ApiImage[] };

    const candidates = data.filter(
      (img) => (img.computed_geometry ?? img.geometry) && (img.captured_at ?? 0) >= MIN_CAPTURED_AT,
    );
    if (candidates.length > 0) {
      const img = candidates[Math.floor(Math.random() * candidates.length)];
      const [lng, lat] = (img.computed_geometry ?? img.geometry)!.coordinates;
      return { id: c.id, imageId: img.id, lat, lng, city: c.city, country: c.country };
    }
  }
  return null;
}

async function main() {
  const token = loadToken();
  const locations = [];
  for (const c of CITIES) {
    const loc = await findPano(token, c);
    if (loc) {
      locations.push(loc);
      console.log(`✓ ${c.city}: ${loc.imageId}`);
    } else {
      console.warn(`✗ ${c.city}: no panorama found`);
    }
  }
  const out = resolve('src/data/maps/world.json');
  writeFileSync(out, JSON.stringify(locations, null, 2) + '\n');
  console.log(`Wrote ${locations.length} locations to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
