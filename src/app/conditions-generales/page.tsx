import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: "Les règles d'utilisation de Spotride : ce que le service propose, ce qu'il attend de vous, et les responsabilités de chacun.",
};

export default function TermsPage() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <article className="simple-page prose-page">
          <p className="kicker">Règles d&apos;utilisation</p>
          <h1>Conditions générales d&apos;utilisation</h1>
          <p className="lead">
            Ces conditions s&apos;appliquent à toute personne qui consulte Spotride, y propose un
            spot, y publie une fiche photographe ou y dépose un avis. Les utiliser, c&apos;est les
            accepter.
          </p>

          <h2>Ce qu&apos;est Spotride</h2>
          <p>
            Spotride est un annuaire de lieux repérés pour la photographie de moto, alimenté par
            ses utilisateurs et relu avant publication. Le service est <strong>gratuit</strong> :
            aucune fonctionnalité n&apos;est payante, aucun paiement n&apos;est encaissé, aucune
            transaction n&apos;a lieu sur le site. Il n&apos;y a donc ni commande, ni facturation,
            ni remboursement possible.
          </p>
          <p>
            Consulter la carte ne demande aucun compte. Un compte n&apos;est nécessaire que pour
            gérer une fiche photographe.
          </p>

          <h2>Ce que vous vous engagez à respecter</h2>
          <ul>
            <li>Ne proposer aucun lieu dont l&apos;accès suppose une intrusion, une effraction ou une infraction.</li>
            <li>Décrire honnêtement les risques, restrictions et nuisances d&apos;un lieu.</li>
            <li>Ne publier que des images dont vous détenez les droits, ou dont la diffusion vous a été autorisée.</li>
            <li>Ne pas publier de contenu injurieux, diffamatoire, trompeur ou publicitaire.</li>
            <li>Ne pas déposer d&apos;avis sur votre propre fiche photographe, ni d&apos;avis fictif.</li>
          </ul>
          <p>
            La <Link href="/charte">charte de contribution</Link> détaille ces attentes. Elle fait
            partie des présentes conditions.
          </p>

          <h2>Publication et modération</h2>
          <p>
            Toute contribution est relue avant d&apos;être visible. Une proposition peut être
            acceptée, corrigée, refusée, ou publiée avec une position volontairement approximative
            lorsque le lieu est fragile ou sensible. Une fiche déjà en ligne peut être masquée ou
            archivée à tout moment, notamment à la suite d&apos;un signalement ou d&apos;une demande
            de retrait. Ces décisions sont prises au cas par cas et journalisées.
          </p>
          <p>
            Aucune publication n&apos;est due : le refus d&apos;une contribution n&apos;a pas à être
            motivé au-delà de l&apos;information donnée à son auteur.
          </p>

          <h2>Vos contenus restent les vôtres</h2>
          <p>
            Vous conservez l&apos;intégralité de vos droits sur les textes et photographies que vous
            transmettez. En les publiant sur Spotride, vous accordez au site le droit de les
            afficher, de les redimensionner et de les recadrer pour les besoins de l&apos;affichage,
            pour la durée de leur mise en ligne. Cette autorisation cesse dès leur retrait.
          </p>
          <p>
            Vous pouvez demander à tout moment le retrait d&apos;une photo ou d&apos;une fiche
            depuis la page <Link href="/demande-de-retrait">demande de retrait</Link>.
          </p>

          <h2>Responsabilité</h2>
          <p>
            Les informations publiées sont déclaratives et peuvent devenir obsolètes : un accès
            autorisé hier peut être fermé aujourd&apos;hui. Elles sont fournies à titre indicatif et
            ne remplacent ni le code de la route, ni la signalisation sur place, ni l&apos;accord du
            propriétaire d&apos;un lieu privé.
          </p>
          <p>
            Vous restez seul responsable de votre conduite, de votre sécurité et du respect des
            règles applicables sur les lieux où vous vous rendez. Spotride ne saurait être tenu
            responsable d&apos;un dommage résultant de l&apos;usage des informations publiées.
          </p>
          <p>
            Le service est fourni en l&apos;état, sans garantie de disponibilité continue. Il peut
            être interrompu, modifié ou arrêté, y compris définitivement.
          </p>

          <h2>Comptes</h2>
          <p>
            Vous êtes responsable de la confidentialité de votre mot de passe et des actions
            effectuées depuis votre compte. Vous pouvez supprimer votre compte et votre fiche
            photographe depuis votre espace personnel. Un compte peut être suspendu en cas de
            manquement grave ou répété aux présentes conditions.
          </p>

          <h2>Évolution et droit applicable</h2>
          <p>
            Ces conditions peuvent être modifiées. La version en vigueur est celle publiée sur cette
            page. Elles sont soumises au droit français. En cas de litige, une solution amiable sera
            recherchée avant toute action contentieuse.
          </p>
          <p>
            Pour toute question, utilisez la page{" "}
            <Link href="/demande-de-retrait">demande de retrait et contact</Link>. Les informations
            sur l&apos;éditeur figurent dans les{" "}
            <Link href="/mentions-legales">mentions légales</Link>, et le traitement de vos données
            dans la <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </article>
        <SiteFooter />
      </div>
    </main>
  );
}
