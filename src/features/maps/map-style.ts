import type { StyleSpecification } from "maplibre-gl";

/** Centre et zoom par défaut : Toulouse, sans dépendre de la géolocalisation. */
export const DEFAULT_MAP_CENTER: [number, number] = [1.4442, 43.6045];
export const DEFAULT_MAP_ZOOM = 10.6;

const openStreetMapRasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "paper-background",
      type: "background",
      paint: {
        "background-color": "#f5efe7",
      },
    },
    {
      id: "openstreetmap",
      type: "raster",
      source: "openstreetmap",
      paint: {
        "raster-opacity": 0.74,
        "raster-saturation": -0.22,
        "raster-contrast": -0.08,
        "raster-brightness-min": 0.08,
        "raster-brightness-max": 0.96,
        "raster-fade-duration": 120,
      },
    },
  ],
};

export function resolveMapStyle(
  styleUrl: string,
): StyleSpecification | string {
  return styleUrl === "osm-raster" ? openStreetMapRasterStyle : styleUrl;
}
