import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AuthForm } from "@/features/account/components/auth-form";
import { getAccountState } from "@/features/account/account-session";

export const metadata = { title: "Connexion", robots: { index: false, follow: false } };

export default async function SignInPage() {
  const account = await getAccountState();
  if (account.status === "authenticated") redirect("/mon-espace");

  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>
        <section className="hero">
          <p className="kicker">Votre espace</p>
          <h1>Connexion</h1>
        </section>
        <AuthForm mode="signin" />
        <SiteFooter />
      </div>
    </main>
  );
}
