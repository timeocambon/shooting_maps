import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
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
          <div className="moderation-list">
            {requests.map((request) => (
              <article key={request.id}>
                <div className="moderation-list-main">
                  <div className="chip-row">
                    <span className="status-chip">{withdrawalKindLabels[request.kind]}</span>
                    <span className="status-chip">{withdrawalStateLabels[request.state as keyof typeof withdrawalStateLabels] ?? request.state}</span>
                  </div>
                  <h2>{request.spot ? request.spot.name : "Aucune fiche associée"}</h2>
                  <p>{request.spot ? `${request.spot.municipality}` : "Demande de suppression de données"}</p>
                </div>
                <div className="moderation-list-meta">
                  <time dateTime={request.createdAt}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.createdAt))}</time>
                  <span>{request.description.length > 72 ? `${request.description.slice(0, 72)}…` : request.description}</span>
                  <Link href={`/admin/retraits/${request.id}`}>Examiner <ArrowRight size={16} /></Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty"><ShieldCheck /><h2>Aucune demande de retrait ouverte.</h2><p>Les demandes envoyées depuis la page publique apparaîtront ici.</p><Link className="button button-secondary" href="/admin/spots">Consulter le catalogue</Link></div>
        )}
      </section>
    </main>
  );
}
