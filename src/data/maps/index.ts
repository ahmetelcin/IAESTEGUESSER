import type { MapId } from '../../game/scoring';
import europe from './europe.json';
import turkey from './turkey.json';
import world from './world.json';

export interface Location {
  id: string;
  /** Several images share a city; a game never repeats a city if it can avoid it. */
  cityId: string;
  imageId: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  /** Mapillary username; shown after the guess and on the credits page. */
  creator?: string;
}

export interface MapInfo {
  label: string;
  /** Where the guess map starts (and resets to each round). */
  center: [number, number];
  zoom: number;
}

/** Menu order. */
export const MAP_INFO: Record<MapId, MapInfo> = {
  world: { label: 'IAESTE Dünya', center: [25, 10], zoom: 1 },
  europe: { label: 'Avrupa', center: [52, 14], zoom: 3 },
  turkey: { label: 'Türkiye', center: [39, 35], zoom: 5 },
};

export const MAPS: Record<MapId, Location[]> = {
  world: world as Location[],
  europe: europe as Location[],
  turkey: turkey as Location[],
};

/** A map is playable once it has enough distinct cities for a full game. */
export function isPlayable(mapId: MapId, rounds: number): boolean {
  return new Set(MAPS[mapId].map((l) => l.cityId)).size >= rounds;
}
