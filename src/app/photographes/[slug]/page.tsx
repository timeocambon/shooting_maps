import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SpotGallery } from "@/features/spots/components/spot-gallery";
import { ReviewForm } from "@/features/photographers/components/review-form";
import { ReviewList } from "@/features/photographers/components/review-list";
import {
  getPublishedPhotographerBySlug,
  getPublishedPhotographerReviews,
  getPublishedPhotographers,
} from "@/features/photographers/data/photographer-repository";
import { socialLinkUrl, socialPlatformLabels } from "@/features/photographers/domain/photographer";

type PhotographerPageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const photographers = await getPublishedPhotographers();
  return photographers.map((photographer) => ({ slug: photographer.slug }));
}

export async function generateMetadata({ params }: PhotographerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const photographer = await getPublishedPhotographerBySlug(slug);
  if (!photographer) return { title: "Photographe introuvable" };

  return {
    title: photographer.name,
    description: photographer.tagline,
    openGraph: {
      title: photographer.name,
      description: photographer.tagline,
      images: photographer.coverImageUrl ? [photographer.coverImageUrl] : [],
    },
  };
}

export default async function PhotographerPage({ params }: PhotographerPageProps) {
  const { slug } = await params;
  const photographer = await getPublishedPhotographerBySlug(slug);
  if (!photographer) notFound();

  const reviews = await getPublishedPhotographerReviews(photographer.id);

  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/photographes">
          <ArrowLeft size={17} aria-hidden="true" /> Retour aux photographes
        </Link>

        <article className="spot-detail">
          {photographer.photoUrls.length ? (
            <SpotGallery photoUrls={photographer.photoUrls} spotName={photographer.name} />
          ) : (
            <div className="detail-visual" aria-label="Aucune photo publiée pour ce photographe">
              <span className="spot-visual-road" aria-hidden="true" />
            </div>
          )}

          <div className="detail-heading">
            <div>
              <p className="kicker">Photographe</p>
              <h1>{photographer.name}</h1>
              {photographer.locationLabel ? (
                <p className="spot-location">
                  <MapPin size={17} aria-hidden="true" />
                  {photographer.locationLabel}
                </p>
              ) : null}
            </div>
            {photographer.averageRating ? (
              <div className="verified-date">
                <Star size={18} aria-hidden="true" className="filled" />
                <span>
                  Note moyenne
                  <strong>{photographer.averageRating.toFixed(1)} / 5 · {photographer.reviewCount} avis</strong>
                </span>
              </div>
            ) : null}
          </div>

          <p className="detail-intro">{photographer.tagline}</p>
          <p>{photographer.bio}</p>

          {photographer.socials.length ? (
            <div className="detail-actions">
              {photographer.socials.map((social) => (
                <a
                  key={`${social.platform}-${social.value}`}
                  className="button button-secondary"
                  href={socialLinkUrl(social)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {socialPlatformLabels[social.platform]}
                </a>
              ))}
            </div>
          ) : null}

          <section className="reviews-section" aria-labelledby="reviews-title">
            <h2 id="reviews-title">Avis ({photographer.reviewCount})</h2>
            <ReviewList reviews={reviews} />
          </section>

          <section className="reviews-section" aria-labelledby="review-form-title">
            <h2 id="review-form-title">Laisser un avis</h2>
            <ReviewForm
              photographerId={photographer.id}
              photographerSlug={photographer.slug}
              photographerName={photographer.name}
            />
          </section>
        </article>
        <SiteFooter />
      </div>
    </main>
  );
}
