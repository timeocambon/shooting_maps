"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import { SpotCard } from "@/features/spots/components/spot-card";
import { SpotMap } from "@/features/spots/components/spot-map";
import { distanceKm } from "@/features/maps/geo";
import {
  categoryLabels,
  spotCategories,
  type PublicSpot,
  type SpotCategory,
} from "@/features/spots/domain/spot";

type MapExplorerProps = {
  spots: PublicSpot[];
  mapStyleUrl: string;
};

type Viewport = { center: [number, number]; zoom: number };
type GeoStatus = "idle" | "loading" | "granted" | "denied" | "unsupported";

const DISTANCE_OPTIONS_KM = [10, 25, 50, 100] as const;

function parseInitialState(searchParams: URLSearchParams) {
  const q = searchParams.get("recherche") ?? "";

  const categorieParam = searchParams.get("categorie");
  const category: SpotCategory | "all" =
    categorieParam &&
    (spotCategories as readonly string[]).includes(categorieParam)
      ? (categorieParam as SpotCategory)
      : "all";

  const distanceParam = Number(searchParams.get("distance"));
  const distanceLimitKm =
    Number.isFinite(distanceParam) && distanceParam > 0 ? distanceParam : null;

  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const zoomParam = searchParams.get("zoom");
  const lat = latParam !== null ? Number(latParam) : NaN;
  const lng = lngParam !== null ? Number(lngParam) : NaN;
  const zoom = zoomParam !== null ? Number(zoomParam) : NaN;
  const hasViewport =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Number.isFinite(zoom) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  return {
    q,
    category,
    distanceLimitKm,
    viewport: hasViewport ? ({ center: [lng, lat], zoom } satisfies Viewport) : null,
  };
}

export function MapExplorer({ spots, mapStyleUrl }: MapExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [initialState] = useState(() => parseInitialState(searchParams));

  const [query, setQuery] = useState(initialState.q);
  const [category, setCategory] = useState<SpotCategory | "all">(initialState.category);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(spots[0]?.id ?? null);
  const [distanceLimitKm, setDistanceLimitKm] = useState<number | null>(
    initialState.distanceLimitKm,
  );
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [viewport, setViewport] = useState<Viewport | null>(initialState.viewport);

  const filteredSpots = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");

    return spots.filter((spot) => {
      const matchesQuery =
        !normalizedQuery ||
        spot.name.toLocaleLowerCase("fr").includes(normalizedQuery) ||
        spot.municipality.toLocaleLowerCase("fr").includes(normalizedQuery);
      const matchesCategory =
        category === "all" || spot.categories.includes(category);
      const matchesDistance =
        !distanceLimitKm || !userLocation
          ? true
          : distanceKm(userLocation, spot) <= distanceLimitKm;

      return matchesQuery && matchesCategory && matchesDistance;
    });
  }, [category, query, spots, distanceLimitKm, userLocation]);

  // Garde la zone et les filtres utiles synchronisés dans l'URL, pour qu'un
  // lien copié restaure la même vue. La position du visiteur reste locale :
  // elle n'est jamais mise dans l'URL.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("recherche", query.trim());
    if (category !== "all") params.set("categorie", category);
    if (distanceLimitKm) params.set("distance", String(distanceLimitKm));
    if (viewport) {
      params.set("lat", viewport.center[1].toFixed(4));
      params.set("lng", viewport.center[0].toFixed(4));
      params.set("zoom", viewport.zoom.toFixed(1));
    }

    const next = params.toString();
    if (next === searchParams.toString()) return;

    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [query, category, distanceLimitKm, viewport, pathname, router, searchParams]);

  function selectSpot(spot: PublicSpot) {
    setSelectedSpotId(spot.id);
    document
      .querySelector(`[data-spot-id="${spot.id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function requestLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }

    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGeoStatus("granted");
        setDistanceLimitKm((current) => current ?? 25);
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  return (
    <section className="explorer" aria-label="Explorer les spots">
      <div className="results-panel">
        <div className="search-area">
          <label className="search-field">
            <span className="sr-only">Rechercher un spot ou une commune</span>
            <Search size={19} aria-hidden="true" />
            <input
              type="search"
              placeholder="Spot ou commune…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="filter-heading">
            <span>
              <SlidersHorizontal size={17} aria-hidden="true" />
              Ambiance
            </span>
            {category !== "all" ? (
              <button type="button" onClick={() => setCategory("all")}>
                Effacer
              </button>
            ) : null}
          </div>

          <div className="filter-chips" aria-label="Filtrer par type de décor">
            <button
              className={category === "all" ? "active" : ""}
              type="button"
              onClick={() => setCategory("all")}
              aria-pressed={category === "all"}
            >
              Tout
            </button>
            {spotCategories.map((item) => (
              <button
                className={category === item ? "active" : ""}
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
              >
                {categoryLabels[item]}
              </button>
            ))}
          </div>

          <div className="filter-heading">
            <span>
              <LocateFixed size={17} aria-hidden="true" />
              Distance
            </span>
            {distanceLimitKm ? (
              <button type="button" onClick={() => setDistanceLimitKm(null)}>
                Effacer
              </button>
            ) : null}
          </div>

          {userLocation ? (
            <div className="filter-chips" aria-label="Filtrer par distance">
              {DISTANCE_OPTIONS_KM.map((option) => (
                <button
                  key={option}
                  className={distanceLimitKm === option ? "active" : ""}
                  type="button"
                  onClick={() => setDistanceLimitKm(option)}
                  aria-pressed={distanceLimitKm === option}
                >
                  {option} km
                </button>
              ))}
            </div>
          ) : (
            <div className="geo-prompt">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={requestLocation}
                disabled={geoStatus === "loading"}
              >
                <LocateFixed size={16} aria-hidden="true" />
                {geoStatus === "loading" ? "Localisation…" : "Autour de moi"}
              </button>
              {geoStatus === "denied" ? (
                <p className="geo-status" role="status">
                  Position refusée : active la géolocalisation dans ton
                  navigateur pour filtrer par distance.
                </p>
              ) : null}
              {geoStatus === "unsupported" ? (
                <p className="geo-status" role="status">
                  La géolocalisation n&apos;est pas disponible sur ce navigateur.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="results-summary" aria-live="polite">
          <strong>
            {filteredSpots.length} {filteredSpots.length > 1 ? "spots" : "spot"}
          </strong>
          <span>autour de Toulouse</span>
        </div>

        <div className="spot-list">
          {filteredSpots.length ? (
            filteredSpots.map((spot) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                selected={selectedSpotId === spot.id}
                onSelect={selectSpot}
              />
            ))
          ) : (
            <div className="empty-state">
              <strong>Aucun spot dans cette sélection</strong>
              <p>Essayez une autre ambiance, une commune voisine ou un rayon plus large.</p>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setDistanceLimitKm(null);
                }}
              >
                Réinitialiser
              </button>
            </div>
          )}
        </div>
      </div>

      <SpotMap
        spots={filteredSpots}
        selectedSpotId={selectedSpotId}
        onSelectSpot={(spotId) => {
          const spot = filteredSpots.find((item) => item.id === spotId);
          if (spot) selectSpot(spot);
        }}
        styleUrl={mapStyleUrl}
        initialCenter={initialState.viewport?.center}
        initialZoom={initialState.viewport?.zoom}
        onViewportChange={setViewport}
        userLocation={userLocation}
      />
    </section>
  );
}
