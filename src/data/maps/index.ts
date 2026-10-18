import type { MapId } from '../../game/scoring';
import world from './world.json';

export interface Location {
  id: string;
  imageId: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
}

export const MAPS: Record<MapId, Location[]> = {
  world: world as Location[],
  europe: [],
  turkey: [],
};
