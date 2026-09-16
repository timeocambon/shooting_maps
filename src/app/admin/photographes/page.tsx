import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, Eye, EyeOff, Mail, UserCheck } from "lucide-react";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getAllPhotographers, type AdminPhotographerRow } from "@/features/admin/photographer-data";
import { setPhotographerStateAction } from "@/app/admin/photographes/actions";

type PhotographersPageProps = { searchParams: Promise<{ decision?: string }> };

export const metadata: Metadata = { title: "Photographes" };

const stateLabels: Record<string, string> = {
  pending: "En attente",
  published: "Publiée",
  hidden: "Masquée",
  rejected: "Refusée",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function PhotographerCard({ photographer }: { photographer: AdminPhotographerRow }) {
  const isPending = photographer.publicationState === "pending";
  const isPublished = photographer.publicationState === "published";
  const isHidden = photographer.publicationState === "hidden";

  return (
    <article className="admin-card">
      <div className="admin-card-visual" aria-hidden="true">
        {photographer.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photographer.coverUrl} alt="" />
        ) : (
          <Camera />
        )}
      </div>

      <div className="chip-row">
        <span className="status-chip">{stateLabels[photographer.publicationState] ?? photographer.publicationState}</span>
        <span className="status-chip">{photographer.photoCount} photo{photographer.photoCount > 1 ? "s" : ""}</span>
        {photographer.hasOwner ? (
          <span className="status-chip"><UserCheck size={12} aria-hidden="true" /> Compte lié</span>
        ) : null}
      </div>

      <h2>{photographer.name}</h2>
      <p className="admin-card-tagline">{photographer.tagline}</p>

      <div className="admin-card-meta">
        <span><Mail size={13} aria-hidden="true" /> {photographer.contactEmail}</span>
        <time dateTime={photographer.createdAt}>Inscrite le {formatDate(photographer.createdAt)}</time>
      </div>

      <div className="admin-card-actions">
        <Link className={isPending ? "button button-small" : "button button-small button-secondary"} href={`/admin/photographes/${photographer.id}`}>
          {isPending ? "Examiner" : "Détail"} <ArrowRight size={15} aria-hidden="true" />
        </Link>

        {isPublished || isHidden ? (
          <form action={setPhotographerStateAction}>
            <input type="hidden" name="photographerId" value={photographer.id} />
            <input type="hidden" name="state" value={isPublished ? "hidden" : "published"} />
            <button className="text-decision" type="submit">
              {isPublished ? <><EyeOff size={14} aria-hidden="true" /> Masquer</> : <><Eye size={14} aria-hidden="true" /> Republier</>}
            </button>
          </form>
        ) : null}

        {isPublished ? (
          <a className="text-decision" href={`/photographes/${photographer.slug}`} target="_blank" rel="noreferrer">
            Voir la page
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default async function AdminPhotographersPage({ searchParams }: PhotographersPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { decision } = await searchParams;
  const photographers = await getAllPhotographers();
  const pending = photographers.filter((item) => item.publicationState === "pending");
  const others = photographers.filter((item) => item.publicationState !== "pending");

  return (
    <main className="admin-layout">
      <AdminSidebar active="photographers" />
      <section className="admin-content">
        <header>
          <div><p className="kicker">Annuaire public</p><h1>Photographes</h1></div>
          <span className="role-chip">{pending.length} en attente · {photographers.length} au total</span>
        </header>
        {decision ? <p className="success-message">La décision a été enregistrée.</p> : null}

        <h2 className="admin-section-title">À examiner ({pending.length})</h2>
        {pending.length ? (
          <div className="admin-card-grid">
            {pending.map((photographer) => (
              <PhotographerCard key={photographer.id} photographer={photographer} />
            ))}
          </div>
        ) : (
          <p className="admin-section-empty">Aucune inscription en attente.</p>
        )}

        <h2 className="admin-section-title">Toutes les fiches ({others.length})</h2>
        {others.length ? (
          <div className="admin-card-grid">
            {others.map((photographer) => (
              <PhotographerCard key={photographer.id} photographer={photographer} />
            ))}
          </div>
        ) : (
          <p className="admin-section-empty">Aucune fiche traitée pour le moment.</p>
        )}
      </section>
    </main>
  );
}
