# Cahier des charges — Spotride Toulouse

Version 1.0 — cadrage du MVP

## 1. Résumé du projet

Spotride Toulouse est une application web communautaire consacrée aux lieux adaptés aux shootings photo de motos autour de Toulouse.

Le service ne se limite pas à afficher des coordonnées sur une carte. Chaque spot doit fournir les informations nécessaires pour préparer réellement une séance : type de décor, exemples de rendu, meilleur moment de la journée, accès, stationnement, fréquentation, état du sol, contraintes et risques connus.

La consultation est publique. Les utilisateurs peuvent proposer un nouveau spot, mais aucune contribution n'est publiée sans contrôle manuel. Une partie professionnelle permettra ensuite aux photographes locaux de présenter leur travail et de recevoir des demandes de contact.

Nom de travail : **Spotride Toulouse**. Le nom définitif devra être vérifié avant toute création de marque ou de nom de domaine.

## 2. Problème à résoudre

Les motards qui souhaitent photographier leur moto rencontrent plusieurs difficultés :

- les lieux intéressants sont dispersés entre réseaux sociaux, recommandations orales et favoris personnels ;
- une photo vue en ligne ne donne pas forcément la position ni les conditions d'accès ;
- une simple adresse ne précise pas la lumière, la circulation, le stationnement ou les restrictions ;
- les spots peuvent devenir inaccessibles ou sensibles sans que l'information soit mise à jour ;
- il est difficile de trouver rapidement un photographe ayant un style adapté à l'univers moto.

## 3. Proposition de valeur

### Promesse principale

> Trouver en quelques minutes un spot adapté à sa moto, au style de photo recherché et au moment de la journée.

### Différenciation

Spotride doit se distinguer d'une carte généraliste grâce à la qualité de ses fiches :

- information spécialisée pour les shootings moto ;
- photos de référence prises sur place ;
- conseils de lumière et de cadrage ;
- indications d'accès et de sécurité ;
- contenu contrôlé avant publication ;
- signalement et mise à jour communautaires ;
- réseau local de photographes spécialisés.

## 4. Zone de lancement

Le lancement est volontairement limité à Toulouse et à un rayon indicatif de 60 kilomètres.

Cette zone doit pouvoir être ajustée dans l'administration sans modification du code. Un spot situé légèrement en dehors peut être accepté s'il présente une forte valeur et reste raisonnablement accessible depuis Toulouse.

Objectif avant ouverture publique : **25 à 40 fiches complètes et vérifiées**.

## 5. Utilisateurs ciblés

### Motard visiteur

Il cherche rapidement un lieu correspondant au style de sa moto et à l'ambiance souhaitée. Il consulte surtout depuis son téléphone, filtre les résultats et ouvre plusieurs fiches avant de choisir.

Ses besoins prioritaires sont la pertinence visuelle, la distance, l'accès et la certitude de ne pas arriver dans un lieu inutilisable.

### Motard contributeur

Il connaît un lieu intéressant et souhaite le partager. Il accepte de donner des informations précises et de fournir des photos dont il peut autoriser la publication.

Son parcours doit rester court, lui permettre de sauvegarder un brouillon local et expliquer clairement pourquoi sa proposition doit être vérifiée.

### Photographe local

Il souhaite montrer son style et obtenir des demandes de personnes déjà intéressées par un shooting moto.

Dans un premier temps, les photographes pilotes seront intégrés manuellement. La création autonome de profil et le paiement arriveront après validation de l'intérêt commercial.

### Administrateur

Il contrôle les propositions, corrige les informations, publie les fiches, masque un lieu devenu problématique et traite les signalements.

## 6. Principes produit

- **Mobile en priorité** : la majorité des consultations aura lieu pendant la préparation d'une sortie ou sur la route.
- **Consultation sans compte** : la carte et les fiches restent accessibles librement.
- **Contribution légère** : une adresse e-mail vérifiée suffit dans le MVP ; aucun profil public n'est requis.
- **Qualité avant quantité** : une fiche incomplète n'est pas publiée uniquement pour augmenter le nombre de points.
- **Sécurité avant engagement** : aucun mécanisme ne doit encourager la vitesse, l'accès illégal ou le stationnement dangereux.
- **Respect du lieu** : un emplacement fragile peut être affiché de manière approximative ou retiré.
- **Publicité identifiable** : toute mise en avant payante doit être clairement indiquée.

