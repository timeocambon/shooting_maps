import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getModerationQueue } from "@/features/admin/moderation-data";
import { proposalStateLabels } from "@/features/proposals/domain/proposal";

type QueuePageProps = { searchParams: Promise<{ decision?: string }> };

export const metadata: Metadata = { title: "Propositions à modérer" };

export default async function ProposalsPage({ searchParams }: QueuePageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { decision } = await searchParams;
  const proposals = await getModerationQueue();

  return (
    <main className="admin-layout">
      <AdminSidebar active="proposals" />
      <section className="admin-content">
        <header><div><p className="kicker">File de modération</p><h1>Propositions à vérifier</h1></div><span className="role-chip">{proposals.length} en attente</span></header>
        {decision ? <p className="success-message">La décision a été enregistrée et le journal de modération mis à jour.</p> : null}
        {proposals.length ? (
          <div className="moderation-list">
            {proposals.map((proposal) => (
              <article key={proposal.id}>
                <div className="moderation-list-main"><span className="status-chip">{proposalStateLabels[proposal.state as keyof typeof proposalStateLabels] ?? proposal.state}</span><h2>{proposal.name}</h2><p>{proposal.municipality} · {proposal.photoCount} photo{proposal.photoCount > 1 ? "s" : ""}</p></div>
                <div className="moderation-list-meta"><span>{proposal.trackingId}</span><time dateTime={proposal.submittedAt ?? undefined}>{proposal.submittedAt ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(proposal.submittedAt)) : "Sans date"}</time><Link href={`/admin/propositions/${proposal.id}`}>Examiner <ArrowRight size={16} /></Link></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty"><Inbox /><h2>La file est vide.</h2><p>Les propositions apparaissent ici uniquement après confirmation de l&apos;adresse e-mail.</p><Link className="button button-secondary" href="/proposer">Tester une contribution</Link></div>
        )}
      </section>
    </main>
  );
}

