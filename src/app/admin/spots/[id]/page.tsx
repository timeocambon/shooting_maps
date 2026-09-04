import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveX, ArrowLeft, ExternalLink, Save, ShieldCheck, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { changeSpotStateAction, deleteSpotAction, updateSpotAction } from "@/app/admin/spots/actions";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { getCatalogSpot } from "@/features/admin/catalog-data";
import { categoryLabels, spotCategories } from "@/features/spots/domain/spot";

type EditSpotPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; maj?: string }>;
};

const bestTimeOptions = [
  ["morning", "Matin"],
  ["day", "Journée"],
  ["golden_hour", "Golden hour"],
  ["sunset", "Coucher de soleil"],
  ["night", "Nuit"],
] as const;

const stateLabels: Record<string, string> = {
  published: "Publié",
  hidden: "Masqué",
  sensitive: "Sensible",
  archived: "Archivé",
  review_due: "À revérifier",
};

const transitions: Record<string, string[]> = {
  published: ["hidden", "sensitive", "archived", "review_due"],
  hidden: ["published", "sensitive", "archived"],
  sensitive: ["published", "hidden", "archived", "review_due"],
  archived: ["hidden", "published"],
  review_due: ["published", "hidden", "sensitive", "archived"],
};

const errors: Record<string, string> = {
  validation: "Certains champs sont incomplets ou invalides.",
  enregistrement: "Les modifications n’ont pas pu être enregistrées.",
  etat: "Le changement d’état est invalide ou son motif est incomplet.",
  confirmation: "Le nom saisi ne correspond pas au nom de la fiche.",
  suppression: "La suppression définitive n’a pas pu être effectuée.",
};

export const metadata: Metadata = { title: "Modifier un spot" };

