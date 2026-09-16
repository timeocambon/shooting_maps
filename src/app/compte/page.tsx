import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AuthPanel } from "@/features/account/components/auth-panel";
import { getAccountState } from "@/features/account/account-session";

export const metadata = { title: "Connexion ou création de compte", robots: { index: false, follow: false } };

type AccountPageProps = { searchParams: Promise<{ mode?: string; confirmation?: string }> };

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const account = await getAccountState();
  if (account.status === "authenticated") redirect("/mon-espace");

  const { mode, confirmation } = await searchParams;

  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <section className="hero">
          <p className="kicker">Votre espace</p>
          <h1>Connexion</h1>
          <p className="lead">Connectez-vous ou créez un compte pour gérer votre fiche photographe.</p>
        </section>
        {confirmation === "echec" ? (
          <p className="form-error" role="alert">
            Ce lien de confirmation est invalide ou a expiré. Recréez un compte avec la même
            adresse pour en recevoir un nouveau.
          </p>
        ) : null}
        <AuthPanel defaultMode={mode === "inscription" ? "signup" : "signin"} />
        <SiteFooter />
      </div>
    </main>
  );
}
