import type { Metadata } from "next";
import Link from "next/link";
import { Star, ThumbsUp } from "lucide-react";
import { deletePhotographerReviewAction, reviewPhotographerReviewAction } from "@/app/admin/avis/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/confirm-submit-button";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getPendingReviewQueue } from "@/features/admin/photographer-data";

type AdminReviewsPageProps = { searchParams: Promise<{ decision?: string; erreur?: string }> };

export const metadata: Metadata = { title: "Avis photographes" };

export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { decision, erreur } = await searchParams;
  const reviews = await getPendingReviewQueue();

  return (
    <main className="admin-layout">
      <AdminSidebar active="reviews" />
      <section className="admin-content">
        <header>
          <div><p className="kicker">Annuaire public</p><h1>Avis en attente</h1></div>
          <span className="role-chip">{reviews.length} à vérifier</span>
        </header>
        {decision === "supprime" ? <p className="success-message">L’avis a été supprimé définitivement.</p> : null}
        {decision && decision !== "supprime" ? <p className="success-message">L’avis a été traité.</p> : null}
        {erreur ? <p className="form-error" role="alert">Le traitement n’a pas pu être enregistré.</p> : null}
        {reviews.length ? (
          <div className="moderation-list">
            {reviews.map((review) => (
              <article key={review.id}>
                <div className="moderation-list-main">
                  <div className="chip-row">
                    <span className="status-chip">
                      <Star size={13} aria-hidden="true" /> {review.rating}/5
                    </span>
                  </div>
                  <h2>{review.photographerName}</h2>
                  <p>{review.comment}</p>
                </div>
                <div className="moderation-list-meta">
                  <time dateTime={review.createdAt}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.createdAt))}</time>
                  <span>{review.reviewerName ?? "Anonyme"}</span>
                  <div className="review-decision-row">
                    <form action={reviewPhotographerReviewAction} className="review-decision-row">
                      <input type="hidden" name="reviewId" value={review.id} />
                      <input type="hidden" name="photographerSlug" value={review.photographerSlug} />
                      <button className="button button-small" name="moderationState" value="approved" type="submit">Publier</button>
                      <button className="text-decision" name="moderationState" value="rejected" type="submit">Rejeter</button>
                    </form>
                    <form action={deletePhotographerReviewAction}>
                      <input type="hidden" name="reviewId" value={review.id} />
                      <ConfirmSubmitButton
                        label="Supprimer"
                        message="Supprimer définitivement cet avis ? Cette action est irréversible."
                      />
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty"><ThumbsUp /><h2>Aucun avis en attente.</h2><p>Les avis laissés sur les fiches photographe apparaîtront ici.</p></div>
        )}
      </section>
    </main>
  );
}
