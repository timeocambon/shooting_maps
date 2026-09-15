import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PhotographerCard } from "@/features/photographers/components/photographer-card";
import { getPublishedPhotographers } from "@/features/photographers/data/photographer-repository";

export const metadata = { title: "Photographes" };

export default async function PhotographersPage() {
  const photographers = await getPublishedPhotographers();

  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <section className="hero">
          <p className="kicker">Trouver un photographe</p>
          <h1>Photographes référencés</h1>
          <p className="lead">Des photographes inscrits sur Spotride, avec leur présentation, quelques images et leurs réseaux pour les contacter directement.</p>
          <Link className="button button-secondary" href="/devenir-photographe">Être référencé comme photographe</Link>
        </section>

        {photographers.length ? (
          <div className="photographer-grid">
            {photographers.map((photographer) => (
              <PhotographerCard key={photographer.id} photographer={photographer} />
            ))}
          </div>
        ) : (
          <div className="admin-empty">
            <Camera aria-hidden="true" />
            <h2>Aucun photographe référencé pour le moment.</h2>
            <p>Les inscriptions envoyées depuis la page dédiée apparaîtront ici après vérification.</p>
            <Link className="button button-secondary" href="/devenir-photographe">Proposer votre profil</Link>
          </div>
        )}
        <SiteFooter />
      </div>
    </main>
  );
}
