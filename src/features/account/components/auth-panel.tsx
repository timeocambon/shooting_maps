"use client";

import { useActionState, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import {
  signInAccountAction,
  signUpAction,
  type AuthActionState,
} from "@/app/compte/actions";

const initialState: AuthActionState = { status: "idle" };

type Mode = "signin" | "signup";

export function AuthPanel({ defaultMode = "signin" }: { defaultMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const isSignUp = mode === "signup";
  const [state, formAction, pending] = useActionState(
    isSignUp ? signUpAction : signInAccountAction,
    initialState,
  );

  return (
    <div className="auth-panel">
      <div className="auth-tabs" role="tablist" aria-label="Connexion ou création de compte">
        <button
          type="button"
          role="tab"
          aria-selected={!isSignUp}
          className={!isSignUp ? "active" : ""}
          onClick={() => setMode("signin")}
        >
          Se connecter
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignUp}
          className={isSignUp ? "active" : ""}
          onClick={() => setMode("signup")}
        >
          Créer un compte
        </button>
      </div>

      {/* La clé force la réinitialisation du formulaire au changement d'onglet. */}
      <form className="report-form auth-form-card" action={formAction} key={mode}>
        {isSignUp ? (
          <label>
            Votre nom
            <span>Affiché sur votre espace. Vous pourrez le modifier plus tard.</span>
            <input name="displayName" maxLength={80} required autoComplete="name" />
          </label>
        ) : null}

        <label>
          Adresse e-mail
          {isSignUp ? (
            <span>Utilisez celle indiquée sur votre fiche photographe pour la récupérer automatiquement.</span>
          ) : null}
          <input name="email" type="email" autoComplete="email" required maxLength={320} />
        </label>

        <label>
          Mot de passe
          {isSignUp ? <span>8 caractères minimum.</span> : null}
          <input
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
          />
        </label>

        {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}

        <div className="publish-row">
          <p>
            {isSignUp
              ? "Un compte vous permet de gérer votre fiche photographe."
              : "Pas encore de compte ? Utilisez l’onglet « Créer un compte »."}
          </p>
          <button className="button" type="submit" disabled={pending}>
            {isSignUp ? <UserPlus size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
            {pending ? "Un instant…" : isSignUp ? "Créer mon compte" : "Se connecter"}
          </button>
        </div>
      </form>
    </div>
  );
}
