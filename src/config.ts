export const MAPILLARY_TOKEN: string = import.meta.env.VITE_MAPILLARY_TOKEN ?? '';

// Esri World Street Map — keyless. (CARTO basemaps now require an API key.)
export const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, USGS, <a href="https://www.openstreetmap.org/copyright">OSM</a>';

/** How many times to retry with another location when a panorama fails to load. */
export const MAX_LOAD_ATTEMPTS = 3;

export const ROUNDS_PER_GAME = 5;
/** Seconds per round. Becomes adjustable in the admin panel (phase 4). */
export const ROUND_SECONDS = 60;