## 7. Périmètre fonctionnel

### Priorité P0 — indispensable au lancement

- carte centrée sur la zone toulousaine ;
- liste des spots synchronisée avec la carte ;
- regroupement des marqueurs lorsque la carte est éloignée ;
- recherche par nom de lieu ou commune ;
- filtres essentiels ;
- fiche détaillée d'un spot ;
- partage d'un lien vers une fiche ;
- formulaire de proposition avec ajout de photos ;
- vérification de l'adresse e-mail du contributeur ;
- page de confirmation et numéro de suivi ;
- formulaire de signalement d'une fiche ;
- interface d'administration sécurisée ;
- file de modération ;
- création, correction, publication, masquage et archivage d'un spot ;
- traitement des signalements ;
- pages légales et mécanisme de demande de retrait ;
- mesure d'audience limitée aux événements nécessaires au produit.

### Priorité P1 — après validation de l'usage

- annuaire de photographes locaux ;
- fiche photographe avec portfolio, styles, zone et moyens de contact ;
- demande de devis envoyée au photographe ;
- profil professionnel enrichi ;
- favoris ;
- historique des propositions pour les contributeurs ;
- filtres avancés ;
- affichage approximatif des lieux sensibles réservé aux membres vérifiés ;
- notifications lors du changement d'état d'une proposition.

### Priorité P2 — croissance

- abonnement photographe Pro ;
- mises en avant sponsorisées ;
- réservation et acompte ;
- commission sur les séances conclues ;
- collections et itinéraires de spots ;
- ajout progressif d'autres villes ;
- application mobile seulement si les usages le justifient.

### Hors périmètre du MVP

- réseau social interne ;
- messagerie instantanée ;
- avis publics et notes ;
- suivi de position en direct ;
- itinéraires de conduite sportive ;
- publication automatique sans modération ;
- carte nationale vide au lancement ;
- paiement intégré.

## 8. Arborescence du MVP

### Espace public

- `/` — carte, recherche et liste des spots ;
- `/spots/[slug]` — fiche détaillée ;
- `/proposer` — formulaire de contribution ;
- `/proposition-confirmee` — confirmation et prochaines étapes ;
- `/signaler/[spot]` — signalement d'une information ;
- `/photographes` — annuaire, masqué tant que la fonctionnalité P1 n'est pas prête ;
- `/a-propos` — mission et fonctionnement de la modération ;
- `/charte` — règles de contribution et de comportement ;
- `/confidentialite` — politique de confidentialité ;
- `/mentions-legales` — mentions légales ;
- `/demande-de-retrait` — demande concernant une photo ou une donnée.

### Administration

- `/admin` — aperçu des éléments à traiter ;
- `/admin/propositions` — file de modération ;
- `/admin/propositions/[id]` — examen détaillé ;
- `/admin/spots` — catalogue publié et masqué ;
- `/admin/spots/[id]` — modification d'une fiche ;
- `/admin/signalements` — signalements ouverts ;
- `/admin/photographes` — futurs profils professionnels ;
- `/admin/parametres` — catégories, rayon et textes éditoriaux.

## 9. Écran principal : carte et résultats

### Objectif

Permettre à un visiteur de comprendre immédiatement le service, choisir une zone et trouver un spot pertinent en moins de trois interactions.

### Éléments

- en-tête compact avec identité, lien « Proposer un spot » et menu ;
- champ de recherche par commune ou nom ;
- raccourcis de filtres visibles ;
- carte avec marqueurs regroupés ;
- tiroir ou panneau de résultats ;
- cartes de résultats avec photo, nom, commune, distance, type de décor et meilleur moment ;
- compteur de résultats ;
- bouton de recentrage ;
- indication claire lorsque la carte a été déplacée ;
- appel à contribution discret lorsque peu de résultats existent dans une zone.

### Filtres du MVP

- type de décor : urbain, industriel, architecture, nature, panorama, graffiti ;
- meilleur moment : matin, journée, golden hour, coucher de soleil, nuit ;
- accès : facile, intermédiaire, difficile ;
- fréquentation : calme, variable, fréquenté ;
- type de sol : bitume, gravier, terre, mixte ;
- distance depuis une position choisie.

