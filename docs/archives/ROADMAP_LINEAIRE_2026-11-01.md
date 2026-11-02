# DEAD SECTOR — Roadmap de conception et d'apprentissage

Version de travail du 1er novembre 2026. Les étapes futures sont des propositions à valider une par une. Cette feuille de route décrit un chemin vers une petite démo terminée, pas un engagement à réaliser toutes les extensions imaginables.

## Destination proposée : une démo complète et courte

Une expérience solo de 5 à 10 minutes dans un secteur industriel abandonné : découvrir les lieux, ouvrir un accès, traverser une zone de combat et atteindre une sortie. Un seul niveau composé de quelques espaces connectés, une arme principale, un type de zombie, une ressource de soin et éventuellement des munitions limitées. La tension vient de la visibilité, du son, des espaces et du rythme exploration/combat. Le gameplay doit rester lisible malgré l'obscurité.

Cette cible est à confirmer en A1. Un deuxième ennemi, plusieurs armes ou un générateur peuvent venir ensuite si la démo en a besoin. Multijoueur, monde procédural, campagne, inventaire complexe et moteur physique externe restent hors du premier objectif.

La fin de parcours est observable : un nouveau joueur comprend les commandes, peut finir le niveau, gagner, mourir et recommencer, sans blocage connu ; une version statique reproductible peut être partagée ; l'auteur sait expliquer son architecture et ses compromis.

## Méthode d'un atelier avec l'IA

1. **Question de conception** : quel problème du joueur ou de la compréhension résout-on ?
2. **Plan court** : un comportement, un ou deux concepts, les responsabilités et la manière de vérifier. Accord préalable pour une fonctionnalité importante.
3. **Implémentation** : patch ciblé, lecture des interfaces réelles, build. L'IA ne remplace pas tout un système pour économiser une explication.
4. **Observation en jeu** : scénario précis avec résultat attendu, effectué par l'IA si possible ou par l'utilisateur. Écrire ce qui reste non vérifié.
5. **Compréhension** : l'utilisateur explique un flux ou prédit une conséquence, puis expérimente un petit changement. Une bonne réponse ne demande pas de réciter du TypeScript.
6. **Trace de reprise** : mettre à jour ETAT_PROJET, garder une décision et son motif, terminer à un point stable.

La durée d'un atelier dépend des essais, pas d'un quota de fichiers. Un jalon peut demander plusieurs ateliers. On ne passe pas automatiquement au suivant après un build réussi. Aucun calendrier de production n'est fixé sans connaître le temps disponible.

## Vue d'ensemble A → H

| Jalon | Résultat | Situation |
| --- | --- | --- |
| A — Fondations | Comprendre et représenter un FPS minimal | Code déjà présent ; consolidation de compréhension à faire |
| B — Prototype fiable | Contrôles, combat et fins de partie vérifiés | Implémenté en grande partie ; validation structurée à faire |
| C — Objectif et ressources | Le joueur sait quoi faire et doit choisir | C1, C2, C3 entièrement implémentés (à valider en jeu) |
| D — Premier niveau | Un trajet industriel jouable en volumes simples | D1, D2, D3 entièrement implémentés (à valider en jeu) |
| E — Ennemis lisibles | Perception, attaques et déplacements adaptés au niveau | E1, E2, E3 implémentés (à valider en jeu) |
| F — Identité et sensations | Image, son, animation au service de l'horreur rétro | F1 et F4 implémentés (style Manoir victorien PS1) |
| G — Démo équilibrée | Parcours complet compréhensible et testable | À faire après intégration |
| H — Livraison | Version partageable, stable et documentée | À faire |

Ordre recommandé : A1/B1 maintenant, puis les étapes suivantes dans l'ordre ; D et E nécessitent des allers-retours. Ne pas terminer les textures d'une salle avant d'avoir vérifié son parcours. Le compteur C1 peut servir d'atelier de transition court, mais il ne remplace pas la conception du niveau.

## A — Fondations et carte mentale

