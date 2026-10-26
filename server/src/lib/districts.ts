/**
 * Košice city districts with approximate centre points (WGS84).
 * Items only store the district – never an address – so every distance is approximate by design.
 */
export const KOSICE_CENTER = { lat: 48.7206, lng: 21.2581 }; // Hlavná ulica (Dóm sv. Alžbety)

export const KOSICE_DISTRICTS = {
  'Staré Mesto': [48.722, 21.258],
  Sever: [48.739, 21.249],
  Západ: [48.716, 21.231],
  'Sídlisko KVP': [48.711, 21.208],
  Juh: [48.703, 21.256],
  Džungľa: [48.7135, 21.277],
  'Dargovských hrdinov': [48.733, 21.293],
  'Košická Nová Ves': [48.718, 21.298],
  'Sídlisko Ťahanovce': [48.745, 21.276],
  Ťahanovce: [48.763, 21.284],
  'Nad jazerom': [48.685, 21.297],
  'Vyšné Opátske': [48.697, 21.284],
  Barca: [48.6815, 21.264],
  Krásna: [48.668, 21.325],
  'Luník IX': [48.6995, 21.2235],
  Myslava: [48.7155, 21.186],
  Pereš: [48.683, 21.196],
  Lorinčík: [48.672, 21.17],
  Poľov: [48.659, 21.149],
  Šaca: [48.63, 21.177],
  Šebastovce: [48.648, 21.278],
  Kavečany: [48.78, 21.205],
} as const satisfies Record<string, readonly [number, number]>;

export type District = keyof typeof KOSICE_DISTRICTS;
export const DISTRICT_NAMES = Object.keys(KOSICE_DISTRICTS) as [District, ...District[]];

const isDistrict = (v: string): v is District => Object.hasOwn(KOSICE_DISTRICTS, v);

/** Straight-line distance from the Košice centre in km (1 decimal), or null for unknown/no district. */
export const distanceFromCenterKm = (district: string | null | undefined): number | null => {
  if (!district || !isDistrict(district)) return null;
  const [lat, lng] = KOSICE_DISTRICTS[district];
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat - KOSICE_CENTER.lat);
  const dLng = rad(lng - KOSICE_CENTER.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(KOSICE_CENTER.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
};
