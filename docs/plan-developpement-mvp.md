# Plan de développement du MVP — Spotride Toulouse

Ce document transforme le cahier des charges en étapes de réalisation. Il ne le
remplace pas : les règles produit, de sécurité et de modération du cahier des
charges restent la référence.

## Objectif de livraison

Ouvrir une bêta privée permettant à un visiteur de trouver un spot, à un
contributeur d'en proposer un avec ses photos et à un administrateur de traiter
la proposition ou un signalement sans intervention technique.

Le chemin critique du MVP est le suivant :

1. décisions produit et techniques bloquantes ;
2. modèle de données, sécurité et environnements ;
3. consultation publique de spots déjà modérés ;
4. contribution, vérification d'e-mail et traitement des images ;
5. modération et signalements ;
6. qualité, contenu initial et bêta.

Les fonctions P1 et P2 ne doivent pas ralentir ce chemin critique.

## État d’avancement au 3 septembre 2026

- Étapes 1 et 2 : socle sécurisé, carte, recherche et fiches publiques réalisés.
- Étape 3 : contribution, images, confirmation d’e-mail et file de propositions réalisées.
- Étape 4 : signalements, masquage d’urgence et maintenance du catalogue réalisés.
- Prochaine étape : qualité, conformité et exploitation avant la bêta privée.

Le passage à `review_due` est évalué automatiquement lors de l’ouverture du
tableau de bord ou du catalogue. Une exécution planifiée indépendante de toute
visite sera configurée avec l’environnement de production à l’étape 5.

## Règles de pilotage

- Travailler par parcours complet utilisable, pas uniquement par couches
  techniques.
- Déployer chaque lot en préproduction avec des données de test réalistes.
- Ajouter les contrôles de sécurité et d'accessibilité pendant le développement,
  pas seulement à la fin.
- Versionner le schéma de base de données et les textes de consentement.
- Ne jamais publier automatiquement une contribution.
- Conserver une trace des décisions de modération et des actions sensibles.
- Tester en priorité sur un téléphone réel et avec une connexion limitée.

## Étape 0 — Cadrage à verrouiller

### Objectif

Éviter de construire le socle sur des choix encore ambigus.

### Travail produit

- Confirmer le nom de travail avant domaine ou identité définitive.
- Valider le rayon initial de 60 km et la liste des catégories.
- Rédiger la première version de la charte de contribution et de modération.
- Définir précisément ce qu'est une position `exacte`, `approximative` et
  `sensible`.
- Préparer 5 fiches représentatives servant de jeu de conception, puis viser 15
  fiches avant les tests de bout en bout.
- Mener les entretiens motards et photographes prévus dans le cahier des charges.

### Travail technique

- Valider les décisions recensées dans `docs/decisions-techniques.md`.
- Définir les environnements local, préproduction et production.
- Choisir la région d'hébergement et documenter les sous-traitants traitant des
  données personnelles.
- Décider des durées de conservation des propositions non confirmées, refusées
  et des originaux d'images.

### Critère de sortie

Les choix qui influencent le schéma, l'authentification, le stockage, la carte et
l'e-mail sont actés. Un petit catalogue représentatif est disponible pour les
tests.

## Étape 1 — Socle applicatif et données

### Objectif

Obtenir une application déployable, une base versionnée et une première chaîne
d'administration sécurisée.

### Livrables

- Application TypeScript responsive avec rendu serveur ou hybride.
- Qualité automatisée : formatage, analyse statique, tests et vérification de
  compilation.
- Configuration séparée par environnement et exemple de variables sans secret.
- Base PostgreSQL avec extension géographique et migrations versionnées.
- Stockage objet séparant les originaux privés des variantes publiables.
- Authentification administrateur et vérification des rôles côté serveur.
- Journal d'audit pour les créations, modifications et changements d'état.
- Données de référence : catégories, moments, accès, fréquentation, sols, motifs
  de signalement et paramètres de zone.
- Script ou interface d'import du catalogue initial.

### Premier modèle de domaine

- `spots` et leurs états de publication ;
- `spot_photos` et leur état de modération ;
- `proposals` et leurs transitions d'état ;
- `proposal_photos` ;
- `reports` ;
- `moderation_actions` pour l'historique ;
- `admin_users` ou rattachement équivalent au fournisseur d'identité ;
- `settings` et catégories administrables.

