"use client";

import { useActionState, useState } from "react";
import { LogIn, MailCheck, UserPlus } from "lucide-react";
import {
  signInAccountAction,
  signUpAction,
  type AuthActionState,
} from "@/app/compte/actions";

const initialState: AuthActionState = { status: "idle" };

type Mode = "signin" | "signup";

/**
 * Un composant distinct par mode : useActionState fige l'action au montage,
 * donc réutiliser un seul formulaire pour les deux modes ferait exécuter
 * l'action du mode initial après un changement d'onglet.
 */
function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAccountAction, initialState);

  return (
    <form className="report-form auth-form-card" action={formAction}>
      <label>
        Adresse e-mail
        <input name="email" type="email" autoComplete="email" required maxLength={320} />
      </label>

      <label>
        Mot de passe
        <input name="password" type="password" autoComplete="current-password" required minLength={8} />
      </label>

      {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}

      <div className="publish-row">
        <p>Pas encore de compte ? Utilisez l’onglet « Créer un compte ».</p>
        <button className="button" type="submit" disabled={pending}>
          <LogIn size={17} aria-hidden="true" /> {pending ? "Un instant…" : "Se connecter"}
        </button>
      </div>
    </form>
  );
}

function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  if (state.status === "confirmation-sent") {
    return (
      <section className="report-confirmation" aria-live="polite">
        <MailCheck aria-hidden="true" />
        <p className="kicker">Compte créé</p>
        <h2>Confirmez votre adresse e-mail</h2>
        <p>
          Un lien vient d’être envoyé à <strong>{state.email}</strong>. Ouvrez-le pour
          activer votre compte : votre fiche photographe y sera rattachée
          automatiquement si elle porte la même adresse.
        </p>
        <p>Pensez à regarder dans vos indésirables si le message tarde.</p>
      </section>
    );
  }

  return (
    <form className="report-form auth-form-card" action={formAction}>
      <label>
        Votre nom
        <span>Affiché sur votre espace. Vous pourrez le modifier plus tard.</span>
        <input name="displayName" maxLength={80} required autoComplete="name" />
      </label>

      <label>
        Adresse e-mail
        <span>Utilisez celle indiquée sur votre fiche photographe pour la récupérer automatiquement.</span>
        <input name="email" type="email" autoComplete="email" required maxLength={320} />
      </label>

      <label>
        Mot de passe
        <span>8 caractères minimum.</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </label>

      {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}

      <div className="publish-row">
        <p>Un compte vous permet de gérer votre fiche photographe.</p>
        <button className="button" type="submit" disabled={pending}>
          <UserPlus size={17} aria-hidden="true" /> {pending ? "Un instant…" : "Créer mon compte"}
        </button>
      </div>
    </form>
  );
}

export function AuthPanel({ defaultMode = "signin" }: { defaultMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(defaultMode);

  return (
    <div className="auth-panel">
      <div className="auth-tabs" role="tablist" aria-label="Connexion ou création de compte">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={mode === "signin" ? "active" : ""}
          onClick={() => setMode("signin")}
        >
          Se connecter
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "active" : ""}
          onClick={() => setMode("signup")}
        >
          Créer un compte
        </button>
      </div>

      {mode === "signin" ? <SignInForm /> : <SignUpForm />}
    </div>
  );
}
