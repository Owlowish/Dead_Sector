# DEAD SECTOR — Architecture

Base `88d13ad` avec travail local sur horreur sonore, impacts et finale, le 6 novembre 2026. Le code fait foi ; validations et limites dans `ETAT_PROJET.md`.

## Responsabilités

| Modules | Rôle |
| --- | --- |
| `main.ts`, `Game.ts` | Démarrage, scène/rendu, instances, orchestration, progression, valeurs du HUD et nettoyage. |
| `GameHud.ts` | Présentation DOM : santé/armes/progression, invites, annonces et deux notifications bornées. Durées sur temps actif, sans logique de combat. |
| `Player.ts` | Caméra, entrées, Pointer Lock, déplacement, collision, santé et lampe. |
| `MansionConfig.ts`, `Level.ts` | Données du manoir ; géométrie, solides de tir, collisions, altitude, navigation et éclairage. |
| `Door.ts` | Interaction E, ouverture, verrouillage, collision mobile et sécurité anti-pincement. |
| `EncounterConfig.ts`, `FinaleConfig.ts` | Huit rencontres dont finale avec élite : quotas, plafonds, salves, zones, apparitions et paramètres du Gardien. |
| `Zombie.ts` | Standard/Coureur et option élite : perception, recherche de chemin, poursuite, attaque, blessure et relève hors élite. |
| `SpitterZombie.ts`, `SpitProjectile.ts` | Préparation du crachat, récupération et projectile mobile avec collisions décor/joueur. |
| `CrawlerZombie.ts`, `CrawlerAnimation.ts` | Rampeuse : comportement, six poses, proportions, appui au sol et zones de tête. |
| `ZombieRemains.ts` | Chute/cadavre des standards, Coureurs et Cracheurs ; animation inverse des relèves. |
| `Weapon.ts`, `WeaponSpread.ts`, `SpriteHitMask.ts` | Armes, munitions, cadence, dispersion, raycasting, alpha et classification tête/corps. |
| `WeaponAnimation.ts`, `ShotgunAnimation.ts`, `WeaponPresentation.ts` | Chronologies et poses partagées avec les aperçus ; présentation DOM/CSS et images rétro. |
| `HitEffects.ts`, `ImpactSurface.ts`, `ShellCasing.ts` | Surfaces bois/pierre/métal, particules et marques bornées, douilles et libération des ressources. |
| `Medkit.ts`, `AmmoBox.ts`, `ShotgunPickup.ts`, `PickupSprite.ts` | Soins, drops de munitions, fusil et billboards partagés. |
| `MansionMaterials.ts`, `StormWindow.ts`, `StormController.ts` | Matériaux/UV partagés, fenêtres, pluie, éclairs et tonnerre. |
| `HorrorDirector.ts` | Source sonore rare, sélection hors regard, délai et suspension. |
| `PerfTracker.ts`, `TierDiagnostics.ts` | Temps d'image, coûts de transitions/apparitions, tirs, contacts, dégâts, relèves et ressources par palier. |
| `index.html`, `style.css`, `public/assets/` | Interface, couches visuelles des armes et ressources chargées par URL. |

`EncounterBell`, `UpgradePedestal` et `UpgradeConfig` restent présents. Le carillon est instancié mais inactif ; aucun piédestal n'est instancié dans le cycle normal. Le code d'offres et d'application des améliorations est donc dormant.

## Boucle et contrôle

`Game.start()` installe `renderer.setAnimationLoop`. Le delta de simulation vaut `min(delta réel, 0,05 s)` ; le menu K le force à zéro. `PerfTracker` mesure le delta réel séparément.

- `isSimulationActive()` accepte `playing`, `respite`, `exploration`, `terminal` et `won`, sauf si K ou le bilan est ouvert.
- Joueur, IA et projectiles exigent le Pointer Lock ; les ennemis ne sont simulés qu'en `playing`.
- `Game.updatePickups` exige le même contrôle effectif et revérifie l'état après les dégâts : pas de collecte pendant pause, perte de focus ou frame de mort. Gains affichés depuis les deltas réellement appliqués ; `AmmoBox.getWeaponType` et `Weapon.getReserveAmmoFor` distinguent l'arme bénéficiaire.
- Le décompte d'accalmie exige aussi un onglet visible et le focus. Les cadavres et impacts ont leurs propres conditions de pause ; certains effets visuels continuent sans Pointer Lock.
- `Weapon.update(delta)` gère rechargement, ADS et animation ; `Weapon`/`Player` filtrent aussi leurs entrées selon le contrôle. La cadence de tir utilise `performance.now()`, les animations le delta simulé.
- `Level.getLightingAt` transmet l'éclairage local à l'arme 2D ; le rendu 3D est calculé à un tiers de la résolution avec minimum 320 × 240, puis agrandi par CSS. Le HUD conserve sa résolution.

