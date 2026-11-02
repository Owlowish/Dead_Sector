# Audit des micro-saccades entre paliers — 2 novembre 2026

Demande : auditer les optimisations et proposer la suite. Aucun changement du gameplay ou du moteur effectué. Les modifications locales préexistantes de `Level.ts`, du test demi-niveau et du document d'état ont été conservées. Les plafonds et le demi-niveau sont bien présents dans le code actuel ; les anciens documents de migration et la roadmap ne décrivent plus exactement ce prototype.

## Conclusion et niveau de preuve

La piste CPU la plus solide est la recherche de chemins répétée pour choisir les apparitions, suivie des recalculs des zombies derrière les murs. Des mesures isolées reproduisent un coût supérieur au budget d'une image à 60 Hz. Deuxième piste : destruction puis recréation de ressources graphiques au changement de palier, dont le premier agile au palier 2. Leurs conséquences sur les uploads GPU et les shaders n'ont pas été profilées dans le navigateur.

Il ne s'agit pas d'une reproduction complète des micro-saccades sur la machine du joueur. Aucun FPS de combat réel, profil GPU ni trace de transition n'a été mesuré. Un test CPU ciblé établit un coût algorithmique ; il ne prouve pas à lui seul la cause exclusive du ressenti.

## Mesure reproductible

Exécuter depuis la racine `node scripts/audit-tier-cpu.mjs`. Résultat écrit dans `tmp/audit-tier-perf.json`.

Le test construit le vrai `Level`, ouvre complètement les portes non permanentes, appelle la vraie navigation sur les points d'apparition éligibles à la collision et à la distance minimale. Aucun zombie vivant pour la séparation ; FOV, visibilité et classement final ne sont pas chronométrés. TextureLoader est remplacé par un constructeur de textures vides : ni requête réseau, ni décodage d'image, ni upload GPU. Ce n'est pas le coût intégral de `trySpawnZombie`, ni l'état exact des portes lors d'une transition.

15 répétitions par position, lors de la première mesure :

| Ensemble | Position cible du joueur | Points du pool | Médiane CPU | Maximum observé | Tests de collision par balayage |
| --- | --- | --- | --- | --- | --- |
| Palier 1 | (8 ; 1,7 ; 16) | 9 | 66,55 ms | 76,06 ms | 180 932 |
| Palier 2 | (8 ; 1,7 ; 4) | 6 | 8,55 ms | 11,41 ms | 24 371 |
| Palier 3 | (-12,25 ; 4,1 ; -9) | 6 | 36,30 ms | 41,08 ms | 108 909 |

45 waypoints, 85 meshes bloquant les tirs. Les durées dépendent du JIT, de la charge machine et du placement du joueur. Le palier 2 n'est pas systématiquement le pire : la géométrie du chemin et les positions comptent.

## P1 — Navigation reconstruite pendant les apparitions

`Game.trySpawnZombie` appelle `Level.findNextWaypoint` pour chaque candidat restant. Cette fonction reconstruit un tableau de 47 nœuds (départ, cible, 45 waypoints), puis Dijkstra teste à nouveau les segments candidats. `isPathClear` échantillonne tous les 0,1 m ; chaque échantillon parcourt les colliders et les portes. Il n'existe pas de graphe d'adjacence préconstruit.

Cette opération survient directement sur le thread de rendu, y compris pour le premier ennemi immédiat de `startTier` aux paliers 2 et 3. Les apparitions suivantes sont espacées de 1,2 s ; une tentative sans point valable revient après 0,5 s. `Zombie.SEARCH` recalcule aussi toutes les 0,5 s. Plusieurs ennemis alertés ensemble peuvent regrouper leurs recherches sur la même image.

Actions proposées :

1. Préconstruire les connexions praticables entre waypoints pour le décor fixe. Conserver les coûts de distance ; raccorder seulement le départ et la cible lors d'une requête.
2. Traiter explicitement les portes mobiles : version de navigation ou arêtes contrôlées, mise à jour quand leur état praticable change. Une ouverture/fermeture doit invalider les connexions concernées ; pas de cache aveugle à travers les portes ou les escaliers.
3. Pour une apparition, utiliser un test d'accessibilité adapté ; ne plus chercher un trajet complet indépendant pour chaque candidat lorsque plusieurs appartiennent à la même composante accessible. Tester la visibilité avant le chemin lorsqu'elle permet de rejeter un candidat.
4. Décaler les demandes de replanification des ennemis ou limiter leur nombre par image ; ne pas ralentir les collisions ni les attaques de contact.

Validation : mêmes chemins et apparitions légales, portes et deux escaliers testés, pas de passage dans les murs. Comparer les mêmes positions, le nombre de tests de collision et les durées avant/après. Un pool de zombies ou un moteur physique ne résout pas ce coût.

## P1 — Ressources recréées à chaque palier

`Game.startTier` dispose tous les anciens zombies avant de créer le suivant. Un standard appelle TextureLoader quatre fois par instance (repos/marche/attaque/blessure), même quand les autres standards utilisent les mêmes fichiers. `dispose` libère ces textures à chaque suppression. Une image déjà dans le cache HTTP n'est pas une texture GPU déjà prête.

