# DEAD SECTOR — Comprendre le système

Carte du prototype inspecté le 1er novembre 2026. Les liens entre objets importent davantage que le détail de chaque ligne.

Composition et lambris, 5 novembre : `MansionComposition` décrit les intentions, repos muraux et six portraits ; `MansionDressing` conserve les douze autres placements et construit leurs reliefs. `Level` possède ces lots statiques et `MansionPortraits`, qui fusionne les tableaux épais par pièce. `MansionConfig` reste la source des dimensions solides du socle, des piliers et de l’établi ; `MansionFurnishings` dérive les accessoires de ces supports. Le mesh existant Galerie est aussi fourni à la liste de solides de Level pour arrêter les tirs sur le buste exposé. Il est retiré avant destruction sans remplacer le tableau partagé avec Weapon.

`MansionWallGeometry → Level` remplace les boîtes de murs ordinaires par les mêmes six faces subdivisées : lambris à 1,05 m du sol local, papier répété à 2,10 m, phase horizontale mondiale et découpe au changement d’étage. `MansionWallMaterial` partage un atlas papier/bois et un matériau, sans groupe de matériau supplémentaire. Les colliders et raycasts utilisent toujours les volumes visibles ; le découpage ne change pas les surfaces touchées. `SalonWallGeometry` est un ancien module désormais inutilisé par Level ; les encadrements du Salon conservent leur bois particulier. L’aperçu `make-composition-preview` charge le vrai Level et les mêmes données, sans variante du décor propre à la démonstration.

Sons mécaniques et balancement, 5 novembre : `Game` relie le contexte du listener existant à `Weapon.setupMechanicalAudio`. `WeaponSoundEvents` dérive ses seuils des chronologies pistolet/pompe ; Weapon les déclenche au franchissement, et engage directement le son de cartouche lors du commit réel. `WeaponMechanicalAudio` possède six buffers synthétisés et quatre voix maximum, commandés par Effets ; interruptions et `Weapon.dispose` annulent les restes et libèrent sources/écouteurs. Aucun son n'entraîne un transfert de munitions.

`Game → WeaponMotion` transmet la position réelle après Player et l'état ADS/recharge après Weapon. Le helper écrit les seules variables de balancement sur le parent `.weapon-view` ; le CSS les compose avec les transforms enfants de recul et de visée. Phase liée à la distance, amplitude amortie, ADS complet stable ; aucune action sur la caméra ou les tirs. Pause/debug/palier/dispose réinitialisent le helper. L'aperçu `make-weapon-feedback-preview` réutilise ces données et classes.

Feu du Salon, 5 novembre : `Level.createSalonFireplace → HearthFire` pose un plan fixe transparent dans la bouche de l'âtre. `HearthFireAnimation` partage dimensions/cellules/cadence avec le GIF d'aperçu ; les UV avancent sans nouveau chargement de texture. `Level.update` transmet le delta d'atmosphère de Game pour figer le feu hors activité. `Level.disposeDecor → HearthFire.dispose` retire plan et ressources, y compris si le chargement termine tard. Aucun son, collider ou lumière supplémentaire.

Relief et ambiance, 5 novembre : `Level` possède `MansionFurnishings` (160 formes fusionnées par pièce, six meshes, un matériau vertexColors) et `MansionAtmosphere` (six groupes de24points). Le premier est statique ; le second reçoit un delta d'atmosphère de Game, nul hors activité. Aucune collision de déplacement ni lumière supplémentaire ; seul le batch Galerie sert désormais de bloqueur de tir, comme décrit ci-dessus. `Level.disposeDecor` libère leurs ressources avec MansionDressing et MansionPortraits. `MansionFloorSurfaces.SALON_RUNNERS` est partagé par les plans du tapis et le choix du son des pas.

`Game → FootstepAudio` transmet la position réelle après Player.update. La distance parcourue choisit les appuis, la surface choisit un des trois buffers synthétisés une fois sur le contexte du listener existant. Volume Effets, pause/focus, reset des paliers et destruction pilotent les voix (deux au plus). `AudioMix` conserve le rôle réglages/fondus et ajoute lecture/écriture locale versionnée ; l'écriture est demandée seulement par les curseurs, et Game applique immédiatement les valeurs restaurées aux sources initiales.

Recomposition du Salon, 5 novembre : `VisualStyle.salonLighting` fournit également position et décroissance du foyer et des appoints. `Level` place la source nommée `salon-hearth` devant la cheminée, au même endroit que la lanterne, et oriente l'appoint chaud vers la Galerie. Le nombre de sources et le flux `getLightingAt → Game → Weapon` restent inchangés. `scripts/make-salon-preview.mjs` fournit un banc A/B à caméras fixes avec les anciennes valeurs figées et les nouvelles instances réelles ; observations et mesure limitée consignées dans ETAT_PROJET. Les mentions de validation manquante ci-dessous sont l'historique des ateliers précédents.

