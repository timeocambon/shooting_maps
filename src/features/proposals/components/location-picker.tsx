"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapPin, Move } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { resolveMapStyle } from "@/features/maps/map-style";
import { ensureMaplibreWorkerConfigured } from "@/features/maps/maplibre-worker";

type LocationPickerProps = {
  latitude: number;
  longitude: number;
  confirmed: boolean;
  onChange: (latitude: number, longitude: number) => void;
  styleUrl: string;
};

export function LocationPicker({
  latitude,
  longitude,
  confirmed,
  onChange,
  styleUrl,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onChangeRef = useRef(onChange);
  const initialLocationRef = useRef({ latitude, longitude });
  const programmaticMoveRef = useRef(false);
  const readyForUserMoveRef = useRef(false);

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
        zoom: 14,
        attributionControl: false,
      });

      map.on("click", (event) => {
        map.easeTo({ center: event.lngLat, duration: 260 });
      });
      map.on("moveend", () => {
        if (!readyForUserMoveRef.current) return;
        if (programmaticMoveRef.current) {
          programmaticMoveRef.current = false;
          return;
        }
        const center = map.getCenter();
        onChangeRef.current(
          Number(center.lat.toFixed(6)),
          Number(center.lng.toFixed(6)),
        );
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.once("load", () => {
        programmaticMoveRef.current = false;
        readyForUserMoveRef.current = true;
      });
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      readyForUserMoveRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    if (
      Math.abs(center.lat - latitude) < 0.000001 &&
      Math.abs(center.lng - longitude) < 0.000001
    ) {
      return;
    }

    programmaticMoveRef.current = true;
    map.easeTo({
      center: [longitude, latitude],
      zoom: Math.max(map.getZoom(), 16),
      duration: 420,
    });
  }, [latitude, longitude]);

  return (
    <div className="location-picker-shell">
      <div
        ref={containerRef}
        className="location-picker"
        role="region"
        aria-label="Choisir la position du spot sur la carte"
      />
      <div className="location-picker-instruction" aria-hidden="true">
        <Move size={15} /> Déplacez la carte sous le repère
      </div>
      <div
        className={`location-picker-target${confirmed ? " is-confirmed" : ""}`}
        aria-hidden="true"
      >
        <MapPin size={42} strokeWidth={2.4} />
        <span />
      </div>
      <div className="location-picker-tip" aria-hidden="true">
        La pointe indique la position exacte
      </div>
    </div>
  );
}
