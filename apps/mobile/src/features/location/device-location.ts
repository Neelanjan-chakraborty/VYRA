import * as Location from 'expo-location';

export type DeviceLocationResult =
  | { readonly status: 'ok'; readonly latitude: number; readonly longitude: number }
  | { readonly status: 'denied' }
  | { readonly status: 'unavailable' };

/**
 * Asks for the device's approximate location. Only "when in use" permission
 * is requested; Android is configured to never request precise location and
 * iOS defaults to approximate. The lowest accuracy is used, and the server
 * rounds the result again before storing it.
 */
export async function getApproximateLocation(): Promise<DeviceLocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return { status: 'denied' };
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
    return {
      status: 'ok',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    return { status: 'unavailable' };
  }
}
