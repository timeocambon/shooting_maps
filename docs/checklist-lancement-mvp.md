# Checklist de lancement du MVP

Cette liste sert de barrière de mise en ligne. Une case non cochée doit bloquer
l'ouverture publique, sauf dérogation explicitement documentée.

## Catalogue et parcours publics

- [ ] 25 à 40 spots complets ont été vérifiés et publiés.
- [ ] La carte fonctionne sans géolocalisation.
- [ ] La géolocalisation n'est demandée qu'après une action explicite.
- [ ] Recherche, filtres, liste et carte restent synchronisés.
- [ ] La zone et les filtres utiles sont partageables par URL.
- [ ] Une image absente ou défaillante ne bloque ni un résultat ni une fiche.
- [ ] Les avertissements précèdent l'ouverture de l'itinéraire.
- [ ] Les positions sensibles ou masquées ne fuitent pas dans les réponses réseau,
  le HTML, les métadonnées ou les images.
- [ ] Les fiches masquées et archivées sont exclues du sitemap et de l'indexation.

## Contribution

- [ ] Le formulaire en cinq étapes fonctionne sur téléphone et ordinateur.
- [ ] Le brouillon local est conservé au moins sept jours.
- [ ] Les erreurs renvoient vers l'étape et le champ concernés.
- [ ] Les doubles envois accidentels sont bloqués.
- [ ] Les consentements et leur version sont enregistrés.
- [ ] Seules les propositions dont l'e-mail est confirmé atteignent `submitted`.
- [ ] Les liens sont temporaires, non devinables et à usage unique.
- [ ] Le numéro de suivi est affiché et envoyé par e-mail.

## Images

- [ ] Les limites de nombre, taille, dimensions et format sont contrôlées côté
  serveur sur le contenu réel du fichier.
- [ ] Les originaux sont privés et séparés des variantes publiques.
- [ ] Les variantes sont responsives et optimisées.
- [ ] Les métadonnées EXIF sont retirées avant publication.
- [ ] Les crédits, droits déclarés et personnes reconnaissables sont vérifiables
  dans l'administration.
- [ ] Une photo peut être masquée rapidement sans masquer tout le catalogue.

## Administration et modération

- [ ] L'administration impose une authentification renforcée.
- [ ] Les permissions modérateur/administrateur sont vérifiées côté serveur.
- [ ] Toutes les transitions d'état prévues sont utilisables et testées.
- [ ] Les décisions et actions sensibles sont journalisées.
- [ ] Une proposition peut être corrigée, complétée, acceptée, refusée ou classée
  comme doublon sans intervention technique.
- [ ] Un spot peut être publié, masqué, archivé et restauré.
- [ ] Les fiches non vérifiées depuis douze mois passent à `review_due`.
- [ ] Les signalements critiques remontent en priorité haute.
- [ ] Une procédure de masquage d'urgence est connue et testée.

## Sécurité, vie privée et conformité

- [ ] Aucun secret ni rôle privilégié n'est exposé au navigateur ou au dépôt.
- [ ] Les formulaires sont protégés contre les abus et limités en débit.
- [ ] Les textes sont validés, normalisés et rendus sans injection possible.
- [ ] Les liens sécurisés ont été testés contre expiration, rejeu et falsification.
- [ ] Les données sensibles sont retirées des journaux et du suivi d'erreurs.
- [ ] Les durées de conservation et tâches de suppression sont actives.
- [ ] La demande de retrait d'une donnée ou d'une image est fonctionnelle.
- [ ] Charte, confidentialité, mentions légales et information des formulaires sont
  publiées avec l'identité réelle de l'éditeur.

## Fiabilité et exploitation

- [ ] Les environnements local, préproduction et production sont séparés.
- [ ] Les migrations ont été testées sur une base vide et sur une copie de
  préproduction.
- [ ] Les sauvegardes quotidiennes sont actives.
- [ ] Une restauration a été réalisée et documentée.
- [ ] Les échecs d'e-mail et de traitement d'image sont visibles et rejouables.
- [ ] Les erreurs importantes déclenchent une alerte exploitable.
- [ ] Une procédure de retour arrière est documentée.

## Qualité d'expérience

- [ ] Les parcours P0 sont utilisables au clavier avec un focus visible.
- [ ] Les contrastes, labels, textes alternatifs, erreurs et zoom ont été vérifiés.
- [ ] Les écrans ont été testés sur plusieurs téléphones réels.
- [ ] Les images hors écran sont différées et le nombre de résultats est limité.
- [ ] Cinq utilisateurs extérieurs ont réussi les parcours principaux sans aide.
- [ ] Les événements produit nécessaires sont mesurés sans collecte superflue.

## Validation finale

- [ ] Le responsable produit accepte le périmètre et les limites connues.
- [ ] Le responsable de la modération sait traiter propositions et signalements.
- [ ] Les coordonnées et contacts d'incident sont accessibles à l'équipe.
- [ ] La date, le responsable et la décision d'ouverture sont consignés.
