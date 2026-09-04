import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  Clock3,
  EyeOff,
  Footprints,
  MapPin,
  Navigation,
  ParkingCircle,
  ShieldAlert,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getPublishedSpotBySlug,
  getPublishedSpots,
  getPublicSpotUnavailability,
} from "@/features/spots/data/spot-repository";
import {
  accessLabels,
  attendanceLabels,
  bestTimeLabels,
  categoryLabels,
  surfaceLabels,
} from "@/features/spots/domain/spot";

type SpotPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const spots = await getPublishedSpots();
  return spots.map((spot) => ({ slug: spot.slug }));
}

export async function generateMetadata({ params }: SpotPageProps): Promise<Metadata> {
  const { slug } = await params;
  const spot = await getPublishedSpotBySlug(slug);

  if (!spot) {
    const unavailable = await getPublicSpotUnavailability(slug);
    return unavailable
      ? { title: `${unavailable.name} — fiche indisponible`, robots: { index: false, follow: false } }
      : { title: "Spot introuvable" };
  }

  const socialImages = spot.coverImageUrl ? [spot.coverImageUrl] : [];

  return {
    title: spot.name,
    description: spot.shortDescription,
    openGraph: {
      title: spot.name,
      description: spot.shortDescription,
      images: socialImages,
    },
    twitter: {
      card: "summary_large_image",
      title: spot.name,
      description: spot.shortDescription,
      images: socialImages,
    },
    robots: spot.isDemo ? { index: false, follow: false } : undefined,
  };
}

export default async function SpotPage({ params }: SpotPageProps) {
  const { slug } = await params;
  const spot = await getPublishedSpotBySlug(slug);
  if (!spot) {
    const unavailable = await getPublicSpotUnavailability(slug);
    if (!unavailable) notFound();

    return (
      <main>
        <div className="content-shell">
          <SiteHeader />
          <Link className="back-link" href="/"><ArrowLeft size={17} aria-hidden="true" /> Retour à la carte</Link>
          <section className="unavailable-spot">
            <EyeOff aria-hidden="true" />
            <p className="kicker">Fiche temporairement indisponible</p>
            <h1>{unavailable.name}</h1>
            <p>{unavailable.state === "archived" ? "Ce spot a été archivé après vérification et n’est plus proposé sur la carte." : "Cette fiche est masquée pendant que l’équipe vérifie ses informations. Ses coordonnées ne sont pas affichées."}</p>
            <Link className="button" href="/">Découvrir les spots disponibles</Link>
          </section>
          <SiteFooter />
        </div>
      </main>
    );
  }

  const routeUrl = `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`;

  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/">
          <ArrowLeft size={17} aria-hidden="true" /> Retour à la carte
        </Link>

        <article className="spot-detail">
          {spot.photoUrls.length ? (
            <section className={`detail-gallery${spot.photoUrls.length === 1 ? " single" : ""}`} aria-label={`Galerie de ${spot.name}`}>
              {spot.photoUrls.map((url, index) => (
                <Image key={url} unoptimized width={1600} height={1200} sizes={index === 0 ? "(max-width: 1180px) 100vw, 780px" : "(max-width: 620px) 100vw, 390px"} src={url} alt={`Vue ${index + 1} du spot ${spot.name}`} priority={index === 0} />
              ))}
            </section>
          ) : (
            <div className="detail-visual" aria-label="Aucune photo publiée pour cette fiche">
              <span className="spot-visual-road" aria-hidden="true" />
              {spot.isDemo ? <span className="demo-chip">Fiche de démonstration</span> : null}
            </div>
          )}

          <div className="detail-heading">
            <div>
              <p className="kicker">{spot.categories.map((item) => categoryLabels[item]).join(" · ")}</p>
              <h1>{spot.name}</h1>
              <p className="spot-location">
                <MapPin size={17} aria-hidden="true" />
                {spot.municipality} · {spot.postalCode}
                {spot.displayPrecision === "approximate" ? " · position approximative" : ""}
              </p>
            </div>
            <div className="verified-date">
              <CalendarCheck size={18} aria-hidden="true" />
              <span>
                Vérifié le
                <strong>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(spot.lastVerifiedAt))}</strong>
              </span>
            </div>
          </div>

          <p className="detail-intro">{spot.shortDescription}</p>

          <section className="warning-card" aria-labelledby="warnings-title">
            <ShieldAlert size={23} aria-hidden="true" />
            <div>
              <h2 id="warnings-title">À savoir avant de partir</h2>
              <ul>
                {spot.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          </section>

          <section className="facts-grid" aria-label="Informations pratiques">
            <div className="fact-card">
              <Clock3 aria-hidden="true" />
              <span>Meilleur moment</span>
              <strong>{spot.bestTimes.map((item) => bestTimeLabels[item]).join(", ")}</strong>
              <p>{spot.lightOrientation ?? "Orientation lumineuse à confirmer."}</p>
            </div>
            <div className="fact-card">
              <ParkingCircle aria-hidden="true" />
              <span>Accès · {accessLabels[spot.accessLevel]}</span>
              <strong>{spot.parking}</strong>
              <p>Sol {surfaceLabels[spot.surfaceType].toLowerCase()} · {attendanceLabels[spot.attendance].toLowerCase()}</p>
            </div>
            <div className="fact-card">
              <Footprints aria-hidden="true" />
              <span>Approche à pied</span>
              <strong>{spot.walkingApproach}</strong>
              <p>Respectez les accès, les riverains et la signalisation sur place.</p>
            </div>
          </section>

          <div className="detail-actions">
            <a className="button" href={routeUrl} target="_blank" rel="noreferrer">
              <Navigation size={17} aria-hidden="true" /> Ouvrir l&apos;itinéraire
            </a>
            <Link className="report-link" href={`/signaler/${spot.slug}`}>Signaler une information</Link>
            <span>L&apos;itinéraire s&apos;ouvre dans votre service cartographique.</span>
          </div>
        </article>
        <SiteFooter />
      </div>
    </main>
  );
}
