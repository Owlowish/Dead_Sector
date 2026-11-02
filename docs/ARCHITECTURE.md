# DEAD SECTOR — Comprendre le système

Carte du prototype inspecté le 1er novembre 2026. Les liens entre objets importent davantage que le détail de chaque ligne.

Mise à jour ciblée du 2 novembre : le tir possède maintenant une dispersion hanche/ADS (`WeaponSpread.ts`), partagée avec la projection du viseur. `Weapon.setOnImpact → Game → HitEffects` transmet la première intersection pour afficher particules et marques bornées, tandis que le callback de dégâts existant reste séparé. Les billboards Medkit/AmmoBox utilisent `PickupSprite.ts` et la position du joueur ; Zombie possède une réaction de blessure de 0,2 s qui bloque poursuite/séparation/attaque et annule la préparation. Détails actuels dans `COMBAT_FEEDBACK.md`. Le reste du document est un socle historique : Game contient aussi les paliers/récompenses/apparitions depuis d'autres interventions ; consulter son code et ETAT_PROJET.

## Trois couches à distinguer

Mise à jour fusil à pompe : `ShotgunAnimation.ts` fournit les repères du cycle de pompe (arrière, éjection, retour) et les deux images de hanche. `Weapon.ts` choisit l'image et déclenche une seule éjection ; `style.css` place le sprite et le flash. `scripts/make-shotgun-preview.mjs` génère un aperçu avec les mêmes données et le CSS du jeu. Le rechargement cartouche par cartouche est une action distincte du cycle de pompe après tir.

Extension recul du fusil : ce même module définit aussi la fenêtre de pose de choc et son impulsion amortie. Weapon choisit une image de choc hanche ou ADS, le CSS applique le cadrage et le repère de flash correspondants. Le rechargement visuel reste une pose fixe, faute de nouveaux assets produits ; voir `FUSIL_RECUL_ADS.md`.

Mise à jour ultérieure : le rechargement du fusil est désormais animé par couches DOM/CSS à partir des assets existants, avec six poses dans `ShotgunAnimation.ts`. `Weapon.commitShotgunShell` engage une seule cartouche à 0,50 s d'un cycle de 0,65 s, indépendamment de la durée du retrait de la main. Les données de pose sont partagées avec l'aperçu ; détails et limites dans `FUSIL_RECHARGEMENT_COUCHES.md`.

Mise à jour cadavres du 2 novembre : Zombie possède `ZombieRemains`, une représentation de mort indépendante de son IA. `die` rend le zombie immédiatement inactif/invisible aux tirs ; `Game.updateZombieRemains` avance quatre poses puis conserve la dernière, y compris pendant le menu du dernier ennemi. Le support reste vertical et orienté vers le joueur, dont la position est transmise via Zombie.updateDeath ; le premier essai horizontal a été remplacé à la demande de l'utilisateur. `startTier → Zombie.dispose → ZombieRemains.dispose` retire les corps et libère les ressources communes au dernier utilisateur. Les UV propres aux géométries permettent des poses indépendantes avec une unique texture partagée pour chute et cadavre. Voir `ZOMBIE_CADAVRES.md` pour pause, vérifications et limites de l'illusion billboard.

1. **Simulation** : positions, santé, états et temporisateurs. Elle décide ce qui arrive.
2. **Représentation** : meshes, textures, caméra, sons, HUD. Elle rend les événements perceptibles.
3. **Coordination** : construction des objets, ordre des mises à jour et fin de partie. Elle relie les systèmes.

Ces couches ne sont pas encore séparées en modules stricts. Zombie et Weapon associent logique et présentation, Game contient aussi du DOM. C'est acceptable pour ce petit prototype. On séparera seulement les responsabilités qui deviennent réellement encombrantes.

## Qui possède quoi ?

| Fichier | Responsabilité actuelle | Collaborations |
| --- | --- | --- |
| `src/main.ts` | Charge le CSS, construit Game, démarre | Game |
| `src/Game.ts` | Possède scène/rendu, instances, état de partie, orchestration et HUD | Tous les systèmes |
| `src/Player.ts` | Caméra, entrées, déplacement, collision, santé | Level, fonction canPlay fournie par Game |
| `src/Level.ts` | Géométrie fixe, éclairage, boîtes de collision et meshes solides | Player et Zombie pour collisions ; Weapon pour tirs |
| `src/Zombie.ts` | Une instance ennemie : santé, poursuite, attaque, sprite et animation | Level, position joueur et callback d'attaque |
| `src/ZombieRemains.ts` | Représentation de mort : chute et corps au sol, ressources GPU communes et libération | Zombie, données ZombieAnimation ; mises à jour coordonnées par Game |
| `src/Weapon.ts` | Entrée de tir, cadence, rayon, sélection de cible, effets et sons | Caméra, meshes, callback onHit et canPlay |
| `src/Medkit.ts` | Ressource de soin : billboard pixel art éclairé, flottement, détection de contact et consommation | PickupSprite, Player (pour soigner), Game |
| `src/Door.ts` | Porte interactive : coulissement vertical, états d'ouverture, gestion de collision et interaction | Level (obstacles et tirs), Player/Game (touche E) |
| `src/AmmoBox.ts` | Munitions : billboard pixel art éclairé, flottement, détection de ramassage et ravitaillement | PickupSprite, Weapon (réserve), Game |
| `src/HitEffects.ts` | Particules et traces temporaires à partir d'une intersection ; plafonds et nettoyage | Weapon via Game |
| `src/WeaponSpread.ts` | Direction aléatoire dans un cône, angle selon ADS et projection du viseur | Weapon |
| `index.html`, `src/style.css` | Interface superposée à l'image 3D | Game et Weapon modifient certains éléments |
| `public/assets` | Ressources accessibles par URL | TextureLoader et Audio |