### Critères d'acceptation

- la carte s'affiche même si l'utilisateur refuse la géolocalisation ;
- la position du visiteur n'est demandée qu'après une action explicite ;
- un filtre actif est visible et supprimable individuellement ;
- la liste se met à jour sans rechargement complet ;
- sélectionner un marqueur met en évidence le résultat correspondant ;
- sélectionner un résultat centre la carte sur le spot ;
- l'URL conserve au minimum la zone et les filtres pour pouvoir être partagée ;
- une image défaillante n'empêche pas l'affichage de la fiche.

## 10. Fiche détaillée d'un spot

### Informations affichées

- nom éditorial du spot ;
- commune et distance indicative ;
- galerie de 2 à 6 images ;
- catégories de décor ;
- courte description de l'ambiance ;
- meilleur moment et orientation lumineuse si elle est connue ;
- niveau d'accès ;
- stationnement et approche à pied ;
- type et état habituel du sol ;
- fréquentation et nuisances possibles ;
- consignes de sécurité ;
- statut du lieu : public, privé avec autorisation, accès à confirmer ou sensible ;
- date de dernière vérification ;
- crédits photo et contributeur si celui-ci souhaite être cité ;
- emplacement sur la carte ;
- bouton pour ouvrir l'itinéraire dans l'application cartographique du visiteur ;
- bouton de partage ;
- bouton « Signaler une information ».

### Règles d'affichage

- les avertissements importants apparaissent avant l'itinéraire ;
- un spot masqué ne doit plus exposer ses coordonnées exactes ;
- un lieu sensible peut afficher une zone approximative au lieu d'un point précis ;
- les plaques et personnes reconnaissables doivent être évitées, floutées ou couvertes par les autorisations nécessaires ;
- aucune fiche ne doit présenter un comportement dangereux comme une recommandation.

### Critères d'acceptation

- les informations importantes restent lisibles sur un écran mobile ;
- la première image est optimisée et les autres sont chargées progressivement ;
- le lien partagé ouvre directement la bonne fiche ;
- la date de vérification est toujours présente ;
- une fiche archivée retourne une page explicative sans révéler les coordonnées.

## 11. Formulaire de proposition

Le formulaire est découpé en cinq étapes et affiche une progression.

### Étape 1 — Localisation

- placement du point sur la carte ;
- recherche d'une adresse ou d'une commune ;
- possibilité de corriger le point manuellement ;
- question sur le caractère exact ou approximatif de la position ;
- confirmation que l'accès n'implique pas une intrusion.

### Étape 2 — Identité du spot

- nom proposé ;
- type de décor ;
- description courte ;
- meilleur moment ;
- particularités visuelles.

### Étape 3 — Accès et sécurité

- stationnement ;
- approche à pied ;
- type de sol ;
- circulation ;
- fréquentation ;
- risques et restrictions ;
- statut public, privé, incertain ou sensible.

### Étape 4 — Photos

- 2 images minimum et 6 maximum ;
- formats JPEG, PNG ou WebP ;
- compression avant ou après envoi ;
- réorganisation de la galerie ;
- crédit photo facultatif ;
- confirmation des droits de diffusion ;
- confirmation relative aux personnes reconnaissables ;
- avertissement concernant les plaques d'immatriculation et métadonnées de géolocalisation.

### Étape 5 — Contact et validation

- adresse e-mail obligatoire ;
- pseudonyme public facultatif ;
- récapitulatif complet ;
- acceptation de la charte ;
- acceptation des conditions de contribution ;
- information sur l'usage des données ;
- envoi puis vérification de l'adresse e-mail.

### Comportement attendu

- le brouillon est conservé localement pendant au moins sept jours ;
- les erreurs sont indiquées dans l'étape concernée ;
- un envoi multiple accidentel est bloqué ;
- après confirmation de l'e-mail, la proposition passe à l'état « à vérifier » ;
- un identifiant de suivi est affiché et envoyé par e-mail ;
- aucune publication n'est promise automatiquement.

## 12. Signalement d'une fiche

Le formulaire de signalement propose les motifs suivants :

- accès désormais interdit ;
- danger ou problème de sécurité ;
- information incorrecte ;
- demande liée à une photo ou à une personne identifiable ;
- propriété privée ou nuisance ;
- doublon ;
- autre motif.

