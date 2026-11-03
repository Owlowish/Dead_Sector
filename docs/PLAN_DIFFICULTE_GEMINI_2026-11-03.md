# Repenser la difficulté des paliers 4 à 7 — proposition pour Gemini

## Diagnostic fondé sur le code actuel

- `Player` marche à 5 m/s et sprinte à 9 m/s, sans endurance. Le standard avance à 1,5 m/s, le Coureur à 2,7 m/s et le Cracheur à 0,62 m/s. Le joueur peut donc prendre beaucoup de distance. C'est un constat mécanique ; son effet réel dépend du parcours et n'a pas encore été mesuré en partie complète.
- `Game.startTier` attend 1 s après le carillon des paliers 4–7. Ensuite, `Game` tente une seule apparition toutes les 1,2 s tant que la file et la place le permettent, pour un plafond global de quatre. Des quotas élevés peuvent ainsi produire une longue succession de duels plutôt qu'une pression simultanée.
- `Game.trySpawnZombie` traite `maxAgile` et `maxSpitter` comme des plafonds opportunistes. Si un type atteint sa limite simultanée, un standard prend la place dans le quota total ; le nombre final de Coureurs ou de Cracheurs peut donc être inférieur à la composition visée.
- `SpitterZombie` ne démarre son tir qu'à 5–12 m. En deçà de 5 m avec ligne de vue, il s'arrête et reste inoffensif. Tout dégât non fatal annule actuellement sa préparation. Le projectile vise la position du joueur au moment du tir et avance en ligne droite à 6,5 m/s.
- Les trois soins et les six munitions du manoir sont réarmés dans `Game.enterRespite` puis dans `Game.startTier`. Un objet ramassé pendant l'accalmie peut donc réapparaître immédiatement au début du combat suivant. Le soin de base vaut 30 PV, le joueur commence à 100 PV, et l'amélioration Vitalité donne 120 PV max et 40 PV de soin.
- Les standards ont actuellement 20 % de chance de se relever une fois. `ZombieRemains` possède déjà une lecture inverse de la chute, mais `beginRevival` refuse le type `agile` et le retour vivant remet toujours la pose standard. Une relève des Coureurs doit donc étendre ces deux points, pas seulement changer la probabilité.

Ces points indiquent surtout un problème de **pression dans le temps et dans l'espace**. Les derniers paliers comptent actuellement 6/8/9/10 ennemis. Le retour utilisateur demande aussi davantage d'ennemis au total et des Coureurs capables de se relever. Ces deux leviers sont compatibles avec le plafond actuel de quatre menaces simultanées, mais ils allongent la tentative et augmentent les besoins en munitions : les introduire par étapes mesurées, sans hausse supplémentaire des PV, de la vitesse et des dégâts.

## Pistes de difficulté

| Piste | Ce que le joueur devra décider | Coût et risque | Priorité |
| --- | --- | --- | --- |
| Vagues groupées et renforts rapides | Choisir une trajectoire de fuite et prioriser plusieurs menaces | Moyen ; vérifier la lisibilité et les spawns | 1 |
| Composition réellement garantie | Adapter sa cible aux Coureurs et au Cracheur présents ensemble | Moyen ; préserver le plafond de quatre et un standard par palier | 1 |
| Supprimer les angles morts du Cracheur | Ne plus pouvoir le neutraliser en se collant à lui | Faible à moyen ; garder une attaque annoncée | 1 |
| Davantage d'ennemis sur la durée | Tenir plusieurs séquences de pression dans un même palier | Plafond actif conservé ; mesurer quand même les cadavres, la durée et les munitions | 1, après mesure du rythme |
| Relève rare des Coureurs | Réévaluer un corps et sa trajectoire, même après un tir réussi | Moyen ; animation inverse, signal clair et quota réservé | 1, après vérification des corps |
| Ravitaillement une seule fois par transition | Décider quand utiliser soins et munitions | Faible ; éviter une pénurie qui bloque la tentative | 2 |
| Résistance mesurée à l'interruption | Choisir entre infliger des dégâts et interrompre une attaque | Moyen ; l'annulation doit rester visible et cohérente | 2 |
| Tir légèrement anticipé ou zone verte temporaire | Varier le mouvement pendant l'esquive | Plus coûteux ; nouvelle télégraphie et validation visuelle | Option après essai |

Je recommande de commencer par **rythme + composition + angle mort**, puis d'ajouter le nombre total d'ennemis et la relève des Coureurs en comparant les mesures avant/après. Le plafond global reste quatre et le sprint du joueur inchangé. L'économie et l'interruption viennent après la mesure de ce second lot. La zone dangereuse au sol est une option artistique et technique distincte, pas une partie implicite du lot.

