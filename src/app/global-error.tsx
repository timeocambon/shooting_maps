"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <main className="admin-gate">
          <section>
            <p className="kicker">Erreur inattendue</p>
            <h1>Une erreur est survenue.</h1>
            <p>L’équipe a été prévenue automatiquement. Vous pouvez réessayer ou revenir à l’accueil.</p>
            <a className="button" href="/">Retour à l’accueil</a>
          </section>
        </main>
      </body>
    </html>
  );
}
