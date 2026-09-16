import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Confirmez votre adresse",
  robots: { index: false, follow: false },
};

export default function SignUpConfirmationPage() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>

        <section className="report-confirmation" aria-live="polite">
          <MailCheck aria-hidden="true" />
          <p className="kicker">Compte créé</p>
          <h1>Confirmez votre adresse</h1>
          <p>
            Un lien vient d’être envoyé à l’adresse que vous venez d’indiquer. Ouvrez-le
            pour activer votre compte : votre fiche photographe y sera rattachée
            automatiquement si elle porte la même adresse.
          </p>
          <p>
            Le message met parfois une minute ou deux à arriver. S’il reste introuvable,
            pensez à regarder dans vos indésirables.
          </p>
          <Link className="button" href="/compte">Revenir à la connexion</Link>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
