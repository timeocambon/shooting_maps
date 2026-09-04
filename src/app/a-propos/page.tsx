import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Le projet" };

export default function AboutPage() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <article className="simple-page prose-page">
          <p className="kicker">Pourquoi Spotride</p>
          <h1>Préparer un shooting, pas seulement trouver une adresse.</h1>
          <p className="lead">Spotride Toulouse rassemble les informations qui comptent vraiment : rendu visuel, lumière, accès, stationnement, fréquentation et risques connus.</p>
          <h2>La qualité avant la quantité</h2>
          <p>Chaque proposition doit être relue avant publication. Un lieu fragile, dangereux ou soumis à une restriction peut être rendu approximatif, masqué ou archivé.</p>
          <h2>Un usage responsable</h2>
          <p>Le service ne recommande ni vitesse, ni intrusion, ni stationnement dangereux. Les lieux, les riverains et le droit à l&apos;image passent avant l&apos;engagement.</p>
        </article>
      </div>
    </main>
  );
}
