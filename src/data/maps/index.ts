import type { MapId } from '../../game/scoring';
import bursa from './bursa.json';
import edirne from './edirne.json';
import europe from './europe.json';
import turkey from './turkey.json';
import world from './world.json';

export interface Location {
  id: string;
  /**
   * Several panoramas share a city; a game never repeats a city if it can avoid it.
   * On city maps every spot is its own "city" so rounds spread across town.
   */
  cityId: string;
  imageId: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
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
  edirne: { label: 'Edirne', center: [41.6771, 26.5557], zoom: 12 },
  bursa: { label: 'Bursa', center: [40.1955, 29.03], zoom: 11 },
};

export const MAPS: Record<MapId, Location[]> = {
  world: world as Location[],
  europe: europe as Location[],
  turkey: turkey as Location[],
  edirne: edirne as Location[],
  bursa: bursa as Location[],
};

/** A map is playable once it has enough distinct cities (or spots) for a full game. */
export function isPlayable(mapId: MapId, rounds: number): boolean {
  return new Set(MAPS[mapId].map((l) => l.cityId)).size >= rounds;
}
