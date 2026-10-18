export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Wraps a longitude into [-180, 180). */
export function normalizeLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Returns `to` with its longitude shifted by ±360° so that a straight line
 * from `from` on a Mercator map takes the short way (crossing the antimeridian if needed).
 */
export function shortestPathTarget(from: LatLng, to: LatLng): LatLng {
  let lng = to.lng;
  while (lng - from.lng > 180) lng -= 360;
  while (lng - from.lng < -180) lng += 360;
  return lng === to.lng ? to : { lat: to.lat, lng };
}

/**
 * Shifts longitudes by multiples of 360° so they span the narrowest possible window,
 * i.e. the window skips the widest empty gap on the globe (often the Pacific).
 * Keeps the input order; used to fit several points on one Mercator map.
 */
export function fitLongitudes(lngs: number[]): number[] {
  if (lngs.length < 2) return [...lngs];
  const norm = lngs.map(normalizeLng);
  const sorted = [...norm].sort((a, b) => a - b);
  // Gap after sorted[i]; the last one wraps around to sorted[0] + 360.
  let widest = sorted.length - 1;
  let widestGap = sorted[0] + 360 - sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1] - sorted[i];
    if (gap > widestGap) {
      widestGap = gap;
      widest = i;
    }
  }
  const start = sorted[(widest + 1) % sorted.length];
  return norm.map((l) => (l < start ? l + 360 : l));
}
