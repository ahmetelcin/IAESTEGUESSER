import { describe, expect, it } from 'vitest';
import { MAX_SCORE, formatDistance, scoreFor } from './scoring';

describe('scoreFor', () => {
  it('gives full score under 150 m', () => {
    expect(scoreFor(0, 'world')).toBe(MAX_SCORE);
    expect(scoreFor(0.149, 'world')).toBe(MAX_SCORE);
    expect(scoreFor(0.149, 'turkey')).toBe(MAX_SCORE);
  });

  it('drops below full score just past 150 m', () => {
    expect(scoreFor(0.151, 'turkey')).toBeLessThan(MAX_SCORE);
  });

  it('follows 5000 * exp(-km / scale)', () => {
    expect(scoreFor(2000, 'world')).toBe(Math.round(5000 / Math.E));
    expect(scoreFor(800, 'europe')).toBe(Math.round(5000 / Math.E));
    expect(scoreFor(250, 'turkey')).toBe(Math.round(5000 / Math.E));
  });

  it('is stricter on smaller maps', () => {
    const km = 300;
    expect(scoreFor(km, 'world')).toBeGreaterThan(scoreFor(km, 'europe'));
    expect(scoreFor(km, 'europe')).toBeGreaterThan(scoreFor(km, 'turkey'));
  });

  it('never increases with distance', () => {
    let prev = MAX_SCORE;
    for (let km = 0; km <= 20000; km += 250) {
      const s = scoreFor(km, 'world');
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });

  it('stays within 0..5000 integers', () => {
    const s = scoreFor(20037, 'turkey');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(s)).toBe(true);
  });
});

describe('formatDistance', () => {
  it('uses meters under 1 km', () => {
    expect(formatDistance(0.0424)).toBe('42 m');
    expect(formatDistance(0.999)).toBe('999 m');
  });

  it('uses km with Turkish thousands separator', () => {
    expect(formatDistance(12.4)).toBe('12 km');
    expect(formatDistance(1234.6)).toBe('1.235 km');
  });
});