## Tâches ordonnées pour Gemini

### 0. Mesurer une situation de départ

Ajouter une sortie de diagnostic locale et désactivable, sans télémétrie externe ni nouvel écran de jeu : pour chaque palier, durée de combat, nombre d'ennemis simultanés au fil du temps, délai avant le premier contact, types réellement apparus, dégâts subis, soins/munitions pris, tirs dépensés et relèves. Utiliser `Game` et les événements existants ; ne pas refondre l'architecture. Faire ensuite quelques essais des paliers 4–7 et consigner les résultats, en distinguant mesures automatisées et parcours humain. Si un parcours complet est impossible, le signaler et poursuivre avec des hypothèses explicites.

### 1. Éliminer l'angle mort du Cracheur

Dans `SpitterZombie`, permettre une réponse annoncée quand le joueur entre à moins de 5 m. Premier essai simple : conserver le même cycle préparation/crachat et une distance minimale très courte, avec un point de départ du projectile qui ne traverse pas le joueur ni un mur. Ne pas ajouter d'attaque instantanée. Tester 1 m, 3 m, 5 m, mur/porte, esquive et mort pendant la préparation. Garder la préparation d'au moins 0,8 s et le projectile non guidé après le départ.

### 2. Donner une forme aux paliers 4–7

Dans `EncounterConfig`, décrire pour chaque palier une ouverture différée de 2, 2, 3, puis 3 ennemis, espacés de courts intervalles plutôt qu'apparus sur la même frame. Dans `Game`, utiliser ces données puis réapprovisionner la vague dès qu'une place se libère, sans dépasser quatre menaces actives ou en relève. Une apparition impossible reste en file, sans téléportation visible ni suppression de quota. Conserver les critères actuels de distance, ligne de vue, navigation et porte ouverte. Essayer ensuite un intervalle de renfort de l'ordre de 0,7–0,9 s ; c'est une valeur de départ à mesurer, pas un équilibre approuvé.

Construire la composition prévue au début du palier : les quotas de Cracheurs, Coureurs et standards sont des nombres à servir au cours de la vague, pas seulement des maxima. Si le type suivant est temporairement au plafond simultané, attendre une place ou prendre un autre type **sans perdre** le quota restant. Tester les compositions P4–P7 avec des morts à des moments différents et garantir au moins un standard. Ne pas modifier ici les PV, les dégâts ou la vitesse des ennemis.

### 3. Ajouter des ennemis au total, sans multiplier les entités actives

Après le lot 2, essayer les totaux P4–P7 **8 / 10 / 12 / 14** au lieu de 6 / 8 / 9 / 10. Conserver les plafonds simultanés existants : quatre menaces globales, deux Cracheurs au maximum et trois Coureurs au maximum selon le palier. Répartir les nouveaux ennemis entre standards, Coureurs et Cracheurs de façon à conserver au moins deux standards aux paliers 5–7 ; ne pas augmenter tous les quotas spéciaux mécaniquement. `EncounterConfig` porte ces nombres, `Game` consomme la file et maintient l'espacement sûr des apparitions.

Mesurer avant/après la durée de chaque palier, le délai d'attente sans ennemi visible, les munitions dépensées et la fréquence d'images. Si la tentative dépasse nettement la cible de 10–15 minutes ou devient une guerre d'usure, réduire d'abord les totaux, sans accélérer encore les attaques. Tester notamment qu'un spawn refusé reste en file et que le palier se termine seulement après les 14 éliminations prévues au P7 et toutes les relèves.

Pour la performance, garder les textures, matériaux et géométries partagés ; ne pas créer de nouvelle ressource graphique par apparition. Les cadavres persistants créent tout de même un mesh par mort : relever draw calls, mémoire et temps d'image au P7 avec quatorze corps, et optimiser seulement si une régression est mesurée. Ne pas supprimer silencieusement les cadavres demandés par l'utilisateur. Aucun nouveau système de physique, particules de masse ni cinquième ennemi simultané dans ce lot.

### 4. Donner une seule chance de relève aux Coureurs

Étendre la règle existante de `Zombie` au type `agile` avec une chance initiale distincte, **12 % à essayer**, tirée à sa première mort seulement ; la seconde mort reste définitive. Après un délai lisible d'environ 2 s, rejouer à l'envers les poses `agile/death` déjà présentes dans `ZombieRemains`, puis revenir avec environ la moitié des 80 PV initiaux. Le retour doit choisir la pose agile, réinitialiser correctement attaque/navigation/ombre et ne jamais utiliser les images standard. Ajouter un signal discret (mouvement du corps ou son local) avant qu'il redevienne dangereux, et au moins une courte récupération après la relève.

