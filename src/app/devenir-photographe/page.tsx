import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PhotographerSignupForm } from "@/features/photographers/components/photographer-signup-form";

export const metadata = { title: "Devenir photographe référencé", robots: { index: false, follow: false } };

export default function BecomePhotographerPage() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/photographes"><ArrowLeft size={17} /> Retour aux photographes</Link>
        <section className="hero">
          <p className="kicker">Rejoindre l’annuaire</p>
          <h1>Faites découvrir votre travail</h1>
          <p className="lead">Votre profil sera visible par toute personne cherchant un photographe, avec votre présentation, quelques photos et vos réseaux pour vous contacter.</p>
        </section>
        <PhotographerSignupForm />
        <SiteFooter />
      </div>
    </main>
  );
}
