import { distanceKm, type Place } from './location.js';
import { PLACES } from './places-data.js';

export { PLACES, PLACES_GENERATED_ON } from './places-data.js';

const byId = new Map(PLACES.map((place) => [place.id, place]));

export function placeById(id: string): Place | undefined {
  return byId.get(id);
}

function normalise(text: string): string {
  return text.normalize('NFKD').replaceAll(/\p{M}/gu, '').toLowerCase();
}

/** Case- and accent-insensitive prefix-then-substring search, largest places first. */
export function searchPlaces(query: string, countryCode: string, limit = 20): Place[] {
  const q = normalise(query.trim());
  const inCountry = PLACES.filter((p) => p.countryCode === countryCode);
  if (!q) return inCountry.slice(0, limit);
  const prefix = inCountry.filter((p) => normalise(p.name).startsWith(q));
  const contains = inCountry.filter(
    (p) => !normalise(p.name).startsWith(q) && normalise(p.name).includes(q),
  );
  return [...prefix, ...contains].slice(0, limit);
}

/** The nearest listed place within `maxKm`, used only to label an approximate device location. */
export function nearestPlace(
  point: { latitude: number; longitude: number },
  maxKm = 30,
): Place | undefined {
  let best: Place | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const place of PLACES) {
    const d = distanceKm(point, place);
    if (d < bestDistance) {
      best = place;
      bestDistance = d;
    }
  }
  return bestDistance <= maxKm ? best : undefined;
}
