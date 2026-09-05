"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { resolveMapStyle } from "@/features/maps/map-style";
import { ensureMaplibreWorkerConfigured } from "@/features/maps/maplibre-worker";

type LocationPickerProps = {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
  styleUrl: string;
};

export function LocationPicker({ latitude, longitude, onChange, styleUrl }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialLocationRef = useRef({ latitude, longitude });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;
      ensureMaplibreWorkerConfigured(maplibregl.setWorkerUrl);
      const initial = initialLocationRef.current;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: resolveMapStyle(styleUrl),
        center: [initial.longitude, initial.latitude],
        zoom: 11,
        attributionControl: false,
      });
      const marker = new maplibregl.Marker({ color: "#e85b3d", draggable: true })
        .setLngLat([initial.longitude, initial.latitude])
        .addTo(map);

      marker.on("dragend", () => {
        const point = marker.getLngLat();
        onChangeRef.current(Number(point.lat.toFixed(6)), Number(point.lng.toFixed(6)));
      });
      map.on("click", (event) => {
        marker.setLngLat(event.lngLat);
        onChangeRef.current(Number(event.lngLat.lat.toFixed(6)), Number(event.lngLat.lng.toFixed(6)));
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    markerRef.current?.setLngLat([longitude, latitude]);
    mapRef.current?.easeTo({
      center: [longitude, latitude],
      zoom: Math.max(mapRef.current.getZoom(), 14),
    });
  }, [latitude, longitude]);

  return <div ref={containerRef} className="location-picker" role="region" aria-label="Choisir la position du spot sur la carte" />;
}
