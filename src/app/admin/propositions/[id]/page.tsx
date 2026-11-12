import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, MapPin, MessageSquareReply, ShieldAlert } from "lucide-react";
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
  modifiee: "La proposition a changé depuis l'ouverture de cette page. Vérifiez-la avant de décider.",
  "en-cours": "Une décision est déjà en cours pour cette proposition. Réessayez dans quelques instants.",
  "message-public": "Une demande de précisions nécessite un message au contributeur (2 000 caractères maximum).",
  decision: "La décision n'a pas pu être enregistrée.",
};

export const metadata: Metadata = { title: "Examiner une proposition" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

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
        {proposal.hasNewResponse ? <p className="success-message exchange-alert" role="status"><MessageSquareReply size={16} /> Le contributeur a répondu à la demande de précisions : la proposition est de nouveau à décider.</p> : null}

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
            {proposal.exchanges.length ? (
              <section className="exchange-history" aria-label="Échanges avec le contributeur">
                <h3>Échanges avec le contributeur</h3>
                <p className="exchange-hint">Messages visibles par le contributeur. Les notes internes n&apos;apparaissent jamais ici.</p>
                <ol>
                  {proposal.exchanges.map((exchange) => (
                    <li key={exchange.id}>
                      <div className="exchange-message"><span>Demande · {formatDate(exchange.requestedAt)}</span><p>{exchange.publicMessage}</p></div>
                      {exchange.response ? (
                        <div className="exchange-message exchange-response"><span>Réponse du contributeur · {exchange.respondedAt ? formatDate(exchange.respondedAt) : ""}</span><p>{exchange.response}</p></div>
                      ) : exchange.closedAt ? (
                        <p className="exchange-hint">Demande close sans réponse.</p>
                      ) : (
                        <p className="exchange-hint">En attente de la réponse du contributeur.</p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </section>

          <aside className="decision-card">
            <CheckCircle2 />
            <h2>Décision de modération</h2>
            {proposal.state === "submitted" ? <>
              <p>Une seule décision est possible. En cas de publication, les images nettoyées deviennent publiques ; les originaux restent privés.</p>
              <form action={reviewAction}>
                <input type="hidden" name="version" value={proposal.version} />
                <label>Précision affichée<select name="displayPrecision" defaultValue={proposal.payload.displayPrecision}><option value="exact">Exacte</option><option value="approximate">Approximative</option></select></label>
                <label className="check-row"><input type="checkbox" name="sensitive" defaultChecked={proposal.payload.locationStatus === "sensitive"} /><span>Classer le lieu comme sensible</span></label>
                <label>Message au contributeur <small>obligatoire pour « Demander des précisions », visible par le contributeur dans l&apos;application et par e-mail</small><textarea name="publicMessage" rows={5} maxLength={2000} placeholder="Ex. Pouvez-vous préciser où se garer et si l'accès est autorisé le week-end ?" /></label>
                <label>Note interne <small>jamais transmise au contributeur</small><textarea name="internalNote" rows={4} maxLength={2000} placeholder="Motif ou vérifications réalisées…" /></label>
                <div className="decision-actions">
                  <button className="button" name="decision" value="approved" type="submit">Accepter et publier</button>
                  <button className="button button-secondary" name="decision" value="changes_requested" type="submit">Demander des précisions</button>
                  <button className="text-decision" name="decision" value="duplicate" type="submit">Classer en doublon</button>
                  <button className="text-decision danger" name="decision" value="rejected" type="submit">Refuser la proposition</button>
                </div>
              </form>
            </> : proposal.state === "changes_requested"
              ? <p>Une demande de précisions est en cours. La proposition revient automatiquement dans la file dès que le contributeur répond ; une nouvelle décision sera alors possible.</p>
              : <p>Cette proposition a déjà reçu une décision.</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