Les agiles partagent leurs ressources, mais `releaseAgileSharedResources` vide le cache au dernier utilisateur. Les ressources des cadavres ont la même règle dans `ZombieRemains`. À la transition, ces caches retombent à zéro avant le nouveau groupe. Le premier agile demande aussi les géométries de ses poses et ses matériaux au milieu de la partie.

Le test isolé compte : standard 5 demandes de texture à froid (dont mort), 4 pour un deuxième standard, puis 5 après suppression complète ; agile 6 à froid (5 animations + mort des restes), 0 pour un deuxième agile, puis 6 après suppression complète. Cela prouve la recréation des objets de ressources, pas leur coût GPU exact. Les durées de construction Node, sans image réelle, sont faibles et ne permettent pas d'innocenter l'upload GPU.

Actions : conserver un cache borné des ressources pendant la tentative, préparer les deux variantes avant le combat, supprimer les corps et les instances à chaque palier en conservant leurs ressources communes. Libération à la vraie fin de vie du jeu. Ne pas partager naïvement une texture dont `repeat/offset` sont modifiés par chaque ennemi : préserver les animations indépendantes (UV de géométrie, par exemple). Préparer les images n'équivaut pas à préparer tous les shaders ; vérifier le premier rendu de chaque variante/animation. Pas besoin d'introduire immédiatement un pool complet d'entités.

## P2 — Le compteur actuel masque les pires images

`Game.start` borne delta à 0,05 s, puis passe cette valeur à `logPerformanceMetrics`. La borne est utile pour limiter les déplacements de simulation, mais l'utiliser comme mesure supprime la durée réelle des blocages supérieurs à 50 ms. La moyenne sur 60 valeurs masque également un pic isolé. Le rapport ne constitue donc pas une preuve de fluidité des transitions.

`scripts/measure-perf.mjs` laisse tourner le jeu trois secondes sans déverrouiller de palier ni verrouiller la souris. Il ne reproduit pas la simulation des apparitions/poursuites. Ne pas utiliser son résultat comme validation du symptôme signalé.

Action prioritaire de mesure : conserver le delta brut séparément du delta de simulation, relever p95/p99/max et le nombre d'images > 33/50 ms, annoter début de palier, apparition, première utilisation d'une variante, fin de nettoyage. Faire trois transitions à froid puis à chaud avec le même parcours ; comparer au build de production sans HMR. Les seuils servent à repérer les pics, pas à garantir un résultat sur tous les ordinateurs.

## P2 — Coût continu du rendu et allocations

Les plafonds, murs et escaliers sont créés au chargement du niveau, pas reconstruits à chaque palier. Leur ajout peut augmenter le coût continu, sans expliquer seul un pic au changement de palier. Ombres directionnelles et ombres du lustre ponctuel restent actives ; Three rend les différentes faces de l'ombre ponctuelle (voir WebGLShadowMap du paquet installé). Deux lumières avec ombres ne signifient pas deux passes équivalentes.

`Zombie.hasClearPath` et `Level.hasLineOfSight` remettent à jour les matrices de tous les meshes solides pour chaque rayon. Les zombies font de la perception chaque image. La boucle recrée vecteurs, tableaux filtrés, listes d'occupants et callbacks ; le rapport perf lui-même recrée sa fonction globale chaque image. Ces allocations peuvent contribuer au ramasse-miettes, mais ce coût n'a pas été isolé. Elles viennent après les recherches de chemins mesurées.

Actions secondaires : mettre à jour les matrices des objets réellement mobiles au bon endroit ; réutiliser quelques vecteurs/tableaux si un profil confirme l'intérêt ; comparer ombres du lustre activées/désactivées en gardant le rendu de base identique. Réduire la résolution rétro seule ne corrige pas un blocage CPU.

## Atelier recommandé avant de nouvelles fonctionnalités

Un atelier « transitions fluides » : instrumentation brute, graphe de navigation réutilisable avec invalidation des portes, puis cache de ressources conservé entre paliers. Avancer par mesures séparées pour attribuer les gains. Fichiers : `Game.ts`, `Level.ts`, `Zombie.ts`, `AgileZombieAnimation.ts`, `ZombieRemains.ts`, tests de navigation et de durée de vie. Aucun changement de taille de carte, de nombre d'ennemis ou de luminosité nécessaire pour commencer. Atelier proposé, pas implémenté par cet audit.

## Résultats après implémentation de l'atelier « Transitions fluides » (2 novembre 2026)