export default async function EditSpotPage({ params, searchParams }: EditSpotPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { id } = await params;
  const { erreur, maj } = await searchParams;
  const spot = await getCatalogSpot(id);
  if (!spot) notFound();
  const updateAction = updateSpotAction.bind(null, spot.id);
  const stateAction = changeSpotStateAction.bind(null, spot.id);
  const deleteAction = deleteSpotAction.bind(null, spot.id);
  const publicSpotVisible = ["published", "sensitive", "review_due"].includes(spot.publicationState) && spot.displayPrecision !== "hidden";

  return (
    <main className="admin-form-page">
      <div className="moderation-review-shell">
        <Link className="back-link" href="/admin/spots"><ArrowLeft size={17} /> Catalogue</Link>
        <header className="review-heading catalog-review-heading">
          <div><span className={`spot-state-chip ${spot.publicationState}`}>{stateLabels[spot.publicationState]}</span><p className="kicker">Dernière vérification : {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(spot.lastVerifiedAt))}</p><h1>{spot.name}</h1><p>URL stable : /spots/{spot.slug}</p></div>
          {publicSpotVisible ? <a className="button button-secondary" href={`/spots/${spot.slug}`} target="_blank" rel="noreferrer">Voir la fiche <ExternalLink size={14} /></a> : null}
        </header>
        {erreur ? <p className="form-error" role="alert">{errors[erreur] ?? errors.enregistrement}</p> : null}
        {maj ? <p className="success-message">{maj === "etat" ? "Le nouvel état est appliqué et journalisé." : "La fiche a été mise à jour."}</p> : null}

        <div className="catalog-edit-layout">
          <form className="spot-admin-form" action={updateAction}>
            <fieldset>
              <legend>Identité et position</legend>
              <div className="field-grid">
                <label className="field-wide">Nom éditorial<input name="name" minLength={3} maxLength={120} defaultValue={spot.name} required /></label>
                <label className="field-wide">Adresse <span>facultative si seules les coordonnées sont connues</span><input name="address" minLength={5} maxLength={240} autoComplete="street-address" defaultValue={spot.address} placeholder="12 rue Exemple, 31000 Toulouse" /></label>
                <label>Commune<input name="municipality" defaultValue={spot.municipality} required /></label>
                <label>Code postal<input name="postalCode" inputMode="numeric" pattern="[0-9]{5}" defaultValue={spot.postalCode} required /></label>
                <label>Latitude<input name="latitude" type="number" step="0.000001" defaultValue={spot.latitude} required /></label>
                <label>Longitude<input name="longitude" type="number" step="0.000001" defaultValue={spot.longitude} required /></label>
                <label>Précision publique<select name="displayPrecision" defaultValue={spot.displayPrecision}><option value="exact">Exacte</option><option value="approximate">Approximative</option><option value="hidden">Coordonnées masquées</option></select></label>
                <label>Statut du lieu<select name="locationStatus" defaultValue={spot.locationStatus}><option value="public">Public</option><option value="private_with_permission">Privé avec autorisation</option><option value="to_confirm">À confirmer</option><option value="sensitive">Sensible</option></select></label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Rendu et conditions</legend>
              <span className="field-label">Décors · 1 à 3 choix</span>
              <div className="admin-choice-grid">
                {spotCategories.map((category) => <label key={category}><input type="checkbox" name="categories" value={category} defaultChecked={spot.categories.includes(category)} /><span>{categoryLabels[category]}</span></label>)}
              </div>
              <span className="field-label separated">Meilleurs moments · 1 à 3 choix</span>
              <div className="admin-choice-grid">
                {bestTimeOptions.map(([value, label]) => <label key={value}><input type="checkbox" name="bestTimes" value={value} defaultChecked={spot.bestTimes.includes(value)} /><span>{label}</span></label>)}
              </div>
              <div className="field-grid separated">
                <label>Niveau d&apos;accès<select name="accessLevel" defaultValue={spot.accessLevel}><option value="easy">Facile</option><option value="intermediate">Intermédiaire</option><option value="difficult">Difficile</option></select></label>
                <label>Type de sol<select name="surfaceType" defaultValue={spot.surfaceType}><option value="asphalt">Bitume</option><option value="gravel">Gravier</option><option value="earth">Terre</option><option value="mixed">Mixte</option></select></label>
                <label>Fréquentation<select name="attendance" defaultValue={spot.attendance}><option value="quiet">Calme</option><option value="variable">Variable</option><option value="busy">Fréquenté</option></select></label>
                <label>Orientation de la lumière<input name="lightOrientation" maxLength={500} defaultValue={spot.lightOrientation ?? ""} /></label>
                <label className="field-wide">Description<textarea name="shortDescription" minLength={20} maxLength={500} rows={5} defaultValue={spot.shortDescription} required /></label>
                <label className="field-wide">Stationnement<textarea name="parking" rows={3} maxLength={500} defaultValue={spot.parking} required /></label>
                <label className="field-wide">Approche à pied<textarea name="walkingApproach" rows={3} maxLength={500} defaultValue={spot.walkingApproach} required /></label>
                <label className="field-wide">Avertissements <span>un par ligne, huit maximum</span><textarea name="warnings" rows={5} defaultValue={spot.warnings.join("\n")} /></label>
              </div>
            </fieldset>

            <div className="publish-row">
              <label className="check-row"><input type="checkbox" name="markVerified" /><span>Marquer les informations comme vérifiées aujourd’hui</span></label>
              <button className="button" type="submit"><Save size={17} /> Enregistrer la fiche</button>
            </div>
          </form>

          <aside className="decision-card catalog-state-card">
            <ShieldCheck />
            <h2>Visibilité de la fiche</h2>
            <p>Masquer retire immédiatement la fiche de la carte. Archiver conserve son URL publique avec une explication, sans afficher ses coordonnées.</p>
            <form action={stateAction}>
              <label>Nouvel état<select name="nextState" defaultValue={transitions[spot.publicationState]?.[0]}>{(transitions[spot.publicationState] ?? []).map((state) => <option key={state} value={state}>{stateLabels[state]}</option>)}</select></label>
              <label>Motif du changement<textarea name="note" rows={4} minLength={3} maxLength={1000} required placeholder="Vérification, fermeture, demande de retrait…" /></label>
              <button className="button button-secondary" type="submit">Appliquer et journaliser</button>
            </form>
            {spot.publicationState !== "archived" ? (
              <div className="archive-spot-action">
                <ArchiveX aria-hidden="true" />
                <h3>Retirer cette fiche</h3>
                <p>Elle disparaîtra de la carte publique, mais restera récupérable dans le catalogue.</p>
                <form action={stateAction}>
                  <input type="hidden" name="nextState" value="archived" />
                  <input type="hidden" name="note" value="Retrait manuel depuis la fiche administrateur" />
                  <label className="check-row danger-check"><input type="checkbox" required /><span>Je confirme le retrait de la carte</span></label>
                  <button className="button danger-button" type="submit">Retirer de la carte</button>
                </form>
              </div>
            ) : null}
            {session.role === "administrator" ? (
              <details className="delete-spot-action">
                <summary><Trash2 size={16} /> Supprimer définitivement</summary>
                <p>Cette action efface la fiche, ses signalements et ses photos. Elle est irréversible.</p>
                <form action={deleteAction}>
                  <label>
                    Pour confirmer, saisissez exactement <strong>{spot.name}</strong>
                    <input name="confirmation" required minLength={3} maxLength={120} autoComplete="off" />
                  </label>
                  <button className="button danger-button" type="submit">Supprimer définitivement</button>
                </form>
              </details>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
