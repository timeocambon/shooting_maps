import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MapPin, Star } from "lucide-react";
import type { PublicPhotographer } from "@/features/photographers/domain/photographer";

type PhotographerCardProps = { photographer: PublicPhotographer };

export function PhotographerCard({ photographer }: PhotographerCardProps) {
  return (
    <article className="photographer-card">
      <span className="photographer-visual" aria-hidden="true">
        {photographer.coverImageUrl ? (
          <Image fill sizes="(max-width: 620px) 100vw, 340px" src={photographer.coverImageUrl} alt="" />
        ) : (
          <span className="photographer-visual-placeholder" />
        )}
      </span>
      <div className="photographer-card-body">
        <h2>{photographer.name}</h2>
        {photographer.locationLabel ? (
          <p className="spot-location">
            <MapPin size={15} aria-hidden="true" />
            {photographer.locationLabel}
          </p>
        ) : null}
        <p className="spot-description">{photographer.tagline}</p>
        <div className="photographer-card-footer">
          {photographer.averageRating ? (
            <span className="photographer-rating">
              <Star size={15} aria-hidden="true" className="filled" />
              {photographer.averageRating.toFixed(1)} ({photographer.reviewCount})
            </span>
          ) : (
            <span className="photographer-rating muted">Pas encore d’avis</span>
          )}
          <Link href={`/photographes/${photographer.slug}`}>
            Voir la fiche <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
