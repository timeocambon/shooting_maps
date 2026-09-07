import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Mentions légales" };

export default function LegalNoticePage() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <article className="simple-page prose-page">
          <p className="kicker">Version de travail</p>
          <h1>Mentions légales</h1>
          <p className="lead">Cette page reflète le statut actuel du projet. Sa formulation devra être relue avant la bêta, mais son contenu correspond à la situation réelle : un projet personnel, sans activité économique.</p>

          <h2>Éditeur du site</h2>
          <p>Ce site est édité par une personne physique agissant à titre non professionnel, sans activité économique, au sens de l’article 1-1 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (anciennement article 6-III). À ce titre, l’identité complète de l’éditeur n’est pas rendue publique : elle a été communiquée à l’hébergeur du site, qui la tient à la disposition de l’autorité judiciaire en cas de besoin.</p>
          <p>Si le site venait à générer des revenus (publicité, parrainage, etc.), cette page serait mise à jour avec l’identité complète de l’éditeur et un directeur de la publication, comme l’exige la loi pour un éditeur professionnel.</p>

          <h2>Hébergement</h2>
          <p>
            Application : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.<br />
            Base de données et fichiers : Supabase, Inc., 970 Toa Payoh North #07-04, Singapour.
          </p>

          <h2>Propriété intellectuelle</h2>
          <p>Les photographies publiées restent la propriété de leurs auteurs, qui déclarent en détenir les droits de diffusion au moment de leur envoi. Toute réutilisation en dehors de Spotride doit obtenir l’accord préalable de l’auteur.</p>

          <h2>Contact</h2>
          <p>Pour toute question relative à ces mentions, au contenu du site ou à vos données personnelles, utilisez la page <Link href="/demande-de-retrait">demande de retrait</Link>. Voir aussi la page <Link href="/confidentialite">confidentialité</Link> pour le détail des données traitées.</p>
        </article>
      </div>
    </main>
  );
}
