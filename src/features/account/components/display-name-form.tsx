"use client";

import { useActionState, useState } from "react";
import { Check, SquarePen } from "lucide-react";
import { updateDisplayNameAction, type AuthActionState } from "@/app/compte/actions";

const initialState: AuthActionState = { status: "idle" };

export function DisplayNameForm({ displayName }: { displayName: string | null }) {
  const [editing, setEditing] = useState(!displayName);
  const [state, formAction, pending] = useActionState(updateDisplayNameAction, initialState);

  if (!editing) {
    return (
      <button type="button" className="display-name-edit" onClick={() => setEditing(true)}>
        <SquarePen size={14} aria-hidden="true" /> Modifier mon nom
      </button>
    );
  }

  return (
    <form className="display-name-form" action={formAction}>
      <label>
        <span className="sr-only">Votre nom</span>
        <input
          name="displayName"
          defaultValue={displayName ?? ""}
          placeholder="Votre nom"
          maxLength={80}
          required
          autoComplete="name"
        />
      </label>
      <button className="button button-small" type="submit" disabled={pending}>
        <Check size={15} aria-hidden="true" /> {pending ? "…" : "Enregistrer"}
      </button>
      {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}
    </form>
  );
}
