"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import {
  reportNeedsContact,
  reportReasonLabels,
  reportReasons,
  type ReportReason,
} from "@/features/reports/domain/report";
import {
  createReportAction,
  type ReportActionState,
} from "@/app/signaler/[slug]/actions";

const initialState: ReportActionState = { status: "idle" };

type ReportFormProps = {
  spotId: string;
  spotName: string;
  spotSlug: string;
};

export function ReportForm({ spotId, spotName, spotSlug }: ReportFormProps) {
  const [reason, setReason] = useState<ReportReason>("incorrect_information");
  const boundAction = createReportAction.bind(null, spotId, spotSlug);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (state.status === "success") {
    return (
      <section className="report-confirmation" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <p className="kicker">Signalement transmis</p>
        <h1>Merci, nous allons vérifier.</h1>
        <p>Votre référence est <strong>{state.reference}</strong>. Une alerte prioritaire apparaît immédiatement dans l’administration lorsque le motif l’exige.</p>
        <Link className="button" href={`/spots/${spotSlug}`}>Revenir à la fiche</Link>
      </section>
    );
  }

  const contactRequired = reportNeedsContact(reason);

  return (
    <form className="report-form" action={formAction}>
      <fieldset>
        <legend>Que faut-il vérifier ?</legend>
        <div className="report-reason-grid">
          {reportReasons.map((item) => (
            <label key={item} className={reason === item ? "selected" : ""}>
              <input
                type="radio"
                name="reason"
                value={item}
                checked={reason === item}
                onChange={() => setReason(item)}
              />
              <span>{reportReasonLabels[item]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        Ce que vous avez constaté
        <span>Donnez les éléments utiles sans partager de données personnelles inutiles.</span>
        <textarea name="comment" minLength={10} maxLength={2000} rows={6} required />
      </label>

      <label>
        Adresse e-mail {contactRequired ? "obligatoire" : "facultative"}
        <span>{contactRequired ? "Elle nous permet de vérifier une demande sensible." : "Uniquement si vous acceptez d’être recontacté."}</span>
        <input name="email" type="email" autoComplete="email" required={contactRequired} maxLength={320} />
      </label>

      <label className="website-field" aria-hidden="true">
        Site web
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="report-privacy">
        <AlertTriangle aria-hidden="true" />
        <p>En cas de danger immédiat, ne restez pas sur place. Ce formulaire n’est pas un service d’urgence.</p>
      </div>

      {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}

      <div className="publish-row">
        <p>Les informations sont utilisées uniquement pour examiner la fiche et ne sont jamais affichées publiquement.</p>
        <button className="button" type="submit" disabled={pending}>
          <Send size={17} aria-hidden="true" /> {pending ? "Envoi…" : `Signaler ${spotName}`}
        </button>
      </div>
    </form>
  );
}
