import { describe, expect, it } from 'vitest';
import { distanceKm, distanceLabel, locationUpdateSchema, roundToGrid } from './location.js';
import { nearestPlace, PLACES, placeById, searchPlaces } from './places.js';

describe('location precision', () => {
  it('rounds to a ~2 km grid', () => {
    expect(roundToGrid(12.97194)).toBe(12.98);
    expect(roundToGrid(77.59369)).toBe(77.6);
    expect(roundToGrid(-33.8688)).toBe(-33.86);
    // Never moves a point by more than half a grid cell (~1.1 km).
    for (const v of [12.9716, 19.0761, 28.7041, -0.0001, 179.999])
      expect(Math.abs(roundToGrid(v) - v)).toBeLessThanOrEqual(0.0100001);
  });

  it('shows bands, never exact distances', () => {
    expect(distanceLabel(0.3)).toBe('Under 5 km away');
    expect(distanceLabel(12.4)).toBe('About 10 km away');
    expect(distanceLabel(13)).toBe('About 15 km away');
    expect(distanceLabel(420)).toBe('100+ km away');
  });

  it('measures real distances', () => {
    const mumbai = placeById('gn:1275339');
    const delhi = placeById('gn:1273294');
    expect(mumbai && delhi && Math.round(distanceKm(mumbai, delhi))).toBeGreaterThan(1100);
    expect(mumbai && delhi && Math.round(distanceKm(mumbai, delhi))).toBeLessThan(1200);
  });

  it('validates updates', () => {
    expect(
      locationUpdateSchema.safeParse({ source: 'device', latitude: 12.97, longitude: 77.59 })
        .success,
    ).toBe(true);
    expect(
      locationUpdateSchema.safeParse({ source: 'device', latitude: 120, longitude: 0 }).success,
    ).toBe(false);
    expect(
      locationUpdateSchema.safeParse({
        source: 'manual',
        countryCode: 'IN',
        placeId: 'gn:1277333',
        area: 'Indiranagar',
      }).success,
    ).toBe(true);
    expect(locationUpdateSchema.safeParse({ source: 'manual', countryCode: 'India' }).success).toBe(
      false,
    );
  });
});

describe('places (GeoNames)', () => {
  it('has the major Indian cities with plausible coordinates', () => {
    expect(PLACES.length).toBeGreaterThan(300);
    for (const p of PLACES) {
      expect(p.countryCode).toBe('IN');
      expect(p.latitude).toBeGreaterThan(6);
      expect(p.latitude).toBeLessThan(37);
      expect(p.longitude).toBeGreaterThan(68);
      expect(p.longitude).toBeLessThan(98);
    }
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
  });

  it('searches by prefix first, ignoring case and accents', () => {
    expect(searchPlaces('beng', 'IN')[0]?.name).toBe('Bengaluru');
    expect(searchPlaces('MUMBAI', 'IN')[0]?.name).toBe('Mumbai');
    expect(searchPlaces('zzzz', 'IN')).toEqual([]);
    expect(searchPlaces('mum', 'US')).toEqual([]);
  });

  it('labels a device location with the nearest place, or nothing if none is close', () => {
    expect(nearestPlace({ latitude: 12.98, longitude: 77.6 })?.name).toBe('Bengaluru');
    expect(nearestPlace({ latitude: 0, longitude: 0 })).toBeUndefined();
  });
});
