/**
 * Turns a Nominatim reverse-geocoding address into the district name shown in the game
 * ("Kaleiçi, Edirne"). Kept free of I/O so it can be tested; curate.ts does the requests.
 */

/** Nominatim `address` object (only the fields we look at). */
export type NominatimAddress = Partial<
  Record<'neighbourhood' | 'quarter' | 'suburb' | 'city_district' | 'town' | 'county' | 'city' | 'village', string>
>;

/** town = ilçe (Kadıköy, Osmangazi); suburb = mahalle/semt (Karaağaç, Namazgah). */
export type DistrictLevel = 'town' | 'suburb';

const FIELDS: Record<DistrictLevel, (keyof NominatimAddress)[]> = {
  town: ['town', 'county', 'city_district'],
  suburb: ['suburb', 'quarter', 'neighbourhood', 'village'],
};

const clean = (name: string) =>
  name
    .replace(/\s+(Mahallesi|Mah\.?)$/i, '')
    .replace(/\s+Merkez$/i, '')
    .trim();

export function districtFromAddress(
  address: NominatimAddress | null | undefined,
  level: DistrictLevel,
  city: string,
): string | undefined {
  if (!address) return undefined;
  const other: DistrictLevel = level === 'town' ? 'suburb' : 'town';
  const lower = city.toLocaleLowerCase('tr');
  for (const field of [...FIELDS[level], ...FIELDS[other]]) {
    const value = address[field];
    if (!value) continue;
    const name = clean(value);
    // "Edirne Merkez", "Bursa": just the city again, not a district.
    if (!name || name.toLocaleLowerCase('tr').startsWith(lower)) continue;
    return name;
  }
  return undefined;
}
