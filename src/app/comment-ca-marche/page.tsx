import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Compass,
  Link2,
  MapPin,
  Navigation,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Comment ça marche",
  description:
    "Lire la carte, filtrer les spots, comprendre une fiche et préparer votre sortie photo à moto.",
};

const steps = [
  {
    icon: MapPin,
    title: "Repérez un spot sur la carte",
    body: "Chaque pastille est un lieu vérifié. Cliquez dessus et la fiche correspondante remonte en haut de la liste ; cliquez sur une carte de la liste et le point se centre. Les deux restent toujours synchronisés.",
  },
  {
    icon: SlidersHorizontal,
    title: "Affinez avec les filtres",
    body: "L'ambiance trie par type de décor : urbain, industriel, architecture, nature, panorama, graffiti. Le champ de recherche accepte un nom de spot comme une commune. Le bouton « Autour de moi » demande votre position pour classer les lieux par distance — il ne s'active que si vous le déclenchez vous-même.",
  },
  {
    icon: Clock3,
    title: "Lisez la fiche avant de partir",
    body: "Une fiche indique le meilleur moment de la journée, le niveau d'accès, le type de sol, la fréquentation, le stationnement et l'approche à pied. La date de dernière vérification vous dit à quel point l'information est fraîche.",
  },
  {
    icon: Navigation,
    title: "Ouvrez l'itinéraire",
    body: "Le bouton d'itinéraire passe la main à votre application de navigation. Les avertissements éventuels s'affichent avant : lisez-les, ils décrivent des situations rencontrées sur place.",
  },
  {
    icon: Link2,
    title: "Partagez une zone",
    body: "L'adresse de la page contient la zone affichée et vos filtres. Copiez-la et envoyez-la : la personne en face ouvrira exactement la même vue que vous.",
  },
];

export default function HowItWorksPage() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>

        <article className="simple-page prose-page">
          <p className="kicker">Prise en main</p>
          <h1>Trouver un décor, en deux minutes.</h1>
          <p className="lead">
            Spotride réunit des lieux repérés pour la photo moto, avec ce qu&apos;il faut savoir
            avant de s&apos;y rendre : la lumière, l&apos;accès, le stationnement et les précautions.
          </p>

          <ol className="howto-steps">
            {steps.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="howto-icon" aria-hidden="true"><Icon size={19} /></span>
                <div>
                  <h2>{title}</h2>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>

          <h2>Point exact ou zone approximative ?</h2>
          <p>
            Certaines fiches affichent un point précis, d&apos;autres une zone. Ce n&apos;est pas un
            manque de précision : quand un lieu est fragile, privé ou susceptible d&apos;être dégradé
            par l&apos;affluence, sa position exacte n&apos;est volontairement pas publiée. La mention
            apparaît sous le nom de la commune.
          </p>

          <h2>Avant de rouler</h2>
          <p>
            Aucun spot ne justifie une intrusion, un arrêt dangereux ou une gêne pour les riverains.
            Un lieu accessible aujourd&apos;hui peut être fermé demain : si vous constatez un
            changement, signalez-le depuis la fiche, ça profite à tout le monde. Le détail de nos
            règles est sur la <Link href="/charte">charte</Link>.
          </p>

          <div className="howto-cta">
            <Link className="button" href="/"><Compass size={17} aria-hidden="true" /> Explorer la carte</Link>
            <Link className="button button-secondary" href="/proposer">Proposer un spot</Link>
          </div>

          <p className="howto-footnote">
            <ShieldCheck size={15} aria-hidden="true" />
            Chaque spot est relu par une personne avant publication.
          </p>
        </article>

        <SiteFooter />
      </div>
    </main>
  );
}
