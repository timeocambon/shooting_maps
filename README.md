# Spotride Toulouse

Application web communautaire pour découvrir et proposer des lieux adaptés aux
shootings photo de motos autour de Toulouse.

Les parcours des lots 1 à 4 sont maintenant reliés de bout en bout. La prochaine
étape est le **lot 5 — qualité, conformité et exploitation** du MVP.

## Documentation

- [Cahier des charges du MVP](docs/cahier-des-charges-mvp.md)
- [Plan de développement du MVP](docs/plan-developpement-mvp.md)
- [Décisions techniques à valider](docs/decisions-techniques.md)
- [Checklist de lancement](docs/checklist-lancement-mvp.md)
- [Développement local](docs/developpement-local.md)

## Périmètre immédiat

Le développement porte d'abord sur les fonctionnalités P0 : découverte des
spots, fiches détaillées, contribution vérifiée par e-mail, signalements et
administration de la modération. L'annuaire de photographes et la monétisation
restent hors du MVP.

## Socle disponible

- carte MapLibre et catalogue public responsive ;
- fiches détaillées avec avertissements prioritaires ;
- mode de démonstration sans service externe ;
- base locale Supabase/PostgreSQL avec PostGIS et migrations reproductibles ;
- coordonnées sensibles arrondies avant de quitter la base ;
- authentification d'administration par mot de passe et TOTP ;
- rôles, politiques d'accès, transitions d'état et journal de modération ;
- formulaire public guidé en cinq étapes avec brouillon local de sept jours ;
- contrôle du contenu réel des photos, originaux privés et variantes WebP sans métadonnées ;
- confirmation d'e-mail par lien temporaire et numéro de suivi ;
- file de modération avec publication, demande de précisions, refus et doublon ;
- publication atomique des fiches et de leur galerie après décision manuelle.
- signalement public avec contact conditionnel, anti-robot et limitation de débit ;
- priorité haute automatique et masquage immédiat lors d’une alerte sensible ;
- file de traitement des signalements avec décision et note interne ;
- catalogue administrable avec recherche, correction, archivage et restauration ;
- relance automatique de vérification des fiches anciennes à l’ouverture de
  l’administration ;
- page publique explicative sans coordonnées pour une fiche masquée ou archivée.

## Démarrage rapide

Prérequis : Node.js 22 et Docker.

```bash
npm install
npm run db:start
cp .env.example .env.local
npm run dev
```

Sans Supabase, `npm run dev` affiche automatiquement les données fictives
embarquées. La procédure complète, dont la création du premier administrateur,
est décrite dans [Développement local](docs/developpement-local.md).
