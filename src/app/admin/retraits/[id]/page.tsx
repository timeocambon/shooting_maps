import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { reviewWithdrawalRequestAction } from "@/app/admin/retraits/actions";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getWithdrawalReview } from "@/features/admin/withdrawal-data";
import { withdrawalKindLabels, withdrawalStateLabels } from "@/features/withdrawals/domain/withdrawal";

type WithdrawalReviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
};

const errors: Record<string, string> = {
  validation: "Indiquez une décision avant de terminer le traitement.",
  "deja-traite": "Cette demande a déjà reçu une décision définitive.",
  photo: "La photo sélectionnée n’appartient pas à la fiche associée.",
  traitement: "Le traitement n’a pas pu être enregistré.",
};

export const metadata: Metadata = { title: "Examiner une demande de retrait" };

export default async function WithdrawalReviewPage({ params, searchParams }: WithdrawalReviewPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { id } = await params;
  const { erreur } = await searchParams;
  const request = await getWithdrawalReview(id);
  if (!request) notFound();
  const reviewAction = reviewWithdrawalRequestAction.bind(null, request.id);
  const isFinal = ["resolved", "dismissed"].includes(request.state);
  const publicSpotVisible = request.spot
    ? ["published", "sensitive", "review_due"].includes(request.spot.publication_state)
    : false;

  return (
    <main className="admin-form-page">
      <div className="moderation-review-shell">
        <Link className="back-link" href="/admin/retraits"><ArrowLeft size={17} /> File des demandes de retrait</Link>
        <header className="review-heading">
          <div>
            <div className="chip-row"><span className="status-chip">{withdrawalKindLabels[request.kind]}</span><span className="status-chip">{withdrawalStateLabels[request.state as keyof typeof withdrawalStateLabels] ?? request.state}</span></div>
            <h1>{request.spot ? request.spot.name : "Aucune fiche associée"}</h1>
            <p>{request.spot ? `${request.spot.municipality} · ` : ""}reçue le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(request.createdAt))}</p>
          </div>
          {publicSpotVisible && request.spot ? <a className="button button-secondary" href={`/spots/${request.spot.slug}`} target="_blank" rel="noreferrer">Voir la fiche <ExternalLink size={14} /></a> : null}
        </header>
        {erreur ? <p className="form-error" role="alert">{errors[erreur] ?? errors.traitement}</p> : null}

        <div className="review-columns report-review-columns">
          <section className="review-information">
            <h2>Éléments transmis</h2>
            <dl>
              <div><dt>Type</dt><dd>{withdrawalKindLabels[request.kind]}</dd></div>
              {request.trackingId ? <div><dt>Référence de proposition</dt><dd>{request.trackingId}</dd></div> : null}
              {request.spot ? <div><dt>État de la fiche</dt><dd>{request.spot.publication_state}</dd></div> : null}
            </dl>
            <h3>Demande</h3><p>{request.description}</p>
            <h3>Contact</h3><p>{request.requesterEmail}</p>
            {isFinal ? <><h3>Décision enregistrée</h3><p>{request.decision}</p>{request.internalNote ? <><h3>Note interne</h3><p>{request.internalNote}</p></> : null}</> : null}
          </section>

          <aside className="decision-card">
            <ShieldAlert />
            <h2>{isFinal ? "Traitement terminé" : "Traiter la demande"}</h2>
            {isFinal ? (
              <p>Cette décision est définitive. Toute correction reste possible depuis le catalogue ou la fiche photo concernée.</p>
            ) : (
              <form action={reviewAction}>
                <p>La prise en charge conserve la demande dans la file. Une résolution ou un classement sans suite demande une décision explicite.</p>
                {request.spotPhotos.length ? (
                  <label>
                    Masquer une photo précise <span>facultatif</span>
                    <select name="hidePhotoId" defaultValue="">
                      <option value="">Aucune</option>
                      {request.spotPhotos.map((photo) => (
                        <option key={photo.id} value={photo.id} disabled={photo.moderationState === "hidden"}>
                          Photo {photo.displayOrder + 1} {photo.moderationState === "hidden" ? "(déjà masquée)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {request.spot ? (
                  <label className="check-row danger-check"><input type="checkbox" name="hideSpot" /><span>Masquer immédiatement toute la fiche</span></label>
                ) : null}
                <label>Décision ou réponse au demandeur<textarea name="decision" rows={4} maxLength={1000} placeholder="Photo retirée, données supprimées, demande déjà satisfaite…" /></label>
                <label>Note interne<textarea name="internalNote" rows={4} maxLength={2000} defaultValue={request.internalNote ?? ""} placeholder="Vérifications effectuées…" /></label>
                <div className="decision-actions">
                  <button className="button" name="nextState" value="in_review" type="submit">Prendre en charge</button>
                  <button className="button button-secondary" name="nextState" value="resolved" type="submit">Marquer comme résolu</button>
                  <button className="text-decision" name="nextState" value="dismissed" type="submit">Classer sans suite</button>
                </div>
              </form>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
