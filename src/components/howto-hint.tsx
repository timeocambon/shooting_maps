"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Compass, X } from "lucide-react";

const STORAGE_KEY = "spotride:howto-hint-dismissed";

// La préférence vit hors de React (localStorage), elle est donc lue avec
// useSyncExternalStore plutôt que recopiée dans un état depuis un effet :
// écrire setState directement dans un effet déclenche des rendus en cascade,
// et la règle react-hooks/set-state-in-effect le refuse.
const listeners = new Set<() => void>();
// Filet pour la navigation privée : si l'écriture échoue, la fermeture doit
// malgré tout masquer l'encart pour la durée de la visite.
let dismissedInMemory = false;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Un autre onglet qui ferme l'encart met celui-ci à jour aussi.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): boolean {
  if (dismissedInMemory) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Navigation privée ou stockage refusé : l'encart reste affiché, ce qui
    // est sans conséquence.
    return false;
  }
}

// Au rendu serveur l'encart est toujours présent : une apparition après coup
// décalerait la carte vers le bas. Le revers est un bref passage à l'écran
// pour qui l'a déjà fermé — c'est le compromis le moins gênant des deux.
function getServerSnapshot(): boolean {
  return false;
}

/** Encart d'aide affiché tant qu'il n'a pas été fermé. */
export function HowtoHint() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function dismiss() {
    dismissedInMemory = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Sans stockage, l'encart réapparaîtra à la prochaine visite.
    }
    for (const listener of listeners) listener();
  }

  if (dismissed) return null;

  return (
    <aside className="howto-hint">
      <span className="howto-hint-icon" aria-hidden="true"><Compass size={17} /></span>
      <p>
        <strong>Première visite ?</strong> Cliquez un point sur la carte pour ouvrir sa fiche,
        ou filtrez par ambiance et par distance.
      </p>
      <Link href="/comment-ca-marche">
        Comment ça marche <ArrowRight size={15} aria-hidden="true" />
      </Link>
      <button type="button" onClick={dismiss} aria-label="Masquer cette aide">
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  );
}
