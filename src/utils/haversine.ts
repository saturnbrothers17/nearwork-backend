import { APP_CONFIG } from '@nearwork/config';

/**
 * Calculates great-circle distance between two geographic coordinates in kilometers (Haversine formula).
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return Math.round(d * 100) / 100; // 2 decimals
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Verifies if the worker's current coordinates are within the arrival geofence threshold.
 */
export function isWithinGeofence(
  workerLat: number,
  workerLng: number,
  destLat: number,
  destLng: number,
  maxDistanceMeters: number = APP_CONFIG.workerArrivalGeofenceMeters
): { withinGeofence: boolean; distanceMeters: number } {
  const distanceKm = calculateDistanceKm(workerLat, workerLng, destLat, destLng);
  const distanceMeters = distanceKm * 1000;
  return {
    withinGeofence: distanceMeters <= maxDistanceMeters,
    distanceMeters: Math.round(distanceMeters)
  };
}

/**
 * Estimates travel duration in minutes based on distance and urban traffic heuristics.
 */
export function estimateEtaMinutes(distanceKm: number): number {
  // Average urban speed: 25 km/h + 3 min buffer for stops/traffic
  const avgSpeedKmh = 25;
  const timeHours = distanceKm / avgSpeedKmh;
  const minutes = Math.ceil(timeHours * 60) + 2;
  return Math.max(1, minutes);
}