Un signalement concernant un danger immédiat, une personne identifiable ou une propriété privée est placé en priorité haute. L'administrateur peut masquer temporairement la fiche avant d'avoir terminé l'examen.

## 13. Administration et modération

### Tableau de bord

L'administrateur voit immédiatement :

- propositions à vérifier ;
- propositions en attente d'une réponse ;
- signalements prioritaires ;
- spots dont la vérification est ancienne ;
- dernières publications et modifications.

### Examen d'une proposition

L'écran réunit la carte, les photos, les informations envoyées et les contrôles de qualité.

Actions disponibles :

- enregistrer une correction ;
- demander des informations complémentaires ;
- accepter et publier ;
- refuser avec un motif ;
- marquer comme doublon ;
- classer le lieu comme sensible ;
- masquer les coordonnées ;
- masquer ou flouter une photo avant publication ;
- conserver une note interne non visible du public.

### États d'une proposition

- `draft` — saisie non finalisée ;
- `email_pending` — en attente de vérification ;
- `submitted` — prête à être examinée ;
- `changes_requested` — informations complémentaires demandées ;
- `approved` — acceptée ;
- `rejected` — refusée ;
- `duplicate` — doublon identifié ;
- `withdrawn` — retirée par le contributeur.

### États d'un spot

- `published` — visible et indexable ;
- `hidden` — invisible temporairement ;
- `sensitive` — visible avec position limitée ;
- `archived` — fermé ou non pertinent ;
- `review_due` — à vérifier sans être nécessairement masqué.

## 14. Règles de modération

### Publication autorisée si

- le lieu peut raisonnablement accueillir un shooting sans intrusion ;
- les informations essentielles sont complètes ;
- les photos permettent d'évaluer le rendu ;
- les droits déclarés sont cohérents ;
- aucun danger majeur non maîtrisable n'est identifié ;
- la publication ne risque pas manifestement de dégrader un lieu fragile.

### Refus ou masquage si

- l'accès repose sur une infraction ou une intrusion ;
- le lieu impose un arrêt dangereux sur la chaussée ;
- les photos encouragent la vitesse ou une conduite illégale ;
- le contributeur ne peut pas autoriser la diffusion des images ;
- une personne reconnaissable est publiée sans base claire ;
- un propriétaire ou une personne concernée formule une demande crédible ;
- le spot expose un site fragile au vandalisme, aux nuisances ou à la surfréquentation ;
- les informations ne peuvent pas être vérifiées.

### Maintenance

- chaque fiche affiche sa date de dernière vérification ;
- les spots les plus consultés sont revérifiés en priorité ;
- un contrôle automatique place une fiche en `review_due` après douze mois sans mise à jour ;
- un signalement grave permet le masquage immédiat ;
- l'historique des décisions est conservé dans l'administration.

## 15. Données principales

### Spot

- identifiant ;
- slug public ;
- nom ;
- latitude et longitude ;
- précision d'affichage ;
- commune et code postal ;
- rayon de recherche ;
- description ;
- catégories ;
- meilleur moment ;
- orientation lumineuse ;
- niveau d'accès ;
- stationnement ;
- approche à pied ;
- type de sol ;
- fréquentation ;
- statut du lieu ;
- avertissements ;
- état de publication ;
- date de dernière vérification ;
- auteur de la dernière vérification ;
- dates de création et modification.

### Photo

- identifiant ;
- spot ou proposition associée ;
- fichier original protégé ;
- versions optimisées ;
- ordre dans la galerie ;
- texte alternatif ;
- crédit facultatif ;
- déclaration de droits ;
- état de modération ;
- métadonnées techniques supprimées lors de la publication ;
- dates d'ajout et de retrait.

### Proposition

- identifiant de suivi ;
- données de spot proposées ;
- e-mail du contributeur ;
- pseudonyme facultatif ;
- état ;
- consentements et version des textes acceptés ;
- commentaires de modération ;
- dates d'envoi, vérification et décision.

### Signalement

- identifiant ;
- spot concerné ;
- motif ;
- commentaire ;
- e-mail facultatif ou obligatoire selon le motif ;
- priorité ;
- état ;
- décision et note interne ;
- dates de création et traitement.

