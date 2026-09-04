import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock3, MailCheck, RotateCw } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { resendProposalConfirmationAction } from "@/app/proposition-confirmee/actions";

type ConfirmationPageProps = {
  searchParams: Promise<{
    suivi?: string;
    confirme?: string;
    email?: string;
    renvoi?: string;
    jeton?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Suivi de votre proposition",
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const { suivi, confirme, email, renvoi, jeton } = await searchParams;
  const isConfirmed = confirme === "oui";

  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <section className="confirmation-page">
          <span className={`confirmation-icon ${isConfirmed ? "success" : ""}`}>
            {isConfirmed ? <CheckCircle2 /> : <MailCheck />}
          </span>
          <p className="kicker">{isConfirmed ? "Adresse confirmée" : "Une dernière étape"}</p>
          <h1>{isConfirmed ? "Votre proposition rejoint la modération." : "Confirmez votre adresse e-mail."}</h1>
          <p className="lead">
            {isConfirmed
              ? "L'équipe examinera l'accès, les risques, les photos et la précision de la position avant toute publication."
              : email === "echec"
                ? "La proposition est enregistrée, mais l'e-mail n'a pas pu partir. Vous pouvez demander un nouveau lien ci-dessous."
                : "Un lien temporaire vous a été envoyé. Il expire dans 24 heures et ne peut servir qu'une fois."}
          </p>

          {suivi ? <div className="tracking-card"><span>Numéro de suivi</span><strong>{suivi}</strong><small>Conservez-le pour toute demande concernant votre contribution.</small></div> : null}

          {confirme === "erreur" ? <p className="form-error" role="alert">Ce lien est invalide, expiré, déjà utilisé, ou la proposition ne contient pas deux photos valides.</p> : null}
          {renvoi === "oui" ? <p className="success-message">Un nouveau lien vient d&apos;être préparé.</p> : null}
          {renvoi === "attente" ? <p className="form-error">Le numéro, l&apos;adresse ou le délai de renvoi ne correspondent pas. Attendez deux minutes avant un nouvel essai.</p> : null}
          {renvoi === "erreur" ? <p className="form-error">L&apos;e-mail n&apos;a pas pu être envoyé. Votre proposition reste enregistrée.</p> : null}

          {jeton && process.env.NODE_ENV !== "production" && !isConfirmed ? (
            <div className="development-link">
              <strong>Mode local</strong>
              <span>L&apos;envoi Brevo n&apos;est pas configuré. Ce bouton remplace l&apos;e-mail pendant le développement.</span>
              <Link className="button" href={`/proposition-confirmee/verifier?jeton=${encodeURIComponent(jeton)}`}>Ouvrir le lien de confirmation</Link>
            </div>
          ) : null}

          {!isConfirmed ? (
            <details className="resend-card" open={email === "echec" || renvoi === "erreur"}>
              <summary><RotateCw size={16} /> Renvoyer le lien</summary>
              <form action={resendProposalConfirmationAction}>
                <label>Numéro de suivi<input name="trackingId" defaultValue={suivi} placeholder="SPT-XXXXXXXXXX" required /></label>
                <label>Adresse e-mail<input name="email" type="email" required /></label>
                <button className="button button-secondary" type="submit">Renvoyer</button>
              </form>
            </details>
          ) : (
            <div className="moderation-next"><Clock3 /><span><strong>Et maintenant ?</strong> La fiche reste invisible jusqu&apos;à la décision manuelle d&apos;un modérateur.</span></div>
          )}
          <Link className="button button-secondary" href="/">Retour à la carte</Link>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}

