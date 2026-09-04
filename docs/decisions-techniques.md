# Décisions techniques retenues

Le cahier des charges propose une direction sans imposer tous les fournisseurs.
Les choix ci-dessous sont désormais retenus pour le MVP. Ils pourront être
réévalués si les tests utilisateurs, les coûts ou les contraintes juridiques
font apparaître un problème concret.

## Pile applicative

- Framework web : Next.js App Router avec TypeScript strict, rendu serveur pour les fiches et
  composants interactifs pour la carte et les formulaires.
- Exécution : Node.js 22, npm et versions verrouillées dans `package-lock.json`.
- Styles : CSS natif partagé, sans bibliothèque de composants imposant son
  système visuel.
- Base et services : Supabase avec PostgreSQL/PostGIS, authentification et
  stockage objet.
- Carte : MapLibre GL JS. Le style MapLibre de démonstration est réservé au
  développement ; MapTiler Cloud est retenu pour les tuiles et le géocodage de
  production avec une offre autorisant l'usage commercial.
- Validation : schémas partagés côté client et serveur, avec le serveur comme
  autorité.
- Tests : Vitest pour le domaine, pgTAP pour le schéma et les politiques, puis
  contrôles HTTP et Playwright pour les parcours complets avant la bêta.

## Fournisseurs et exploitation

### Hébergement de l'application

Vercel est retenu pour le MVP afin de conserver le support direct de Next.js,
les prévisualisations par branche et un retour arrière simple. Les fonctions
seront placées à Paris (`cdg1`). Le projet n'est pas encore déployé.

### Base, identité et stockage

Un projet Supabase dédié sera créé dans la région spécifique Paris
(`eu-west-3`) pour rapprocher application et données et éviter un groupe de
régions pouvant sortir de l'Union européenne. La base, Auth et Storage restent
dans le même projet pour limiter le coût opérationnel du MVP.

### Carte et géocodage

MapLibre assure le rendu et le regroupement des marqueurs. MapTiler fournit le
style, les tuiles et la recherche d'adresse. La clé publique devra être limitée
aux domaines autorisés et un plafond de dépense devra être configuré. Les
itinéraires continuent de s'ouvrir dans l'application cartographique choisie par
le visiteur.

### E-mail transactionnel

Brevo est retenu pour les messages de contribution et de modération. En local,
un lien de confirmation réservé au développement permet de tester le parcours
sans envoyer d'e-mail. La mise en production exigera SPF, DKIM, DMARC, suivi
des rebonds et modèles versionnés.

### Traitement des images

Les originaux restent dans un compartiment Supabase privé. Le traitement Node.js
avec Sharp contrôle le contenu décodé, les dimensions et le poids, puis produit
une variante WebP sans métadonnées. Seules ces variantes peuvent être copiées
dans le compartiment public lors d'une approbation manuelle.

### Authentification d'administration

Supabase Auth est retenu avec comptes créés sur invitation, mot de passe fort et
second facteur TOTP obligatoire. L'inscription publique est désactivée. Les
rôles sont vérifiés dans la couche d'accès serveur puis de nouveau par les
politiques PostgreSQL.

### Mesure d'audience et suivi d'erreurs

Plausible est retenu pour les événements produit limités à la liste blanche du
cahier des charges. Sentry sera utilisé pour les erreurs avec filtrage des
e-mails, coordonnées, jetons et contenus de formulaire. Ces deux intégrations
seront ajoutées au lot qualité, avant la bêta.

## Décisions de domaine à formaliser

- Matrice des transitions autorisées pour les propositions et les spots.
- Algorithme de position approximative et niveau d'accès aux coordonnées exactes.
- Données obligatoires pour autoriser une publication.
- Seuils de poids, dimensions et formats d'image réellement acceptés.
- Durées de validité des liens sécurisés.
- Durées de conservation et procédure d'effacement.
- Niveau de priorité et délai cible pour chaque motif de signalement.
- Règle de génération et de changement des slugs.
- Comportement public d'un slug masqué, archivé ou remplacé par un doublon.

## Architecture à préserver quel que soit le fournisseur

- Le domaine ne dépend pas directement des SDK de carte, e-mail ou stockage.
- Les transitions d'état passent par des services métier testables et audités.
- L'interface publique ne reçoit jamais les coordonnées exactes interdites.
- Les écritures administratives sont autorisées et validées côté serveur.
- Les tâches différées sont idempotentes et rejouables.
- Les clés et secrets sont séparés par environnement et absents du dépôt.
- Les données de test ne contiennent pas de données personnelles réelles.

## État de mise en œuvre

Le framework, la carte, Supabase local, PostGIS, les migrations, le stockage,
l'authentification renforcée, la contribution avec photos et la file de
modération sont opérationnels. Les comptes hébergés et services payants ne
seront créés qu'au moment de préparer la préproduction.
