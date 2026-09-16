import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AuthForm } from "@/features/account/components/auth-form";
import { getAccountState } from "@/features/account/account-session";

export const metadata = { title: "Créer un compte", robots: { index: false, follow: false } };

export default async function SignUpPage() {
  const account = await getAccountState();
  if (account.status === "authenticated") redirect("/mon-espace");

  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <section className="hero">
          <p className="kicker">Rejoindre Spotride</p>
          <h1>Créer votre compte</h1>
          <p className="lead">Un compte vous permet de gérer votre fiche photographe et de retrouver vos contributions.</p>
        </section>
        <AuthForm mode="signup" />
        <SiteFooter />
      </div>
    </main>
  );
}
