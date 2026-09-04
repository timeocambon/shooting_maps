import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProposalWizard } from "@/features/proposals/components/proposal-wizard";
import { getMapStyleUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Proposer un spot",
  description: "Partagez un lieu adapté aux shootings photo moto autour de Toulouse.",
  robots: { index: false, follow: false },
};

export default function ProposePage() {
  return (
    <main>
      <div className="content-shell contribution-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <header className="contribution-heading">
          <div>
            <p className="kicker">Contribution vérifiée avant publication</p>
            <h1>Partagez un décor qui mérite d&apos;être connu.</h1>
          </div>
          <p>Comptez environ cinq minutes. Votre brouillon textuel reste sur cet appareil pendant sept jours et aucune proposition n&apos;est publiée automatiquement.</p>
        </header>
        <ProposalWizard mapStyleUrl={getMapStyleUrl()} />
        <SiteFooter />
      </div>
    </main>
  );
}
