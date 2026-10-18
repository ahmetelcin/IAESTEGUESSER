import { describe, expect, it } from 'vitest';
import { haversineKm, normalizeLng, shortestPathTarget } from './geo';

const ISTANBUL = { lat: 41.0082, lng: 28.9784 };
const ANKARA = { lat: 39.9334, lng: 32.8597 };
const PARIS = { lat: 48.8566, lng: 2.3522 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const FIJI = { lat: -17.7134, lng: 178.065 };
const SAMOA = { lat: -13.759, lng: -172.1046 };

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(PARIS, PARIS)).toBe(0);
  });

  it('matches known city distances within 1%', () => {
    expect(haversineKm(ISTANBUL, ANKARA)).toBeCloseTo(350, -1);
    expect(Math.abs(haversineKm(PARIS, LONDON) - 344) / 344).toBeLessThan(0.01);
  });

  it('is symmetric', () => {
    expect(haversineKm(PARIS, LONDON)).toBeCloseTo(haversineKm(LONDON, PARIS), 9);
  });

  it('takes the short way across the antimeridian', () => {
    // Fiji–Samoa is ~1150 km, not ~38000 km around the other side.
    const km = haversineKm(FIJI, SAMOA);
    expect(km).toBeGreaterThan(1000);
    expect(km).toBeLessThan(1300);
  });
});

describe('normalizeLng', () => {
  it('wraps longitudes into [-180, 180)', () => {
    expect(normalizeLng(190)).toBeCloseTo(-170);
    expect(normalizeLng(-190)).toBeCloseTo(170);
    expect(normalizeLng(540)).toBeCloseTo(-180);
    expect(normalizeLng(45)).toBe(45);
  });
});

describe('shortestPathTarget', () => {
  it('leaves nearby points unchanged', () => {
    expect(shortestPathTarget(PARIS, LONDON)).toEqual(LONDON);
  });

  it('shifts the target by 360° so the line crosses the antimeridian', () => {
    const target = shortestPathTarget(FIJI, SAMOA);
    expect(target.lat).toBe(SAMOA.lat);
    expect(target.lng).toBeCloseTo(SAMOA.lng + 360);
    expect(Math.abs(target.lng - FIJI.lng)).toBeLessThanOrEqual(180);
  });

  it('works in the other direction too', () => {
    const target = shortestPathTarget(SAMOA, FIJI);
    expect(target.lng).toBeCloseTo(FIJI.lng - 360);
    expect(Math.abs(target.lng - SAMOA.lng)).toBeLessThanOrEqual(180);
  });
});
