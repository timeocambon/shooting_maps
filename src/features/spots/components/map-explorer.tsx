"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { SpotCard } from "@/features/spots/components/spot-card";
import { SpotMap } from "@/features/spots/components/spot-map";
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

type MapBounds = { west: number; south: number; east: number; north: number };
/** Zone rapportée par la carte (dispo seulement une fois qu'elle a chargé). */
type Viewport = { center: [number, number]; zoom: number; bounds: MapBounds };
/** Position/zoom restaurés depuis une URL partagée : pas encore de bounds. */
type InitialViewport = { center: [number, number]; zoom: number };

function parseInitialState(searchParams: URLSearchParams) {
  const q = searchParams.get("recherche") ?? "";

  const categorieParam = searchParams.get("categorie");
  const category: SpotCategory | "all" =
    categorieParam &&
    (spotCategories as readonly string[]).includes(categorieParam)
      ? (categorieParam as SpotCategory)
      : "all";

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
    viewport: hasViewport ? ({ center: [lng, lat], zoom } satisfies InitialViewport) : null,
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
  // Contient toujours les bounds une fois peuplé par la carte (voir
  // SpotMap.onViewportChange) ; reste `null` tant que la carte n'a pas
  // encore rapporté sa zone, y compris juste après restauration d'une URL
  // partagée (on ne connaît le centre/zoom initiaux qu'après coup, pas les
  // bounds, qui dépendent de la taille réelle du conteneur de la carte).
  const [viewport, setViewport] = useState<Viewport | null>(null);

  const filteredSpots = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");

    return spots.filter((spot) => {
      const matchesQuery =
        !normalizedQuery ||
        spot.name.toLocaleLowerCase("fr").includes(normalizedQuery) ||
        spot.municipality.toLocaleLowerCase("fr").includes(normalizedQuery);
      const matchesCategory =
        category === "all" || spot.categories.includes(category);

      return matchesQuery && matchesCategory;
    });
  }, [category, query, spots]);

  // La liste de gauche n'affiche que ce qui est actuellement visible sur la
  // carte (selon le zoom et le déplacement) ; la carte, elle, reçoit tous
  // les spots filtrés pour pouvoir les faire apparaître en la déplaçant.
  // Tant que la carte n'a pas encore rapporté sa zone (juste après le
  // chargement), on affiche tout pour éviter un flash de liste vide.
  const visibleSpots = useMemo(() => {
    if (!viewport) return filteredSpots;
    const { bounds } = viewport;
    return filteredSpots.filter(
      (spot) =>
        spot.latitude >= bounds.south &&
        spot.latitude <= bounds.north &&
        spot.longitude >= bounds.west &&
        spot.longitude <= bounds.east,
    );
  }, [filteredSpots, viewport]);

  // Garde la zone et les filtres utiles synchronisés dans l'URL, pour qu'un
  // lien copié restaure la même vue. Tant que la carte n'a pas encore
  // rapporté sa position réelle (viewport === null, juste après le
  // chargement), on garde celle restaurée depuis l'URL initiale plutôt que
  // de l'effacer prématurément.
  const urlCenterZoom = viewport ?? initialState.viewport;
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("recherche", query.trim());
    if (category !== "all") params.set("categorie", category);
    if (urlCenterZoom) {
      params.set("lat", urlCenterZoom.center[1].toFixed(4));
      params.set("lng", urlCenterZoom.center[0].toFixed(4));
      params.set("zoom", urlCenterZoom.zoom.toFixed(1));
    }

    const next = params.toString();
    if (next === searchParams.toString()) return;

    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [query, category, urlCenterZoom, pathname, router, searchParams]);

  function selectSpot(spot: PublicSpot) {
    setSelectedSpotId(spot.id);
    document
      .querySelector(`[data-spot-id="${spot.id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
        </div>

        <div className="results-summary" aria-live="polite">
          <strong>
            {visibleSpots.length} {visibleSpots.length > 1 ? "spots" : "spot"}
          </strong>
          <span>sur cette zone de carte</span>
        </div>

        <div className="spot-list">
          {visibleSpots.length ? (
            visibleSpots.map((spot) => (
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
              <p>Dézoomez ou déplacez la carte, ou essayez une autre ambiance.</p>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Réinitialiser les filtres
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
      />
    </section>
  );
}
