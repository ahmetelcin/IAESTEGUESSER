export const MAPILLARY_TOKEN: string = import.meta.env.VITE_MAPILLARY_TOKEN ?? '';

// Esri World Street Map — keyless. (CARTO basemaps now require an API key.)
export const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
export const TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, USGS, OpenStreetMap katkıcıları';

/** How many times to retry with another location when a panorama fails to load. */
export const MAX_LOAD_ATTEMPTS = 3;
