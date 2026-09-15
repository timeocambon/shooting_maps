import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { reviewPhotographerAction, setPhotographerPhotoStateAction } from "@/app/admin/photographes/actions";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getPhotographerReview } from "@/features/admin/photographer-data";
import { socialLinkUrl, socialPlatformLabels } from "@/features/photographers/domain/photographer";

type PhotographerReviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
};

const errors: Record<string, string> = {
  validation: "Indiquez une décision avant de terminer le traitement.",
  "deja-traite": "Ce profil a déjà reçu une décision.",
  traitement: "Le traitement n’a pas pu être enregistré.",
};

export const metadata: Metadata = { title: "Examiner un photographe" };

export default async function PhotographerReviewPage({ params, searchParams }: PhotographerReviewPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { id } = await params;
  const { erreur } = await searchParams;
  const photographer = await getPhotographerReview(id);
  if (!photographer) notFound();

  const reviewAction = reviewPhotographerAction.bind(null, photographer.id);
  const isFinal = photographer.publicationState !== "pending";

  return (
    <main className="admin-form-page">
      <div className="moderation-review-shell">
        <Link className="back-link" href="/admin/photographes"><ArrowLeft size={17} /> File des photographes</Link>
        <header className="review-heading">
          <div>
            <div className="chip-row"><span className="status-chip">{photographer.publicationState}</span></div>
            <h1>{photographer.name}</h1>
            <p>{photographer.contactEmail}</p>
          </div>
        </header>
        {erreur ? <p className="form-error" role="alert">{errors[erreur] ?? errors.traitement}</p> : null}

        <div className="review-columns report-review-columns">
          <section className="review-information">
            <h2>Présentation</h2>
            <p><strong>{photographer.tagline}</strong></p>
            <p>{photographer.bio}</p>
            {photographer.locationLabel ? <p>Zone : {photographer.locationLabel}</p> : null}

            <h3>Réseaux</h3>
            <ul>
              {photographer.socials.map((social) => (
                <li key={`${social.platform}-${social.value}`}>
                  {socialPlatformLabels[social.platform]} — <a href={socialLinkUrl(social)} target="_blank" rel="noreferrer">{social.value}</a>
                </li>
              ))}
            </ul>

            <h3>Photos ({photographer.photos.length})</h3>
            <div className="review-photo-grid">
              {photographer.photos.map((photo) => (
                <figure key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.publicUrl} alt="" />
                  {isFinal ? (
                    <form action={setPhotographerPhotoStateAction}>
                      <input type="hidden" name="photoId" value={photo.id} />
                      <input type="hidden" name="photographerId" value={photographer.id} />
                      <input type="hidden" name="moderationState" value={photo.moderationState === "hidden" ? "approved" : "hidden"} />
                      <button className="text-decision" type="submit">{photo.moderationState === "hidden" ? "Réafficher" : "Masquer"}</button>
                    </form>
                  ) : null}
                </figure>
              ))}
            </div>
          </section>

          <aside className="decision-card">
            <ShieldAlert />
            <h2>{isFinal ? "Traitement terminé" : "Valider ce profil"}</h2>
            {isFinal ? (
              <p>Ce profil a déjà été traité. Utilisez les boutons sur chaque photo pour ajuster la galerie publiée.</p>
            ) : (
              <form action={reviewAction}>
                <label>Note interne<textarea name="internalNote" rows={4} maxLength={2000} placeholder="Vérifications effectuées…" /></label>
                <div className="decision-actions">
                  <button className="button" name="decision" value="published" type="submit">Publier</button>
                  <button className="text-decision" name="decision" value="rejected" type="submit">Rejeter</button>
                </div>
              </form>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
