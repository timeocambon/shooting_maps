"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass, X } from "lucide-react";

const STORAGE_KEY = "spotride:howto-hint-dismissed";

/**
 * Encart d'aide affiché tant qu'il n'a pas été fermé.
 *
 * Il est rendu côté serveur, donc présent dès le premier affichage : une
 * apparition après coup décalerait la carte vers le bas. Le revers est un bref
 * passage à l'écran pour qui l'a déjà fermé, le temps que le navigateur lise
 * sa préférence — c'est le compromis le moins gênant des deux.
 */
export function HowtoHint() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
    } catch {
      // Navigation privée ou stockage refusé : l'encart reste affiché, ce qui
      // est sans conséquence.
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Sans stockage, l'encart réapparaîtra à la prochaine visite.
    }
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
