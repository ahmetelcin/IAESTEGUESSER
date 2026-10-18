export const MAPILLARY_TOKEN: string = import.meta.env.VITE_MAPILLARY_TOKEN ?? '';

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** How many times to retry with another location when a panorama fails to load. */
export const MAX_LOAD_ATTEMPTS = 3;
