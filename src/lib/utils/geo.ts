/**
 * Geo-spatial utility functions for the discovery feed.
 *
 * Uses the Haversine formula for accurate distance calculations
 * between two latitude/longitude points on Earth.
 */

const EARTH_RADIUS_KM = 6371;

/** Convert degrees to radians */
function toRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculates the great-circle distance between two points using the
 * Haversine formula.
 *
 * @returns distance in kilometres
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Returns a bounding box (min/max lat/lng) around a centre point.
 * Useful for a fast WHERE filter before the precise Haversine check.
 *
 * @param lat  Centre latitude
 * @param lng  Centre longitude
 * @param radiusKm  Radius in kilometres
 */
export function boundingBox(
  lat: number,
  lng: number,
  radiusKm: number,
): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const latDelta = radiusKm / EARTH_RADIUS_KM;
  const lngDelta = radiusKm / (EARTH_RADIUS_KM * Math.cos(toRadians(lat)));

  // Convert radians back to degrees
  const latDeltaDeg = latDelta * (180 / Math.PI);
  const lngDeltaDeg = lngDelta * (180 / Math.PI);

  return {
    minLat: lat - latDeltaDeg,
    maxLat: lat + latDeltaDeg,
    minLng: lng - lngDeltaDeg,
    maxLng: lng + lngDeltaDeg,
  };
}
