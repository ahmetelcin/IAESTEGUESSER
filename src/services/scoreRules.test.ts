import { describe, expect, it } from 'vitest';
import { cleanName, parseBoardQuery, validateSubmission } from './scoreRules';

const now = new Date('2026-10-19T12:00:00Z');
const valid = {
  id: 'abc12345-0000',
  name: '  Ayşe   Y. ',
  score: 18_250,
  mapId: 'turkey',
  mode: 'nmpz',
  rounds: 5,
  day: '2026-10-19',
  ts: now.getTime(),
};
const check = (changes: Record<string, unknown>) => validateSubmission({ ...valid, ...changes }, now);

describe('validateSubmission', () => {
  it('accepts a normal game and tidies the name', () => {
    const r = validateSubmission(valid, now);
    expect(r.ok && r.value.name).toBe('Ayşe Y.');
  });

  it('keeps scores within 0–25 000 and the game length', () => {
    expect(check({ score: 25_000 }).ok).toBe(true);
    expect(check({ score: 25_001 }).ok).toBe(false);
    expect(check({ score: -1 }).ok).toBe(false);
    expect(check({ score: 12.5 }).ok).toBe(false);
    expect(check({ rounds: 2, score: 10_001 }).ok).toBe(false);
    expect(check({ rounds: 10, score: 25_000 }).ok).toBe(true);
  });

  it('rejects empty or too long names', () => {
    expect(check({ name: '   ' }).ok).toBe(false);
    expect(check({ name: 'x'.repeat(17) }).ok).toBe(false);
    expect(check({ name: 42 }).ok).toBe(false);
  });

  it('rejects unknown maps, modes and odd round counts', () => {
    expect(check({ mapId: 'mars' }).ok).toBe(false);
    expect(check({ mode: 'fast' }).ok).toBe(false);
    expect(check({ rounds: 0 }).ok).toBe(false);
    expect(check({ rounds: 11 }).ok).toBe(false);
  });

  it('needs a sane id', () => {
    expect(check({ id: 'short' }).ok).toBe(false);
    expect(check({ id: 'has spaces in it' }).ok).toBe(false);
  });

  it('accepts days a little ahead (time zones) or late (offline queue), nothing further', () => {
    expect(check({ day: '2026-10-20' }).ok).toBe(true);
    expect(check({ day: '2026-10-12' }).ok).toBe(true);
    expect(check({ day: '2026-10-11' }).ok).toBe(false);
    expect(check({ day: '2026-10-21' }).ok).toBe(false);
    expect(check({ day: '19.10.2026' }).ok).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(validateSubmission(null, now).ok).toBe(false);
    expect(validateSubmission('x', now).ok).toBe(false);
  });
});

describe('parseBoardQuery', () => {
  const q = (s: string) => parseBoardQuery(new URLSearchParams(s));

  it('builds a filter for one map and mode, today', () => {
    expect(q('mapId=world&mode=nmpz&period=today&day=2026-10-19&limit=5')).toEqual({
      ok: true,
      filter: { rounds: 5, mapId: 'world', mode: 'nmpz', day: '2026-10-19' },
      limit: 5,
    });
  });

  it('drops the map and/or mode condition for "all"', () => {
    expect(q('mapId=all&mode=all&period=all')).toEqual({ ok: true, filter: { rounds: 5 }, limit: 10 });
    expect(q('mapId=all&mode=moving&period=all')).toMatchObject({ filter: { rounds: 5, mode: 'moving' } });
  });

  it('caps the limit and rejects bad input', () => {
    expect(q('mapId=all&mode=all&period=all&limit=500')).toMatchObject({ limit: 20 });
    expect(q('mapId=mars&mode=all&period=all').ok).toBe(false);
    expect(q('mapId=all&mode=fast&period=all').ok).toBe(false);
    expect(q('mapId=all&mode=all&period=week').ok).toBe(false);
    expect(q('mapId=all&mode=all&period=today').ok).toBe(false); // today needs a day
  });
});

describe('cleanName', () => {
  it('strips control characters and collapses spaces', () => {
    expect(cleanName('a\u0000b \t  c\n')).toBe('ab c');
  });
});
