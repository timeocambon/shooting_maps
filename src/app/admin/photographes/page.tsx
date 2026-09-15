import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera } from "lucide-react";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getPhotographerQueue } from "@/features/admin/photographer-data";

type PhotographersQueuePageProps = { searchParams: Promise<{ decision?: string }> };

export const metadata: Metadata = { title: "Photographes" };

export default async function AdminPhotographersPage({ searchParams }: PhotographersQueuePageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { decision } = await searchParams;
  const photographers = await getPhotographerQueue();

  return (
    <main className="admin-layout">
      <AdminSidebar active="photographers" />
      <section className="admin-content">
        <header>
          <div><p className="kicker">Annuaire public</p><h1>Photographes</h1></div>
          <span className="role-chip">{photographers.length} en attente</span>
        </header>
        {decision ? <p className="success-message">La décision a été enregistrée.</p> : null}
        {photographers.length ? (
          <div className="moderation-list">
            {photographers.map((photographer) => (
              <article key={photographer.id}>
                <div className="moderation-list-main">
                  <div className="chip-row"><span className="status-chip">{photographer.photoCount} photo{photographer.photoCount > 1 ? "s" : ""}</span></div>
                  <h2>{photographer.name}</h2>
                  <p>{photographer.tagline}</p>
                </div>
                <div className="moderation-list-meta">
                  <time dateTime={photographer.createdAt}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(photographer.createdAt))}</time>
                  <span>{photographer.contactEmail}</span>
                  <Link href={`/admin/photographes/${photographer.id}`}>Examiner <ArrowRight size={16} /></Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty"><Camera /><h2>Aucune inscription en attente.</h2><p>Les demandes envoyées depuis la page publique apparaîtront ici.</p></div>
        )}
      </section>
    </main>
  );
}
