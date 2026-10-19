/**
 * City lists for `npm run curate`. Coordinates are city centers; the script searches
 * a few km around them. Countries should be IAESTE members — check against the current
 * member list before the stand.
 *
 * Mapillary has little 360° coverage in much of Türkiye (Ankara, Antalya, Konya, … had none
 * in Oct 2026), so the Türkiye list only holds cities where panoramas were found.
 */
import type { DistrictLevel } from './districts';

export interface City {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

const c = (id: string, city: string, country: string, lat: number, lng: number): City => ({
  id,
  city,
  country,
  lat,
  lng,
});

// ── Europe ──────────────────────────────────────────────────────────────
const EUROPE: City[] = [
  c('berlin', 'Berlin', 'Almanya', 52.52, 13.405),
  c('munich', 'Münih', 'Almanya', 48.1374, 11.5755),
  c('vienna', 'Viyana', 'Avusturya', 48.2082, 16.3738),
  c('zurich', 'Zürih', 'İsviçre', 47.3769, 8.5417),
  c('paris', 'Paris', 'Fransa', 48.8566, 2.3522),
  c('lyon', 'Lyon', 'Fransa', 45.764, 4.8357),
  c('madrid', 'Madrid', 'İspanya', 40.4168, -3.7038),
  c('barcelona', 'Barselona', 'İspanya', 41.3874, 2.1686),
  c('lisbon', 'Lizbon', 'Portekiz', 38.7223, -9.1393),
  c('porto', 'Porto', 'Portekiz', 41.1579, -8.6291),
  c('london', 'Londra', 'Birleşik Krallık', 51.5074, -0.1278),
  c('dublin', 'Dublin', 'İrlanda', 53.3498, -6.2603),
  c('amsterdam', 'Amsterdam', 'Hollanda', 52.3676, 4.9041),
  c('brussels', 'Brüksel', 'Belçika', 50.8503, 4.3517),
  c('luxembourg', 'Lüksemburg', 'Lüksemburg', 49.6116, 6.1319),
  c('copenhagen', 'Kopenhag', 'Danimarka', 55.6761, 12.5683),
  c('oslo', 'Oslo', 'Norveç', 59.9139, 10.7522),
  c('stockholm', 'Stockholm', 'İsveç', 59.3293, 18.0686),
  c('helsinki', 'Helsinki', 'Finlandiya', 60.1699, 24.9384),
  c('tallinn', 'Tallinn', 'Estonya', 59.437, 24.7536),
  c('riga', 'Riga', 'Letonya', 56.9496, 24.1052),
  c('vilnius', 'Vilnius', 'Litvanya', 54.6872, 25.2797),
  c('warsaw', 'Varşova', 'Polonya', 52.2297, 21.0122),
  c('krakow', 'Krakov', 'Polonya', 50.0647, 19.945),
  c('prague', 'Prag', 'Çekya', 50.0755, 14.4378),
  c('bratislava', 'Bratislava', 'Slovakya', 48.1486, 17.1077),
  c('budapest', 'Budapeşte', 'Macaristan', 47.4979, 19.0402),
  c('ljubljana', 'Ljubljana', 'Slovenya', 46.0569, 14.5058),
  c('zagreb', 'Zagreb', 'Hırvatistan', 45.815, 15.9819),
  c('belgrade', 'Belgrad', 'Sırbistan', 44.7866, 20.4489),
  c('sarajevo', 'Saraybosna', 'Bosna-Hersek', 43.8563, 18.4131),
  c('bucharest', 'Bükreş', 'Romanya', 44.4268, 26.1025),
  c('athens', 'Atina', 'Yunanistan', 37.9838, 23.7275),
  c('valletta', 'Valletta', 'Malta', 35.8989, 14.5146),
  c('kyiv', 'Kiev', 'Ukrayna', 50.4501, 30.5234),
];

// ── Rest of the world ───────────────────────────────────────────────────
const WORLD_EXTRA: City[] = [
  c('istanbul', 'İstanbul', 'Türkiye', 41.0082, 28.9784),
  c('tokyo', 'Tokyo', 'Japonya', 35.6812, 139.7671),
  c('seoul', 'Seul', 'Güney Kore', 37.5665, 126.978),
  c('macau', 'Makao', 'Makao', 22.1987, 113.5439),
  c('mumbai', 'Mumbai', 'Hindistan', 19.076, 72.8777),
  c('dubai', 'Dubai', 'BAE', 25.2048, 55.2708),
  c('doha', 'Doha', 'Katar', 25.2854, 51.531),
  c('amman', 'Amman', 'Ürdün', 31.9539, 35.9106),
  c('beirut', 'Beyrut', 'Lübnan', 33.8938, 35.5018),
  c('nairobi', 'Nairobi', 'Kenya', -1.2921, 36.8219),
  c('mexico-city', 'Meksiko', 'Meksika', 19.4326, -99.1332),
  c('panama-city', 'Panama', 'Panama', 8.9824, -79.5199),
  c('bogota', 'Bogota', 'Kolombiya', 4.711, -74.0721),
  c('quito', 'Quito', 'Ekvador', -0.1807, -78.4678),
  c('lima', 'Lima', 'Peru', -12.0464, -77.0428),
  c('buenos-aires', 'Buenos Aires', 'Arjantin', -34.6037, -58.3816),
  c('sao-paulo', 'São Paulo', 'Brezilya', -23.5505, -46.6333),
  c('rio', 'Rio de Janeiro', 'Brezilya', -22.9068, -43.1729),
  c('toronto', 'Toronto', 'Kanada', 43.6532, -79.3832),
  c('montreal', 'Montreal', 'Kanada', 45.5017, -73.5673),
  c('new-york', 'New York', 'ABD', 40.7128, -74.006),
  c('chicago', 'Chicago', 'ABD', 41.8781, -87.6298),
  c('san-francisco', 'San Francisco', 'ABD', 37.7749, -122.4194),
];

// ── Türkiye ─────────────────────────────────────────────────────────────
const TURKEY: City[] = [
  c('istanbul', 'İstanbul', 'Türkiye', 41.0082, 28.9784),
  c('ankara', 'Ankara', 'Türkiye', 39.9334, 32.8597),
  c('antalya', 'Antalya', 'Türkiye', 36.8969, 30.7133),
  c('izmir', 'İzmir', 'Türkiye', 38.4237, 27.1428),
  c('bursa', 'Bursa', 'Türkiye', 40.1955, 29.03),
  c('mersin', 'Mersin', 'Türkiye', 36.8121, 34.6415),
  c('edirne', 'Edirne', 'Türkiye', 41.6771, 26.5557),
  c('denizli', 'Denizli', 'Türkiye', 37.7765, 29.0864),
  c('izmit', 'İzmit', 'Türkiye', 40.7654, 29.9408),
  c('sakarya', 'Sakarya', 'Türkiye', 40.7569, 30.3783),
  c('fethiye', 'Fethiye', 'Türkiye', 36.6214, 29.1164),
  c('marmaris', 'Marmaris', 'Türkiye', 36.855, 28.2742),
  c('tekirdag', 'Tekirdağ', 'Türkiye', 40.978, 27.5115),
  c('yalova', 'Yalova', 'Türkiye', 40.655, 29.2769),
  c('manisa', 'Manisa', 'Türkiye', 38.6191, 27.4289),
  c('malatya', 'Malatya', 'Türkiye', 38.3552, 38.3095),
  c('sivas', 'Sivas', 'Türkiye', 39.7477, 37.0179),
  c('ordu', 'Ordu', 'Türkiye', 40.9839, 37.8764),
  c('karabuk', 'Karabük', 'Türkiye', 41.2061, 32.6204),
  // Regular photos only in most of these (no 360° coverage in Oct 2026).
  c('eskisehir', 'Eskişehir', 'Türkiye', 39.7767, 30.5206),
  c('konya', 'Konya', 'Türkiye', 37.8746, 32.4932),
  c('kayseri', 'Kayseri', 'Türkiye', 38.7205, 35.4826),
  c('gaziantep', 'Gaziantep', 'Türkiye', 37.0662, 37.3833),
  c('adana', 'Adana', 'Türkiye', 37.0, 35.3213),
  c('trabzon', 'Trabzon', 'Türkiye', 41.0015, 39.7178),
  c('samsun', 'Samsun', 'Türkiye', 41.2867, 36.33),
  c('diyarbakir', 'Diyarbakır', 'Türkiye', 37.9144, 40.2306),
  c('erzurum', 'Erzurum', 'Türkiye', 39.9055, 41.2658),
  c('canakkale', 'Çanakkale', 'Türkiye', 40.1553, 26.4142),
  c('van', 'Van', 'Türkiye', 38.5012, 43.373),
  c('sanliurfa', 'Şanlıurfa', 'Türkiye', 37.1591, 38.7969),
  c('mardin', 'Mardin', 'Türkiye', 37.3212, 40.7245),
  c('antakya', 'Antakya', 'Türkiye', 36.2021, 36.1603),
  c('aydin', 'Aydın', 'Türkiye', 37.856, 27.8416),
  c('balikesir', 'Balıkesir', 'Türkiye', 39.6484, 27.8826),
  c('kutahya', 'Kütahya', 'Türkiye', 39.4242, 29.9833),
  c('afyon', 'Afyonkarahisar', 'Türkiye', 38.7507, 30.5567),
  c('isparta', 'Isparta', 'Türkiye', 37.7648, 30.5566),
  c('bolu', 'Bolu', 'Türkiye', 40.7395, 31.6116),
  c('rize', 'Rize', 'Türkiye', 41.0201, 40.5234),
  c('nevsehir', 'Nevşehir', 'Türkiye', 38.6244, 34.7239),
  c('bodrum', 'Bodrum', 'Türkiye', 37.0344, 27.4305),
  c('alanya', 'Alanya', 'Türkiye', 36.5438, 31.9998),
];

export const CITY_LISTS = {
  world: [...EUROPE, ...WORLD_EXTRA],
  europe: EUROPE,
  turkey: TURKEY,
} satisfies Record<string, City[]>;

/**
 * Cities that get many spots spread across town instead of a few around the center.
 * In the Türkiye map each is still one city (asked at most once per game); the game's
 * city maps (İstanbul, Edirne, Bursa) are built from these same spots. Keyed by city id.
 */
export interface CitySpots {
  /** Half-size of the scanned square, degrees. */
  radius: number;
  /** Grid cell size, degrees (default 0.01; bigger for big cities to bound requests). */
  cell?: number;
  count: number;
  spacingM: number;
  /** District shown after the guess: ilçe (town) or mahalle (suburb). See scripts/districts.ts. */
  districtLevel: DistrictLevel;
}

export const CITY_SPOTS: Record<string, CitySpots> = {
  // Edirne is one ilçe (Merkez), and Bursa's 30 spots share three ilçeler: use mahalleler.
  edirne: { radius: 0.04, count: 20, spacingM: 300, districtLevel: 'suburb' },
  bursa: { radius: 0.07, count: 30, spacingM: 500, districtLevel: 'suburb' },
  istanbul: { radius: 0.18, cell: 0.03, count: 40, spacingM: 1000, districtLevel: 'town' },
};

/**
 * Maps that also accept regular (non-360°) photos. 360° coverage in Türkiye is thin, so
 * these maps take flat images too, preferring panoramas when a place has both.
 * World and Europe stay panorama-only.
 */
export const FLAT_ALLOWED: ReadonlySet<string> = new Set(['turkey']);
