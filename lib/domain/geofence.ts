import type { VerificationState } from "@/lib/domain/types";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationReading extends Partial<Coordinates> {
  accuracyM?: number;
  permissionDenied?: boolean;
  exceptionRequested?: boolean;
}

export interface GeofenceResult {
  state: VerificationState;
  distanceM?: number;
  accuracyM?: number;
  verified: boolean;
}

const EARTH_RADIUS_M = 6_371_000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineDistanceM(from: Coordinates, to: Coordinates) {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function verifyGeofence(
  store: Coordinates & { radiusM: number },
  reading: LocationReading,
  maxAccuracyM = 150,
): GeofenceResult {
  if (reading.permissionDenied) return { state: reading.exceptionRequested ? "exception" : "permission_denied", verified: false };
  if (reading.latitude == null || reading.longitude == null) return { state: reading.exceptionRequested ? "exception" : "permission_denied", verified: false };
  const distanceM = haversineDistanceM(store, { latitude: reading.latitude, longitude: reading.longitude });
  if (reading.accuracyM == null || reading.accuracyM > maxAccuracyM) {
    return { state: reading.exceptionRequested ? "exception" : "inaccurate", distanceM, accuracyM: reading.accuracyM, verified: false };
  }
  if (distanceM > store.radiusM) return { state: reading.exceptionRequested ? "exception" : "outside_geofence", distanceM, accuracyM: reading.accuracyM, verified: false };
  return { state: "verified", distanceM, accuracyM: reading.accuracyM, verified: true };
}
