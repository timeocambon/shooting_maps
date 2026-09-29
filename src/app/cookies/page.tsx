import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Cookies et traceurs",
  description: "Les cookies déposés par Spotride, leur finalité, leur durée, et pourquoi aucun bandeau de consentement n'est affiché.",
};

export default function CookiesPage() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <article className="simple-page prose-page">
          <p className="kicker">Traceurs</p>
          <h1>Cookies et traceurs</h1>
          <p className="lead">
            Spotride ne dépose aucun cookie publicitaire, aucun traceur entre sites et aucun
            identifiant de profilage. Cette page liste ce qui est réellement déposé, et pourquoi
            aucun bandeau ne vous est présenté.
          </p>

          <h2>Ce qui est déposé, et seulement dans ces cas</h2>
          <h3>Si vous créez un compte ou vous connectez</h3>
          <p>
            Des cookies de session sont déposés par Supabase, le service qui gère
            l&apos;authentification. Ils vous maintiennent connecté d&apos;une page à l&apos;autre et
            permettent de renouveler votre session. Ils expirent à la déconnexion ou après une
            période d&apos;inactivité. Sans eux, il serait impossible de rester identifié : ils sont
            strictement nécessaires au service que vous avez demandé.
          </p>

          <h3>Si vous utilisez certaines fonctions du site</h3>
          <p>
            Deux informations sont conservées par votre navigateur, dans son stockage local, et ne
            sont jamais transmises au serveur :
          </p>
          <ul>
            <li>
              le <strong>brouillon d&apos;une proposition de spot</strong> en cours, pour que vous
              puissiez reprendre là où vous en étiez. Il est effacé sept jours après sa dernière
              modification, ou dès l&apos;envoi de la proposition ;
            </li>
            <li>
              le fait que vous ayez <strong>fermé l&apos;encart d&apos;aide</strong> affiché
              au-dessus de la carte, pour ne pas vous le représenter.
            </li>
          </ul>
          <p>
            Ces éléments sont propres à chaque navigateur et à chaque appareil. Vider les données de
            navigation les supprime.
          </p>

          <h2>Ce qui n&apos;est pas déposé</h2>
          <p>
            Aucune régie publicitaire, aucun bouton de partage de réseau social, aucune vidéo
            intégrée, aucun outil de mesure d&apos;audience tiers. La consultation de la carte,
            sans compte, ne dépose rien.
          </p>

          <h2>Les services tiers sollicités par votre navigateur</h2>
          <p>
            Certains contenus proviennent d&apos;autres serveurs, qui reçoivent alors votre adresse
            IP — c&apos;est le fonctionnement même du web, et non un traceur :
          </p>
          <ul>
            <li>
              <strong>OpenStreetMap</strong> fournit les fonds de carte. Chaque tuile affichée est
              chargée depuis ses serveurs.
            </li>
            <li>
              <strong>Supabase</strong> héberge les photos publiées, chargées depuis son stockage.
            </li>
            <li>
              <strong>Vercel</strong> sert le site lui-même.
            </li>
          </ul>
          <p>
            Les liens vers les réseaux sociaux des photographes et le bouton d&apos;itinéraire ne se
            déclenchent qu&apos;à votre clic, et vous emmènent alors sur des sites tiers soumis à
            leurs propres règles.
          </p>

          <h2>Pourquoi aucun bandeau de consentement</h2>
          <p>
            Le consentement préalable est exigé pour les traceurs qui ne sont pas strictement
            nécessaires au service demandé : publicité, mesure d&apos;audience à des fins
            commerciales, suivi entre sites. Spotride n&apos;en utilise aucun. Les cookies de session
            et le stockage local décrits ci-dessus relèvent de l&apos;exemption prévue pour les
            traceurs nécessaires au fonctionnement demandé par l&apos;utilisateur.
          </p>
          <p>
            Si un outil de mesure d&apos;audience venait à être ajouté, il resterait limité à des
            statistiques agrégées, sans cookie ni identification individuelle. Un bandeau serait mis
            en place si cette limite devait être dépassée, et cette page serait mise à jour.
          </p>

          <h2>Comment les refuser malgré tout</h2>
          <p>
            Tous les navigateurs permettent de bloquer ou supprimer les cookies et le stockage
            local, site par site, dans leurs paramètres de confidentialité. Refuser les cookies de
            session vous empêchera simplement de rester connecté à votre compte ; la carte et les
            fiches resteront consultables.
          </p>
          <p>
            Le détail des données personnelles traitées figure dans la{" "}
            <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </article>
        <SiteFooter />
      </div>
    </main>
  );
}
