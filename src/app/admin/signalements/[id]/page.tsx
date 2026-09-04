import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { reviewReportAction } from "@/app/admin/signalements/actions";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getReportReview } from "@/features/admin/report-data";
import {
  reportReasonLabels,
  reportStateLabels,
  type ReportReason,
} from "@/features/reports/domain/report";

type ReportReviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
};

const errors: Record<string, string> = {
  validation: "Indiquez une décision avant de terminer le traitement.",
  "deja-traite": "Ce signalement a déjà reçu une décision définitive.",
  traitement: "Le traitement n’a pas pu être enregistré.",
};

export const metadata: Metadata = { title: "Examiner un signalement" };

export default async function ReportReviewPage({ params, searchParams }: ReportReviewPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { id } = await params;
  const { erreur } = await searchParams;
  const report = await getReportReview(id);
  if (!report) notFound();
  const reviewAction = reviewReportAction.bind(null, report.id);
  const isFinal = ["resolved", "dismissed"].includes(report.state);
  const publicSpotVisible = ["published", "sensitive", "review_due"].includes(report.spot.publication_state);

  return (
    <main className="admin-form-page">
      <div className="moderation-review-shell">
        <Link className="back-link" href="/admin/signalements"><ArrowLeft size={17} /> File des signalements</Link>
        <header className="review-heading">
          <div>
            <div className="chip-row"><span className={`priority-chip ${report.priority}`}>{report.priority === "high" ? "Prioritaire" : "Normal"}</span><span className="status-chip">{reportStateLabels[report.state as keyof typeof reportStateLabels] ?? report.state}</span></div>
            <h1>{report.spot.name}</h1>
            <p>{report.spot.municipality} · reçu le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(report.createdAt))}</p>
          </div>
          {publicSpotVisible ? <a className="button button-secondary" href={`/spots/${report.spot.slug}`} target="_blank" rel="noreferrer">Voir la fiche <ExternalLink size={14} /></a> : null}
        </header>
        {erreur ? <p className="form-error" role="alert">{errors[erreur] ?? errors.traitement}</p> : null}

        <div className="review-columns report-review-columns">
          <section className="review-information">
            <h2>Éléments transmis</h2>
            <dl>
              <div><dt>Motif</dt><dd>{reportReasonLabels[report.reason as ReportReason] ?? report.reason}</dd></div>
              <div><dt>Priorité</dt><dd>{report.priority === "high" ? "Haute" : "Normale"}</dd></div>
              <div><dt>État de la fiche</dt><dd>{report.spot.publication_state}</dd></div>
            </dl>
            <h3>Constat du visiteur</h3><p>{report.comment}</p>
            <h3>Contact privé</h3><p>{report.reporterEmail ?? "Aucune adresse fournie"}</p>
            {isFinal ? <><h3>Décision enregistrée</h3><p>{report.decision}</p>{report.internalNote ? <><h3>Note interne</h3><p>{report.internalNote}</p></> : null}</> : null}
          </section>

          <aside className="decision-card">
            {report.priority === "high" ? <AlertTriangle className="danger-icon" /> : <ShieldAlert />}
            <h2>{isFinal ? "Traitement terminé" : "Traiter le signalement"}</h2>
            {isFinal ? (
              <p>Cette décision est définitive. Toute correction ou republication de la fiche reste disponible depuis le catalogue.</p>
            ) : (
              <form action={reviewAction}>
                <p>La prise en charge conserve le signalement dans la file. Une résolution ou un classement sans suite demande une décision explicite.</p>
                <label className="check-row danger-check"><input type="checkbox" name="hideSpot" defaultChecked={report.priority === "high"} /><span>Masquer immédiatement la fiche publique</span></label>
                <label>Décision publique ou motif<textarea name="decision" rows={4} maxLength={1000} placeholder="Correction effectuée, accès confirmé, demande non fondée…" /></label>
                <label>Note interne<textarea name="internalNote" rows={4} maxLength={2000} defaultValue={report.internalNote ?? ""} placeholder="Vérifications ou personnes contactées…" /></label>
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