### A1. Définir le jeu que nous voulons terminer

- **Résultat** : confirmer ou réduire la cible ci-dessus et écrire trois intentions concrètes (par exemple : mouvements rapides, ennemis lisibles, exploration oppressante).
- **Apprentissage** : distinguer vision, mécanique et contenu ; savoir limiter un périmètre.
- **Support** : ROADMAP et ETAT_PROJET uniquement. Les intentions guident ensuite les arbitrages de code.
- **Validation** : décrire une session du lancement à la sortie et ce qui rend ce parcours intéressant.
- **Exercice** : citer une fonctionnalité attirante mais non nécessaire à cette première démo, et expliquer son coût.

### A2. Lire la boucle existante comme un système

- **Résultat** : suivre entrées → simulation → représentation, à partir d'ARCHITECTURE et de Game.
- **Apprentissage** : boucle de jeu et séparation des responsabilités. Caméra, scène et objets ne jouent pas le même rôle.
- **Support** : main, Game, Player, Level ; pas de réécriture nécessaire pour « apprendre ».
- **Validation** : expliquer ce qui se passe pendant une image et ce qui arrive entre deux images lors d'un clic.
- **Exercice** : prédire quelles mises à jour s'arrêtent après Échap et vérifier la prédiction dans le code.

### A3. Comprendre les approximations déjà employées

- **Résultat** : distinguer géométrie, texture, collision et raycasting.
- **Apprentissage** : approximation de simulation, indépendance entre affichage et règles.
- **Support** : Level, Zombie, Weapon. Expliquer les limites avant de les corriger.
- **Validation** : expliquer pourquoi un pixel transparent peut être touché et pourquoi une collision n'est pas une recherche de chemin.
- **Exercice** : dessiner un mur, le cercle du joueur et un rayon ; montrer pourquoi chaque test répond à une question différente.

## B — Stabiliser le prototype existant

### B1. Établir une référence de fonctionnement — prochaine étape recommandée

- **Résultat** : liste courte des comportements effectivement vérifiés, des anomalies reproductibles et des limites acceptées. Proposer aussi une sauvegarde Git locale puisque ce dossier n'est pas actuellement un dépôt détecté ; aucune publication distante nécessaire.
- **Apprentissage** : différence entre compilation, test fonctionnel et jugement de gameplay ; isoler un cas reproductible.
- **Support** : scénario de contrôle ci-dessous, ETAT_PROJET ; code seulement pour une correction identifiée et autorisée.
- **Validation** : exécuter chaque scénario et noter succès/échec/non testé, navigateur et contexte utiles. Ne pas convertir une absence de test en succès.
- **Exercice** : choisir une anomalie et décrire les étapes minimales pour qu'une autre personne la reproduise.

### B2. Clarifier temps et pause

- **Résultat** : décider ce qui continue pendant la pause ; sécuriser les touches à la perte de focus/verrouillage si les essais le justifient. Examiner le ralentissement dû au delta plafonné.
- **Apprentissage** : temps réel versus temps simulé, simulation versus effets d'interface.
- **Support** : Game, Player, Weapon, Zombie, modifications ciblées. Documenter le comportement choisi avant d'uniformiser les horloges.
- **Validation** : maintien d'une touche puis Échap/retour ; changement d'onglet ; tir et attaque autour de la pause ; observation à fréquence réduite si l'outil le permet.
- **Exercice** : expliquer pourquoi un délai basé sur performance.now peut expirer pendant la pause alors qu'un compteur simulé reste suspendu.
- **Limite** : une boucle à pas fixe n'est pas obligatoire maintenant ; l'introduire seulement si le problème observé la justifie.

### B3. Vérifier le contrat du combat

