"use client";

import { useEffect, useRef } from "react";
import type {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import { Compass } from "lucide-react";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  resolveMapStyle,
} from "@/features/maps/map-style";
import { ensureMaplibreWorkerConfigured } from "@/features/maps/maplibre-worker";
import type { PublicSpot } from "@/features/spots/domain/spot";

type Viewport = { center: [number, number]; zoom: number };

type SpotMapProps = {
  spots: PublicSpot[];
  selectedSpotId: string | null;
  onSelectSpot: (spotId: string) => void;
  styleUrl: string;
  /** Centre initial (ex. restauré depuis l'URL partagée) ; sinon Toulouse. */
  initialCenter?: [number, number];
  /** Zoom initial (ex. restauré depuis l'URL partagée) ; sinon le zoom par défaut. */
  initialZoom?: number;
  /** Appelé après chaque déplacement stabilisé, pour synchroniser la zone dans l'URL. */
  onViewportChange?: (viewport: Viewport) => void;
  /** Position du visiteur, seulement après une action explicite de sa part. */
  userLocation?: { latitude: number; longitude: number } | null;
};

type MarkerCluster = {
  latitude: number;
  longitude: number;
  spots: PublicSpot[];
};

/** Distance en pixels sous laquelle deux marqueurs sont regroupés. */
const CLUSTER_RADIUS_PX = 46;

function clusterSpots(map: MapLibreMap, spots: PublicSpot[]): MarkerCluster[] {
  type WorkingCluster = MarkerCluster & { x: number; y: number };
  const clusters: WorkingCluster[] = [];

  for (const spot of spots) {
    const point = map.project([spot.longitude, spot.latitude]);
    const nearby = clusters.find(
      (cluster) =>
        Math.hypot(cluster.x - point.x, cluster.y - point.y) < CLUSTER_RADIUS_PX,
    );

    if (nearby) {
      nearby.spots.push(spot);
      const count = nearby.spots.length;
      nearby.x = (nearby.x * (count - 1) + point.x) / count;
      nearby.y = (nearby.y * (count - 1) + point.y) / count;
      nearby.latitude =
        nearby.spots.reduce((sum, item) => sum + item.latitude, 0) / count;
      nearby.longitude =
        nearby.spots.reduce((sum, item) => sum + item.longitude, 0) / count;
    } else {
      clusters.push({
        x: point.x,
        y: point.y,
        latitude: spot.latitude,
        longitude: spot.longitude,
        spots: [spot],
      });
    }
  }

  return clusters;
}

