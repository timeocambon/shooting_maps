"use client";

import { useEffect, useRef } from "react";
import type {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import { resolveMapStyle } from "@/features/maps/map-style";
import type { PublicSpot } from "@/features/spots/domain/spot";

type SpotMapProps = {
  spots: PublicSpot[];
  selectedSpotId: string | null;
  onSelectSpot: (spotId: string) => void;
  styleUrl: string;
};

export function SpotMap({
  spots,
  selectedSpotId,
  onSelectSpot,
  styleUrl,
}: SpotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map());
  const syncMarkersRef = useRef<
    ((nextSpots: PublicSpot[], nextSelectedSpotId: string | null) => void) | null
  >(null);
  const onSelectRef = useRef(onSelectSpot);
  const initialSpotsRef = useRef(spots);
  const selectedSpotRef = useRef(selectedSpotId);

  useEffect(() => {
    onSelectRef.current = onSelectSpot;
  }, [onSelectSpot]);

  useEffect(() => {
    selectedSpotRef.current = selectedSpotId;
  }, [selectedSpotId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    const markers = markersRef.current;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: resolveMapStyle(styleUrl),
        center: [1.4442, 43.6045],
        zoom: 10.6,
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
        markers.clear();

        nextSpots.forEach((spot) => {
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

          markers.set(spot.id, marker);
        });
      };

      syncMarkersRef.current = syncMarkers;
      syncMarkers(initialSpotsRef.current, selectedSpotRef.current);
    });

    return () => {
      cancelled = true;
      syncMarkersRef.current = null;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
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

  return (
    <div className="map-shell">
      <div
        ref={containerRef}
        className="spot-map"
        role="region"
        aria-label="Carte des spots autour de Toulouse"
      />
      <span className="map-status">
        {spots.length === 0
          ? "Aucun spot affiché"
          : `${spots.length} ${spots.length > 1 ? "spots affichés" : "spot affiché"}`}
      </span>
    </div>
  );
}
