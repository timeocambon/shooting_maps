import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, MapPin, PenLine, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import {
  correctProposalAction,
  reviewProposalAction,
  setProposalPhotoStateAction,
} from "@/app/admin/propositions/actions";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { ReviewPhotoGallery } from "@/features/admin/components/review-photo-gallery";
import { getProposalReview } from "@/features/admin/moderation-data";
import {
  accessLabels,
  attendanceLabels,
  bestTimeLabels,
  categoryLabels,
  spotCategories,
  surfaceLabels,
} from "@/features/spots/domain/spot";

type ProposalPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; maj?: string }>;
};

const errors: Record<string, string> = {
  validation: "La décision ou la note est invalide.",
  photos: "La proposition doit contenir entre deux et six photos traitées.",
  "publication-photos": "Les variantes publiques n'ont pas pu être préparées.",
  "deja-traitee": "Cette proposition a déjà été traitée dans une autre session.",
  decision: "La décision n'a pas pu être enregistrée.",
  correction: "La correction n'a pas pu être enregistrée : vérifiez les champs.",
  photo: "L'état de cette photo n'a pas pu être mis à jour.",
};

const locationStatusLabels: Record<string, string> = {
  public: "Public",
  private_with_permission: "Privé avec autorisation",
  to_confirm: "À confirmer",
  sensitive: "Sensible",
};

const displayPrecisionLabels: Record<string, string> = {
  exact: "Exacte",
  approximate: "Approximative",
};

export const metadata: Metadata = { title: "Examiner une proposition" };

