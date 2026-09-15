"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Send, Star } from "lucide-react";
import {
  createPhotographerReviewAction,
  type PhotographerReviewActionState,
} from "@/app/photographes/[slug]/actions";

const initialState: PhotographerReviewActionState = { status: "idle" };

type ReviewFormProps = {
  photographerId: string;
  photographerSlug: string;
  photographerName: string;
};

export function ReviewForm({ photographerId, photographerSlug, photographerName }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const boundAction = createPhotographerReviewAction.bind(null, photographerId, photographerSlug);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (state.status === "success") {
    return (
      <section className="report-confirmation" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <p className="kicker">Avis transmis</p>
        <h1>Merci, il sera visible après vérification.</h1>
        <p>Un avis abusif ou hors sujet peut être retiré par l’équipe de modération.</p>
      </section>
    );
  }

  return (
    <form className="report-form" action={formAction}>
      <fieldset>
        <legend>Votre note pour {photographerName}</legend>
        <div className="star-rating-input" role="radiogroup" aria-label="Note sur 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={value <= (hoverRating ?? rating) ? "filled" : ""}
              aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
              aria-pressed={rating === value}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(null)}
            >
              <Star size={22} aria-hidden="true" />
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </fieldset>

      <label>
        Votre avis
        <span>Partagez votre expérience avec ce photographe.</span>
        <textarea name="comment" minLength={10} maxLength={800} rows={5} required />
      </label>

      <label>
        Votre nom <span>facultatif — affiché avec votre avis</span>
        <input name="reviewerName" maxLength={80} placeholder="ex. Camille" />
      </label>

      <label>
        Adresse e-mail <span>facultative — jamais affichée publiquement</span>
        <input name="reviewerEmail" type="email" autoComplete="email" maxLength={320} />
      </label>

      <label className="website-field" aria-hidden="true">
        Site web
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}

      <div className="publish-row">
        <p>Les avis sont vérifiés avant publication pour éviter le spam et les abus.</p>
        <button className="button" type="submit" disabled={pending}>
          <Send size={17} aria-hidden="true" /> {pending ? "Envoi…" : "Publier mon avis"}
        </button>
      </div>
    </form>
  );
}