- **Résultat** : confirmer obstacles, cibles mortes, portée, santé indépendante et verrouillage des fins de partie. Décider si la hitbox rectangulaire est suffisamment équitable.
- **Apprentissage** : invariants de gameplay et ordre des événements.
- **Support** : Weapon, Zombie, Player, Game. Tester la logique pure si une règle complexe apparaît ; pas de framework ajouté uniquement pour tester des constantes.
- **Validation** : tous les scénarios de combat ci-dessous et aucune régression du déplacement.
- **Exercice** : expliquer le trajet complet d'une attaque ennemie fatale, du Zombie au message de défaite.

## C — Donner une intention au joueur

### C1. Afficher l'objectif et la progression

- **Résultat** : objectif temporaire « éliminer les ennemis » avec nombre restant, calculé depuis les zombies vivants. Plus tard, cet objectif deviendra « atteindre la sortie » ; ne pas figer toute l'architecture autour du nettoyage de l'arène.
- **Apprentissage** : état dérivé et synchronisation du HUD. Une seule source de vérité.
- **Support** : Game, HTML/CSS ; extraction Hud seulement si utile à la lisibilité.
- **Validation** : 3 au départ, décrément à la mort seulement, 0 à la victoire ; aucun changement au simple impact ni après une fin de partie.
- **Exercice** : expliquer pourquoi un compteur décrémenté à chaque tir serait incorrect.

### C2. Ajouter une ressource de soin

- **Résultat** : un ramassage visible qui soigne sans dépasser la santé maximale et disparaît après usage. Définir s'il reste disponible lorsque la vie est pleine.
- **Apprentissage** : interaction de proximité, durée de vie d'un objet.
- **Support** : Player pour les règles de santé, Game pour l'interaction ; petit objet dédié si nécessaire, sans inventaire général.
- **Validation** : santé basse/pleine, ramassage unique, aucun soin après la mort, retour à l'état initial au redémarrage.
- **Exercice** : choisir un emplacement de soin et expliquer le choix de risque/récompense.

### C3. Décider puis expérimenter les munitions

- **Résultat proposé** : réserve simple et ramassage ; pas de chargeur/rechargement dans le même atelier. À retenir seulement si la gestion de ressources sert la démo.
- **Apprentissage** : préconditions d'une action et coût associé.
- **Support** : Weapon pour accepter ou refuser un tir, HUD pour affichage, interaction existante pour ramassage.
- **Validation** : pas de consommation pendant cooldown, aucun dégât/flash de tir réussi à zéro, réserve reconstituée correctement, parcours finissable avec marge.
- **Exercice** : estimer les munitions minimales pour trois zombies avec les dégâts actuels et prévoir une marge pour les ratés.

## D — Construire un vrai parcours avant son habillage

### D1. Dessiner le niveau sur papier puis en volumes simples

- **Résultat** : quelques espaces connectés : arrivée sûre, découverte, combat, sortie. Choisir points de départ et repères. Conserver les collisions horizontales actuelles au début, sans escalier ni saut.
- **Apprentissage** : greyboxing (tester les volumes avant le décor), circulation et lignes de vue.
- **Support** : Level et positions initiales de Game ; définir les placements dans des données simples si cela réduit les répétitions.
- **Validation** : parcourir entièrement le niveau sans ennemi, pas de passage inaccessible ni sortie hors des murs ; échelle et visibilité des passages correctes.
- **Exercice** : déplacer un obstacle et prédire les effets sur la ligne de tir et le trajet d'évitement.

### D2. Ajouter une porte et une interaction explicite

- **Résultat** : regarder une porte proche et appuyer sur une touche pour l'ouvrir. Un objet teste l'interaction, pas une multitude d'écouteurs par porte.
- **Apprentissage** : portée d'interaction et cohérence entre état visuel et collision.
- **Support** : Player/contrôles, Level, petite classe Door si utile ; maintenir les solides et colliders cohérents lors de l'ouverture.
- **Validation** : impossible à distance ou à travers un mur, passage et tir bloqués quand fermée, libres quand ouverte, comportement déterminé à la fermeture.
- **Exercice** : expliquer le bug obtenu si seule l'image de la porte s'ouvre.

### D3. Remplacer la victoire d'arène par un objectif de sortie

