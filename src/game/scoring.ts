export type MapId = 'world' | 'europe' | 'turkey';

export const MAX_SCORE = 5000;
export const FULL_SCORE_KM = 0.15;

export const SCALES: Record<MapId, number> = {
  world: 2000,
  europe: 800,
  turkey: 250,
};

export function scoreFor(km: number, mapId: MapId): number {
  if (km < FULL_SCORE_KM) return MAX_SCORE;
  return Math.round(MAX_SCORE * Math.exp(-km / SCALES[mapId]));
}

const kmFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const kmFormatDecimal = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  // One decimal below 10 km so city-map misses (1,2 km vs 1,8 km) stay distinguishable.
  if (km < 9.95) return `${kmFormatDecimal.format(km)} km`;
  return `${kmFormat.format(km)} km`;
}
