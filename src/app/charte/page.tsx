import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Charte" };

export default function CharterPage() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <article className="simple-page prose-page">
          <p className="kicker">Nos règles</p>
          <h1>Charte de contribution</h1>
          <p className="lead">Ce que Spotride attend de celles et ceux qui proposent un spot, et ce que nous nous engageons à faire de leurs contributions.</p>
          <h2>Contribuer avec soin</h2>
          <ul>
            <li>Ne proposer aucun accès fondé sur une intrusion ou une infraction.</li>
            <li>Décrire honnêtement les risques, restrictions et nuisances.</li>
            <li>Ne publier que des images dont la diffusion est autorisée.</li>
            <li>Éviter les plaques et les personnes reconnaissables.</li>
            <li>Respecter les lieux, les propriétés et les riverains.</li>
          </ul>
        </article>
      </div>
    </main>
  );
}