K ouvre une pause de debug distincte de l'état de rencontre, annule le rechargement, suspend l'audio et libère la souris. `jumpToDebugTier → Player.resetForDebug → Game.startTier` restaure position/vie et nettoie ennemis, projectiles, drops, douilles et impacts. Équipement, munitions et améliorations sont conservés. Fermer le panneau laisse la reprise du Pointer Lock au clic du joueur.

## Tirs et dégâts

`Weapon` actualise les matrices mondiales, projette un rayon par plomb depuis la caméra et trie les intersections entre cibles visibles et solides du décor. `SpriteHitMask.isOpaqueSpriteHit` ignore les pixels transparents ; `isHeadSpriteHit` utilise les UV et les zones de tête de la pose courante. Le masque alpha partagé est plafonné à 512 px.

- Dégâts calculés par `Weapon` : pistolet 80 tête / 28 corps ; fusil 24 tête / 12 corps par plomb. Les impacts sont cumulés par cible.
- `onHit(mesh, damage, shot) → Game → takeDamage(damage, headHits > 0, impactForce)` applique une seule notification par cible. `impactForce` reste distinct des dégâts pour l'interruption du Cracheur. La Rampeuse applique en plus son multiplicateur tête de 1,5.
- `setOnImpact → Game → HitEffects.emit` produit particules et traces selon la surface bois/pierre/métal de la face touchée ; `Weapon` sélectionne aussi le son correspondant.
- `setOnShoot` déclenche recul caméra, diagnostic et alerte des ennemis ; `setOnCasingEject` crée la douille. `setOnAmmoChange` synchronise le HUD.
- `GameHud` conserve les références des champs `data-hud-*` ; les callbacks transmettent les valeurs sans remplacer les blocs DOM. `update(delta, controlActive)` suspend/cache les notifications et annonces hors contrôle ; `clear` les retire aux sauts debug, nouveaux paliers, fins et redémarrages. Les calques DOM des armes restent dans `Weapon`.
- `onAttack` des ennemis et le callback du projectile passent par `Game → Player.takeDamage`, HUD et voile rouge ; une vie nulle appelle `endGame('lost')`.

Les armes du joueur sont hitscan ; les crachats sont des projectiles mobiles à 9 m/s, sans guidage. Le fusil engage une cartouche à 0,50 s d'un cycle de 0,65 s ; `commitShotgunShell` garantit un transfert unique, y compris à grand delta. Annuler avant cet instant ne consomme rien ; annuler après conserve la cartouche engagée. Recul, cycle de pompe et rechargement restent distincts. Le recul utilisateur de deux secondes est conservé.

Les armes FPS utilisent des calques DOM/CSS et des `clip-path` calibrés sur les images actuelles : carcasse, culasse, main et chargeur/cartouche. Le masque de carcasse exclut la culasse mobile ; le rechargement du fusil masque les anciens dessins de main/cartouche et les remplace par des calques séparés. Modifier les sources impose de vérifier ces masques. `WeaponPresentation.installWeaponArt` rééchantillonne le rendu sur une grille de 3 px, coupe l'alpha sous 128 et libère les anciennes Blob URL après remplacement au redimensionnement ; les sources et coordonnées de découpe restent intactes.

## Rencontres et ressources

`startTier(n)` nettoie les ennemis/cadavres/projectiles précédents, actualise les portes et cibles de l'arme, remet les compteurs à zéro et initialise `spawnQueue` depuis `EncounterConfig`. Les drops non consommés persistent entre paliers normaux.

- `trySpawnZombie` distingue quotas totaux par type et plafonds simultanés. La limite active est le minimum du budget global et de celui du palier.
- Les points retenus respectent secteur, collision, distance minimale de 6 m, visibilité et chemin praticable ; le score privilégie les points sûrs proches et plusieurs directions.
- Un Cracheur réserve aussi un Coureur d'escorte : deux places, deux unités de quota et deux points sûrs proches avec ligne de vue mutuelle sont nécessaires.
- `Zombie.isThreat()` inclut `alive || revivalPending` : un corps susceptible de se relever occupe encore une place et empêche la fin du combat. Première mort sans impact tête fatal : 20 % de relève standard, 12 % Coureur ; une seule relève, à 40 PV.
- `checkTierCompletion()` appelle `enterRespite()` seulement quand la file et les menaces sont vides. Les accès débloqués s'ouvrent, les soins sont réarmés et dix secondes d'exploration libre précèdent le prochain palier.
- Après P7, l'accalmie mène à P8 avec élite. Finir P8 appelle `endGame('won')` sans libérer la souris : exploration conservée et bilan volontaire par B. Le bilan suspend le contrôle ; `restartRun` réinitialise joueur/armes/portes/ressources/diagnostics et effets sans reconstruire les instances ni ajouter d'écouteurs. Les sauts debug conservent l'équipement et sont signalés au bilan.
- Les munitions proviennent des morts via un budget par palier ; `AmmoBox` alimente la réserve de `Weapon` puis est libérée après consommation. Les caisses fixes ne sont plus instanciées.

