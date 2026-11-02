# Zombie : chute et cadavre entre deux paliers

Atelier demandé et approuvé le 2 novembre 2026. L'utilisateur veut des cadavres pixel art, supprimés au début du palier suivant pour éviter leur accumulation. La proposition de quatre poses, corps au sol sans collision et ressources communes a été validée. Les modifications parallèles de la nouvelle carte ont été conservées ; cet atelier n'en change pas les règles.

Correction demandée ensuite : le cadavre doit rester un **billboard vertical**, comme les zombies vivants, pour conserver une hauteur apparente. Le premier essai de plan horizontal a été remplacé. Aucune nouvelle génération nécessaire : la quatrième pose de chute fournit directement le dessin du corps couché.

## Ce qui change

- `Zombie.die()` déclare immédiatement l'ennemi mort, masque sa hitbox, annule préparation d'attaque/blessure, arrête sa voix et démarre sa représentation de chute.
- Quatre poses sur 0,56 seconde : jambes qui cèdent (0,12), genou au sol (0,14), chute latérale (0,14), corps couché (0,16).
- Après cette séquence, la dernière pose reste affichée dans un plan vertical éclairé, tourné vers le joueur autour de Y. Le dessin représente le zombie couché et son appui reste à 0,025 unité au-dessus du sol. La position du corps est fixe, son orientation suit le joueur ; il ne bloque ni déplacement ni tirs et ne projette pas d'ombre supplémentaire.
- `Game.updateZombieRemains` avance les chutes indépendamment de l'IA. Combat/exploration sans souris verrouillée : pause ; répit/victoire : la chute du dernier zombie continue derrière le menu ; défaite : les chutes sont suspendues.
- `Game.startTier()` appelle toujours `Zombie.dispose` pour les anciennes instances, supprime aussi leurs cadavres et vide la liste des cibles de Weapon. Les corps restent pendant le répit et l'exploration jusqu'au véritable démarrage du prochain palier.

## Responsabilités et flux

| Fichier | Rôle |
| --- | --- |
| `src/Zombie.ts` | Mort logique immédiate, démarrage de la représentation, aucune IA après mort, nettoyage de l'acteur et de sa voix |
| `src/ZombieRemains.ts` | Chute puis corps au sol ; images, matériaux et géométries partagés avec comptage des utilisateurs |
| `src/ZombieAnimation.ts` | Régions de la planche, ancrages au sol, durées et dimensions, utilisés dans jeu et aperçu |
| `src/Game.ts` | Politique pause/menu des animations de mort ; nettoyage et remise à zéro des cibles au début du palier |
| `scripts/make-zombie-death-preview.mjs` | Aperçu WebGL isolé utilisant la vraie classe ZombieRemains, bouton un cycle, lecture lente et caméra autour du corps |
| `scripts/check-zombie-remains.mjs` | Tests avec les vrais Zombie, Weapon, Game.updateZombieRemains et Game.startTier, sans constructeur WebGL de Game |

```text
Weapon → Game → Zombie.takeDamage → die
  → alive=false, hitbox invisible, attaque annulée, voix arrêtée
  → ZombieRemains.start(position, orientation)

Boucle Game → updateZombieRemains(delta) → Zombie.updateDeath
  → quatre poses de chute → dernière pose immobile, support vertical face au joueur

Nouveau palier → Game.startTier → Zombie.dispose
  → retire acteur et cadavre, déconnecte voix, libère ressources individuelles
  → dernier utilisateur : libère aussi les ressources communes des cadavres
  → Weapon.setTargets([]), puis cibles des nouvelles apparitions
```

Une classe séparée a été choisie pour la responsabilité concrète de représentation de la mort et de partage des ressources. Elle évite d'ajouter cette gestion GPU dans les décisions de poursuite/attaque déjà nombreuses de Zombie. Aucun gestionnaire global d'entités, moteur physique, dépendance ou règle d'arène ajouté.

## Concepts pédagogiques

1. **Mort logique et fin visuelle sont différentes.** `alive=false` arrête immédiatement les attaques et fait diminuer le compteur du palier ; `updateDeath` peut encore afficher une chute. Le résultat de l'animation ne déclenche pas une seconde élimination. La fin de combat reste fondée sur les vivants et les ennemis encore en file.
2. **Les UV sélectionnent une portion d'image.** Les quatre poses partagent la même texture ; leurs géométries ont des UV différents. Deux zombies peuvent tomber à des instants différents sans modifier une texture commune et changer accidentellement la pose de l'autre. La densité de pixels commune et un ancrage au sol par pose empêchent un redimensionnement arbitraire quand le personnage se baisse.
3. **Retirer de la scène ne libère pas toute la mémoire GPU.** Il faut appeler `dispose()` sur textures, matériaux et géométries devenus inutiles. Les ressources communes gardent un compteur d'utilisateurs : les supprimer au premier cadavre nettoyé casserait ceux encore affichés. Les appels de nettoyage sont protégés contre une double libération. Les nœuds audio individuels sont également déconnectés au nettoyage.

## Contrat des assets et choix de cadrage

Assets générés via l'outil intégré imagegen, d'après `zombie_idle.png` :

