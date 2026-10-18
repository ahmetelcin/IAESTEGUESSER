import type { Location } from './maps';

export interface Photographer {
  name: string;
  images: number;
}

/** Everyone whose images appear in the game, most images first (an image used on two maps counts once). */
export function tallyPhotographers(maps: readonly Location[][]): Photographer[] {
  const byImage = new Map<string, string>();
  for (const list of maps) for (const l of list) if (l.creator) byImage.set(l.imageId, l.creator);
  const counts = new Map<string, number>();
  for (const name of byImage.values()) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, images]) => ({ name, images }))
    .sort((a, b) => b.images - a.images || a.name.localeCompare(b.name, 'tr'));
}
