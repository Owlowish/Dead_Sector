# DEAD SECTOR — Roadmap du manoir-arène

Orientation mise à jour le 2 novembre 2026. Lire d'abord ORIENTATION_JEU.md : il distingue décisions validées et propositions. La mission actuelle modifie les documents seulement, sans autorisation d'implémenter automatiquement les étapes.

## Destination

Une tentative de survie dans un manoir fixe, fait de salles de combat et de couloirs reliés en boucles. Le joueur élimine les ennemis du palier, choisit une récompense gratuite, puis poursuit dans le même manoir dont de nouveaux accès s'ouvrent progressivement. Pas d'extraction dans la nouvelle cible.

Prototype proposé : trois paliers, une extension du secteur accessible, deux armes au total et une variante ennemie. Quantités, récompenses exactes, fin de prototype et remise à zéro des avantages après la mort restent à préciser avant les ateliers concernés.

L'ancienne roadmap linéaire est conservée dans archives/ROADMAP_LINEAIRE_2026-11-01.md. Ses prescriptions d'extraction et de parcours arrivée→sortie sont historiques. Les acquis techniques et les ressources artistiques restent utilisables.

## Ce que le prototype apporte déjà

Déplacement FPS, collisions, tir instantané, munitions/rechargement, ADS, ennemis animés avec attaque/perception/recherche, portes, soins/munitions, HUD, ambiance du manoir et effets de tir. Voir ETAT_PROJET.md pour les dernières corrections et leurs validations réelles.

Le passage aux paliers exige d'inspecter particulièrement : victoire par zone de sortie, liste fixe de cibles, création et retrait des zombies, navigation et pause des différents systèmes. Ne pas déclarer la nouvelle boucle fonctionnelle sur la seule base des fonctionnalités existantes.

## Méthode de chaque atelier

Expliquer résultat, un ou deux concepts, fichiers concernés et validation prévue ; obtenir l'accord pour une nouvelle fonctionnalité importante. Implémenter le petit comportement autorisé, compiler et observer. Faire un débrief des flux entre systèmes et un exercice de compréhension ; enregistrer ce qui est testé ou non testé dans ETAT_PROJET.

Pour les assets, appliquer PIPELINE_ASSETS.md : valider une base puis une animation isolée avant l'intégration. Ne pas reprendre les retouches esthétiques en parallèle de la migration de la boucle.

## R1 — Remplacer l'extraction par un premier palier

- Résultat : un groupe défini, un numéro de palier et une phase de répit après sa dernière élimination. L'ancienne zone de sortie ne gagne plus la partie.
- Concepts : machine à états de partie, transitions déclenchées une seule fois.
- Fichiers à inspecter : Game, Level et HUD ; préserver les règles individuelles des zombies.
- Validation : marcher dans l'ancienne sortie ne termine rien ; le dernier ennemi termine le combat une seule fois ; mort et redémarrage restent possibles ; aucune attaque pendant le répit.
- Exercice : expliquer pourquoi une condition de fin vraie pendant plusieurs images ne doit pas ouvrir plusieurs menus.

## R2 — Enchaîner trois paliers déterministes

- Résultat : bouton Continuer entre paliers, nouveaux groupes définis par des données simples, compteur de menaces fiable.
- Concepts : cycle de vie des entités et données de configuration.
- Fichiers à inspecter : Game pour les groupes, Weapon pour actualiser les cibles, Zombie pour santé/mort, Level pour emplacements.
- Commencer sans apparition différée : tous les ennemis du groupe apparaissent ensemble dans des emplacements praticables. Si un étalement est ajouté, suivre aussi les ennemis restant à faire apparaître.
- Validation : le tir touche les nouveaux ennemis, les morts ne bloquent rien ; zéro vivant ne termine pas un groupe encore incomplet ; pas d'apparition au contact ou dans les murs ; pas de cumul d'ennemis des anciens paliers.
- Exercice : décrire ce qui devient périmé si Weapon garde seulement les meshes du premier groupe.

## R3 — Transformer la carte en circuit et ouvrir une aile

