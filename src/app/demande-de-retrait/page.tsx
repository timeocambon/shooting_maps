import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WithdrawalForm } from "@/features/withdrawals/components/withdrawal-form";

export const metadata: Metadata = {
  title: "Demande de retrait",
  description: "Demandez le retrait d’une photo ou la suppression de vos données personnelles.",
  robots: { index: false, follow: false },
};

export default function WithdrawalRequestPage() {
  return (
    <main>
      <div className="content-shell report-shell">
        <SiteHeader />
        <Link className="back-link" href="/">
          <ArrowLeft size={17} aria-hidden="true" /> Retour à la carte
        </Link>
        <header className="report-heading">
          <div>
            <p className="kicker">Droits sur vos images et vos données</p>
            <h1>Demander un retrait</h1>
          </div>
          <p>Vous pouvez demander le retrait d’une photo déjà publiée ou envoyée, ou la suppression des données personnelles que vous nous avez transmises. Chaque demande est examinée par une personne, pas automatiquement.</p>
        </header>
        <WithdrawalForm />
        <SiteFooter />
      </div>
    </main>
  );
}