Les coordonnées publiques doivent être calculées côté serveur selon la précision
d'affichage. Les coordonnées exactes d'un spot sensible ne doivent jamais être
envoyées au navigateur public.

### Tests indispensables

- Une migration peut être appliquée sur une base vide.
- Un visiteur ne peut lire que les spots publiables.
- Un modérateur et un administrateur n'ont pas les mêmes permissions.
- Un changement d'état invalide est refusé côté serveur.
- Une action sensible crée une entrée d'audit.

### Critère de sortie

Un administrateur authentifié peut créer une fiche de test, la publier, la
masquer et retrouver l'historique de ces actions en préproduction.

## Étape 2 — Découverte publique

### Objectif

Rendre le parcours principal « trouver un spot » complet sur mobile et
ordinateur.

### Tranche 2.1 — Carte et liste

- Carte centrée sur Toulouse sans demander la géolocalisation.
- Marqueurs regroupés lorsque la carte est éloignée.
- Liste synchronisée avec la carte et sélection bidirectionnelle.
- Limitation et pagination des résultats chargés.
- État vide et appel à contribution.

### Tranche 2.2 — Recherche et filtres

- Recherche par nom de lieu ou commune.
- Filtres P0 et filtre de distance.
- Filtres actifs visibles et supprimables individuellement.
- Zone et filtres persistés dans l'URL partageable.
- Géolocalisation demandée uniquement après une action explicite.

### Tranche 2.3 — Fiche spot

- Route stable par slug et métadonnées propres à la fiche.
- Galerie responsive avec image de secours et chargement progressif.
- Accès, sécurité, sol, fréquentation et dernière vérification visibles.
- Avertissements placés avant le bouton d'itinéraire.
- Partage, itinéraire et accès au formulaire de signalement.
- Comportement dédié pour les spots sensibles, masqués et archivés.

### Tests indispensables

- Synchronisation carte/liste et sérialisation des filtres dans l'URL.
- Recherche géographique et règles de visibilité des coordonnées.
- Navigation clavier, focus, labels et zoom navigateur.
- Rendu d'une fiche avec image absente ou défaillante.
- Métadonnées, sitemap et exclusion des fiches non publiées.

### Critère de sortie

Un utilisateur extérieur peut trouver et comparer des spots, comprendre les
risques et ouvrir un itinéraire sans créer de compte.

## Étape 3 — Contribution et images

### Objectif

Permettre une proposition complète sans publication automatique.

### Tranche 3.1 — Formulaire en cinq étapes

- Localisation, identité, accès/sécurité, photos, contact/validation.
- Validation par étape avec erreurs rattachées aux bons champs.
- Brouillon local conservé au moins sept jours et versionné pour éviter les
  incompatibilités après une évolution du formulaire.
- Récapitulatif et consentements avec version des textes acceptés.
- Protection contre le double envoi.

### Tranche 3.2 — Téléversement et traitement

- 2 à 6 fichiers JPEG, PNG ou WebP.
- Vérification du contenu réel, du poids et des dimensions côté serveur.
- Originaux privés et accès limités aux personnes autorisées.
- Création de variantes responsives, suppression des métadonnées et
  réorganisation de la galerie.
- Quarantaine ou rejet explicite en cas d'échec de traitement.

### Tranche 3.3 — Vérification d'e-mail

- Création dans l'état `email_pending`.
- Lien temporaire, non devinable, à usage unique.
- Passage à `submitted` uniquement après confirmation.
- Identifiant de suivi affiché et envoyé par e-mail.
- Expiration et nettoyage des propositions jamais confirmées.

### Tests indispensables

- Reprise d'un brouillon et migration ou abandon explicite d'un ancien brouillon.
- Limites de fichiers, faux types MIME, fichier corrompu et envoi interrompu.
- Expiration, rejeu et falsification du lien de confirmation.
- Limitation de débit et protection anti-robot.
- Échec d'e-mail sans perte silencieuse de la proposition.

### Critère de sortie

Une personne peut proposer un spot depuis un téléphone, confirmer son adresse et
retrouver un numéro de suivi ; la proposition apparaît ensuite dans la file de
modération avec ses originaux protégés.

