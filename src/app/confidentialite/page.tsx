import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <article className="simple-page prose-page">
          <p className="kicker">Version de travail</p>
          <h1>Confidentialité et données personnelles</h1>
          <p className="lead">Cette page décrit les pratiques réellement mises en œuvre par Spotride à ce stade du développement. Sa formulation juridique devra être validée avant la bêta, mais son contenu reflète le fonctionnement effectif du service.</p>

          <h2>Quelles données sont collectées</h2>
          <ul>
            <li>Lorsque vous proposez un spot : votre adresse e-mail (pour confirmer votre envoi et être recontacté), les informations et photos que vous transmettez, et le contenu déclaratif du formulaire (droits sur l’image, présence de personnes reconnaissables, etc.).</li>
            <li>Lorsque vous signalez une fiche ou demandez un retrait : le contenu de votre message et, si vous le fournissez, votre adresse e-mail.</li>
            <li>Aucun compte, cookie de suivi ou identifiant publicitaire n’est utilisé côté visiteur pour la navigation publique de la carte.</li>
          </ul>

          <h2>Photos et métadonnées</h2>
          <p>Les photos envoyées sont retraitées avant publication : leurs métadonnées techniques (dont les données de localisation intégrées au fichier) sont supprimées. Une photo publiée peut être masquée individuellement, sans retirer le reste de la fiche, dès qu’un problème est signalé ou qu’une demande de retrait est acceptée.</p>

          <h2>Durées de conservation</h2>
          <ul>
            <li>Une proposition non confirmée (brouillon, e-mail non vérifié) est supprimée automatiquement 30 jours après son dépôt si elle n’a pas été finalisée.</li>
            <li>Une proposition refusée, en doublon, retirée ou restée sans réponse à une demande de précision est supprimée automatiquement 90 jours après sa clôture.</li>
            <li>Une fiche publiée est revérifiée automatiquement douze mois après sa dernière vérification ; elle n’est jamais supprimée du seul fait de son ancienneté, mais son état passe à « à revérifier » jusqu’à contrôle.</li>
            <li>Ces durées sont réglables et peuvent évoluer ; elles seront documentées ici à jour à chaque changement.</li>
          </ul>

          <h2>Vos droits</h2>
          <p>Vous pouvez à tout moment demander le retrait d’une photo vous concernant ou la suppression des données personnelles que vous avez transmises, que la fiche associée soit déjà publiée ou non, depuis la page <Link href="/demande-de-retrait">demande de retrait</Link>. Chaque demande est examinée individuellement par une personne de l’équipe de modération.</p>

          <h2>Qui a accès aux données</h2>
          <p>Les adresses e-mail, commentaires de signalement et demandes de retrait ne sont visibles que par les personnes disposant d’un accès de modération, protégé par une authentification à deux facteurs. Chaque décision de modération est journalisée à des fins de suivi interne.</p>

          <h2>Hébergement</h2>
          <p>Les données sont hébergées chez Supabase (base de données et fichiers) et l’application est servie par Vercel. Aucune revente ni partage commercial des données personnelles n’est pratiqué.</p>
        </article>
      </div>
    </main>
  );
}