- `public/assets/zombies/zombie_death.png` : 1254 × 1254, quatre poses. La génération n'a pas produit des rangées régulières : les pieds des deux poses du haut dépassent la médiane. Le découpage utilise donc des rectangles mesurés qui n'empiètent pas sur les figures voisines, sans modifier le bitmap ni forcer une grille 2×2 incorrecte.
- `public/assets/zombies/zombie_corpse.png` : essai conservé mais **non chargé** après la correction billboard. La dernière pose de `zombie_death.png` est utilisée pour le cadavre, évitant une texture supplémentaire et un changement de dessin en fin de chute.
- Prompts complets, références et fichiers sources dans `docs/ZOMBIE_CADAVRES_PROMPTS.json`. Les originaux générés sont conservés ; les images utilisées sont copiées dans le projet.

L'ancrage X/Z est fixé à la mort. Game transmet la position de la caméra via `Zombie.updateDeath(delta, viewerPosition)` à `ZombieRemains.update`. Le plan s'oriente autour de Y vers cette position pendant la chute ET après la dernière pose, même quand le delta est nul. La fin de l'animation arrête le changement de poses, pas l'orientation du billboard. L'ancrage du dessin au sol est conservé.

## Coût et limites

- Une seule texture de chute/cadavre et un jeu de géométries/matériaux partagés pour tous les zombies présents ; pas de copie de texture par cadavre. Filtrage Nearest, sans mipmaps pour cette image.
- Une seule représentation de mort visible par zombie, sans calcul de poursuite ou physique pour un corps posé. Les poses utilisent la même géométrie préparée entre les instances ; aucun nouveau mesh à chaque frame.
- Le nombre de cadavres dépend du total d'ennemis du palier, pas de la limite de vivants simultanés. Avec les groupes actuels de 4/5/6, au plus six corps avant nettoyage. Si les paliers deviennent infinis ou beaucoup plus longs, discuter alors d'un plafond supplémentaire : ce chantier n'invente pas de disparition anticipée contraire à la demande.
- Les ressources de l'acteur vivant restent détenues jusqu'au nettoyage du palier, comme auparavant ; la nouvelle représentation de mort est partagée. La dernière libération remet le cache commun à zéro ; le prochain palier peut recharger les images depuis le cache du navigateur.
- Le corps reste un dessin 2D en billboard, sans volume physique ni ragdoll. Le même profil est montré depuis tous les azimuts ; c'est l'illusion rétro recherchée, pas une reconstruction 3D de ses différentes faces. Il peut déborder visuellement dans un mur près du lieu de mort, ou chevaucher un autre corps. Pas de déplacement physique du cadavre pour trouver une place libre, ni de blocage de porte par les morts.
- Les UV/cadrages restent liés aux fichiers actuels ; remplacer l'image implique de revoir ses régions et ses ancrages. Le test vérifie les dimensions réelles du PNG.

## Vérifications réellement effectuées

- `npm.cmd run build` réussi ; avertissement Vite de taille de bundle >500 ko toujours présent.
- `node scripts/check-zombie-remains.mjs` réussi : mort en préparation d'attaque, absence de dégâts/mouvement après mort, tir réel de Weapon qui atteint le mur derrière une chute, pause en combat, chute du dernier zombie pendant le menu, support vertical ancré au sol et réorientation après la chute avec delta nul, poses indépendantes avec texture commune, arrêt/déconnexion audio, suppression via le vrai Game.startTier et trois cycles sans accumulation. Les collaborateurs de Game sont fournis sans construire son renderer ; ce test ne joue pas tout le niveau.
- Suites existantes `check-zombie.mjs`, `check-weapon.mjs`, `check-combat-feedback.mjs`, `check-tiers.mjs` réussies. La carte a évolué en parallèle : la suite de paliers courante contient dix épreuves sur le manoir 48×40.
- Aperçu autonome construit avec `node scripts/make-zombie-death-preview.mjs`, ouvert dans Chrome headless avec WebGL logiciel. Cycle parcouru par étapes et captures inspectées ; vérification renouvelée après correction : cadavre de face et caméra latérale à environ 86°, dessin toujours lisible avec sa hauteur apparente. Position fixe, orientation vers la caméra. Captures dans `tmp/zombie-death-preview/`.
- Aucun parcours complet des trois paliers ni appréciation du combat à vitesse réelle dans le vrai manoir par l'assistant. L'aperçu dispose d'un bouton de cycle normal/lent pour l'utilisateur. Aucun chiffre de performance globale en jeu revendiqué.

## Reproduction et mini-exercice

Ouvrir `tmp/zombie-death-preview/index.html` après génération. Cliquer « Une chute », regarder à vitesse normale puis lente, tourner autour du corps et réinitialiser. Dans le jeu, tuer un zombie près d'un autre ennemi, puis le dernier du palier : tous deux doivent tomber sans infliger de coup tardif. Confirmer une récompense, ouvrir l'aile suivante : les anciens corps doivent disparaître au début du combat suivant.

Exercice : modifier la durée d'une des quatre poses dans `zombieDeathAnimation.frames`, régénérer l'aperçu et observer le changement de rythme. Prédire d'abord : une chute plus lente doit-elle retarder la récompense du palier ? Pourquoi ? Ne pas changer la règle de progression pour cet exercice.

Prochaine étape : retour utilisateur sur la lisibilité de la chute, le raccord avec le corps au sol et le nettoyage à l'ouverture du prochain palier. Aucune refonte de carte ou nouvelle mécanique autorisée implicitement par cet atelier.