### Photographe — P1

- identité ou nom professionnel ;
- zone de déplacement ;
- biographie ;
- spécialités ;
- portfolio ;
- moyens de contact ;
- liens professionnels ;
- statut de vérification ;
- offre gratuite ou Pro ;
- état de publication.

## 16. Rôles et permissions

### Visiteur

- consulter et filtrer les spots ;
- partager une fiche ;
- proposer un spot ;
- envoyer un signalement.

### Contributeur identifié par e-mail

- confirmer sa proposition ;
- répondre à une demande de modification grâce à un lien sécurisé ;
- demander le retrait de sa contribution ;
- choisir l'affichage ou non de son pseudonyme.

### Modérateur

- examiner et corriger ;
- demander une modification ;
- publier, masquer ou archiver ;
- traiter les signalements ;
- ne peut pas modifier les comptes administrateurs.

### Administrateur

- possède tous les droits du modérateur ;
- gère les catégories, paramètres et accès ;
- consulte le journal des actions ;
- gère les photographes et futures offres commerciales.

## 17. Parcours de référence

### Trouver un spot

1. Le visiteur arrive sur la carte.
2. Il choisit « Industriel » et « Coucher de soleil ».
3. La carte et la liste affichent les résultats correspondants.
4. Il compare deux fiches.
5. Il consulte les risques et l'accès.
6. Il ouvre l'itinéraire vers le spot retenu.

### Proposer un spot

1. Le contributeur place le point.
2. Il décrit le décor, l'accès et les risques.
3. Il ajoute ses photos et confirme ses droits.
4. Il renseigne son e-mail et accepte la charte.
5. Il confirme le lien reçu.
6. La proposition apparaît dans la file de modération.
7. Il reçoit la décision ou une demande de modification.

### Traiter un signalement critique

1. Un visiteur signale un accès interdit ou une photo litigieuse.
2. Le signalement est classé prioritaire.
3. L'administrateur masque temporairement la fiche ou l'image.
4. Il vérifie les éléments et contacte les personnes nécessaires.
5. Il corrige, republie ou archive.
6. La décision est enregistrée.

## 18. Direction d'interface

### Identité visuelle

- univers sobre, photographique et routier ;
- dominante neutre pour laisser les images ressortir ;
- une couleur d'accent unique pour les actions et marqueurs ;
- aucun code graphique assimilable à une application de vitesse ou de compétition ;
- typographie lisible et moderne ;
- icônes simples accompagnées d'un libellé lorsque leur sens n'est pas évident.

### Mobile

- carte occupant la majorité de l'écran ;
- résultats dans un panneau inférieur dépliable ;
- filtres dans un tiroir ;
- actions principales accessibles au pouce ;
- galerie tactile ;
- formulaire en étapes courtes.

### Ordinateur

- carte à droite ;
- recherche et résultats dans un panneau à gauche ;
- largeur de lecture contrôlée sur les fiches ;
- administration optimisée pour comparer informations et images.

### Accessibilité

- contraste suffisant ;
- navigation au clavier ;
- focus visible ;
- labels associés aux champs ;
- textes alternatifs pour les images ;
- informations jamais transmises uniquement par la couleur ;
- prise en charge du zoom du navigateur ;
- messages d'erreur précis.

## 19. Exigences non fonctionnelles

### Performance

- contenu principal visible rapidement sur une connexion mobile courante ;
- images responsives et compressées ;
- chargement différé des images hors écran ;
- regroupement des marqueurs ;
- limite du nombre de résultats chargés simultanément ;
- cache des fiches publiées ;
- absence de vidéo automatique.

### Fiabilité

- sauvegarde quotidienne de la base ;
- conservation séparée des originaux et versions optimisées ;
- journalisation des décisions de modération ;
- possibilité de restaurer une fiche masquée ;
- messages explicites en cas d'échec d'envoi.

### Sécurité

- authentification renforcée pour l'administration ;
- rôles vérifiés côté serveur ;
- liens de contribution temporaires et non devinables ;
- validation réelle des fichiers envoyés ;
- limitation de débit sur les formulaires ;
- protection contre les envois automatisés ;
- nettoyage des contenus textuels ;
- suppression des métadonnées EXIF lors de la publication ;
- journal des actions sensibles ;
- aucun secret exposé dans le navigateur.

