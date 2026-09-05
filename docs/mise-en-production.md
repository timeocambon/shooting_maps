# Mise en production (lot 5)

Cette page liste les actions qui restent à faire **côté comptes et infrastructure**,
que le code ne peut pas faire à ta place. Le code applicatif (Sentry, Plausible,
e-mails Brevo) est déjà écrit et n'attend que les bonnes variables
d'environnement pour s'activer.

## 1. Hébergement Vercel

1. Crée un projet Vercel relié au dépôt Git de Spotride Toulouse.
2. Le fichier `vercel.json` fixe déjà la région des fonctions sur Paris (`cdg1`).
3. Renseigne dans les paramètres du projet Vercel (Settings → Environment
   Variables) toutes les variables listées dans `.env.example`, avec leurs
   vraies valeurs de production. Sépare bien Production / Preview / Development
   si les valeurs diffèrent (par exemple une base Supabase de préproduction
   pour les previews de branche).
4. Ne mets jamais `SUPABASE_SERVICE_ROLE_KEY` ni `SENTRY_AUTH_TOKEN` dans une
   variable commençant par `NEXT_PUBLIC_`.

## 2. Supabase de production

1. Crée un nouveau projet Supabase dédié, région `eu-west-3` (Paris), comme
   acté dans `docs/decisions-techniques.md`.
2. Applique les migrations : `supabase link` puis `supabase db push`, ou rejoue
   l'historique de `supabase/migrations/` selon la méthode que tu préfères.
3. Active les **sauvegardes automatiques quotidiennes** dans les réglages du
   projet (Database → Backups). Sur le plan payant, la restauration
   ponctuelle (PITR) est recommandée en plus de la sauvegarde quotidienne.
4. Fais un test de restauration au moins une fois avant l'ouverture publique,
   et note la procédure quelque part (checklist de lancement, point
   « Une restauration a été réalisée et documentée »).
5. Crée le premier compte administrateur de production en suivant la même
   procédure que `docs/developpement-local.md`, avec une vraie adresse e-mail
   et un mot de passe fort.

## 3. E-mail transactionnel (Brevo)

Le code envoie déjà les e-mails réels dès que `BREVO_API_KEY` et
`BREVO_SENDER_EMAIL` sont renseignés (`src/features/proposals/server/confirmation-email.ts`).
Il reste à faire uniquement côté compte :

1. Crée un compte Brevo (ou utilise le tien) et une clé API dédiée à ce projet.
2. Configure le domaine d'envoi : enregistrements **SPF**, **DKIM** et
   **DMARC** chez ton fournisseur DNS, puis valide le domaine dans Brevo.
3. Renseigne `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` et `BREVO_SENDER_NAME` dans
   Vercel.
4. Surveille le taux de rebond dans le tableau de bord Brevo après les
   premiers envois réels.

## 4. Suivi d'erreurs (Sentry)

Le SDK est déjà intégré (`src/instrumentation.ts`, `src/instrumentation-client.ts`,
`src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `next.config.ts`) et
filtre automatiquement les e-mails, numéros de téléphone et champs de
formulaire sensibles avant l'envoi (`src/lib/observability/sentry-scrub.ts`),
conformément à `docs/decisions-techniques.md`. Il reste à faire :

1. Crée un projet Sentry (plateforme Next.js).
2. Récupère le DSN et renseigne `NEXT_PUBLIC_SENTRY_DSN` dans Vercel.
3. Pour l'envoi des source maps au build (recommandé, facilite le débogage),
   renseigne aussi `SENTRY_ORG`, `SENTRY_PROJECT` et un `SENTRY_AUTH_TOKEN`
   (jeton scope "project:releases" suffit). Sans ce jeton, le build fonctionne
   quand même, juste sans source maps lisibles côté Sentry.
4. Vérifie une fois en production qu'une erreur provoquée volontairement
   remonte bien dans Sentry, sans donnée personnelle en clair dans
   l'événement.

## 5. Mesure d'audience (Plausible)

1. Ajoute le domaine du site dans Plausible (compte cloud ou instance
   auto-hébergée).
2. Renseigne `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` dans Vercel avec ce domaine exact.
   Le script (`src/app/layout.tsx`) ne se charge que si cette variable est
   présente.
3. Limite les événements personnalisés suivis à la liste blanche définie dans
   le cahier des charges — aucun événement supplémentaire n'est ajouté par ce
   lot.

## 6. Avant l'ouverture publique réelle

- `src/app/layout.tsx` désindexe actuellement tout le site
  (`robots: { index: false, follow: false }`). C'est volontaire tant que le
  catalogue ne contient pas les 25 à 40 fiches vérifiées prévues (voir étape
  « Catalogue »). Cette ligne devra être retirée ou conditionnée avant le
  vrai lancement, en cohérence avec le point de la checklist sur le sitemap et
  l'indexation des fiches masquées/archivées.
- Relis `docs/checklist-lancement-mvp.md` dans son ensemble : ce document ne
  couvre que la partie infrastructure/observabilité de la section
  « Fiabilité et exploitation », pas la checklist complète.
