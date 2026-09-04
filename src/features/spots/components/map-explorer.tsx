"use client";

import { useMemo, useState } from "react";
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

export function MapExplorer({ spots, mapStyleUrl }: MapExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SpotCategory | "all">("all");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(spots[0]?.id ?? null);

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
              <p>Essayez une autre ambiance ou une commune voisine.</p>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
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
      />
    </section>
  );
}