- **Résultat** : une clé ou un interrupteur ouvre l'accès final, puis une zone de sortie déclenche la victoire. Choisir une seule variante. Les ennemis servent le parcours et ne doivent pas forcément tous mourir.
- **Apprentissage** : progression par états et zones déclencheuses.
- **Support** : Game pour la règle de victoire, Level/interactions pour ses conditions ; supprimer explicitement l'ancienne victoire « tous morts » lors du changement.
- **Validation** : pas de victoire prématurée, accès verrouillé avant objectif, sortie fonctionnelle après objectif ; morts ennemies non bloquantes si ce n'est plus une condition.
- **Exercice** : dessiner les conditions qui rendent la sortie accessible.

## E — Rendre les ennemis adaptés à ce parcours

### E1. Perception et attaque lisibles

- **Résultat** : le zombie ne détecte plus simplement le joueur à travers tous les murs ; préciser ligne de vue et comportement quand la cible disparaît. Ajouter une préparation d'attaque perceptible avant les dégâts.
- **Apprentissage** : machine à états et séparation décision/action.
- **Support** : Zombie, solides de Level ; Game conserve la transmission des dégâts. Commencer avec peu d'états utiles, pas une IA comportementale générique.
- **Validation** : mur occultant, visibilité retrouvée, préparation interrompue par mort, possibilité d'éviter l'attaque selon la règle choisie, cadence compréhensible.
- **Exercice** : dessiner IDLE → CHASE → ATTACK et les conditions de transition avant de discuter du code.

### E2. Faire contourner les obstacles utiles

- **Résultat** : sur le niveau réel, quelques points de passage permettent d'éviter les blocages fréquents. Si cela devient insuffisant, proposer ensuite une grille et A* dans un atelier distinct.
- **Apprentissage** : différence entre navigation (choisir le trajet) et collision (autoriser le pas).
- **Support** : données Level et logique Zombie ; aucune dépendance de navigation par défaut.
- **Validation** : parcours en L, détour autour d'un obstacle, chemin inaccessible sans traversée des murs, comportement stable près d'une porte.
- **Exercice** : placer deux points de passage et expliquer pourquoi une poursuite en ligne droite reste bloquée sans eux.

### E3. Éviter l'empilement et régler les rencontres

- **Résultat** : réduire la superposition des quelques ennemis et répartir leurs positions pour rendre les combats lisibles. Séparation locale simple avant toute simulation physique.
- **Apprentissage** : comportements locaux et réglage d'un groupe.
- **Support** : Game/Zombie selon le besoin réel d'information sur les voisins.
- **Validation** : plusieurs zombies près du joueur et dans un passage étroit, absence de poussée à travers un mur, coût acceptable.
- **Exercice** : comparer deux compositions avec le même nombre d'ennemis mais des positions différentes.

## F — Construire l'identité rétro industrielle

### F1. Textures et lumière lisibles

- **Résultat** : palette cohérente, matériaux industriels répétables, zones sombres et repères lumineux. Définir une convention de résolution des textures et vérifier leurs répétitions.
- **Apprentissage** : UV/répétition, matériaux et éclairage. Le matériau Basic des zombies ignore actuellement la lumière : choisir consciemment de le conserver ou de le remplacer après essai.
- **Support** : Level, assets, éventuellement Zombie. Conserver un témoin lisible avant/après.
- **Validation** : sortie et ennemis repérables, pas de joints de texture gênants, pas de zones illisibles, rendu testé sur plusieurs tailles d'écran.
- **Exercice** : assombrir une zone puis y guider le regard sans remonter toute la lumière ambiante.

### F2. Remplacer les représentations provisoires

- **Résultat** : sprite d'arme cohérent et sprites ennemis nettoyés avec animations lisibles ; une amélioration à la fois. Conserver l'arme en surimpression tant qu'une arme 3D n'apporte rien de nécessaire.
- **Apprentissage** : pipeline d'assets, cadrage d'une spritesheet et minutage d'animation.
- **Support** : Weapon/HUD, Zombie, textures et CSS. Documenter dimensions/cellules et provenance/licence.
- **Validation** : aucune cellule voisine visible, pieds stables, flash aligné au canon et viseur toujours centré.
- **Exercice** : distinguer fréquence de l'animation, cadence de tir et durée de recul.