`Game` compte déjà une relève standard en attente comme menace ; vérifier que cela vaut aussi pour le Coureur, pour le HUD, le plafond de quatre et la fin de vague. Réutiliser le même objet zombie et ses ressources partagées, sans seconde entité ni texture supplémentaire. Tester avec hasard contrôlé : pas de relève, relève agile complète, annulation au changement de palier, deuxième mort définitive, pause, dernier ennemi du palier et succession de plusieurs Coureurs. Inspecter l'animation à taille de jeu avant de la déclarer validée.

### 5. Corriger le double réarmement, puis régler les ressources

Faire réapparaître soins et munitions une seule fois par transition de palier. Vérifier les cas : objet pris pendant le combat, objet pris pendant l'accalmie, démarrage direct d'un palier de test, fin du palier 7. Garder des ressources accessibles avant chaque combat ; ne réduire les quantités qu'après comparaison des mesures de tirs, soins et échecs des lots 2–4. Conserver la liberté de circulation et le carillon volontaire.

### 6. Option après essai : interruption et tir plus exigeants

Si les combats restent faciles, remplacer l'annulation du crachat par tout dégât par une règle de « gros choc » explicite : une blessure ordinaire n'efface pas automatiquement la préparation, une accumulation de dégâts ou une mort l'interrompt. Tester précisément le fusil à pompe et les impacts rapprochés. Une autre option est une faible anticipation de la vitesse du joueur au départ du projectile, bornée et jamais corrigée en vol. Choisir **une seule** de ces options après le premier essai ; ne pas les cumuler avec une nouvelle hausse de vitesse ou de dégâts.

## Critères de réussite et limites à préserver

- Le palier 4 introduit une pression perceptiblement supérieure au 3 ; les paliers 6–7 obligent à gérer plusieurs rôles, sans dépasser quatre menaces comptées simultanément.
- L'augmentation du total ne dégrade pas sensiblement le temps d'image au pire cas P7 ; les textures et cadavres restent partagés/réutilisés, et la cible de durée 10–15 minutes reste plausible après essai.
- Un Coureur en relève garde son cadavre visible, se redresse avec ses propres poses, ne compte qu'une fois dans le quota de vague et ne peut ressusciter une seconde fois.
- Aucun ennemi ne naît dans le champ direct dégagé du joueur ni à moins de 6 m ; les chemins et portes demeurent praticables. Pas de coup sans signal lisible ni de contrôle arraché au joueur.
- La rencontre ne se termine pas tant qu'un ennemi ou une relève prévue reste en file. Après P7, l'exploration reste libre. Les cadavres et projectiles se nettoient au palier suivant.
- `npm.cmd run build`, tests ciblés de composition/rythme/ressources/relève agile et tests de progression existants passent. Inspecter ensuite le vrai jeu au Pointer Lock : temps d'attente, pression, esquive, munitions et fréquence d'images. Une compilation ne valide pas la difficulté ressentie.
- Viser toujours la tentative de 10–15 minutes prévue par `docs/ORIENTATION_JEU.md`. Ajuster une seule dimension à la fois après mesure ; éviter une inflation simultanée du nombre, des PV, de la vitesse et des dégâts.

## Message prêt à transmettre à Gemini

> Lis `AGENTS.md`, `docs/ETAT_PROJET.md`, `docs/ORIENTATION_JEU.md`, la section F4 de `docs/ROADMAP.md`, puis `docs/PLAN_DIFFICULTE_GEMINI_2026-11-03.md` et les classes citées. L'utilisateur demande davantage d'ennemis aux paliers élevés **et** une chance de relève des Coureurs, tout en préservant la performance. Implémente les tâches 0, 1 et 2, relève une première mesure, puis implémente les tâches 3 et 4 avec une seconde mesure comparative. Préserve tous les changements non committés, le sprint du joueur, le plafond de quatre menaces simultanées et les cadavres visibles. Vérifie `npm.cmd run build`, les tests ciblés et les tests de progression, puis essaie les paliers 4–7 dans le navigateur si possible. Rapporte durée, munitions et temps d'image ; distingue clairement les comportements testés du ressenti non validé. N'implémente pas automatiquement les tâches 5 et 6 : propose leur réglage à partir des résultats. Mets à jour `docs/ETAT_PROJET.md` avec réalisé, tests, limites et suite proposée. Ne commit/push pas sans demande.
