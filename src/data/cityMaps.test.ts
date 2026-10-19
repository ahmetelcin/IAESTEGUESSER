import { describe, expect, it } from 'vitest';
import { deriveCityMap, placeName } from './cityMaps';

describe('placeName', () => {
  it('shows the district with the city when there is one', () => {
    expect(placeName({ city: 'Edirne', country: 'Türkiye', district: 'Kaleiçi' })).toBe('Kaleiçi, Edirne');
  });

  it('falls back to city and country', () => {
    expect(placeName({ city: 'Edirne', country: 'Türkiye' })).toBe('Edirne, Türkiye');
  });
});

const loc = (id: string, cityId: string) => ({ id, cityId, imageId: `img-${id}`, lat: 0, lng: 0, city: cityId, country: 'Türkiye' });

describe('deriveCityMap', () => {
  const turkey = [loc('edirne-01', 'edirne'), loc('edirne-02', 'edirne'), loc('bursa-01', 'bursa')];

  it('keeps only that city’s spots', () => {
    expect(deriveCityMap(turkey, 'edirne').map((l) => l.id)).toEqual(['edirne-01', 'edirne-02']);
  });

  it('makes every spot its own "city" so one game visits different parts of town', () => {
    expect(deriveCityMap(turkey, 'edirne').map((l) => l.cityId)).toEqual(['edirne-01', 'edirne-02']);
  });

  it('does not modify the source list', () => {
    deriveCityMap(turkey, 'edirne');
    expect(turkey[0].cityId).toBe('edirne');
  });
});