- Résultat : boucle initiale praticable, puis aile ajoutant un second trajet après un palier. Le manoir reste le même et les zones déjà ouvertes restent accessibles.
- Concepts : graphe de circulation et séparation géométrie/accès.
- Support : PLAN_NIVEAU.md, Level, Door et navigation des zombies. Tester en volumes simples avant de détailler le décor.
- Validation : possibilités de fuite, aucun secteur ouvert inaccessible, navigation compatible avec les nouvelles portes ; groupes créés uniquement dans les espaces ouverts.
- Exercice : expliquer la différence entre agrandir une carte et ajouter un choix de trajet.

## R4 — Récompense gratuite entre les combats

- Résultat : un choix parmi deux propositions simples, appliqué une seule fois, puis bouton Continuer. Pas de monnaie.
- Concepts : options éligibles et application d'une décision à l'état de jeu.
- Commencer par des avantages réellement implémentés, par exemple une amélioration simple du pistolet et un avantage de survie. Ne pas afficher une arme qui n'existe pas encore.
- Validation : impossible de choisir deux récompenses, aucun tir derrière le menu, pas d'option sans effet lorsque toutes ses limites sont atteintes, reprise propre des contrôles.
- Exercice : distinguer la liste des récompenses possibles de celle présentée au joueur.

## R5 — Lampe torche et lecture de l'obscurité

- Résultat proposé : faisceau frontal, commande marche/arrêt, repères fixes ; aucune batterie limitée dans le premier essai.
- Concepts : éclairage directionnel et contraste utile.
- Inspecter Player/Game/Level ; ne pas confondre flash de tir et lampe continue. L'arme HTML nécessite toujours son adaptation lumineuse propre.
- Validation : passage, ennemi et préparation d'attaque lisibles ; murs proches non brûlés ; performances et interaction avec le flash de tir vérifiées ; ajuster ensuite l'obscurité globale.
- Exercice : rendre une salle inquiétante tout en montrant un chemin utilisable.

## R6 — Seconde arme et différences de combinaison

- Résultat : une seconde arme distincte, proposée à partir d'un palier défini, et un moyen clair de changer d'arme.
- Concepts : comportement commun et paramètres propres, sans généralisation anticipée à dix armes.
- Décider d'abord inventaire/remplacement, munitions communes ou distinctes et effet du changement d'arme pendant le rechargement.
- Validation : effets et HUD cohérents avec l'arme active, pas de gain de munitions par permutation, récompenses compatibles, chaîne d'animation validée avec PIPELINE_ASSETS.
- Exercice : expliquer comment deux armes peuvent changer les déplacements du joueur, pas seulement leurs dégâts.

## R7 — Variante ennemie et diversité des groupes

- Résultat : une menace différenciée, identifiable avant qu'elle attaque, puis mélange progressif des groupes.
- Concepts : composition d'une rencontre et lisibilité d'un comportement.
- Choisir une différence utile (mobilité ou résistance, par exemple), pas toutes à la fois. Garder des emplacements et chemins fiables.
- Validation : le joueur sait reconnaître et adapter sa réponse, aucune rencontre inévitablement perdue, pas de dernier ennemi inaccessible.
- Exercice : comparer deux groupes avec le même nombre total d'ennemis.

## R8 — Tentatives, équilibre et livraison

- Résultat : parcours des trois paliers testable, fin du prototype définie, bilan et nouvelle tentative cohérents. Choisir alors une prolongation de la survie si souhaitée.
- Concepts : équilibrage par observation et réinitialisation d'un état complet.
- Vérifier accès, équipement, ressources, choix et ennemis réinitialisés ; définir un ravitaillement minimal ou une solution de secours pour éviter les tentatives impossibles faute de balles.
- Observer plusieurs combinaisons de récompenses, puis introduire de la variation contrôlée si les choix fonctionnent.
- Build, preview de production, documentation/crédits des ressources et publication statique après décision d'hébergement. Une publication n'est pas autorisée par cette roadmap.

## Ordre et prochain atelier

Ordre proposé : R1 → R2 → R3 → R4 → R5 → R6 → R7 → R8. R1 est la prochaine implémentation recommandée ; elle doit être explicitement demandée à Gemini ou à l'assistant. Le plan n'autorise pas à implémenter tous les ateliers en une passe.

Avant de commencer R1, confirmer les règles minimales de répit/reprise. Les choix d'équipement, de lampe et de fin de prototype se précisent à l'atelier correspondant. Les modifications de difficulté doivent être guidées par l'expérience en jeu, pas seulement par l'augmentation automatique du nombre d'ennemis.