Pas de notion de projectile mobile : le tir est instantané, dit hitscan. L'altitude n'est plus strictement plane : un moteur d'altitude $O(1)$ continu (`Level.getFloorHeightAt` issu de `MansionConfig.ts`) calcule la hauteur du sol (rez-de-chaussée à 0 m, demi-niveau à +2,4 m et rampes continues) et ancre le joueur (avec amorti de caméra), les zombies, les objets et les cadavres, avec une logique de perception et d'attaque 3D euclidienne.

## La boucle de jeu

```text
setAnimationLoop
  → calcule delta = min(temps écoulé, 0,05 s)
  → fait disparaître le voile rouge
  → si playing ET souris verrouillée :
       Player.update(delta)
       pour chaque Zombie : update(delta, position joueur, callback attaque)
  → Weapon.update(delta) pour les effets
  → renderer.render(scene, camera)
```

La boucle met à jour puis affiche, comme un service qui avance son état à chaque cycle. Le delta donne une durée et non un nombre d'images ; le plafond limite les grands déplacements mais ralentit la simulation lors d'images très longues. Le tir, lui, arrive dans un événement souris entre deux cycles ; il met donc à jour les matrices 3D avant d'interroger les positions.

## Deux flux essentiels

```text
Clic accepté → Weapon : rayon centre caméra, portée 30
  → première intersection parmi cibles visibles + solides
  → décor : son métal
  → cible : onHit(mesh, 40)
       → Game retrouve l'instance via find
       → Zombie.takeDamage → flash ou mort / mesh invisible
       → Game vérifie every(zombie mort) → endGame('won')
```

```text
Zombie.update → distance courte + délai écoulé + ligne d'attaque libre
  → onAttack(10)
  → Game appelle Player.takeDamage
  → actualise vie et voile si santé réduite
  → si zéro : endGame('lost')
```

Un callback est une fonction passée à un objet pour qu'il signale un résultat. Weapon connaît les meshes mais ne connaît pas la classe Zombie ; Game fait l'association. Cela suffit ici, pas besoin d'un bus d'événements général.

## Quatre représentations différentes du monde

- Le **mesh** est une géométrie visible avec un matériau. Il sert aussi de support au raycasting.
- La **boîte de collision** (`Box3`) est une approximation fixe d'un mur ou obstacle. Le joueur et le zombie sont des cercles sur X/Z ; Level teste leur proximité avec ces boîtes. Le déplacement est découpé en petits pas puis testé séparément sur X et Z pour glisser.
- La **texture** colore le mesh. Le zombie est un plan vertical tourné vers le joueur (billboard). La marche déplace la fenêtre de lecture sur quatre cellules horizontales d'une texture.
- L'**interface** est du HTML par-dessus le canvas. Le viseur et le rayon coïncident parce qu'ils utilisent tous deux le centre, pas parce que le viseur émet un rayon.

Transparence visuelle et collision sont distinctes : masquer les pixels d'une texture ne découpe pas sa géométrie. De même, déplacer un obstacle après sa création ne mettrait pas automatiquement à jour la Box3 stockée ; les futures portes devront traiter explicitement les deux représentations.

## États et temps

Zombie possède aussi RECOVER depuis l'ajout de ses animations. Deux poses préparent le coup pendant 0,6 s ; l'impact inflige les dégâts une seule fois et commence une récupération de 0,32 s. Les textures de marche/attaque et les UV sont décrits dans ZombieAnimation.ts, commun au jeu et à l'aperçu. Les ombres utilisent la même texture que le matériau visible. Voir ZOMBIE_ANIMATIONS.md.

L'arme est représentée par couches : carcasse/main principale fixes, culasse indépendante et main secondaire/chargeur de rechargement. Weapon pilote `--slide` pour le cycle court et les offsets de la main pour les poses de rechargement. Le CSS sélectionne des régions stables des images d'origine. Cette représentation évite les variations de perspective de l'ancienne séquence ; voir ARME_COUCHES.md pour les approximations et validations.

Weapon pilote aussi une progression de visée 0–1 au clic droit ; Game la transmet à Player.setAimAmount pour interpoler le FOV (75 à 58) et la sensibilité. Le HUD reçoit la même progression pour le fondu entre les deux perspectives 2D. Pause, blur et fin réinitialisent cette progression ; le rayon central est indépendant du sprite. Voir ARME_ADS.md.

Game possède `playing/won/lost`, chaque Zombie possède `IDLE/CHASE/SEARCH/ATTACK`, une santé et un indicateur alive. SEARCH suit la dernière position aperçue via des points fixes calculés par Level ; ATTACK représente la préparation avant les dégâts. Une réaction rouge et la récupération utilisent des compteurs indépendants.

Le tir suit une horloge réelle en millisecondes ; les attaques et les réactions suivent des secondes simulées. Ne pas les mélanger accidentellement. Toute modification de pause doit préciser ce qui s'arrête (simulation, commandes, audio, effets).

## Évoluer sans refondre

- Plus d'ennemis : tableau actuel suffisant ; optimiser la recherche seulement si un besoin mesuré apparaît.
- Niveau plus grand : commencer par des données de placement dans Level avant d'introduire un éditeur.
- Portes : faire évoluer ensemble visuel, collision et obstruction des rayons.
- HUD qui grossit : extraire une petite classe Hud si les mises à jour DOM masquent la coordination dans Game.
- Redémarrage sans rechargement : définir reset et libération des écouteurs/ressources avant de reconstruire des objets.
- Navigation : commencer avec points de passage ; réserver A* à un besoin de chemins multiples démontré.
