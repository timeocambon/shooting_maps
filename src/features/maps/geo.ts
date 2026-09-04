const EARTH_RADIUS_KM = 6371;

export type LngLat = {
  latitude: number;
  longitude: number;
};

/**
 * Distance à vol d'oiseau entre deux positions, en kilomètres (formule de
 * Haversine). Utilisée pour le filtre "autour de moi" — jamais pour calculer
 * un itinéraire.
 */
export function distanceKm(a: LngLat, b: LngLat): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