### F3. Ajouter ambiance et audio spatial

- **Résultat** : ambiance discrète et un son ennemi localisable qui s'atténue avec la distance ; volumes réglables. Ne pas masquer les informations de combat avec l'ambiance.
- **Apprentissage** : listener/emitter et chargement audio après interaction utilisateur.
- **Support** : caméra, Zombie/Level et gestion audio simple si plusieurs sons partagent des règles. Séparer ce changement du simple remplacement des WAV provisoires.
- **Validation** : gauche/droite et éloignement audibles, pas de lecture parasite après redémarrage, erreurs de chargement visibles, volume contrôlable.
- **Exercice** : identifier à l'oreille un ennemi hors champ puis vérifier sa position.

### F4. Choisir le rendu basse résolution

- **Résultat** : rendre la scène à une résolution réduite puis l'agrandir nettement, en gardant le HUD lisible ; option de réglage si nécessaire.
- **Apprentissage** : résolution interne versus taille d'affichage, coût GPU et lisibilité.
- **Support** : renderer de Game et CSS ; éviter une chaîne de post-traitement complète par défaut.
- **Validation** : visée utilisable, proportions correctes après resize, comparaison mesurée et visuelle avant/après.
- **Exercice** : expliquer pourquoi `setPixelRatio(1)` et `antialias: false` seuls ne créent pas une image véritablement basse résolution.

## G — Transformer les systèmes en démo agréable

### G1. Jouer la totalité du parcours et régler le rythme

- **Résultat** : alterner sécurité, anticipation, combat et récupération sur le niveau complet. Régler ressources et ennemis à partir d'observations.
- **Apprentissage** : playtest, hypothèse puis mesure ; nombre d'ennemis et difficulté ne sont pas équivalents.
- **Support** : paramètres de gameplay et placements ; pas de nouvelle mécanique tant que les problèmes observés relèvent du réglage.
- **Validation** : parcours possible du début à la fin, pas de manque inévitable de ressource, plusieurs essais et retours d'au moins un nouveau joueur si possible.
- **Exercice** : formuler « je change X pour obtenir Y » et observer si Y se produit effectivement.

### G2. Accueil, options et retours d'erreur

- **Résultat** : commandes et objectif compréhensibles, volume réglable, sensibilité adaptée ; informer d'une ressource manquante ou d'un échec de verrouillage plutôt que laisser une action silencieuse.
- **Apprentissage** : cycle de chargement et expérience utilisateur, en distinguant erreur technique et état du jeu.
- **Support** : Game, Player, HUD/audio selon l'architecture réellement obtenue ; introduire un état ready/loading seulement quand nécessaire.
- **Validation** : premier lancement sans connaissance du projet, pause/reprise, fin/redémarrage, ressources indisponibles et différentes tailles d'écran.
- **Exercice** : faire expliquer à un testeur son objectif sans lui donner d'indice oral.

### G3. Mesurer la stabilité et le coût

- **Résultat** : mesurer les ralentissements avant d'optimiser ; corriger les anomalies répétables ; décider si le rechargement pour recommencer reste acceptable (il peut suffire pour la démo).
- **Apprentissage** : profilage et cycle de vie. Si un reset sans rechargement est retenu, traiter états, timers, meshes, listeners et ressources, pas seulement la santé.
- **Support** : outils du navigateur et modules réellement responsables du coût. Pas de pooling ni de découpage des bundles sans bénéfice identifié.
- **Validation** : plusieurs parties/rechargements, aucune erreur non traitée, fréquence et mémoire observées dans un navigateur et sur une machine identifiés ; cible de performance choisie après mesure, pas supposée.
- **Exercice** : distinguer lenteur CPU, rendu GPU et temps de chargement à partir d'un symptôme puis d'une mesure.

