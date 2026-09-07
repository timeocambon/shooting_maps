"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import {
  withdrawalKindHints,
  withdrawalKindLabels,
  withdrawalKinds,
  type WithdrawalKind,
} from "@/features/withdrawals/domain/withdrawal";
import {
  createWithdrawalRequestAction,
  type WithdrawalActionState,
} from "@/app/demande-de-retrait/actions";

const initialState: WithdrawalActionState = { status: "idle" };

export function WithdrawalForm() {
  const [kind, setKind] = useState<WithdrawalKind>("photo");
  const [state, formAction, pending] = useActionState(createWithdrawalRequestAction, initialState);

  if (state.status === "success") {
    return (
      <section className="report-confirmation" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <p className="kicker">Demande transmise</p>
        <h1>Merci, nous allons vérifier.</h1>
        <p>Une équipe examine chaque demande manuellement. Vous serez recontacté à l’adresse indiquée si des précisions sont nécessaires.</p>
      </section>
    );
  }

  return (
    <form className="report-form" action={formAction}>
      <fieldset>
        <legend>Quel est l’objet de votre demande ?</legend>
        <div className="report-reason-grid">
          {withdrawalKinds.map((item) => (
            <label key={item} className={kind === item ? "selected" : ""}>
              <input
                type="radio"
                name="kind"
                value={item}
                checked={kind === item}
                onChange={() => setKind(item)}
              />
              <span>{withdrawalKindLabels[item]}</span>
            </label>
          ))}
        </div>
        <p className="field-hint">{withdrawalKindHints[kind]}</p>
      </fieldset>

      <label>
        Fiche concernée <span>facultatif — l’adresse de la fiche publiée si vous la connaissez</span>
        <input name="spotSlug" maxLength={160} placeholder="ex. belvedere-des-coteaux-demo, ou l’URL complète de la fiche" />
      </label>

      <label>
        Référence de proposition <span>facultatif — la référence SPT-… reçue par e-mail si la photo n’est pas encore publiée</span>
        <input name="trackingId" maxLength={40} placeholder="SPT-XXXXXXXXXX" />
      </label>

      <label>
        Votre demande
        <span>Décrivez ce qui doit être retiré ou supprimé, avec le plus de détails utiles.</span>
        <textarea name="description" minLength={10} maxLength={2000} rows={6} required />
      </label>

      <label>
        Adresse e-mail
        <span>Nécessaire pour confirmer votre identité et vous répondre.</span>
        <input name="email" type="email" autoComplete="email" required maxLength={320} />
      </label>

      <label className="website-field" aria-hidden="true">
        Site web
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}

      <div className="publish-row">
        <p>Ces informations ne sont utilisées que pour traiter votre demande et ne sont jamais affichées publiquement.</p>
        <button className="button" type="submit" disabled={pending}>
          <Send size={17} aria-hidden="true" /> {pending ? "Envoi…" : "Envoyer la demande"}
        </button>
      </div>
    </form>
  );
}
