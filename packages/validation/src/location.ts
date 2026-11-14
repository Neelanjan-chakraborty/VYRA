import { z } from 'zod';

/** A place people can choose manually. Coordinates are the place's centre. */
export interface Place {
  readonly id: string;
  readonly name: string;
  readonly region: string | null;
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly population: number;
}

/**
 * Coordinates are stored on a 0.02° grid (about 2 km), the coarsest precision
 * that keeps a 10 km radius meaningful. Exact positions are never stored.
 */
export const LOCATION_GRID_DEGREES = 0.02;

export function roundToGrid(value: number): number {
  return Math.round(Math.round(value / LOCATION_GRID_DEGREES) * LOCATION_GRID_DEGREES * 100) / 100;
}

/** Radii people can choose. null = no distance limit. */
export const DISTANCE_OPTIONS_KM = [10, 25, 50, 100] as const;

/**
 * How a distance is shown: bands, never an exact figure. Shared by the API
 * (which computes it) and the app (which displays it).
 */
export function distanceLabel(km: number): string {
  if (km < 5) return 'Under 5 km away';
  if (km >= 100) return '100+ km away';
  return `About ${Math.round(km / 5) * 5} km away`;
}

/**
 * - `active`: the viewer has a location and a radius; both people with a
 *   location are compared.
 * - `no_location`: the viewer chose a radius but has no location, so no
 *   distance filter is applied.
 * - `off`: the viewer has no radius.
 */
export const distanceFilterStatusSchema = z.enum(['active', 'no_location', 'off']);
export type DistanceFilterStatus = z.infer<typeof distanceFilterStatusSchema>;

export const locationSourceSchema = z.enum(['DEVICE_APPROXIMATE', 'MANUAL']);
export type LocationSource = z.infer<typeof locationSourceSchema>;

const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);

export const locationUpdateSchema = z.discriminatedUnion('source', [
  z.object({
    /** From the device's approximate location. Rounded by the server before storage. */
    source: z.literal('device'),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  }),
  z.object({
    source: z.literal('manual'),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    /** A place from GET /v1/places. Gives the only coordinates a manual choice can have. */
    placeId: z.string().max(40).optional(),
    /** Free-text city when it isn't in the list. Stored as a label only — no distance. */
    city: z.string().trim().min(1).max(80).optional(),
    area: z.string().trim().min(1).max(80).optional(),
  }),
]);
export type LocationUpdate = z.infer<typeof locationUpdateSchema>;

/** What the owner sees about their own location. Coordinates are never returned. */
export const locationViewSchema = z.object({
  source: locationSourceSchema,
  city: z.string().nullable(),
  region: z.string().nullable(),
  area: z.string().nullable(),
  countryCode: z.string().nullable(),
  /** True when VYRA can use distance for this person. */
  distanceAvailable: z.boolean(),
});
export type LocationView = z.infer<typeof locationViewSchema>;

export const placeViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string().nullable(),
  countryCode: z.string(),
});
export const placeListSchema = z.object({ places: z.array(placeViewSchema) });
export type PlaceView = z.infer<typeof placeViewSchema>;

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function distanceKm(
  a: { readonly latitude: number; readonly longitude: number },
  b: { readonly latitude: number; readonly longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
