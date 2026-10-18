import { describe, expect, it } from 'vitest';
import { MODE_RULES } from './modes';

describe('mode rules', () => {
  it('moving allows everything', () => {
    expect(MODE_RULES.moving).toEqual({ move: true, pan: true, zoom: true });
  });

  it('no-move only forbids moving', () => {
    expect(MODE_RULES['no-move']).toEqual({ move: false, pan: true, zoom: true });
  });

  it('NMPZ forbids moving, panning and zooming', () => {
    expect(MODE_RULES.nmpz).toEqual({ move: false, pan: false, zoom: false });
  });
});