## Étape 4 — Modération et signalements

### Objectif

Donner à l'équipe un circuit opérationnel et traçable avant toute ouverture.

### File de propositions

- Tri par ancienneté, état et priorité.
- Vue détaillée réunissant localisation, réponses, photos et contrôles qualité.
- Correction, demande d'information, approbation, refus et doublon.
- Classement sensible et choix de la précision publique.
- Note interne et historique des décisions.
- Notifications transactionnelles correspondant aux transitions.

### Catalogue de spots

- Recherche et filtres par état.
- Modification, publication, masquage, archivage et restauration.
- Mise à jour explicite de la date et de l'auteur de vérification.
- Passage automatique à `review_due` après douze mois sans vérification.

### Signalements

- Formulaire public avec motifs et contact conditionnel.
- Priorité haute automatique pour danger, personne identifiable et propriété
  privée.
- Masquage rapide du spot ou de la photo concernée.
- Traitement, décision et note interne journalisés.

### Tests indispensables

- Toutes les transitions d'état et permissions par rôle.
- Double traitement concurrent d'une même proposition.
- Masquage immédiat et absence de fuite des coordonnées après masquage.
- Classement automatique des signalements critiques.
- Relance de vérification et restauration d'une fiche.

### Critère de sortie

Un administrateur peut traiter les trois parcours de référence du cahier des
charges sans accès direct à la base ni intervention d'un développeur.

## Étape 5 — Qualité, conformité et exploitation

### Objectif

Passer d'une application fonctionnelle à un service exploitable en sécurité.

### Livrables

- Pages À propos, charte, confidentialité, mentions légales et retrait.
- Mesure d'audience limitée aux événements listés dans le cahier des charges,
  sans conservation par défaut de la position du visiteur.
- Suivi d'erreurs avec filtrage des e-mails, coordonnées, jetons et contenus
  sensibles.
- En-têtes de sécurité, politique de contenu, protections CSRF lorsque
  nécessaires et revue des dépendances.
- Sauvegardes quotidiennes et test documenté de restauration.
- Budget de performance mobile et optimisation des images.
- Audit d'accessibilité manuel complétant les tests automatisés.
- Procédure d'incident pour masquer rapidement un spot ou une photo.
- Politique de rétention et tâches automatiques de suppression.

### Critère de sortie

Tous les points de `docs/checklist-lancement-mvp.md` sont cochés ou font l'objet
d'une dérogation documentée avec un responsable et une date de correction.

## Étape 6 — Contenu et bêta privée

### Objectif

Valider les parcours réels et la qualité du catalogue avant l'ouverture.

### Déroulement

1. Importer et vérifier 15 premières fiches.
2. Faire tester les parcours par cinq personnes extérieures sur plusieurs
   téléphones.
3. Corriger les blocages et mesurer la complétion du formulaire.
4. Atteindre 25 à 40 spots vérifiés.
5. Ouvrir à une petite audience locale, surveiller les erreurs et le délai de
   modération.
6. Décider de l'ouverture progressive à partir des indicateurs du cahier des
   charges.

### Critère de sortie

La définition de « terminé » du cahier des charges et la checklist de lancement
sont satisfaites. L'équipe sait exploiter, sauvegarder, restaurer et modérer le
service.

## Ordre recommandé des premières tâches

1. Valider la pile technique et les fournisseurs.
2. Écrire le schéma des états et les règles d'autorisation.
3. Initialiser l'application, les contrôles qualité et les environnements.
4. Créer les migrations du domaine et les données de référence.
5. Construire le premier parcours vertical : créer un spot en administration,
   le publier et l'afficher sur une carte publique.
6. Ajouter la fiche détaillée, la recherche et les filtres.
7. Construire le parcours vertical de contribution jusqu'à la modération.
8. Ajouter les signalements et le masquage d'urgence.
9. Terminer les exigences transverses et préparer la bêta.

## Hors périmètre jusqu'à validation du MVP

- comptes publics et favoris ;
- profils photographes et demandes de devis ;
- abonnement, sponsoring, réservation et paiement ;
- avis, notes, messagerie et réseau social ;
- application mobile native et extension à d'autres villes.