### Référencement

- une URL stable par spot ;
- titre et description uniques ;
- image de partage ;
- données structurées seulement lorsqu'elles représentent fidèlement le contenu ;
- sitemap limité aux fiches publiées ;
- fiches masquées exclues de l'indexation.

## 20. Données personnelles et droits sur les images

Cette section constitue un cadrage produit, pas un avis juridique. Les textes définitifs devront être adaptés à l'identité de l'éditeur et, si nécessaire, validés par un professionnel.

### Principes à intégrer dès le MVP

- collecter uniquement les données nécessaires au traitement de la contribution ou du signalement ;
- distinguer clairement les champs obligatoires et facultatifs ;
- informer sur la finalité, les destinataires et la durée de conservation ;
- fournir un moyen simple d'exercer les droits d'accès, de rectification et d'effacement ;
- permettre une demande de retrait concernant une photo ;
- ne pas rendre public l'e-mail d'un contributeur ;
- éviter de collecter une identité civile lorsque le pseudonyme suffit ;
- appliquer une durée de conservation aux propositions refusées et non confirmées ;
- limiter la géolocalisation du visiteur à la fonction demandée et ne pas la conserver par défaut ;
- traiter une image, une adresse e-mail et une plaque d'immatriculation comme des données pouvant permettre l'identification ;
- obtenir une déclaration explicite concernant les droits du photographe et les personnes reconnaissables ;
- prévoir un masquage rapide pendant l'examen d'une demande de retrait.

### Références officielles consultées

- CNIL — définition d'une donnée personnelle : https://www.cnil.fr/fr/definition/donnee-personnelle
- CNIL — minimiser les données collectées : https://www.cnil.fr/fr/minimiser-les-donnees-collectees
- CNIL — exemples d'information sur les formulaires : https://www.cnil.fr/fr/exemples-de-formulaire-de-collecte-de-donnees-caractere-personnel
- CNIL — demander le retrait d'une image en ligne : https://www.cnil.fr/fr/demander-le-retrait-de-votre-image-en-ligne
- Service-Public — droit à l'image et vie privée : https://www.service-public.fr/particuliers/vosdroits/F32103

## 21. Mesure du succès

### Événements à mesurer

- ouverture de la carte ;
- recherche lancée ;
- filtre appliqué ;
- résultat sélectionné ;
- fiche consultée ;
- itinéraire ouvert ;
- partage utilisé ;
- formulaire commencé ;
- étape du formulaire terminée ;
- proposition confirmée ;
- signalement envoyé ;
- demande de contact photographe envoyée en P1.

### Indicateurs de lancement

- 25 à 40 spots complets avant ouverture ;
- au moins 100 visiteurs locaux pendant la bêta ;
- au moins 20 propositions reçues sur la première période de test ;
- taux de complétion du formulaire supérieur à 35 % ;
- au moins 30 % des visiteurs de la bêta revenant consulter le service ;
- délai médian de modération inférieur à trois jours ;
- moins de 10 % de fiches publiées signalées pour une erreur importante ;
- cinq photographes pilotes intéressés par un profil professionnel.

Ces valeurs sont des hypothèses de validation, pas des prévisions commerciales.

## 22. Modèle économique progressif

### Phase 1 — validation gratuite

- carte et contribution gratuites ;
- profils pilotes de photographes intégrés manuellement ;
- mesure des consultations et demandes de contact ;
- aucun paiement tant que la valeur n'est pas prouvée.

### Phase 2 — profil Photographe Pro

Offre envisagée : portfolio enrichi, priorité locale raisonnable, bouton de demande de devis, statistiques et mise en avant d'une spécialité.

Hypothèse de prix à tester : **12 à 19 euros par mois**, avec une période pilote gratuite. Le prix final doit être fondé sur des entretiens et le nombre réel de contacts obtenus.

### Phase 3 — transaction

- demande structurée ;
- disponibilité ;
- acompte ;
- réservation ;
- commission sur les séances conclues.

Cette phase ne doit être construite qu'après constat d'un volume régulier de demandes.

## 23. Architecture technique recommandée

### Application