## H — Finir et partager

### H1. Préparer une version reproductible

- **Résultat** : README avec installation, commandes, commandes de jeu, architecture résumée, limites et crédits/licences des assets. Version et historique des changements cohérents.
- **Apprentissage** : différence développement/build/preview et notion de livraison.
- **Support** : documentation, package, configuration seulement si nécessaire.
- **Validation** : `npm.cmd run build`, puis `npm.cmd run preview` et parcours complet sur le build de production ; un autre environnement peut installer depuis le lockfile et lancer les instructions.
- **Exercice** : expliquer pourquoi le serveur Vite de développement n'est pas l'artefact final.

### H2. Publier la démo statique

- **Résultat** : choisir un hébergement statique et vérifier URL des assets/base path, accès HTTPS et compatibilité du Pointer Lock. Choix d'hébergement et publication à autoriser explicitement au moment voulu.
- **Apprentissage** : déploiement statique, résolution des URL et diagnostic réseau.
- **Support** : build Vite et configuration d'hébergement ; pas de backend nécessaire pour ce périmètre.
- **Validation** : lien ouvert depuis une nouvelle session, textures/sons chargés, victoire/défaite/redémarrage sur le site hébergé, crédits accessibles.
- **Exercice** : expliquer pourquoi un chemin d'asset commençant par `/` peut se comporter différemment sous un sous-dossier d'hébergement.

### H3. Faire le bilan et choisir la suite

- **Résultat** : démo figée et liste d'améliorations priorisées par impact, plutôt qu'une extension permanente du périmètre.
- **Apprentissage** : savoir terminer, expliquer sa dette technique et choisir une prochaine hypothèse.
- **Validation pédagogique finale** : l'utilisateur peut raconter le chemin d'un clic jusqu'aux dégâts, d'une attaque jusqu'à la mort, d'une image jusqu'au rendu, et expliquer les compromis collision/navigation et temps réel/simulé.
- **Extensions seulement ensuite** : seconde arme, deuxième ennemi, sauvegarde, plusieurs niveaux ou meilleur cheminement. Chaque extension doit justifier son coût et son intérêt pour le joueur.

## Scénarios de référence pour B1 et les régressions

Cocher seulement après essai réel et conserver le résultat dans ETAT_PROJET.

- [ ] Démarrage : 100 PV, trois ennemis, clic pour démarrer, pas de simulation avant le verrouillage.
- [ ] Déplacement : diagonale, sprint, glissement, murs/obstacles, caméra haut/bas, resize.
- [ ] Tir : clic gauche verrouillé uniquement, cadence, centre de caméra, trois touches par zombie, santé indépendante.
- [ ] Obstruction : mur et obstacle avant un ennemi, ennemi mort devant une cible encore vivante ; tirs hors portée si une scène permet ce test (ne pas déplacer définitivement le niveau juste pour cela).
- [ ] Effets : flash/recul seulement au tir accepté, sons adaptés au résultat, réaction rouge et voile joueur.
- [ ] Attaques : distance courte, délai, obstacle bloquant, ennemi mort incapable d'attaquer, santé jamais négative.
- [ ] Pause : Échap, blur/changement d'onglet, touches maintenues, reprise sans mouvement involontaire.
- [ ] Fins : dernier ennemi tué → victoire ; zéro PV → défaite ; pas de tir ni reprise après fin ; boutons sur les deux écrans rétablissent la situation initiale.
- [ ] Technique : build réussi, console sans erreur inattendue, ressources chargées. Un son non écouté ou un comportement non observé doit rester non testé.

## Règle d'adaptation

Si une étape n'améliore ni le jeu ni la compréhension, la supprimer ou la fusionner. Si une anomalie bloque la suite, la corriger avant de rajouter du contenu. Ne pas transformer cette roadmap en framework à réaliser : les classes futures sont des possibilités, les comportements et les apprentissages sont les objectifs.
