import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Clock3, MapPin } from "lucide-react";
import {
  accessLabels,
  bestTimeLabels,
  categoryLabels,
  type PublicSpot,
} from "@/features/spots/domain/spot";

type SpotCardProps = {
  spot: PublicSpot;
  selected: boolean;
  onSelect: (spot: PublicSpot) => void;
};

export function SpotCard({ spot, selected, onSelect }: SpotCardProps) {
  return (
    <article
      className={`spot-card${selected ? " spot-card-selected" : ""}`}
      data-spot-id={spot.id}
    >
      <button
        className="spot-card-select"
        type="button"
        onClick={() => onSelect(spot)}
        aria-label={`Centrer la carte sur ${spot.name}`}
      >
        <span className="spot-visual" aria-hidden="true">
          {spot.coverImageUrl ? (
            <Image unoptimized fill sizes="(max-width: 620px) 100vw, 420px" src={spot.coverImageUrl} alt="" />
          ) : <span className="spot-visual-road" />}
          {spot.isDemo ? <span className="demo-chip">Démo</span> : null}
        </span>
      </button>

      <div className="spot-card-body">
        <div className="eyebrow-row">
          <span className="eyebrow">{categoryLabels[spot.categories[0]]}</span>
          <span className="access-label">Accès {accessLabels[spot.accessLevel].toLowerCase()}</span>
        </div>
        <h2>{spot.name}</h2>
        <p className="spot-location">
          <MapPin size={15} aria-hidden="true" />
          {spot.municipality}
          {spot.displayPrecision === "approximate" ? " · zone approximative" : ""}
        </p>
        <p className="spot-description">{spot.shortDescription}</p>
        <div className="spot-card-footer">
          <span>
            <Clock3 size={15} aria-hidden="true" />
            {bestTimeLabels[spot.bestTimes[0]]}
          </span>
          <Link href={`/spots/${spot.slug}`}>
            Voir la fiche <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
