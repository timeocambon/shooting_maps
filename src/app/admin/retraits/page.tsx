import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, Image as ImageIcon, MapPin, ShieldCheck } from "lucide-react";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getWithdrawalQueue } from "@/features/admin/withdrawal-data";
import { withdrawalKindLabels, withdrawalStateLabels } from "@/features/withdrawals/domain/withdrawal";

type WithdrawalsPageProps = { searchParams: Promise<{ decision?: string }> };

export const metadata: Metadata = { title: "Demandes de retrait" };

export default async function WithdrawalsPage({ searchParams }: WithdrawalsPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { decision } = await searchParams;
  const requests = await getWithdrawalQueue();

  return (
    <main className="admin-layout">
      <AdminSidebar active="withdrawals" />
      <section className="admin-content">
        <header>
          <div><p className="kicker">Droits sur les images et les données</p><h1>Demandes de retrait</h1></div>
          <span className="role-chip">{requests.length} en attente</span>
        </header>
        {decision ? <p className="success-message">La décision a été enregistrée dans l’historique de modération.</p> : null}

        {requests.length ? (
          <div className="admin-card-grid">
            {requests.map((request) => (
              <article key={request.id} className="admin-card">
                <div className="admin-card-visual admin-card-visual-icon" aria-hidden="true">
                  {request.kind === "photo" ? <ImageIcon /> : <FileText />}
                </div>

                <div className="chip-row">
                  <span className="status-chip">{withdrawalKindLabels[request.kind]}</span>
                  <span className="status-chip">
                    {withdrawalStateLabels[request.state as keyof typeof withdrawalStateLabels] ?? request.state}
                  </span>
                </div>

                <h2>{request.spot ? request.spot.name : "Aucune fiche associée"}</h2>
                <p className="admin-card-tagline">
                  {request.description.length > 140 ? `${request.description.slice(0, 140)}…` : request.description}
                </p>

                <div className="admin-card-meta">
                  {request.spot ? (
                    <span><MapPin size={13} aria-hidden="true" /> {request.spot.municipality}</span>
                  ) : (
                    <span>Demande de suppression de données</span>
                  )}
                  <time dateTime={request.createdAt}>
                    Reçue le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.createdAt))}
                  </time>
                </div>

                <div className="admin-card-actions">
                  <Link className="button button-small" href={`/admin/retraits/${request.id}`}>
                    Examiner <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty">
            <ShieldCheck />
            <h2>Aucune demande de retrait ouverte.</h2>
            <p>Les demandes envoyées depuis la page publique apparaîtront ici.</p>
            <Link className="button button-secondary" href="/admin/spots">Consulter le catalogue</Link>
          </div>
        )}
      </section>
    </main>
  );
}
