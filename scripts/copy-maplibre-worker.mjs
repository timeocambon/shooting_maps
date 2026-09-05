// Turbopack ne bundle pas correctement le worker de MapLibre : le chunk
// généré par `new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url)`
// perd son fichier `maplibre-gl-shared.mjs` associé (le worker l'importe par
// chemin relatif). Résultat en production : MapLibre tente de charger son
// worker à l'URL de la page courante, ce que le navigateur bloque avec une
// erreur de type MIME ("text/html" refusé).
//
// Le contournement recommandé par MapLibre pour Turbopack/Next.js est de
// copier les deux fichiers tels quels dans /public et de pointer
// explicitement `setWorkerUrl()` dessus (voir location-picker.tsx et
// spot-map.tsx, via ensureMaplibreWorkerConfigured()).
//
// Ce script tourne avant "dev" et "build" (scripts npm "predev"/"prebuild").
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const dist = path.join(
  path.dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")),
  "dist",
);
const dest = path.join(process.cwd(), "public", "maplibre");

mkdirSync(dest, { recursive: true });

for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(dist, file), path.join(dest, file));
}

console.log(`[copy-maplibre-worker] fichiers copiés dans ${dest}`);
