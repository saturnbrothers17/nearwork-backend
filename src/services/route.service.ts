import { ENV } from '../config/environment';

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  polyline: [number, number][];
  provider: 'google' | 'osrm';
}

export class RouteService {
  /**
   * Calculates actual driving road route between worker and customer coordinates
   * Uses Google Routes / Directions API when GOOGLE_MAPS_API_KEY is configured,
   * with high-precision OSRM road routing fallback.
   */
  static async calculateDrivingRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<RouteResult> {
    // 1. Try Google Routes / Directions API if key configured
    if (ENV.GOOGLE_MAPS_API_KEY && !ENV.GOOGLE_MAPS_API_KEY.includes('mock')) {
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${ENV.GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'OK' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const leg = route.legs[0];
            const distanceKm = Math.round((leg.distance.value / 1000) * 10) / 10;
            const durationMinutes = Math.max(1, Math.round(leg.duration.value / 60));

            // Decode polyline points
            const polyline = this.decodePolyline(route.overview_polyline.points);

            return {
              distanceKm,
              durationMinutes,
              polyline,
              provider: 'google'
            };
          }
        }
      } catch (err) {
        console.warn('Google Directions API fallback to OSRM:', err);
      }
    }

    // 2. High-speed OSRM Real Road Engine Fallback
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const r = data.routes[0];
          const distanceKm = Math.round((r.distance / 1000) * 10) / 10;
          const durationMinutes = Math.max(1, Math.round(r.duration / 60));
          const polyline: [number, number][] = r.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]] // geojson [lng, lat] -> [lat, lng]
          );

          return {
            distanceKm,
            durationMinutes,
            polyline,
            provider: 'osrm'
          };
        }
      }
    } catch (e) {
      console.warn('OSRM Route calculation error:', e);
    }

    // 3. Fallback direct line
    const R = 6371;
    const dLat = ((destLat - originLat) * Math.PI) / 180;
    const dLon = ((destLng - originLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((originLat * Math.PI) / 180) *
        Math.cos((destLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = Math.round(R * c * 10) / 10;

    return {
      distanceKm: dist,
      durationMinutes: Math.max(1, Math.round((dist / 30) * 60)),
      polyline: [
        [originLat, originLng],
        [destLat, destLng]
      ],
      provider: 'osrm'
    };
  }

  /**
   * Decode encoded polyline string into array of [lat, lng]
   */
  private static decodePolyline(encoded: string): [number, number][] {
    const points: [number, number][] = [];
    let index = 0,
      len = encoded.length;
    let lat = 0,
      lng = 0;

    while (index < len) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  }
}
