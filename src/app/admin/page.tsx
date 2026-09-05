import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  ScanEye,
  ShieldCheck,
} from "lucide-react";
import { signOutAction } from "@/app/admin/actions";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getAdminDashboardCounts } from "@/features/admin/moderation-data";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const session = await getAdminSessionState();

  if (session.status === "unconfigured") {
    return (
      <main className="admin-gate">
        <section>
          <span className="admin-icon"><Database aria-hidden="true" /></span>
          <p className="kicker">Socle prêt</p>
          <h1>Connectez la base locale.</h1>
          <p>L&apos;interface publique fonctionne avec des données fictives. Démarrez Supabase puis copiez ses clés locales dans <code>.env.local</code> pour activer l&apos;administration sécurisée.</p>
          <div className="code-steps">
            <code>npm run db:start</code>
            <code>cp .env.example .env.local</code>
            <code>npm run db:reset</code>
          </div>
          <Link className="button button-secondary" href="/">Voir le socle public</Link>
        </section>
      </main>
    );
  }

  if (session.status === "anonymous") {
    return (
      <main className="admin-gate">
        <section>
          <span className="admin-icon"><ShieldCheck aria-hidden="true" /></span>
          <p className="kicker">Accès protégé</p>
          <h1>Administration Spotride</h1>
          <p>Un compte invité et un second facteur sont nécessaires pour accéder aux données de modération.</p>
          <Link className="button" href="/admin/connexion">Se connecter</Link>
        </section>
      </main>
    );
  }

  if (session.status === "mfa_required") {
    return (
      <main className="admin-gate">
        <section>
          <span className="admin-icon"><ShieldCheck aria-hidden="true" /></span>
          <p className="kicker">Seconde étape</p>
          <h1>Confirmez votre identité.</h1>
          <p>Le compte {session.email} doit valider son code à usage unique avant d&apos;accéder à la modération.</p>
          <Link className="button" href="/admin/securite">Configurer ou valider le code</Link>
        </section>
      </main>
    );
  }

  if (session.status === "forbidden") {
    return (
      <main className="admin-gate">
        <section>
          <span className="admin-icon warning"><AlertTriangle aria-hidden="true" /></span>
          <p className="kicker">Accès refusé</p>
          <h1>Ce compte n&apos;a aucun rôle de modération.</h1>
          <p>Le compte {session.email} est authentifié, mais il doit être ajouté à <code>admin_users</code> par un administrateur.</p>
          <form action={signOutAction}><button className="button button-secondary" type="submit">Se déconnecter</button></form>
        </section>
      </main>
    );
  }

  const counts = await getAdminDashboardCounts();

  return (
    <main className="admin-layout">
      <AdminSidebar active="dashboard" />
      <section className="admin-content">
        <header>
          <div><p className="kicker">Modération opérationnelle</p><h1>Bonjour {session.displayName ?? session.email}</h1></div>
          <span className="role-chip">{session.role === "administrator" ? "Administrateur" : "Modérateur"}</span>
        </header>
        <div className="admin-metrics">
          <article><Clock3 /><span>À vérifier</span><strong>{counts.proposals}</strong><small>Propositions soumises</small></article>
          <article><AlertTriangle /><span>Prioritaires</span><strong>{counts.priorityReports}</strong><small>Signalements ouverts</small></article>
          <article><ScanEye /><span>Retraits</span><strong>{counts.openWithdrawals}</strong><small>Demandes en attente</small></article>
          <article><FileCheck2 /><span>Catalogue</span><strong>{counts.publishedSpots}</strong><small>Spots visibles</small></article>
        </div>
        <section className="admin-ready-card">
          <CheckCircle2 aria-hidden="true" />
          <div><h2>Le circuit de maintenance est actif</h2><p>Les alertes prioritaires, masquages, retraits et purges de propositions expirées sont contrôlés côté base et ajoutés au journal de modération.</p></div>
        </section>
        <div className="admin-action-row"><Link className="button admin-primary-action" href="/admin/propositions">Traiter les propositions</Link><Link className="button button-secondary admin-primary-action" href="/admin/signalements">Voir les signalements</Link><Link className="button button-secondary admin-primary-action" href="/admin/retraits">Traiter les retraits</Link><Link className="button button-secondary admin-primary-action" href="/admin/spots">Maintenir le catalogue</Link></div>
      </section>
    </main>
  );
}