export default async function ProposalPage({ params, searchParams }: ProposalPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { id } = await params;
  const { erreur, maj } = await searchParams;
  const proposal = await getProposalReview(id);
  if (!proposal) notFound();
  const reviewAction = reviewProposalAction.bind(null, proposal.id);
  const correctAction = correctProposalAction.bind(null, proposal.id);
  const photoStateAction = setProposalPhotoStateAction.bind(null, proposal.id);
  const canEdit = proposal.state === "submitted";
  const mapUrl = `https://www.openstreetmap.org/?mlat=${proposal.payload.latitude}&mlon=${proposal.payload.longitude}#map=16/${proposal.payload.latitude}/${proposal.payload.longitude}`;

  return (
    <main className="admin-form-page">
      <div className="moderation-review-shell">
        <Link className="back-link" href="/admin/propositions"><ArrowLeft size={17} /> File de modération</Link>
        <header className="review-heading"><div><p className="kicker">{proposal.trackingId}</p><h1>{proposal.payload.name}</h1><p>{proposal.payload.municipality} · proposition de {proposal.publicPseudonym || proposal.contributorEmail}</p></div><a className="button button-secondary" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={17} /> Vérifier la position <ExternalLink size={14} /></a></header>
        {erreur ? <p className="form-error" role="alert">{errors[erreur] ?? errors.decision}</p> : null}
        {maj === "correction" ? <p className="success-message">La proposition a été corrigée et journalisée.</p> : null}

        <ReviewPhotoGallery
          photos={proposal.photos}
          spotName={proposal.payload.name}
          moderateAction={canEdit ? photoStateAction : undefined}
        />

        <div className="review-columns">
          <section className="review-information">
            {canEdit ? (
              <>
                <h2><PenLine size={20} aria-hidden="true" /> Corriger la proposition</h2>
                <p className="correction-hint">
                  Corrige l&apos;orthographe, la catégorie ou la position avant de décider — la
                  proposition reste « à vérifier », rien n&apos;est publié ici.
                </p>
                <form className="spot-admin-form" action={correctAction}>
                  <fieldset>
                    <legend>Identité et position</legend>
                    <div className="field-grid">
                      <label className="field-wide">Nom du lieu<input name="name" minLength={3} maxLength={120} defaultValue={proposal.payload.name} required /></label>
                      <label className="field-wide">Adresse<input name="address" minLength={5} maxLength={180} defaultValue={proposal.payload.address} required /></label>
                      <label>Commune<input name="municipality" minLength={2} maxLength={120} defaultValue={proposal.payload.municipality} required /></label>
                      <label>Code postal<input name="postalCode" inputMode="numeric" pattern="[0-9]{5}" defaultValue={proposal.payload.postalCode} required /></label>
                      <label>Latitude<input name="latitude" type="number" step="0.000001" defaultValue={proposal.payload.latitude} required /></label>
                      <label>Longitude<input name="longitude" type="number" step="0.000001" defaultValue={proposal.payload.longitude} required /></label>
                      <label>Précision annoncée<select name="displayPrecision" defaultValue={proposal.payload.displayPrecision}>{Object.entries(displayPrecisionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label>Statut du lieu<select name="locationStatus" defaultValue={proposal.payload.locationStatus}>{Object.entries(locationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend>Rendu et conditions</legend>
                    <span className="field-label">Décors · 1 à 3 choix</span>
                    <div className="admin-choice-grid">
                      {spotCategories.map((category) => <label key={category}><input type="checkbox" name="categories" value={category} defaultChecked={proposal.payload.categories.includes(category)} /><span>{categoryLabels[category]}</span></label>)}
                    </div>
                    <span className="field-label separated">Meilleurs moments · 1 à 3 choix</span>
                    <div className="admin-choice-grid">
                      {Object.entries(bestTimeLabels).map(([value, label]) => <label key={value}><input type="checkbox" name="bestTimes" value={value} defaultChecked={proposal.payload.bestTimes.includes(value as typeof proposal.payload.bestTimes[number])} /><span>{label}</span></label>)}
                    </div>
                    <div className="field-grid separated">
                      <label>Niveau d&apos;accès<select name="accessLevel" defaultValue={proposal.payload.accessLevel}>{Object.entries(accessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label>Type de sol<select name="surfaceType" defaultValue={proposal.payload.surfaceType}>{Object.entries(surfaceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label>Fréquentation<select name="attendance" defaultValue={proposal.payload.attendance}>{Object.entries(attendanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label className="field-wide">Ambiance<textarea name="shortDescription" minLength={20} maxLength={500} rows={4} defaultValue={proposal.payload.shortDescription} required /></label>
                      <label className="field-wide">Particularités visuelles <span>facultatif</span><textarea name="visualFeatures" maxLength={500} rows={3} defaultValue={proposal.payload.visualFeatures} /></label>
                      <label className="field-wide">Stationnement<textarea name="parking" minLength={3} maxLength={500} rows={3} defaultValue={proposal.payload.parking} required /></label>
                      <label className="field-wide">Approche à pied<textarea name="walkingApproach" minLength={3} maxLength={500} rows={3} defaultValue={proposal.payload.walkingApproach} required /></label>
                      <label className="field-wide">Circulation<textarea name="traffic" minLength={3} maxLength={500} rows={3} defaultValue={proposal.payload.traffic} required /></label>
                      <label className="field-wide">Risques et restrictions<textarea name="risks" minLength={10} maxLength={2000} rows={4} defaultValue={proposal.payload.risks} required /></label>
                      <label className="field-wide">Motif de la correction <span>facultatif, journalisé</span><textarea name="internalNote" maxLength={2000} rows={2} placeholder="Ex. : faute d'orthographe corrigée, position affinée sur la carte…" /></label>
                    </div>
                  </fieldset>

                  <div className="publish-row">
                    <p>La correction s&apos;applique uniquement au contenu affiché ci-dessus ; elle est journalisée et n&apos;envoie aucune notification au contributeur.</p>
                    <button className="button button-secondary" type="submit"><PenLine size={17} /> Enregistrer la correction</button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2>Informations proposées</h2>
                <dl>
                  <div><dt>Adresse proposée</dt><dd>{proposal.payload.address}</dd></div>
                  <div><dt>Décor</dt><dd>{proposal.payload.categories.map((item) => categoryLabels[item]).join(", ")}</dd></div>
                  <div><dt>Meilleur moment</dt><dd>{proposal.payload.bestTimes.map((item) => bestTimeLabels[item]).join(", ")}</dd></div>
                  <div><dt>Accès</dt><dd>{accessLabels[proposal.payload.accessLevel]}</dd></div>
                  <div><dt>Sol</dt><dd>{surfaceLabels[proposal.payload.surfaceType]}</dd></div>
                  <div><dt>Fréquentation</dt><dd>{attendanceLabels[proposal.payload.attendance]}</dd></div>
                  <div><dt>Statut annoncé</dt><dd>{locationStatusLabels[proposal.payload.locationStatus]}</dd></div>
                </dl>
                <h3>Ambiance</h3><p>{proposal.payload.shortDescription}</p>
                {proposal.payload.visualFeatures ? <><h3>Particularités visuelles</h3><p>{proposal.payload.visualFeatures}</p></> : null}
                <h3>Stationnement et approche</h3><p>{proposal.payload.parking}<br />{proposal.payload.walkingApproach}</p>
                <h3>Circulation</h3><p>{proposal.payload.traffic}</p>
                <div className="review-warning"><ShieldAlert /><div><h3>Risques et restrictions</h3><p>{proposal.payload.risks}</p></div></div>
              </>
            )}
          </section>

          <aside className="decision-card">
            <CheckCircle2 />
            <h2>Décision de modération</h2>
            {canEdit ? <>
              <p>Une seule décision est possible. En cas de publication, les images nettoyées deviennent publiques ; les originaux restent privés. Une photo exclue ci-dessus ne sera jamais publiée.</p>
              <form action={reviewAction}>
                <label>Précision affichée<select name="displayPrecision" defaultValue={proposal.payload.displayPrecision}><option value="exact">Exacte</option><option value="approximate">Approximative</option></select></label>
                <label className="check-row"><input type="checkbox" name="sensitive" defaultChecked={proposal.payload.locationStatus === "sensitive"} /><span>Classer le lieu comme sensible</span></label>
                <label>Note interne<textarea name="internalNote" rows={5} maxLength={2000} placeholder="Motif ou vérifications réalisées…" /></label>
                <div className="decision-actions">
                  <button className="button" name="decision" value="approved" type="submit">Accepter et publier</button>
                  <button className="button button-secondary" name="decision" value="changes_requested" type="submit">Demander des précisions</button>
                  <button className="text-decision" name="decision" value="duplicate" type="submit">Classer en doublon</button>
                  <button className="text-decision danger" name="decision" value="rejected" type="submit">Refuser la proposition</button>
                </div>
              </form>
            </> : <p>Une demande de précisions a déjà été enregistrée. La proposition reste visible ici, mais aucune seconde décision ne sera acceptée avant une nouvelle soumission.</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
