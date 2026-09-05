import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, MapPin, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { reviewProposalAction } from "@/app/admin/propositions/actions";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { ReviewPhotoGallery } from "@/features/admin/components/review-photo-gallery";
import { getProposalReview } from "@/features/admin/moderation-data";
import { accessLabels, attendanceLabels, bestTimeLabels, categoryLabels, surfaceLabels } from "@/features/spots/domain/spot";

type ProposalPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
};

const errors: Record<string, string> = {
  validation: "La décision ou la note est invalide.",
  photos: "La proposition doit contenir entre deux et six photos traitées.",
  "publication-photos": "Les variantes publiques n'ont pas pu être préparées.",
  "deja-traitee": "Cette proposition a déjà été traitée dans une autre session.",
  decision: "La décision n'a pas pu être enregistrée.",
};

export const metadata: Metadata = { title: "Examiner une proposition" };

export default async function ProposalPage({ params, searchParams }: ProposalPageProps) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") {
    return <main className="admin-gate"><section><p className="kicker">Accès protégé</p><h1>Authentification requise.</h1><Link className="button" href="/admin">Accéder à l&apos;administration</Link></section></main>;
  }

  const { id } = await params;
  const { erreur } = await searchParams;
  const proposal = await getProposalReview(id);
  if (!proposal) notFound();
  const reviewAction = reviewProposalAction.bind(null, proposal.id);
  const mapUrl = `https://www.openstreetmap.org/?mlat=${proposal.payload.latitude}&mlon=${proposal.payload.longitude}#map=16/${proposal.payload.latitude}/${proposal.payload.longitude}`;

  return (
    <main className="admin-form-page">
      <div className="moderation-review-shell">
        <Link className="back-link" href="/admin/propositions"><ArrowLeft size={17} /> File de modération</Link>
        <header className="review-heading"><div><p className="kicker">{proposal.trackingId}</p><h1>{proposal.payload.name}</h1><p>{proposal.payload.municipality} · proposition de {proposal.publicPseudonym || proposal.contributorEmail}</p></div><a className="button button-secondary" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={17} /> Vérifier la position <ExternalLink size={14} /></a></header>
        {erreur ? <p className="form-error" role="alert">{errors[erreur] ?? errors.decision}</p> : null}

        <ReviewPhotoGallery photos={proposal.photos} spotName={proposal.payload.name} />

        <div className="review-columns">
          <section className="review-information">
            <h2>Informations proposées</h2>
            <dl>
              <div><dt>Adresse proposée</dt><dd>{proposal.payload.address}</dd></div>
              <div><dt>Décor</dt><dd>{proposal.payload.categories.map((item) => categoryLabels[item]).join(", ")}</dd></div>
              <div><dt>Meilleur moment</dt><dd>{proposal.payload.bestTimes.map((item) => bestTimeLabels[item]).join(", ")}</dd></div>
              <div><dt>Accès</dt><dd>{accessLabels[proposal.payload.accessLevel]}</dd></div>
              <div><dt>Sol</dt><dd>{surfaceLabels[proposal.payload.surfaceType]}</dd></div>
              <div><dt>Fréquentation</dt><dd>{attendanceLabels[proposal.payload.attendance]}</dd></div>
              <div><dt>Statut annoncé</dt><dd>{proposal.payload.locationStatus}</dd></div>
            </dl>
            <h3>Ambiance</h3><p>{proposal.payload.shortDescription}</p>
            {proposal.payload.visualFeatures ? <><h3>Particularités visuelles</h3><p>{proposal.payload.visualFeatures}</p></> : null}
            <h3>Stationnement et approche</h3><p>{proposal.payload.parking}<br />{proposal.payload.walkingApproach}</p>
            <h3>Circulation</h3><p>{proposal.payload.traffic}</p>
            <div className="review-warning"><ShieldAlert /><div><h3>Risques et restrictions</h3><p>{proposal.payload.risks}</p></div></div>
          </section>

          <aside className="decision-card">
            <CheckCircle2 />
            <h2>Décision de modération</h2>
            {proposal.state === "submitted" ? <>
              <p>Une seule décision est possible. En cas de publication, les images nettoyées deviennent publiques ; les originaux restent privés.</p>
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
