import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Camera, ShieldCheck, SquarePen } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { signOutAccountAction } from "@/app/compte/actions";
import { DisplayNameForm } from "@/features/account/components/display-name-form";
import { getAccountState, getMyPhotographerProfile } from "@/features/account/account-session";

export const metadata = { title: "Mon espace", robots: { index: false, follow: false } };

const stateLabels: Record<string, string> = {
  pending: "En attente de validation",
  published: "Publiée",
  rejected: "Refusée",
  hidden: "Masquée",
};

export default async function MySpacePage() {
  const account = await getAccountState();
  if (account.status !== "authenticated") redirect("/compte");

  const photographer = await getMyPhotographerProfile();

  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à la carte</Link>

        <section className="hero">
          <p className="kicker">Mon espace</p>
          <h1>Bonjour{account.displayName ? ` ${account.displayName}` : ""}</h1>
          <p className="lead">{account.email}</p>
          <DisplayNameForm displayName={account.displayName} />
        </section>

        <div className="account-cards">
          <article className="account-card">
            <Camera aria-hidden="true" />
            <h2>Ma fiche photographe</h2>
            {photographer ? (
              <>
                <p>
                  <strong>{photographer.name}</strong>
                  <br />
                  <span className="status-chip">{stateLabels[photographer.publicationState] ?? photographer.publicationState}</span>
                </p>
                <div className="account-card-actions">
                  <Link className="button" href="/mon-espace/fiche"><SquarePen size={16} aria-hidden="true" /> Modifier ma fiche</Link>
                  {photographer.publicationState === "published" ? (
                    <Link className="button button-secondary" href={`/photographes/${photographer.slug}`}>Voir ma page publique</Link>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <p>Vous n’avez pas encore de fiche. Créez-la pour apparaître dans l’annuaire des photographes.</p>
                <div className="account-card-actions">
                  <Link className="button" href="/devenir-photographe">Créer ma fiche</Link>
                </div>
              </>
            )}
          </article>

          {account.isAdmin ? (
            <article className="account-card">
              <ShieldCheck aria-hidden="true" />
              <h2>Administration</h2>
              <p>Votre compte dispose d’un rôle de modération.</p>
              <div className="account-card-actions">
                <Link className="button button-secondary" href="/admin">Ouvrir l’administration</Link>
              </div>
            </article>
          ) : null}
        </div>

        <form action={signOutAccountAction} className="account-signout">
          <button className="text-decision" type="submit">Se déconnecter</button>
        </form>

        <SiteFooter />
      </div>
    </main>
  );
}