Mise à jour décor du 5 novembre : `Level` possède `MansionDressing`. Ce composant charge l’atlas unique `mansion-details-v1.png`, transforme les rectangles de ses cinq cellules en UV et place désormais douze surfaces contre les murs. Plans et quinze boîtes de relief sont fusionnés par pièce/matériau : neuf meshes statiques, 204 triangles, deux matériaux partagés sans ombre projetée. Le sol local fixe l’altitude, y compris à l’étage ; aucune animation ni mise à jour par image. Ces surfaces restent hors des collisions et bloqueurs de tir : les murs derrière elles sont toujours physiques. `Game.dispose → Level.disposeDecor → MansionDressing.dispose` retire le groupe et libère ses ressources propres. Contrat initial dans `DECOR_MANOIR_2026-11-05.json`, état courant dans `COMPOSITION_LAMBRIS_2026-11-05.json` ; pas de nouvelle validation WebGL ou de temps GPU acquise.

Mise à jour ciblée du 5 novembre : `Game` possède `AudioMix`, qui conserve les réglages Ambiance/Effets/Musique/Craquement et calcule leurs fondus exponentiels. `Game.updateAudioMix` applique les niveaux aux sources de chaque classe ; les gains relatifs des sons restent locaux. Un ennemi reçoit le niveau Effets dès `setupAudio`, même si le fichier arrive tard. Le mix utilise un delta de présentation pendant la pause, sans avancer le combat ; les règles existantes arrêtent/suspendent toujours les lectures à la perte du contrôle. Les réglages sont conservés pendant la partie, pas enregistrés entre deux chargements.

Pour l'image, `VisualStyle.salonLighting → Level` décrit la salle témoin. `Level.getLightingAt` fournit luminosité, chaleur et impulsion locale d'orage ; cette dernière utilise la distance et un rayon contre les solides seulement pendant un éclair. `Game → Weapon.setEnvironmentalLighting` transmet ces données au filtre des couches DOM. La lumière ambiante est amortie ; le bref flash est ajouté directement puis retiré dès sa fin. Deux appoints sans ombres ont été ajoutés au Salon : 10 lumières ponctuelles dans Level au total (contre 8 auparavant), et toujours deux projecteurs d'ombres. Le budget déclaré de Level est maintenant aligné sur ce nombre ; arme et balise du carillon sont hors de ce budget. Le coût GPU et le résultat artistique restent non mesurés/non observés dans cette passe.

Mise à jour ciblée du 4 novembre : `Game` possède le menu debug K, distinct de l'état de rencontre. Quand il est ouvert, `isSimulationActive` refuse le contrôle et le delta de simulation est nul. Un choix passe par `jumpToDebugTier → Player.resetForDebug → Game.startTier` : retour à l'entrée, vie restaurée, nettoyage et nouveaux compteurs/file, avec équipement conservé. HTML/CSS présentent les boutons générés depuis `EncounterConfig`. La fermeture laisse la souris libre jusqu'au clic du joueur. Le reset de palier efface aussi le compteur de Rampeuses et l'ancienne accalmie.

