import type { setWorkerUrl as SetWorkerUrl } from "maplibre-gl";

let configured = false;

/**
 * Turbopack ne bundle pas correctement le worker de MapLibre (voir
 * scripts/copy-maplibre-worker.mjs) : sans cet appel, MapLibre tente de
 * charger son worker à l'URL de la page courante, ce que le navigateur
 * bloque ("Refused to execute ... MIME type text/html"). À appeler une
 * seule fois, juste après `await import("maplibre-gl")` et avant de créer
 * la première `Map`.
 */
export function ensureMaplibreWorkerConfigured(setWorkerUrl: SetWorkerUrl) {
  if (configured) return;
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  configured = true;
}
