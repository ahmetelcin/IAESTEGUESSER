import { describe, expect, it } from 'vitest';
import { tallyPhotographers } from './credits';

const loc = (imageId: string, creator?: string) => ({
  id: imageId,
  cityId: 'x',
  imageId,
  lat: 0,
  lng: 0,
  city: 'X',
  country: 'Y',
  creator,
});

describe('tallyPhotographers', () => {
  it('counts each image once per photographer, most images first', () => {
    const out = tallyPhotographers([[loc('1', 'ayse'), loc('2', 'bob')], [loc('3', 'ayse')]]);
    expect(out).toEqual([
      { name: 'ayse', images: 2 },
      { name: 'bob', images: 1 },
    ]);
  });

  it('does not double count an image used on two maps', () => {
    const out = tallyPhotographers([[loc('1', 'ayse')], [loc('1', 'ayse')]]);
    expect(out).toEqual([{ name: 'ayse', images: 1 }]);
  });

  it('sorts ties alphabetically (Turkish collation) and skips unknown creators', () => {
    const out = tallyPhotographers([[loc('1', 'zeynep'), loc('2', 'çağrı'), loc('3')]]);
    expect(out.map((p) => p.name)).toEqual(['çağrı', 'zeynep']);
  });
});