La Rampeuse déjà intégrée par Gemini utilise `CrawlerZombie.ts` et six billboards dans `public/assets/zombies/crawler/`. Le remplacement V2 conserve ce comportement. `CrawlerAnimation.ts` fournit chronologie, caractéristiques et rectangles de tête en coordonnées d'image ; `SpriteHitMask.ts` utilise ces rectangles selon la pose et le vrai alpha. Depuis la correction des proportions, ce module fournit aussi l'offset du centre par rapport à l'appui dessiné : `CrawlerZombie` le réutilise sur le sol et les plateformes. L'aperçu importe les mêmes dimensions et le même offset, avec une comparaison 3D depuis la hauteur du joueur. Les validations d'images et de logique ne valent pas observation du combat réel ; limites actuelles dans ETAT_PROJET.

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
| `src/AudioMix.ts` | Réglages et niveaux sonores amortis, baisse progressive de la musique hors combat ; aucune source audio possédée | Game applique les gains aux sources Three.js et HTML Audio des autres classes |
| `src/HorrorDirector.ts` | Temporise l'événement rare, filtre regard/distance, pilote le volume et la source audio unique | Contexte de phase et caméra via Game ; points admissibles via Level ; `PositionalAudio` attachée à la scène |
| `src/UpgradePedestal.ts` | Offre choisissable, icône éclairée orientée vers le joueur, veilleuse et consommation unique | `UpgradeSpec` attribué par Game ; `PickupSprite` partage les textures ; Game applique le bonus après le choix |
| `src/Player.ts` | Caméra, entrées, déplacement, collision, santé | Level, fonction canPlay fournie par Game |
| `src/Level.ts` | Géométrie fixe, habillage, éclairage et lanternes, boîtes de collision et meshes solides | Player et Zombie pour collisions ; Weapon pour tirs ; MansionConfig et MansionMaterials pour les surfaces |
| `src/MansionComposition.ts` | Intentions, zones murales calmes et positions des six portraits | MansionPortraits, aperçu et contrôles de composition |
| `src/MansionDressing.ts` | Douze panneaux muraux et leurs reliefs, atlas partagé, fusion par pièce et matériau | Possédé par Level ; sol et pièces de MansionConfig ; atlas dans public/assets/decor |
| `src/MansionPortraits.ts` | Six tableaux épais fusionnés par pièce, UV recto et chants avec une image existante | Positions de MansionComposition ; construction et destruction par Level |
| `src/MansionFurnishings.ts` | Reliefs du mobilier et corniches, dimensions dérivées des supports, un batch par pièce | Level possède le lot et réutilise le batch Galerie pour les tirs ; MansionConfig fixe les supports |
| `src/StormWindow.ts` | Forme des baies gothiques, texture d'extérieur partagée et projection visuelle du flash au sol | Positions de MansionConfig ; Level règle leur visibilité avec la lumière d'orage |
| `src/MansionMaterials.ts` | Surfaces de mobilier/portes/sols et bois particulier du Salon, matériaux partagés et UV des boîtes | Level et Door ; anciennes entrées de mur conservées, murs ordinaires gérés ci-dessous |
| `src/MansionWallGeometry.ts` | Mêmes volumes de murs, faces découpées en bandes à hauteur physique fixe, UV mondiaux | MansionConfig fournit dimensions et sol local ; Level conserve collisions et solides |
| `src/MansionWallMaterial.ts` | Cache commun d’un matériau et d’un atlas papier/lambris, filtrage pixel et sRGB | MansionWallGeometry décrit les bandes ; Level partage le matériau entre les murs |
| `src/Zombie.ts` | Standard ou Coureur : santé, poursuite, attaque et animation ; le standard peut se relever une fois après sa première mort | Level, ZombieRemains, position joueur et callback d'attaque |
| `src/SpitterZombie.ts`, `src/SpitProjectile.ts` | Cracheur lent : préparation, tir et déplacement ; bille verte simulée avec le delta et collisions décor/joueur | Level, SpitterAnimation, Game |
| `src/ZombieRemains.ts` | Représentation de mort : chute et corps persistant, puis animation inverse pour la relève d'un standard | Zombie, SpitterZombie et ressources GPU communes ; mises à jour coordonnées par Game |
| `src/Weapon.ts` | Entrée de tir, cadence, rayon, sélection de cible, effets et sons | Caméra, meshes, callback onHit et canPlay |
| `src/WeaponPresentation.ts` | Prépare les images à résolution réduite, coupe les faibles alpha, gère les Blob URL de rendu et atténue l'éclairage des armes | Initialisé par main et les aperçus ; références CSS choisies par Weapon ; anciennes URL libérées après resize ; sources et chronologies inchangées |
| `src/Medkit.ts` | Ressource de soin : billboard pixel art éclairé, flottement, détection de contact et consommation | PickupSprite, Player (pour soigner), Game |
| `src/Door.ts` | Porte interactive : coulissement vertical, états d'ouverture, gestion de collision et interaction | Level (obstacles et tirs), Player/Game (touche E) |
| `src/AmmoBox.ts` | Munitions : billboard pixel art éclairé, flottement, détection de ramassage et ravitaillement | PickupSprite, Weapon (réserve), Game |
| `src/HitEffects.ts` | Particules et traces temporaires à partir d'une intersection ; plafonds et nettoyage | Weapon via Game |
| `src/WeaponSpread.ts` | Direction aléatoire dans un cône, angle selon ADS et projection du viseur | Weapon |
| `index.html`, `src/style.css` | Interface superposée à l'image 3D | Game et Weapon modifient certains éléments |
| `public/assets` | Ressources accessibles par URL | TextureLoader et Audio |

Pour F5, `Game.updateHorrorAudio` transmet au directeur le delta, la phase réelle, la position et le regard du joueur. `Level.getAccessibleHorrorPoints` fournit des positions fixes dont les portes d'accès sont réellement ouvertes et dont l'altitude vient de la géométrie du manoir. `HorrorDirector` choisit ensuite une position hors du cône de regard et place l'unique `PositionalAudio` à cet endroit ; il ne modifie ni les ennemis, ni les collisions, ni les portes.

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
