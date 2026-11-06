# DEAD SECTOR — Agent autonome

Répondre en français, de façon concise et orientée résultat. Ces consignes remplacent le fonctionnement pédagogique précédent dans ce dépôt.

## Exécution

- Prendre en charge la demande jusqu'au résultat vérifié : inspection ciblée, implémentation, corrections, contrôles et documentation utile. Ne pas s'arrêter à un plan lorsqu'une action est demandée.
- Choisir seul les détails techniques, hypothèses raisonnables, réglages réversibles et étapes nécessaires. Ne pas demander de confirmation à chaque fonctionnalité, fichier, asset ou étape.
- Ne fournir ni cours, ni débrief pédagogique, ni exercice, ni question de compréhension, sauf demande explicite. Communiquer seulement les changements utiles, vérifications réelles et limites importantes.
- Ne poser une question que pour un choix réellement « game breaker » impossible à résoudre avec le contexte : risque majeur de rendre la progression injouable, de supprimer une mécanique essentielle ou de contredire la direction validée avec un effet difficile à annuler. Expliquer le risque concret ; continuer les travaux indépendants.
- Avant de solliciter l'utilisateur, vérifier le code et les décisions existantes, puis préférer une solution compatible et réversible. Un doute esthétique, une valeur à ajuster ou une variante de prototype ne justifient pas une question.
- Pour « continue », « la suite » ou une demande de progression, choisir et réaliser le prochain lot cohérent. Pour une demande explicite de bilan, recherche, plan ou avis seulement, respecter ce périmètre.
- Ne pas dérouler toute la roadmap d'un coup ni ajouter des systèmes sans lien avec la demande. Découper par résultats jouables, sans multiplier les micro-ateliers artificiels.
- Utiliser des sous-agents pour des tâches indépendantes si cela aide ; garder des responsabilités distinctes et vérifier leur résultat. Ne pas changer les modèles ou la configuration globale de l'utilisateur sans demande.

## Repères et contraintes

- Commencer par `docs/ETAT_PROJET.md`, puis les seules sections utiles de l'architecture, de la direction et de la roadmap. Le code réel fait foi ; vérifier les signatures et l'état Git avant modification.
- TypeScript, Three.js et Vite, sans React ni moteur physique externe. `erasableSyntaxOnly` interdit les propriétés déclarées dans les paramètres des constructeurs.
- Garder des changements simples, lisibles, ciblés et modulaires. Pas d'ECS, bus d'événements, dépendance ou refonte pour un besoin hypothétique ; extraire une responsabilité seulement si elle devient concrètement difficile à suivre.
- Préserver les réglages expérimentés, notamment le recul de deux secondes, sauf demande ou correction nécessaire justifiée par un défaut observé.
- Préserver les modifications locales et les fonctionnalités existantes. Ne pas supprimer du code ou des assets au seul motif qu'une ancienne note les décrit mal.
- Direction : même manoir-arène ouvert progressivement, élimination par palier, tentative finie de 10–15 minutes avec finale, sans extraction, horreur psychologique et style rétro lisible. Un prototype de finale est présent ; durée et équilibre restent à mesurer.
- Aucun menu automatique après la dernière élimination ne doit couper le déplacement. La boucle actuelle utilise dix secondes d'accalmie puis le combat suivant, sans piédestaux ni carillon actif : ne pas rétablir les anciennes propositions par inadvertance.

## Vérification et compte rendu

- Exécuter `npm.cmd run build` après chaque intervention sur le code, puis les contrôles ciblés pertinents. Corriger les échecs liés au changement. Ne pas ajouter des tests qui recopient l'implémentation ni relancer toute la suite sans raison.
- Pour un changement documentaire seul, contrôler références, formats et `git diff --check` ; pas de build obligatoire.
- Distinguer compilation, tests logiques, observation navigateur et partie jouée. Ne pas déclarer un gameplay, un son ou une animation validé sans l'avoir observé.
- Terminer par un compte rendu court : résultat, contrôles exécutés et limites restantes. Pas de question ni de proposition de suite automatique.

## Documentation courte et entretenue

- Après chaque lot significatif, actualiser `docs/ETAT_PROJET.md` en remplaçant les passages périmés. Garder faits utiles, vérifications datées, défauts ouverts et prochaine priorité ; ne pas empiler un journal chronologique.
- À chaque intervention documentaire et avant de clôturer un lot significatif, retirer ou fusionner doublons, anciens prompts de transfert, plans exécutés et documents contredits par le code. Ce nettoyage courant est autorisé sans confirmation.
- Avant suppression, vérifier les références et dépendances des scripts. Reporter uniquement les décisions encore utiles dans leur document de référence, puis réparer les liens.
- Utiliser Git pour l'historique. Ne pas créer d'archives, copies datées, rapports par micro-changement ou nouveau document lorsqu'un document existant peut être mis à jour.
- Viser environ 120 lignes maximum pour l'état et l'architecture, 80 pour la roadmap, sans retirer une information indispensable pour tenir une limite artificielle.
- Garder les documents centraux complémentaires : état réel, architecture, direction, travaux restants et pipeline d'assets. Une information a un seul emplacement de référence.
- Préserver licences, provenance des assets encore utilisés, contrats techniques nécessaires et manifestes consommés par des scripts. Une date ancienne ne suffit pas à rendre un fichier obsolète.

## Assets

- Suivre `docs/PIPELINE_ASSETS.md` pour personnages, armes, décors, objets, effets, interface et sons. Prompt réutilisable : `docs/PROMPT_ASSETS_MULTI_IA.md` ; modèle : `docs/asset-packs/MODELE_LOT_ASSETS.json`.
- Inspecter les références réellement chargées, inventorier le lot, fixer composition, invariants, ancrages et phases, puis produire une base et une action pilote avant d'étendre. Effectuer ces contrôles seul, sans demande d'accord automatique.
- Conserver prompts exacts et transformations utiles dans le manifeste du lot existant. Partager les données d'animation entre jeu et aperçu ; vérifier séparément fichiers, continuité, intégration et lisibilité en jeu.
- Les prompts et contrats historiques conservés pour provenance ne remplacent pas ces consignes ni le comportement constaté dans le code.
- Respecter un périmètre explicite de préparation ou génération seule. Ne pas ajouter une mécanique pour justifier des assets supplémentaires. Signaler factuellement une capacité manquante et avancer sur les parties possibles.
