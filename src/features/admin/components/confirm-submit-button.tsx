"use client";

import { Trash2 } from "lucide-react";

type ConfirmSubmitButtonProps = {
  label: string;
  message: string;
  className?: string;
};

/**
 * Bouton de suppression : demande confirmation avant d'envoyer le formulaire.
 * Sans JavaScript, le formulaire part directement — la fonction SQL reste la
 * seule vraie barrière (vérification du rôle et journalisation).
 */
export function ConfirmSubmitButton({ label, message, className = "text-decision danger" }: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <Trash2 size={14} aria-hidden="true" /> {label}
    </button>
  );
}