export function SpotMap({
  spots,
  selectedSpotId,
  onSelectSpot,
  styleUrl,
  initialCenter,
  initialZoom,
  onViewportChange,
  userLocation,
}: SpotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const flownToUserLocationRef = useRef(false);
  const syncMarkersRef = useRef<
    ((nextSpots: PublicSpot[], nextSelectedSpotId: string | null) => void) | null
  >(null);
  const onSelectRef = useRef(onSelectSpot);
  const onViewportChangeRef = useRef(onViewportChange);
  const spotsRef = useRef(spots);
  const selectedSpotRef = useRef(selectedSpotId);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelectSpot;
  }, [onSelectSpot]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    spotsRef.current = spots;
  }, [spots]);

  useEffect(() => {
    selectedSpotRef.current = selectedSpotId;
  }, [selectedSpotId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    const markers = markersRef.current;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      ensureMaplibreWorkerConfigured(maplibregl.setWorkerUrl);

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: resolveMapStyle(styleUrl),
        center: initialCenter ?? DEFAULT_MAP_CENTER,
        zoom: initialZoom ?? DEFAULT_MAP_ZOOM,
        minZoom: 8,
        maxZoom: 16,
        attributionControl: false,
      });

      mapRef.current = map;
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      const syncMarkers = (
        nextSpots: PublicSpot[],
        nextSelectedSpotId: string | null,
      ) => {
        markers.forEach((marker) => marker.remove());
        markers.length = 0;

        const clusters = clusterSpots(map, nextSpots);

        clusters.forEach((cluster) => {
          if (cluster.spots.length === 1) {
            const spot = cluster.spots[0];
            const markerButton = document.createElement("button");
            markerButton.type = "button";
            markerButton.className = `map-spot-marker${
              spot.id === nextSelectedSpotId ? " is-selected" : ""
            }`;
            markerButton.setAttribute("aria-label", `Afficher ${spot.name}`);
            markerButton.title = spot.name;
            markerButton.addEventListener("click", () => onSelectRef.current(spot.id));

            const marker = new maplibregl.Marker({
              element: markerButton,
              anchor: "center",
            })
              .setLngLat([spot.longitude, spot.latitude])
              .addTo(map);

            markers.push(marker);
            return;
          }

          const hasSelected = cluster.spots.some(
            (spot) => spot.id === nextSelectedSpotId,
          );
          const clusterButton = document.createElement("button");
          clusterButton.type = "button";
          clusterButton.className = `map-cluster-marker${
            hasSelected ? " has-selected" : ""
          }`;
          clusterButton.setAttribute(
            "aria-label",
            `Afficher les ${cluster.spots.length} spots groupés ici`,
          );
          clusterButton.textContent = String(cluster.spots.length);
          clusterButton.addEventListener("click", () => {
            map.easeTo({
              center: [cluster.longitude, cluster.latitude],
              zoom: Math.min(map.getZoom() + 2.4, map.getMaxZoom()),
            });
          });

          const marker = new maplibregl.Marker({
            element: clusterButton,
            anchor: "center",
          })
            .setLngLat([cluster.longitude, cluster.latitude])
            .addTo(map);

          markers.push(marker);
        });
      };

      syncMarkersRef.current = syncMarkers;
      syncMarkers(spotsRef.current, selectedSpotRef.current);

      const recluster = () => {
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          syncMarkersRef.current?.(spotsRef.current, selectedSpotRef.current);
        });
      };

      const reportViewport = () => {
        const center = map.getCenter();
        onViewportChangeRef.current?.({
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
        });
      };

      map.on("move", recluster);
      map.on("moveend", reportViewport);
      // Les écouteurs sont détruits avec la carte dans le nettoyage de
      // l'effet (map.remove() ci-dessous) ; pas besoin de les retirer ici.
    });

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      syncMarkersRef.current = null;
      markers.forEach((marker) => marker.remove());
      markers.length = 0;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Le style et les positions initiales ne pilotent que la création de la carte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  useEffect(() => {
    syncMarkersRef.current?.(spots, selectedSpotId);
  }, [selectedSpotId, spots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedSpotId) return;
    const spot = spots.find((item) => item.id === selectedSpotId);
    if (!spot) return;

    map.flyTo({
      center: [spot.longitude, spot.latitude],
      zoom: Math.max(map.getZoom(), 11),
      essential: true,
    });
  }, [selectedSpotId, spots]);

  // Marqueur de position du visiteur : ajouté seulement s'il a explicitement
  // demandé sa géolocalisation, jamais au chargement de la page.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled) return;

      userMarkerRef.current?.remove();
      userMarkerRef.current = null;

      if (!userLocation) {
        flownToUserLocationRef.current = false;
        return;
      }

      const element = document.createElement("span");
      element.className = "map-user-marker";
      element.setAttribute("aria-hidden", "true");

      userMarkerRef.current = new maplibregl.Marker({
        element,
        anchor: "center",
      })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);

      if (!flownToUserLocationRef.current) {
        flownToUserLocationRef.current = true;
        map.flyTo({
          center: [userLocation.longitude, userLocation.latitude],
          zoom: Math.max(map.getZoom(), 12),
          essential: true,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userLocation]);

  function recenter() {
    mapRef.current?.flyTo({
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      essential: true,
    });
  }

  return (
    <div className="map-shell">
      <div
        ref={containerRef}
        className="spot-map"
        role="region"
        aria-label="Carte des spots autour de Toulouse"
      />
      <button
        type="button"
        className="map-recenter-button"
        onClick={recenter}
      >
        <Compass size={16} aria-hidden="true" />
        Recentrer sur Toulouse
      </button>
      <span className="map-status">
        {spots.length === 0
          ? "Aucun spot affiché"
          : `${spots.length} ${spots.length > 1 ? "spots affichés" : "spot affiché"}`}
      </span>
    </div>
  );
}
