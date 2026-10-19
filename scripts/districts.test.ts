import { describe, expect, it } from 'vitest';
import { districtFromAddress } from './districts';

describe('districtFromAddress', () => {
  const istanbul = { suburb: 'Site Mahallesi', town: 'Ümraniye', province: 'İstanbul' };
  const edirne = { suburb: 'Koca Sinan Mahallesi', city: 'Edirne Merkez', province: 'Edirne' };
  const bursa = { suburb: 'Namazgah', city_district: 'Namazgah Mahallesi', town: 'Yıldırım', province: 'Bursa' };

  it('takes the ilçe at town level', () => {
    expect(districtFromAddress(istanbul, 'town', 'İstanbul')).toBe('Ümraniye');
  });

  it('takes the mahalle at suburb level, without the "Mahallesi" suffix', () => {
    expect(districtFromAddress(edirne, 'suburb', 'Edirne')).toBe('Koca Sinan');
    expect(districtFromAddress(bursa, 'suburb', 'Bursa')).toBe('Namazgah');
  });

  it('drops a trailing "Merkez" ("Yenibosna Merkez Mahallesi" → "Yenibosna")', () => {
    expect(districtFromAddress({ suburb: 'Yenibosna Merkez Mahallesi' }, 'town', 'İstanbul')).toBe('Yenibosna');
  });

  it('falls back to the other level when the preferred one is missing', () => {
    expect(districtFromAddress({ town: 'Silivri' }, 'suburb', 'İstanbul')).toBe('Silivri');
    expect(districtFromAddress({ suburb: 'Karaağaç Mahallesi' }, 'town', 'Edirne')).toBe('Karaağaç');
  });

  it('skips names that only repeat the city ("Edirne Merkez")', () => {
    expect(districtFromAddress({ city: 'Edirne Merkez' }, 'town', 'Edirne')).toBeUndefined();
    expect(districtFromAddress({ town: 'Bursa' }, 'town', 'Bursa')).toBeUndefined();
  });

  it('returns undefined for an empty or missing address', () => {
    expect(districtFromAddress(undefined, 'town', 'Bursa')).toBeUndefined();
    expect(districtFromAddress({}, 'suburb', 'Bursa')).toBeUndefined();
  });
});
