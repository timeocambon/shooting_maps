"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import {
  signInAccountAction,
  signUpAction,
  type AuthActionState,
} from "@/app/compte/actions";

const initialState: AuthActionState = { status: "idle" };

type AuthFormProps = { mode: "signup" | "signin" };

export function AuthForm({ mode }: AuthFormProps) {
  const isSignUp = mode === "signup";
  const [state, formAction, pending] = useActionState(
    isSignUp ? signUpAction : signInAccountAction,
    initialState,
  );

  return (
    <form className="report-form auth-form-card" action={formAction}>
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
          {isSignUp ? (
            <>Déjà un compte ? <Link className="report-link" href="/connexion">Se connecter</Link></>
          ) : (
            <>Pas encore de compte ? <Link className="report-link" href="/inscription">En créer un</Link></>
          )}
        </p>
        <button className="button" type="submit" disabled={pending}>
          {isSignUp ? <UserPlus size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
          {pending ? "Un instant…" : isSignUp ? "Créer mon compte" : "Se connecter"}
        </button>
      </div>
    </form>
  );
}
