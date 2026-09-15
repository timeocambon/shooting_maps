import { Star } from "lucide-react";
import type { PublicPhotographerReview } from "@/features/photographers/domain/photographer";

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="star-rating-display" aria-label={`${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={15} aria-hidden="true" className={value <= rating ? "filled" : ""} />
      ))}
    </span>
  );
}

type ReviewListProps = { reviews: PublicPhotographerReview[] };

export function ReviewList({ reviews }: ReviewListProps) {
  if (!reviews.length) {
    return <p className="review-empty">Aucun avis pour le moment — soyez la première personne à en laisser un.</p>;
  }

  return (
    <ul className="review-list">
      {reviews.map((review) => (
        <li key={review.id}>
          <div className="review-list-head">
            <StarRating rating={review.rating} />
            <span>{review.reviewerName ?? "Anonyme"}</span>
          </div>
          <p>{review.comment}</p>
          <time dateTime={review.createdAt}>
            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(review.createdAt))}
          </time>
        </li>
      ))}
    </ul>
  );
}
