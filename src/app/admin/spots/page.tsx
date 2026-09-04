import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPinPlus, Search } from "lucide-react";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getCatalogSpots } from "@/features/admin/catalog-data";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { categoryLabels, type SpotCategory } from "@/features/spots/domain/spot";

type CatalogPageProps = {
  searchParams: Promise<{ q?: string; etat?: string; creation?: string; suppression?: string; retrait?: string }>;
};

const stateLabels: Record<string, string> = {
  published: "Publié",
  hidden: "Masqué",
  sensitive: "Sensible",
  archived: "Archivé",
  review_due: "À revérifier",
};

export const metadata: Metadata = { title: "Catalogue des spots" };

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const filters = await searchParams;
  const query = filters.q?.trim().toLocaleLowerCase("fr") ?? "";
  const state = filters.etat ?? "all";
  const spots = (await getCatalogSpots()).filter((spot) => {
    const matchesQuery = !query || `${spot.name} ${spot.municipality} ${spot.postalCode}`.toLocaleLowerCase("fr").includes(query);
    const matchesState = state === "all" || spot.publicationState === state;
    return matchesQuery && matchesState;
  });

  return (
    <main className="admin-layout">
      <AdminSidebar active="spots" />
      <section className="admin-content">
        <header><div><p className="kicker">Maintenance éditoriale</p><h1>Catalogue des spots</h1></div><Link className="button" href="/admin/spots/nouveau"><MapPinPlus size={17} /> Créer une fiche</Link></header>
        {filters.creation ? <p className="success-message">La nouvelle fiche est publiée et disponible dans le catalogue.</p> : null}
        {filters.retrait ? <p className="success-message">La fiche a été retirée de la carte et reste disponible dans les éléments archivés.</p> : null}
        {filters.suppression ? <p className="success-message">La fiche et ses données associées ont été supprimées définitivement.</p> : null}
        <form className="catalog-filters" method="get">
          <label className="search-field"><Search size={18} /><input name="q" defaultValue={filters.q} placeholder="Nom, commune ou code postal" /></label>
          <label>État<select name="etat" defaultValue={state}><option value="all">Tous les états</option>{Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="button button-small" type="submit">Filtrer</button>
        </form>
        <p className="catalog-count">{spots.length} fiche{spots.length > 1 ? "s" : ""} affichée{spots.length > 1 ? "s" : ""}</p>
        <div className="moderation-list catalog-list">
          {spots.map((spot) => (
            <article key={spot.id}>
              <div className="moderation-list-main"><span className={`spot-state-chip ${spot.publicationState}`}>{stateLabels[spot.publicationState]}</span><h2>{spot.name}</h2><p>{spot.municipality} · {spot.postalCode} · {spot.categories.map((category) => categoryLabels[category as SpotCategory] ?? category).join(", ")}</p></div>
              <div className="moderation-list-meta"><span>Vérifié le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(spot.lastVerifiedAt))}</span>{spot.openReportCount ? <strong>{spot.openReportCount} signalement{spot.openReportCount > 1 ? "s" : ""}</strong> : null}<Link href={`/admin/spots/${spot.id}`}>Modifier <ArrowRight size={16} /></Link></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
