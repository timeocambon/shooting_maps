import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getReportQueue } from "@/features/admin/report-data";
import {
  reportReasonLabels,
  reportStateLabels,
  type ReportReason,
} from "@/features/reports/domain/report";

type ReportsPageProps = { searchParams: Promise<{ decision?: string }> };

export const metadata: Metadata = { title: "Signalements à traiter" };

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { decision } = await searchParams;
  const reports = await getReportQueue();
  const priorityCount = reports.filter((report) => report.priority === "high").length;

  return (
    <main className="admin-layout">
      <AdminSidebar active="reports" />
      <section className="admin-content">
        <header>
          <div><p className="kicker">Sécurité et exactitude</p><h1>Signalements à traiter</h1></div>
          <span className="role-chip">{priorityCount} prioritaire{priorityCount > 1 ? "s" : ""}</span>
        </header>
        {decision ? <p className="success-message">La décision a été enregistrée dans l’historique de modération.</p> : null}
        {reports.length ? (
          <div className="moderation-list">
            {reports.map((report) => (
              <article key={report.id} className={report.priority === "high" ? "priority-row" : ""}>
                <div className="moderation-list-main">
                  <div className="chip-row">
                    <span className={`priority-chip ${report.priority}`}>{report.priority === "high" ? "Prioritaire" : "Normal"}</span>
                    <span className="status-chip">{reportStateLabels[report.state as keyof typeof reportStateLabels] ?? report.state}</span>
                  </div>
                  <h2>{report.spot.name}</h2>
                  <p>{reportReasonLabels[report.reason as ReportReason] ?? report.reason} · {report.spot.municipality}</p>
                </div>
                <div className="moderation-list-meta">
                  <time dateTime={report.createdAt}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.createdAt))}</time>
                  <span>{report.comment.length > 72 ? `${report.comment.slice(0, 72)}…` : report.comment}</span>
                  <Link href={`/admin/signalements/${report.id}`}>Examiner <ArrowRight size={16} /></Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty"><ShieldCheck /><h2>Aucun signalement ouvert.</h2><p>Les motifs sensibles remonteront automatiquement en tête de cette file.</p><Link className="button button-secondary" href="/admin/spots">Consulter le catalogue</Link></div>
        )}
        {priorityCount ? <p className="queue-warning"><AlertTriangle size={17} /> Les fiches concernées peuvent être masquées dès la prise en charge.</p> : null}
      </section>
    </main>
  );
}