`getRunSummary` agrège diagnostics clôturés, paliers réellement terminés et durée active réelle hors pause ; tirs et impacts restent des comptes distincts. P8 contient deux standards dont un Gardien, trois Coureurs et un Cracheur, sans Rampeuse. `Zombie(..., random, { elite: true })` garde le type standard et les sprites existants ; `FinaleConfig` règle charge immobile, impact évitable et récupération, sans relève.

## Monde, animation et audio

`Level.getFloorHeightAt(x, z)` délègue aux plateformes/rampes de `MansionConfig` : rez-de-chaussée à 0 m, demi-niveau à +2,4 m. Joueur, ennemis, objets et cadavres utilisent ce même sol. Les collisions horizontales et solides de raycasting sont distincts ; `Door` fournit leurs versions mobiles. La navigation exploite un graphe de points, ses arêtes statiques et l'état réel des portes.

Les ennemis restent des billboards verticaux. Les modules d'animation définissent poses/UV et chronologies partagées avec les aperçus ; la Rampeuse conserve un support carré et un offset calculé sur l'appui dessiné. `ZombieRemains` sélectionne des géométries UV propres aux poses sans modifier l'offset d'une texture commune : deux cadavres peuvent afficher des étapes différentes en partageant textures et matériaux. Les instances quittent la scène à chaque palier ; les ressources partagées restent en cache jusqu'à leur libération globale, notamment dans `Game.dispose`.

L'`AudioListener` appartient à la caméra. `Game.syncAmbientAudio` pilote ambiance/musique et suspend les sources hors contrôle, sans focus ou onglet visible. Les voix ennemies et l'orage sont spatialisés. `HorrorDirector.update` reçoit phase, regard, position et points accessibles. `nextWait` retient 35 % des accalmies avec un délai de 3–6 s ; les autres reçoivent une attente infinie et restent silencieuses jusqu'au prochain `resetRespite`. Aucun nouveau tirage au retour de pause ou en cas de point manquant. Une lecture maximum, arrêt hors éligibilité et quatre secondes de silence à la reprise ; la pause peut faire expirer la fenêtre sans son. `advanceRespite` précède l'audio dans la boucle : le palier suivant réarme et coupe la source avant toute nouvelle lecture.

Diagnostics navigateur : `window.__DEAD_SECTOR_PERF()`, `__DEAD_SECTOR_PERF_DETAILED()`, `__DEAD_SECTOR_DIAGNOSTICS()` et `__DEAD_SECTOR_START_TIER(n)`. Ces outils et les tests logiques ne prouvent pas la lisibilité, le rendu audio ou l'équilibre d'un combat réel.

## Outils de vérification visuelle et sonore

Lancer `npm.cmd run dev` pour servir les aperçus générés sous `/tmp/` ; leurs données doivent rester celles du jeu.

| Commande depuis la racine | Résultat |
| --- | --- |
| `node scripts/make-weapon-preview.mjs` | Pistolet, culasse et rechargement : `/tmp/weapon-preview/index.html`. |
| `node scripts/make-shotgun-preview.mjs` | Fusil, recul, pompe, ADS et insertion : `/tmp/shotgun-preview/index.html`. |
| `node scripts/make-zombie-preview.mjs` | Marche/attaque standard et planche des poses : `/tmp/zombie-preview/`. |
| `node scripts/make-zombie-death-preview.mjs` | Vraie classe de cadavre, cycle isolé et vue latérale : `/tmp/zombie-death-preview/index.html`. |
| `node scripts/make-spitter-preview.mjs` | Poses du Cracheur : `/tmp/spitter-preview/index.html`. |
| `node scripts/make-crawler-preview.mjs` | Rampeuse, cycles normal/lent et comparaison 3D des proportions : `/tmp/crawler-preview/index.html`. |
| `python scripts/generate_soft_audio.py` | Régénération des sons adoucis `*-soft.wav`. |
| `python scripts/generate_storm_audio.py` | Régénération de la pluie et du tonnerre. |
| `python scripts/generate_combat_audio.py` | Régénération de la musique et de la détonation du fusil. |

Les scripts audio écrasent leurs sorties dans `public/assets/sounds/` : ne les lancer que pour une modification sonore voulue. L'optimisation des textures existantes est reproductible avec `scripts/optimize-assets.py`.
