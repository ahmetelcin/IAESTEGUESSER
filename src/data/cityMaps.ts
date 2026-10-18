import type { Location } from './maps';

/**
 * A city map is that city's spots from the Türkiye data. Each spot becomes its own "city"
 * so a game's rounds land in different parts of town instead of being treated as repeats.
 */
export function deriveCityMap(turkey: readonly Location[], cityId: string): Location[] {
  return turkey.filter((l) => l.cityId === cityId).map((l) => ({ ...l, cityId: l.id }));
}