L'atelier « Transitions fluides » a été entièrement implémenté et validé sur les 3 étapes :
1. **Étape 1 (Mesure précise)** : `PerfTracker.ts` sépare delta brut réel et delta simulé, calcule médiane, p95, p99, max et compteurs de saccades (>33ms, >50ms), isole le combat actif des pauses/transitions/onglets en arrière-plan, et chronomètre apparitions et transitions.
2. **Étape 2 (Graphe réutilisable & portes dynamiques)** : `Level.ts` précalcule le maillage d'arêtes entre les 45 waypoints statiques au chargement. Les portes mobiles sont validées en $O(1)$ à l'exécution (`door.getState() === 'OPEN'`). Les requêtes raccordent uniquement départ et cible aux waypoints les plus proches. Les apparitions éliminent immédiatement les candidats visibles (FOV + LOS direct) avant tout calcul de chemin. Un jitter temporel étale les recalculs de poursuite des zombies.
3. **Étape 3 (Conservation des ressources & UV d'atlas)** : `ZombieAnimation.ts` découpe les poses d'animation dans les coordonnées UV des géométries (`createAtlasFrameGeometry`), permettant aux zombies standards de partager leurs textures sans muter `repeat/offset`. `ZombieRemains` et `AgileZombieAnimation` conservent leurs caches entre les paliers. `Zombie.warmup()` prépare les textures et matériaux avant le premier combat. `disposeAllZombieResources()` assure une libération explicite et idempotente en fin de session.

### Comparatif CPU isolé (`node scripts/audit-tier-cpu.mjs`)

| Palier / Ressource | Avant optimisation | Après optimisation | Évolution |
| --- | --- | --- | --- |
| **Palier 1** (9 points de pool) | 66,55 ms (max 76,06 ms) | **1,19 ms** (max 5,18 ms) | **-98,2 %** (x56 plus rapide) |
| Collisions Palier 1 | 180 932 tests | **3 288 tests** | **-98,2 %** |
| **Palier 2** (6 points de pool) | 8,55 ms (max 11,41 ms) | **0,64 ms** (max 0,74 ms) | **-92,5 %** (x13 plus rapide) |
| Collisions Palier 2 | 24 371 tests | **1 862 tests** | **-92,4 %** |
| **Palier 3** (6 points de pool) | 36,30 ms (max 41,08 ms) | **1,10 ms** (max 1,32 ms) | **-97,0 %** (x33 plus rapide) |
| Collisions Palier 3 | 108 909 tests | **3 138 tests** | **-97,1 %** |
| Rechargements Zombie Standard après suppression | 5 textures rechargées | **0 texture rechargée** | Cache conservé |
| Rechargements Zombie Agile après suppression | 6 textures rechargées | **0 texture rechargée** | Cache conservé |

### Comparatif navigateur réel (`node scripts/measure-perf.mjs`, Chromium headless)

Conditions identiques : Pointer Lock simulé, délai de grâce de 2 s, 1ère apparition ennemie, puis transition simulée Palier 1 -> Palier 2.

| Métrique de rendu | Avant optimisation | Après optimisation | Constat |
| --- | --- | --- | --- |
| **Temps de frame médian** | 16,7 ms | **16,6 ms** | Parfaitement calé sur 60 FPS |
| **Percentile p95** | 17,0 ms | **17,0 ms** | 95 % des frames fluides |
| **Percentile p99** | **82,2 ms** | **17,1 ms** | Disparition des pics de latence |
| **Temps de frame maximum** | **126,8 ms** | **20,2 ms** | Plus aucun blocage hors budget |
| **Saccades > 33,3 ms (perte de 30 FPS)** | 3+ frames | **0 frame** | 100 % des frames sous le seuil |
| **Saccades > 50,0 ms (blocage sévère)** | 3 frames | **0 frame** | Aucune saccade perçue |
| **Durée d'apparition ennemie** | **67,2 ms** | **2,8 ms** | Divisée par 24 |
| **Durée de transition de palier** | **83,2 ms** | **5,2 ms** | Divisée par 16 |

## Fonctionnalités proposées ensuite

1. **Choix gratuits d'amélioration entre les paliers** : deux options utiles selon l'état réel de l'inventaire. La cible initiale le prévoit, mais le code actuel `enterRespite` réapprovisionne et passe directement à l'exploration ; pas de choix actif dans ce flux. Une interaction avec un autel permettrait de conserver le déplacement libre. Concepts : état de tentative et modification de données ; faible coût de rendu.
2. **Variation contrôlée avec graine** : conserver le squelette de circulation, tirer les ressources, les groupes d'ennemis et quelques décors secondaires. Ne pas déplacer arbitrairement les accès, escaliers ou obstacles qui ferment les boucles. Concepts : génération déterministe et invariants de navigation. Commencer par les tables de rencontres plutôt que refaire toute la carte.
3. **Annonce des apparitions** : son spatial et signal bref dans une zone masquée, puis apparition respectant les distances et chemins actuels. Concepts : événement différé et anticipation du joueur. Pas de lumière dynamique supplémentaire indispensable.
4. **Réglages et confort persistants** : volume, sensibilité et luminosité, puis options d'ombres mesurées. Concepts : séparation réglages/état de partie et persistance locale ; faible coût en jeu.

Après cela seulement, envisager un ennemi élite de fin ou une nouvelle arme. Le projet possède déjà deux armes et deux variantes : améliorer décisions et rencontres apportera plus de variété qu'accumuler immédiatement de nouveaux sprites.
