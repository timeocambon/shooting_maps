import Link from "next/link";
import { ArrowLeft, MapPinPlus } from "lucide-react";
import { createSpotAction } from "@/app/admin/actions";
import { getAdminSessionState } from "@/features/admin/admin-session";

type NewSpotPageProps = { searchParams: Promise<{ erreur?: string }> };

const errors: Record<string, string> = {
  validation: "Certains champs sont incomplets ou invalides.",
  slug: "Une fiche porte déjà ce nom. Choisissez un nom plus précis.",
  enregistrement: "La fiche n'a pas pu être enregistrée.",
};

export const metadata = { title: "Créer un spot" };

export default async function NewSpotPage({ searchParams }: NewSpotPageProps) {
  const session = await getAdminSessionState();
  const { erreur } = await searchParams;

  if (session.status !== "authenticated") {
    return (
      <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><p>Connectez-vous avec votre compte de modération et son second facteur.</p><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>
    );
  }

  return (
    <main className="admin-form-page">
      <div className="admin-form-shell">
        <Link className="back-link" href="/admin/spots"><ArrowLeft size={17} /> Catalogue</Link>
        <header><span className="admin-icon"><MapPinPlus /></span><p className="kicker">Ajout manuel</p><h1>Créer une fiche publiée</h1><p>La fiche rejoint immédiatement le catalogue et la carte publique. Elle pourra ensuite être corrigée, masquée ou archivée.</p></header>
        {erreur ? <p className="form-error" role="alert">{errors[erreur] ?? errors.enregistrement}</p> : null}
        <form className="spot-admin-form" action={createSpotAction}>
          <fieldset>
            <legend>Identité et position</legend>
            <div className="field-grid">
              <label className="field-wide">Nom éditorial<input name="name" minLength={3} maxLength={120} required /></label>
              <label className="field-wide">Adresse <span>facultative si seules les coordonnées sont connues</span><input name="address" minLength={5} maxLength={240} autoComplete="street-address" placeholder="12 rue Exemple, 31000 Toulouse" /></label>
              <label>Commune<input name="municipality" defaultValue="Toulouse" required /></label>
              <label>Code postal<input name="postalCode" inputMode="numeric" pattern="[0-9]{5}" defaultValue="31000" required /></label>
              <label>Latitude<input name="latitude" type="number" step="0.000001" defaultValue="43.6045" required /></label>
              <label>Longitude<input name="longitude" type="number" step="0.000001" defaultValue="1.4442" required /></label>
              <label>Précision publique<select name="displayPrecision" defaultValue="exact"><option value="exact">Exacte</option><option value="approximate">Approximative</option></select></label>
              <label>Statut du lieu<select name="locationStatus" defaultValue="to_confirm"><option value="public">Public</option><option value="private_with_permission">Privé avec autorisation</option><option value="to_confirm">À confirmer</option><option value="sensitive">Sensible</option></select></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Rendu et conditions</legend>
            <div className="field-grid">
              <label>Décor<select name="category"><option value="urban">Urbain</option><option value="industrial">Industriel</option><option value="architecture">Architecture</option><option value="nature">Nature</option><option value="panorama">Panorama</option><option value="graffiti">Graffiti</option></select></label>
              <label>Meilleur moment<select name="bestTime"><option value="morning">Matin</option><option value="day">Journée</option><option value="golden_hour">Golden hour</option><option value="sunset">Coucher de soleil</option><option value="night">Nuit</option></select></label>
              <label>Niveau d&apos;accès<select name="accessLevel"><option value="easy">Facile</option><option value="intermediate">Intermédiaire</option><option value="difficult">Difficile</option></select></label>
              <label>Type de sol<select name="surfaceType"><option value="asphalt">Bitume</option><option value="gravel">Gravier</option><option value="earth">Terre</option><option value="mixed">Mixte</option></select></label>
              <label>Fréquentation<select name="attendance"><option value="quiet">Calme</option><option value="variable">Variable</option><option value="busy">Fréquenté</option></select></label>
              <label className="field-wide">Description<textarea name="shortDescription" minLength={20} maxLength={500} rows={4} required /></label>
              <label className="field-wide">Stationnement<textarea name="parking" rows={2} required /></label>
              <label className="field-wide">Approche à pied<textarea name="walkingApproach" rows={2} required /></label>
              <label className="field-wide">Avertissements <span>un par ligne</span><textarea name="warnings" rows={3} /></label>
            </div>
          </fieldset>
          <div className="publish-row"><p>La fiche sera immédiatement visible et sa création sera ajoutée au journal de modération.</p><button className="button" type="submit">Créer et publier</button></div>
        </form>
      </div>
    </main>
  );
}