- application web responsive en TypeScript ;
- rendu serveur ou hybride pour les fiches publiques ;
- interface de carte basée sur un moteur compatible avec les données OpenStreetMap ;
- composants partagés entre espace public et administration.

### Données et services

- base PostgreSQL ;
- extension géographique pour les recherches par distance ;
- stockage objet pour les originaux et images optimisées ;
- authentification par lien sécurisé pour les contributeurs et par compte renforcé pour l'administration ;
- service d'e-mail transactionnel ;
- tâches différées pour l'optimisation des images et les rappels de modération.

Une solution intégrée de type Supabase peut accélérer le MVP grâce à PostgreSQL, l'authentification et le stockage. Le fournisseur de tuiles cartographiques doit être choisi avec des conditions d'utilisation adaptées au trafic prévu ; les serveurs publics ne doivent pas être considérés comme une infrastructure commerciale illimitée.

### Environnements

- développement local ;
- préproduction avec données de test ;
- production ;
- variables et clés séparées ;
- migrations de base versionnées ;
- suivi des erreurs sans enregistrer inutilement des données sensibles.

## 24. Découpage de réalisation

### Lot 0 — validation et contenu, semaines 1 à 2

- réaliser 10 entretiens avec des motards ;
- réaliser 5 entretiens avec des photographes ;
- tester les catégories et informations de fiche ;
- créer les 15 premières fiches ;
- établir la charte de publication ;
- confirmer le nom de travail ou choisir le nom définitif.

### Lot 1 — socle, semaines 2 à 4

- structure du projet ;
- base de données ;
- stockage d'images ;
- carte et premiers marqueurs ;
- administration minimale ;
- import du catalogue initial.

### Lot 2 — découverte, semaines 4 à 6

- recherche ;
- filtres ;
- liste synchronisée ;
- fiche détaillée ;
- partage et itinéraire ;
- optimisation mobile.

### Lot 3 — contribution et modération, semaines 6 à 8

- formulaire en étapes ;
- envoi et optimisation des images ;
- vérification de l'e-mail ;
- file de modération ;
- demandes de modification ;
- publication et notifications ;
- signalements.

### Lot 4 — qualité et bêta, semaines 8 à 10

- accessibilité ;
- performance ;
- pages légales ;
- sécurité des formulaires ;
- mesure d'audience ;
- tests sur téléphones ;
- bêta privée puis ouverture progressive.

### Lot 5 — photographes pilotes, mois 3 à 4

- annuaire ;
- fiches professionnelles ;
- demandes de contact ;
- intégration manuelle de cinq pilotes ;
- mesure de la valeur générée ;
- décision sur une offre payante.

## 25. Définition de « terminé » pour le MVP

Le MVP est prêt à être ouvert lorsque :

- au moins 25 spots vérifiés sont publiés ;
- tous les parcours P0 fonctionnent sur mobile et ordinateur ;
- l'administrateur peut traiter une proposition sans intervention technique ;
- les e-mails transactionnels fonctionnent ;
- un spot peut être masqué rapidement ;
- une demande liée à une image peut être reçue et traitée ;
- les contrôles d'accès ont été vérifiés ;
- les images sont optimisées et leurs métadonnées retirées à la publication ;
- les erreurs importantes sont suivies ;
- les sauvegardes sont configurées et un test de restauration a été réalisé ;
- la charte, les mentions légales et la politique de confidentialité sont publiées ;
- les principaux événements d'usage sont mesurés ;
- cinq utilisateurs extérieurs ont réussi les parcours principaux sans aide.

## 26. Décisions à prendre avant le développement

Les valeurs proposées ci-dessous servent de choix par défaut afin de ne pas bloquer le projet :

- nom temporaire : Spotride Toulouse ;
- rayon de lancement : 60 kilomètres ;
- nombre minimum de photos : 2 ;
- nombre maximum de photos : 6 ;
- navigation publique sans compte ;
- proposition avec e-mail vérifié ;
- modération entièrement manuelle ;
- coordonnées exactes pour les spots standards ;
- position approximative possible pour les spots sensibles ;
- annuaire de photographes repoussé au premier lot suivant le MVP ;
- aucun paiement au lancement.

Ces décisions peuvent être modifiées après les premiers entretiens, mais elles fournissent un cadre suffisamment précis pour commencer les maquettes puis le développement.
