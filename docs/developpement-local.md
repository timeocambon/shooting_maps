# Développement local

## Prérequis

- Node.js 22 ;
- npm ;
- Docker en fonctionnement.

## Installation

```bash
npm install
npm run db:start
cp .env.example .env.local
npm run db:reset
npm run dev
```

`npm run db:start` affiche l'URL locale et une clé publique. Reportez ces deux
valeurs dans `.env.local`. N'ajoutez jamais la clé `service_role` ou la clé
secrète dans une variable commençant par `NEXT_PUBLIC_`.

L'application est disponible sur `http://127.0.0.1:3000`. Supabase Studio est
disponible sur `http://127.0.0.1:54323` et la boîte e-mail locale sur
`http://127.0.0.1:54324`.

Si Supabase n'est pas démarré ou si les variables sont absentes, l'application
utilise automatiquement trois fiches fictives embarquées. Ce mode sert seulement
à travailler sur l'interface.

## Créer le premier administrateur local

1. Dans Supabase Studio, ouvrez Authentication puis créez un utilisateur avec
   une adresse de test et un mot de passe fort.
2. Dans l'éditeur SQL, associez cet utilisateur au rôle administrateur :

```sql
insert into public.admin_users (user_id, role, display_name)
select id, 'administrator', 'Admin local'
from auth.users
where email = 'adresse-de-test@example.com';
```

3. Ouvrez `/admin`, connectez-vous et scannez le QR code TOTP avec une
   application d'authentification.
4. Depuis le tableau de bord, utilisez « Créer et publier une fiche test » pour
   vérifier la chaîne complète jusqu'à la carte publique.

Les inscriptions sont désactivées : la création d'un compte d'administration
reste une action explicite réalisée dans Supabase.

## Tester une contribution

1. Ouvrez `/proposer` et complétez les cinq étapes avec deux images d'au moins
   1000 × 600 pixels.
2. Après l'envoi, utilisez le bouton « Ouvrir le lien de confirmation » affiché
   uniquement en développement. En production, ce lien est envoyé par Brevo.
3. Connectez-vous à `/admin`, ouvrez « Propositions », puis acceptez ou refusez
   la contribution.
4. En cas d'acceptation, la fiche et ses variantes WebP apparaissent sur la
   carte publique. Les fichiers originaux restent dans le compartiment privé.

## Tester un signalement et la maintenance

1. Ouvrez une fiche publique puis choisissez « Signaler une information ».
2. Un danger, une personne identifiable ou une propriété privée remonte avec
   une priorité haute. Les deux derniers motifs demandent une adresse e-mail.
3. Connectez-vous à `/admin/signalements`, prenez l'alerte en charge et cochez
   le masquage immédiat si la fiche doit disparaître de la carte.
4. Utilisez `/admin/spots` pour corriger, marquer comme vérifiée, masquer,
   archiver ou restaurer une fiche.
5. Une fiche masquée ou archivée conserve son URL publique, mais cette page
   n'affiche plus aucune coordonnée.

Pour tester un véritable envoi d'e-mail, renseignez `BREVO_API_KEY` et
`BREVO_SENDER_EMAIL` dans `.env.local`. Ces valeurs ne doivent jamais commencer
par `NEXT_PUBLIC_` ni être ajoutées au dépôt.

## Contrôles avant de partager une modification

```bash
npm run lint
npm run typecheck
npm run test
npx supabase test db
npm run build
```

Les tests de base vérifient notamment que le rôle public ne peut lire ni les
propositions, ni les signalements, ni les coordonnées exactes ; qu'un jeton ne
peut servir qu'une fois ; qu'une double décision est refusée ; qu'un signalement
critique est prioritaire ; et qu'un masquage retire immédiatement les coordonnées
de l'exposition publique.

## Modifier le schéma

1. Créez une nouvelle migration avec `npx supabase migration new nom_court`.
2. Modifiez uniquement cette nouvelle migration ; ne réécrivez pas une migration
   déjà appliquée dans un environnement partagé.
3. Lancez `npm run db:reset` pour rejouer tout l'historique depuis zéro.
4. Ajoutez ou adaptez les tests dans `supabase/tests/database/`.
5. Régénérez les types avec `npm run db:types`.

## Arrêter les services

```bash
npm run db:stop
```
