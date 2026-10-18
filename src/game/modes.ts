export type Mode = 'moving' | 'no-move' | 'nmpz';

export interface ModeRules {
  /** Walk to other images (arrows, keyboard). */
  move: boolean;
  /** Look around by dragging. */
  pan: boolean;
  zoom: boolean;
}

export const MODE_RULES: Record<Mode, ModeRules> = {
  moving: { move: true, pan: true, zoom: true },
  'no-move': { move: false, pan: true, zoom: true },
  nmpz: { move: false, pan: false, zoom: false },
};

export const MODE_LABELS: Record<Mode, string> = {
  moving: 'Hareketli',
  'no-move': 'Hareketsiz',
  nmpz: 'NMPZ',
};
