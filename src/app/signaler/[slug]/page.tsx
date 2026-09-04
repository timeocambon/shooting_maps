import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ReportForm } from "@/features/reports/components/report-form";
import { getPublishedSpotBySlug } from "@/features/spots/data/spot-repository";

type ReportPageProps = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: "Signaler une fiche",
  description: "Signalez une information à vérifier sur une fiche Spotride.",
  robots: { index: false, follow: false },
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { slug } = await params;
  const spot = await getPublishedSpotBySlug(slug);
  if (!spot) notFound();

  return (
    <main>
      <div className="content-shell report-shell">
        <SiteHeader />
        <Link className="back-link" href={`/spots/${spot.slug}`}>
          <ArrowLeft size={17} aria-hidden="true" /> Retour à la fiche
        </Link>
        <header className="report-heading">
          <div>
            <p className="kicker">Information à vérifier</p>
            <h1>Signaler un problème sur {spot.name}</h1>
          </div>
          <p>Votre signalement est privé. Les motifs sensibles sont placés en tête de la file de modération et la fiche peut être masquée immédiatement.</p>
        </header>
        <ReportForm spotId={spot.id} spotName={spot.name} spotSlug={spot.slug} />
        <SiteFooter />
      </div>
    </main>
  );
}
