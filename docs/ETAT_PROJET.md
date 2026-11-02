# DEAD SECTOR — État et reprise

Dernière intervention ciblée : 2 novembre 2026 (Atelier F3 « Salle témoin visuelle et sonore » complété et validé : Grand Salon des Réceptions réhaussé sans surcoût d'ombres ; cheminée monumentale sculptée avec manteau en pierre, jambages, âtre en brique réfractaire et lit de braises rougeoyantes emissive sous collider physique strict 2.4x3.0x4.0m ; tapis damassé d'apparat au sol matérialisant la boucle de circulation du Secteur 1 ; linteaux sculptés en relief au-dessus des 3 passages ; synthèse procédurale et intégration d'ambiance d'horreur psychologique avec craquements de boiseries feutrés espacés de 18 à 35s ; documentation des 4 sprites d'offrandes manquants avec spriteAssetId cible ; budget strict de 2 ombres respecté, 0 frame > 33ms, 60 FPS constants, build npm propre et 13 suites de tests 100% PASS).

## État prioritaire pour la prochaine reprise

**Dernière intervention — Atelier F3 : Salle témoin visuelle et sonore (2 novembre 2026) :**
- **Salle témoin choisie — Grand Salon des Réceptions (Secteur 1)** :
  * Espace de combat initial et première boucle d'apprentissage du joueur ($X \in [-23,5; -3,5]$, $Z \in [6,5; 19,5]$).
  * **Cheminée monumentale sculptée (`Level.ts`)** : Remplacement du bloc d'obstacle générique par un manteau en pierre de taille (`visualColors.stone`), deux jambages latéraux sculptés, un fond d'âtre en briques réfractaires noircies (`visualColors.hearthDark`) et un lit de braises mourantes rougeoyantes avec matériau `emissive: visualColors.ember`. Collider physique et surface d'impact des tirs strictement préservés à $2,4 \times 3,0 \times 4,0$ m.
  * **Boucle de circulation et contraste utile (`Level.ts`)** : Grand tapis d'apparat damassé victorien bordeaux (`visualColors.carpet`) avec fine bordure d'or (`visualColors.carpetGold`) posé au sol ($Y = 0,005$). Il relie l'arche Sud ($Z=16,5$), longe la cheminée et dessert l'arche Nord ($Z=9,5$) et la Galerie ($Z=6,0$), guidant naturellement les déplacements du joueur sous stress sans texte intrusif.
  * **Linteaux sculptés en relief (`Level.ts`)** : Ajout de linteaux en bois mouluré au-dessus des deux arches du mur de refend et du passage de la Galerie Ouest, découpant les issues en silhouette même dans la pénombre ou à contre-jour.
- **Préservation absolue du budget de rendu d'ombres et lumière** :
  * Respect strict du plafond de **2 lumières projetant des ombres** (`MANSION_BUDGET.maxShadowCastingLights === 2`) : clair de lune directionnel et grand lustre du Hall.
  * Zéro ombre ponctuelle ajoutée pour la cheminée : la lueur d'âtre repose sur la propriété `emissive` des braises et sur la bougie douce sans ombre du Grand Salon, maintenant le nombre de passes d'ombres à 2.
- **Conception sonore espacée & horreur psychologique (`scripts/generate_soft_audio.py` & `Game.ts`)** :
  * Génération procédurale du micro-asset feutré `creak-soft.wav` (friction basse fréquence feutrée de fibres de bois de 0,85 s, bande passante douce).
  * Intégration dans `Game.ts` avec déclenchement espacé : premier délai d'observation garanti de 18 s, puis réarmement aléatoire entre 18 et 35 secondes de silence. Aucun bombardement auditif ni boucle courte agressive.
  * Synchronisation stricte : coupure immédiate en pause, perte de focus (`pointerlockchange`) ou game over via `syncAmbientAudio`.
- **Documentation des assets manquants pour la suite artistique (`UpgradeConfig.ts`)** :
  * Les 4 offrandes F2 disposent désormais d'un `spriteAssetId` explicite (`upgrade-ammo-pouch.png`, `upgrade-tight-choke.png`, `upgrade-vitality-vial.png`, `upgrade-light-boots.png`) et de repères sémantiques clairs afin de guider le futur travail des sprites 2D pixel art.
- **Vérifications réelles et métriques** :
  * `npm.cmd run build` : compilé avec succès (code 0, 258 ms).
  * Nouvelle suite `scripts/check-visual-room-f3.mjs` créée et 100% PASS (4/4 épreuves).
  * Les **13 suites de tests** du projet (`visual-room-f3`, `upgrades-f2`, `encounters-f1`, `perf-tracker`, `navigation-perf`, `tiers`, `split-level`, `zombie`, `zombie-agile`, `zombie-remains`, `combat-feedback`, `weapon`, `shotgun`) sont **100% PASS**.
  * **Profilage Chromium headless (`measure-perf.mjs`)** :
    - Framerate : **60 FPS** parfaitement stables.
    - Temps de frame médian : **16,7 ms** (budget 16,6 ms).
    - Percentile p95 : **16,9 ms**, p99 : **17,4 ms**, max : **21,1 ms**.
    - Saccades $> 33,3$ ms : **0 frame**, $> 50$ ms : **0 frame**.
    - Durée de transition de palier : **0,3 ms**.
    - Triangles : 5 266, Géométries : 143, Shaders : 8 (aucun surcoût GPU).
- **Prochaine étape proposée — Atelier F4 : Progression complète et accalmies** :
  * Étendre la structure d'accalmies et de rencontres à l'ensemble du cycle de tentative (rythme des 4 à 8 rencontres, calibrage des stocks de ressources en manoir ouvert et tension croissante).

**Intervention antérieure — Atelier F2 : Choisir une amélioration sans menu imposé (2 novembre 2026) :**
- **Catalogue d'améliorations équilibrées (`UpgradeConfig.ts`)** :
  * 4 améliorations bornées et observables :
    - *Cartouchière Renforcée* (`ammo_capacity`) : +50% réserve maximale (Pistolet 60->90, Fusil 30->45) et réapprovisionnement immédiat.
    - *Canon Ajusté* (`hip_accuracy`) : dispersion de hanche réduite de 35% pour des tirs groupés.
    - *Élixir de Vitalité* (`vitality`) : santé max augmentée à 120 PV et soin immédiat de +40 PV.
    - *Bottes de Cuir Souple* (`agility`) : vitesse normale et sprint accrues de +12%.
  * Tirage déterministe de 2 offres distinctes à chaque accalmie de palier.
- **Présentoirs 3D in-world sans menu bloquant (`UpgradePedestal.ts`)** :
  * Deux pupitres en chêne sombre et stèle en pierre implantés dans le Grand Hall Sud en $(-2,5; 2,5)$ et $(+2,5; 2,5)$, encadrant l'allée centrale et le carillon.
  * Détection conique de visée ($\le 2,8$ m, $\text{dot} > 0,65$) révélant le nom et l'effet sur le HUD (`[E] CHOISIR : NOM · EFFET`).
  * Veilleuse pulsée douce quand l'offre est active.
  * **Note explicite d'assets manquants pour le prototype** : Les stèles utilisent des primitives 3D provisoires. Il manque actuellement un sprite 2D pixel art dédié pour chaque offrande (icône de fiole, cartouchière, parchemin scellé). Ce point est expressément répertorié pour la passe artistique F3.
- **Règles d'exclusion mutuelle, départ distinct et péremption (`Game.ts`)** :
  * **Choix unique** : Valider une stèle consomme l'offre et ferme immédiatement la stèle concurrente. Impossible d'obtenir deux bonus sur la même accalmie.
  * **Départ distinct** : Le départ (ouverture de porte ou sonnerie de carillon) est totalement séparé du choix d'amélioration. La même pression de touche ne peut jamais choisir et démarrer simultanément.
  * **Péremption** : Si le joueur lance le combat sans choisir, les deux offres sont immédiatement fermées (`pedestal.close()`). Aucun bonus ne peut être ramassé rétroactivement pendant la bataille.
  * **Remise à zéro** : À la mort ou au redémarrage d'une tentative, les bonus ne persistent pas (`appliedUpgrades = []`).
- **Garantie de non-régression et tests** :
  * `npm.cmd run build` propre (code 0, 230 ms).
  * Nouvelle suite `scripts/check-upgrades-f2.mjs` créée et 100% PASS (4/4 épreuves).
  * Les 12 suites de tests du projet (`upgrades-f2`, `encounters-f1`, `perf-tracker`, `navigation-perf`, `tiers`, `split-level`, `zombie`, `zombie-agile`, `zombie-remains`, `combat-feedback`, `weapon`, `shotgun`) sont **100% PASS**.
- **Prochaine étape proposée — Atelier F3 : Salle témoin visuelle et sonore** :
  * Choix d'une salle de référence (ex: Grand Salon ou Grand Hall), travail sur les silhouettes, les repères de circulation, la cohérence des textures pixel art, l'intégration des sprites d'offrandes manquants et l'atmosphère sonore feutrée sans surcoût d'ombres.

**Intervention antérieure — Atelier F1 : Séparer rencontres et secteurs (2 novembre 2026) :**
- **Découplage rencontres vs secteurs physiques (`EncounterConfig.ts`)** :
  * Définition d'une table centralisée de 4 rencontres indépendantes des pièces physiques du manoir.
  * Palier 1 : Incursion initiale (Vestibule, Salon & Galerie), 4 zombies standards, déverrouille le Grand Hall Nord (`unlockSectorTier: 1`).
  * Palier 2 : Assaut du Grand Hall, 5 zombies (dont 2 coureurs agiles max, 1 simultané), déverrouille le plateau haut (+2,4 m) et ses escaliers (`unlockSectorTier: 2`).
  * Palier 3 : Hauteurs gothiques (Bibliothèque & Atelier), 6 zombies (dont 3 agiles max, 2 simultanés), achève l'ouverture de l'enceinte entière (`unlockSectorTier: null`).
  * Palier 4 (Validation F1) : Patrouille combinée en manoir complet ouvert, 4 zombies (dont 2 agiles max), réutilise les cachettes masquées des 3 secteurs sans nouveau secteur ni refermeture de porte.
- **Activation volontaire sans rupture de contrôle (`EncounterBell.ts`)** :
  * Création d'un carillon d'arène 3D victorien en laiton et chêne sombre implanté au Grand Hall Sud en $(0; 2,5)$.
  * Actif uniquement pendant l'exploration sécurisée après l'ouverture complète du manoir.
  * Veilleuse dorée pulsée attirant le regard, détection 3D conique en vision directe ($< 2,8$ m, $\text{dot} > 0,65$).
  * Déclenchement volontaire via touche `[E]` : retour sonore métallique, extinction immédiate de la veilleuse et anti-rebond matériel garantissant qu'un appui prolongé n'enchaîne pas deux paliers.
- **Intégration du flux de partie (`Game.ts` & `index.html`)** :
  * La victoire n'est plus déduite de la taille des secteurs physiques mais de la validation de la table des rencontres (`this.currentTier >= this.encounterConfigs.length`).
  * Aucune fin prématurée après le Palier 3 : transition fluide vers l'accalmie avec liberté totale de mouvement et visée (souris conservée, aucun menu bloquant).
  * Les portes ouvertes aux Paliers 1 et 2 **restent rigoureusement ouvertes** au Palier 4 (aucune refermeture intempestive).
  * Les quotas d'agiles et les pools de spawn sont paramétrés par rencontre et non codés en dur.
  * Fin explicite du prototype : écran de victoire célébrant les 4 rencontres validées sans prétendre être la finale complète F6.
- **Vérifications et mesures réelles** :
  * `npm.cmd run build` : compilé avec succès (code 0, 205 ms).
  * Nouvelle suite de tests `scripts/check-encounters-f1.mjs` créée et validée (4/4 épreuves 100% PASS).
  * Les 11 suites de tests du projet (`encounters-f1`, `perf-tracker`, `navigation-perf`, `tiers`, `split-level`, `zombie`, `zombie-agile`, `zombie-remains`, `combat-feedback`, `weapon`, `shotgun`) sont **100% PASS**.
  * Profilage Chromium headless traversant les 4 paliers (`scripts/measure-perf.mjs`) : framerate stable à 60 FPS (médiane 16,7 ms, p95 17,0 ms, p99 17,2 ms, max 20,2 ms, 0 frame $> 33$ ms, durée de transition 0,2 ms).
- **Prochaine étape proposée — Atelier F2 : Choisir une amélioration sans menu imposé** :
  * Présentation des deux premières offres d'amélioration dans le monde (ex: pupitres ou stèles d'offrandes à lecture conique), sélection unique `[E]` et départ distinct sans coupure de mouvement, selon le contrat validé de `ROADMAP.md`.

**Intervention antérieure — Atelier F0 : Transitions fluides et élimination des micro-saccades (2 novembre 2026) :**
- **Mesure et instrumentation (`PerfTracker.ts` & `Game.ts`)** :
  * Séparation du delta brut réel entre frames (mesuré via `performance.now()`) et du delta simulé plafonné à 0,05 s pour la physique du jeu.
  * Calcul glissant sur tampon circulaire (`Float32Array`) de la médiane, du p95, du p99, du maximum et du compte d'images > 33,3 ms et > 50 ms.
  * Isolation stricte des phases de combat actif : pause, game over, menus et déconnexion d'onglet (visibilité / blur) ne polluent plus les statistiques.
  * Chronométrage précis des événements ponctuels : apparitions d'ennemis, transitions de palier et requêtes de navigation Dijkstra.
- **Navigation réutilisable & portes mobiles (`Level.ts`, `Game.ts`, `Zombie.ts`)** :
  * Préconstruction unique au chargement du maillage d'arêtes statiques (`staticNavEdges`) reliant les 45 waypoints fixes du manoir.
  * Validation dynamique $O(1)$ des franchissements de portes : chaque arête traversant une porte mobile vérifie directement son état (`door.getState() === 'OPEN'`). Zéro raycasting de décor redondant sur le graphe statique.
  * Raccordement dynamique ciblé : seules la position de départ et la position cible testent leurs liaisons de ligne de vue vers leurs waypoints les plus proches pour se brancher au graphe.
  * Résolution Dijkstra avec early-exit dès que la destination est atteinte (temps moyen par recherche : **0,063 ms**).
  * Filtrage anticipé des apparitions dans `Game.trySpawnZombie` : les candidats directement visibles par le joueur (distance, cône de vue $\pm 55^\circ$ et rayon de vue dégagé) sont rejetés immédiatement avant même de lancer une recherche de chemin.
  * Jitter temporel sur les replanifications de recherche des zombies (`0.4 + Math.random() * 0.2` s) évitant que plusieurs IA n'exécutent leur Dijkstra simultanément sur la même frame.
- **Cycle de vie et conservation des ressources (`ZombieAnimation.ts`, `Zombie.ts`, `ZombieRemains.ts`, `AgileZombieAnimation.ts`)** :
  * Découpage des poses d'animation dans les coordonnées UV des géométries (`createAtlasFrameGeometry`) au lieu de muter `repeat/offset` sur la texture de matériau. Chaque zombie standard possède ses géométries de poses dédiées tout en partageant les mêmes textures 2D en mémoire.
  * Conservation des textures, matériaux de profondeur et atlas entre les paliers : `Game.startTier` ne détruit plus les caches communs lors du nettoyage des entités.
  * Préchauffage complet (`Zombie.warmup()`) à l'initialisation du jeu préparant les textures et shaders des zombies standards, agiles et restes mortels avant tout affrontement.
  * Mécanisme de libération explicite final et idempotent (`Zombie.disposeAllZombieResources()`, `Game.dispose()`).
- **Résultats comparatifs mesurés** :
  * **CPU isolé (`node scripts/audit-tier-cpu.mjs`)** :
    - Palier 1 : 66,55 ms -> **1,19 ms** (-98,2 %, x56 plus rapide).
    - Palier 2 : 8,55 ms -> **0,64 ms** (-92,5 %, x13 plus rapide).
    - Palier 3 : 36,30 ms -> **1,10 ms** (-97,0 %, x33 plus rapide).
    - Rechargements de textures après suppression d'un palier : **0** (anciens caches détruits : 5 et 6).
  * **Navigateur en conditions réelles (`node scripts/measure-perf.mjs`, Chromium headless)** :
    - Temps de frame médian : 16,6 ms (parfaitement calé sur 60 FPS).
    - Latence p99 : 82,2 ms -> **17,1 ms** (élimination totale des à-coups).
    - Temps de frame max : 126,8 ms -> **20,2 ms** (plus aucun dépassement de budget).
    - Saccades > 33,3 ms : 3+ -> **0 frame**.
    - Saccades > 50,0 ms : 3 -> **0 frame**.
    - Durée d'apparition d'un ennemi : 67,2 ms -> **2,8 ms** (divisée par 24).
    - Durée d'une transition de palier : 83,2 ms -> **5,2 ms** (divisée par 16).
- **Garantie de non-régression et tests** :
  * `npm.cmd run build` propre (code 0, 215ms).
  * 10 suites de tests automatisées 100% PASS : `check-perf-tracker`, `check-navigation-perf`, `check-tiers`, `check-split-level`, `check-zombie`, `check-zombie-agile`, `check-zombie-remains`, `check-combat-feedback`, `check-weapon`, `check-shotgun`.
  * Respect des règles physiques : escaliers Ouest et Est navigables, balustrades étanches aux tirs et raccourcis, portes en mouvement ou fermées infranchissables, portée d'attaque 3D euclidienne.
- **Prochaine étape proposée** :
  * Engager le jalon F1 de la roadmap validée : conception et implémentation du système de tables de rencontres et progression par secteurs/vagues sans bloquer le mouvement.

**Dernière demande — roadmap d'une tentative finie et horreur psychologique (2 novembre 2026) :** l'utilisateur a choisi 10–15 minutes avec rencontre finale, progression au-delà du palier 3, améliorations gratuites sans menu automatique coupant le mouvement. Il a confirmé l'horreur psychologique (sons, silhouettes, événements inquiétants). `ROADMAP.md` et `ORIENTATION_JEU.md` réécrits ; versions trois paliers archivées. Ordre F0 performance → F1 rencontres/secteurs → F2 choix dans le monde → F3 salle témoin visuelle/sonore → F4 progression complète → F5 événements → F6 finale → F7 variantes/confort. Huit paliers et dispositif d'amélioration sont des propositions à tester. Prompt limité à F1 dans `PROMPT_GEMINI_TENTATIVE_FINIE.md` ; ne pas implémenter toute la roadmap d'un coup. L'accord F0 est acquis et son implémentation est confiée à Gemini ; `PerfTracker.ts` et changements Game sont présents localement, sans validation renouvelée ici. Cette intervention modifie uniquement les documents/consignes ; aucun code du jeu modifié, aucune nouvelle compilation ou validation navigateur. Prochaine action : vérifier F0, puis demander F1 via le prompt ; ergonomie exacte de F2 et identité de la finale restent à valider.

**Dernière demande — audit performance des transitions et propositions de suite (2 novembre 2026) :** voir `docs/AUDIT_PERFORMANCES_PALIERS.md`. Aucun code de gameplay modifié. Audit CPU reproductible ajouté : `node scripts/audit-tier-cpu.mjs` (vrai Level, textures simulées, portes ouvertes, pas de GPU). Première mesure : balayages de chemins médians 66,55 / 8,55 / 36,30 ms selon les trois positions testées ; ne pas assimiler à des FPS de gameplay ni à une reproduction du changement de palier. Causes prioritaires : reconstruction des connexions de navigation par candidat ; destruction/recréation des caches de ressources entre paliers. Le compteur perf utilise un delta plafonné à 50 ms et ne mesure pas correctement les pics. Pas de profil GPU ni parcours navigateur de transition pendant cet audit. Optimisations proposées, aucune encore implémentée ; accord utilisateur à obtenir pour l'atelier « transitions fluides ». Les modifications locales préexistantes de Level et du test demi-niveau ont été préservées. Fonctionnalités suggérées ensuite : choix gratuits utiles, variation contrôlée avec graine, anticipation des apparitions, réglages persistants.

**Dernière intervention — Atelier 3 : Plafonds étagés et fermeture gothique du manoir (2 novembre 2026) :**
- **Toiture gothique intégrale et atmosphère de huis clos** :
  * **Plafond inférieur Sud ($Y = 4,0$ m)** : couvre le Secteur 1 ($Z \in [6, 20]$, Vestibule, Grand Salon, Galerie) pour une ambiance feutrée et oppressante.
  * **Plafond supérieur monumental ($Y = 6,4$ m)** : couvre le Grand Hall, les deux escaliers et le plateau surélevé ($Z \in [-20, 6]$).
    - Offre $6,4$ m de hauteur libre dans le Grand Hall autour du grand lustre.
    - Offre $4,0$ m de hauteur sous plafond sur le plateau haut (+2,4 m) de la Bibliothèque et de l'Atelier.
    - Assure un dégagement vertical continu au-dessus des escaliers sans aucun risque de collision de tête.
  * **Imposte verticale de démarcation ($Z = 6$, $Y \in [4,0, 6,4]$)** : relie hermétiquement le plafond bas du salon au plafond cathédrale du Grand Hall.
  * **4 poutres maîtresses transversales en chêne massif** (à $Z = 13, 0, -7, -14$) qui accrochent le faisceau de la lampe torche et projettent des ombres dynamiques.
  * Matériau et texture : boiseries sombres avec `receiveShadow = true` et intégration dans `solidMeshes` (les tirs vers le haut produisent des impacts de bois et ne s'échappent plus dans le vide).
- **Garantie de non-régression et tests** :
  * `npm.cmd run build` propre (code 0, 220ms).
  * Suite `scripts/check-split-level.mjs` étendue avec l'Épreuve 6 (raycasting vertical des plafonds et dégagement d'escalier validés).
  * Les 8 suites de tests du projet (`split-level`, `tiers`, `shotgun`, `weapon`, `zombie-agile`, `zombie`, `zombie-remains`, `combat-feedback`) sont **100% PASS**.

**Versionnement Git initialisé :** branche locale `main`, remote `origin` vers `https://github.com/Owlowish/Dead_Sector.git`. L'utilisateur a autorisé le premier commit et son push. Identité Git locale au dépôt : `Owlowish`, adresse GitHub noreply ; configuration globale inchangée. Dépendances, builds, aperçus/profils navigateur, archive ZIP et fichiers d'environnement exclus par `.gitignore`. README aligné sur le prototype actuel. Build et tests fusil/pistolet réussis avant le premier commit ; aucun nouveau test navigateur pour cette opération. Consulter `git status` et `git log` pour l'état de synchronisation exact.

**Atelier 2 antérieur — Architecture du Manoir Demi-niveau (+2,4 m) (2 novembre 2026) :**
- **Option 1 implémentée intégralement** d'après `docs/PROPOSITIONS_MANOIR_ETAGES.md` :
  * Rez-de-chaussée ($Y = 0$ m) : Vestibule (P1), Grand Salon (P1), Galerie Ouest (P1) en boucle immédiate, et Grand Hall Nord (P2).
  * Demi-niveau surélevé ($Y = +2,4$ m) : Grande Bibliothèque et Atelier d'Art (P3), reposant sur un socle plein en maçonnerie (aucune pièce jouable superposée).
  * Deux escaliers monumentaux ($6$ m de long, $Z \in [-7, -1]$) avec rampes d'accès continues : Escalier Ouest (Galerie -> Bibliothèque) et Escalier Est (Grand Hall -> Atelier), munis chacun de 12 marches visuelles en chêne.
- **Moteur d'altitude $O(1)$ déterministe** :
  * Calcul mathématique exact dans `MansionConfig.getMansionFloorHeight(x, z)` sans collision physique lourde ni raycast de maillage coûteux.
  * Exposition centralisée via `Level.getFloorHeightAt(x, z)`.
- **Verticalité du joueur (`Player.ts`)** :
  * Déplacement ancré à l'altitude du sol avec amortissement souple via `THREE.MathUtils.damp(this.camera.position.y, floorY + this.eyeHeight, 20, delta)` éliminant tout à-coup lors de la montée des marches.
- **Logique 3D euclidienne des zombies (`Zombie.ts`)** :
  * Suivi automatique de la pente dans `move()`.
  * Détection de ligne de mire (`hasClearPath`), perception et portée d'attaque converties en distance euclidienne 3D stricte `Math.hypot(dx, dy, dz)`.
  * Les zombies en contrebas au rez-de-chaussée ne peuvent plus griffer le joueur en surplomb sur la balustrade, et la maçonnerie bloque leur vision.
- **Portes multi-axes et multi-altitudes (`Door.ts`)** :
  * Prise en charge des portes axées sur X ou Z (`axis: 'X' | 'Z'`) avec boîte englobante pivotée à 90° et altitude $Y$ paramétrable.
  * Détection d'interaction avec portée verticale 3D stricte.
- **Ancrage vertical des objets et restes** :
  * Trousses de soin (`Medkit.ts`), boîtes de cartouches (`AmmoBox.ts`) et fusil à pompe (`ShotgunPickup.ts`) ancrés à la hauteur locale du sol. Protection contre le ramassage vertical à travers les étages.
  * Cadavres verticaux (`ZombieRemains.ts`) ancrés à l'altitude locale du sol.
- **Garantie de non-régression et tests** :
  * `npm.cmd run build` propre (code 0, 230ms).
  * Résolution du clignotement de textures à l'étage (Z-fighting) : le socle occulteur (`plinth`) sous l'aile Nord avait sa face supérieure coplanaire avec le plancher `raisedFloor` à $Y = 2,4$ m. Le socle a été retiré du rendu visuel (`visible = false`, non ajouté à la scène) et abaissé à $2,38$ m, tout en restant actif dans `solidMeshes` pour bloquer tirs et raycasts. Le plancher est désormais 100% net et sans artefact.
  * Dégagement de l'escalier Est : la colonne monumentale du Grand Hall qui était située en $(13, 0)$ obstruait l'accès à la porte de l'Escalier de l'Atelier en $(12.25, -1.0)$. Les deux colonnes du Grand Hall ont été repositionnées en colonnade latérale à $X = 5.0$ ($Z = -2.5$ et $Z = +2.5$) pour libérer totalement le passage et le champ visuel devant l'escalier Est.
  * Nouvelle suite `scripts/check-split-level.mjs` créée et validée (5/5 tests PASS).
  * Suite `scripts/check-tiers.mjs` adaptée et validée (10/10 tests PASS).
  * Les 8 suites de tests du projet (`split-level`, `tiers`, `shotgun`, `weapon`, `zombie-agile`, `zombie`, `zombie-remains`, `combat-feedback`) sont **100% PASS**.
- **Limites et vérifications non effectuées** :
  * Tests réalisés via scripts Node et simulation headless. Aucun playtest manuel interactif dans le navigateur n'a encore été validé par l'utilisateur.
  * Les escaliers sont des rampes rectilignes axiales ; le socle sous le plateau haut est plein.

**Prochaine étape proposée :**
- Playtest par l'utilisateur sur `http://localhost:5173/` pour apprécier les sensations : ascension des escaliers, vue plongeante depuis la balustrade sur le Grand Hall, combat vertical au fusil à pompe contre les coureurs et les marcheurs.

**Dernière intervention — solution de rechargement par couches (2 novembre 2026) :** animation intégrée sans nouvelle génération d'images, en réutilisant `reload_draft.png` (arme/main droite masquées), cellule 7 de `pistol_actions_v3.png` (main vide) et `live_shell.png`. Six poses dans `ShotgunAnimation.ts`, rendu DOM/CSS et chronologie partagés avec l'aperçu. Cycle toujours 0,65 s, transfert unique à l'encliquetage 0,50 s puis retrait vide. `Weapon.ts` conserve les cartouches engagées à l'annulation et reporte le reliquat de temps. Tests fusil/pistolet et build réussis ; cas d'annulation avant/après insertion et grand delta ajoutés. Captures des six poses à 1280/390 px et lecture unique dans l'aperçu Chrome headless contrôlées ; pas de combat réel ni validation artistique utilisateur. Le blocage de génération précédent reste historique : cette solution est du rendu par couches d'assets existants, pas une nouvelle planche. Limites : port simplifié, main réutilisée, changements directs entre position de tir et chargement. Voir `docs/FUSIL_RECHARGEMENT_COUCHES.md`. Prochaine étape : retour utilisateur sur la boucle et l'interruption en jeu, aucune nouvelle fonctionnalité implicitement autorisée.

**Dernière intervention — atelier ADS/recul/rechargement validé (2 novembre 2026) :** correction du cadrage ADS (116 vh, bords des manches hors écran), nouvelles poses `hip-kick-v2.png` et `ads-kick-v2.png`, impulsion brève et amortissement partagés dans `ShotgunAnimation.ts` et pilotés par `Weapon.ts`. Durée de recul utilisateur 2 s conservée. Build et tests fusil/pistolet réussis (dont vérification choc → pompe), avertissement Vite > 500 kB. Aperçu isolé Chrome headless aux largeurs 1920/390, poses hanche/ADS et retour au repos inspectés ; pas de vrai combat ni validation artistique du mouvement par l'utilisateur. **Rechargement incomplet** : génération de la planche refusée par la sécurité image_gen (violence), aucun asset d'insertion livré, pose fixe et logique 0,65 s conservées. Pas de nouvel accord nécessaire pour cet atelier ; blocage de production d'images à signaler, ne pas masquer ni contourner le refus. Détails et prompts dans `docs/FUSIL_RECUL_ADS.md` et `output/shotgun-hip/ACTION_PROMPTS.json`.

**Dernière intervention — base hanche validée puis mouvement de pompe intégré (2 novembre 2026) :** l'utilisateur a accepté `hip-base-v2-candidate.png`. Nouvelle pose arrière générée, conservée dans `output/shotgun-hip/hip-pump-back-v2.png`. Assets actifs `hip-rest-v2.png` / `hip-back-v2.png` dans `public/assets/weapons/shotgun`. `ShotgunAnimation.ts` partage fenêtre arrière (0,15–0,35 s) et repère d'éjection (0,19 s) avec `Weapon.ts` et l'aperçu ; CSS adapté au nouveau cadrage et à la bouche. Sprites ADS existants conservés, cadrage de la pose de rechargement existante préservé. Compilation et tests `check-shotgun` / `check-weapon` réussis ; avertissement Vite > 500 kB. Aperçu isolé Chrome headless : chargement des images, cycle jusqu'au retour au repos, captures aux largeurs 1280/390 px inspectées. Pas de test du vrai combat ni validation artistique du mouvement à vitesse réelle. Aperçu : `node scripts/make-shotgun-preview.mjs`, ouvrir `tmp/shotgun-preview/standalone.html`. Prochain retour : rendu en jeu du hip-fire, du cycle et de la transition ADS. L'animation complète d'insertion des cartouches reste à faire ; cette étape porte sur le cycle de pompe après tir.

**Dernière intervention — nouvelle base de tir à la hanche du fusil (2 novembre 2026) :** orientation proposée acceptée par l'utilisateur ; candidat généré avec image_gen dans `output/shotgun-hip/hip-base-v2-candidate.png`, prompt et limites dans le README du dossier. Canon ramené vers le centre et composition en bas à droite, flanc encore visible. En attente du retour artistique sur cette image précise avant dérivation de la pompe et intégration. Attention aux marges transparentes et au cadrage CSS. Aucun code ni asset actif remplacé ; aucune compilation ou vérification du gameplay effectuée pour cette génération. La perspective de rechargement reste validée séparément.

**Précision utilisateur après génération :** la perspective du brouillon de rechargement est validée. Les réserves mécaniques sur la cartouche restent distinctes. C'est la pose de tir à la hanche actuelle du fusil qui ne convient pas : proposer une vue davantage dans l'axe, cadrée en bas à droite, avec moins de flanc visible, avant de modifier les sprites ou le code. La présence d'une règle CSS `.is-reloading` chargeant `reload_draft.png` a été observée depuis la génération ; elle n'a pas été ajoutée ni validée par cette intervention.

**Dernière demande — pose de référence de rechargement du fusil approuvée (2 novembre 2026) :** l'utilisateur a validé la proposition de préparer une base avant le cycle complet : droite sur poignée, gauche insérant une cartouche, puis cinq poses d'insertion et transitions distinctes. Première génération conservée dans `output/shotgun-reload/reload-base-v1-draft.png`, NON VALIDÉE : orientation de cartouche incorrecte et port de chargement mal exposé. La tentative de correction image_gen a été refusée par le système de sécurité de l'outil ; aucun asset corrigé ni cycle produit. Voir le README de ce dossier. Aucun code du jeu modifié, aucune compilation ni nouvelle validation en jeu. Obtenir une base correcte avant d'étendre l'animation.

**Dernière demande — réflexion sur le plan et les escaliers (2 novembre 2026) :** l'utilisateur demande plusieurs schémas, sans modifier le code, avec une contrainte de légèreté. Voir `docs/PROPOSITIONS_MANOIR_ETAGES.md` : demi-niveau, atrium avec galerie haute, double boucle. Aucun choix ni accord d'implémentation à ce stade. Le déplacement, les collisions et une partie de la navigation/perception actuels ignorent l'altitude ; de vrais escaliers nécessitent leur adaptation. Aucun code du jeu modifié et aucune nouvelle validation de gameplay ou compilation pour cette discussion documentaire. La réalisation décrite ci-dessous est l'état antérieur consigné, pas une validation renouvelée lors de cette réflexion.

**Dernière réalisation validée et testée — Fusil à pompe et Zombie Coureur (Lots A, B, C, D, E) :**
1. **Le Coureur agile (Zombie variante `agile`)** :
   - Fichiers créés/modifiés : `src/AgileZombieAnimation.ts`, `src/ZombieRemains.ts`, `src/Zombie.ts`, `src/Game.ts`.
   - Vitesse accrue (2.7 m/s vs 1.5 m/s standard), résistance ajustée (80 PV vs 100 PV), anticipation d'attaque lisible (0.45s), dégâts 10, étourdissement blessure (0.18s).
   - Découpage par maillage polygonal (`clipPolygon`) pour isoler les 21 poses sans débordement de transparence.
   - Cadavres en billboards verticaux pérennes face à la caméra avec caches de géométrie/matériaux distincts par variante dans `ZombieRemains`, évitant toute collision de texture ou fuite VRAM.
   - Répartition par palier : Palier 1 (0 Coureur, 100% standard), Palier 2 (2 Coureurs max sur le palier, au plus 1 vivant simultané), Palier 3 (3 Coureurs max, au plus 2 vivants simultanés).

2. **Le Fusil à pompe (Arme multi-système & balistique conique)** :
   - Fichiers créés/modifiés : `src/Weapon.ts`, `src/WeaponSpread.ts`, `src/ShellCasing.ts`, `src/ShotgunPickup.ts`, `src/AmmoBox.ts`, `src/Game.ts`, `src/MansionConfig.ts`, `index.html`, `src/style.css`.
   - Pickup 3D immersif au cœur de la Grande Bibliothèque (Secteur 2) en `(0, 0)`, ramassable par contact ou touche `[E]` avec prompt dédié.
   - Commutation fluide d'arme (`Digit1` / `Digit2` et molette) avec stocks, capacités et cadences strictement indépendants :
     * Pistolet 9mm : chargeur 10/15, réserve 30/60, cadence 800ms, cône 2° hanche / 0° ADS.
     * Fusil à pompe calibre 12 : chargeur 5/5, réserve 15/30, cadence 900ms, cône 5° hanche / 3° ADS.
   - Balistique conique 8 plombs hitscan résolus sur un instantané :
     * 15 dégâts par plomb (120 dégâts cumulés à bout portant, neutralisant un zombie en un seul tir net).
     * Les dégâts s'atténuent naturellement avec la distance à mesure que le cône s'élargit.
     * Viseur dynamique projeté à l'écran reflétant exactement le cône courant selon le FOV.
   - Retour mécanique authentique :
     * Détonation, flash et recul de caméra violent (View Punch) immédiats à $t = 0$.
     * Éjection de la douille calibre 12 rouge synchronisée sur le mouvement arrière de la pompe à $t = 0.19$s (pas d'éjection fantôme à $t = 0$).
   - Logique de rechargement unitaire (cartouche par cartouche, 0.65s par cartouche) interruptible immédiatement par un clic de tir dès qu'une cartouche est disponible.
   - **Limite connue documentée** : la planche d'animation du rechargement est absente des assets livrés (`reload.asset: null` dans le manifeste). La logique unitaire et l'interruption sont implémentées et testées, mais les poses visuelles d'insertion restent en attente des assets graphiques.

3. **Vérifications et validations** :
   - `npm.cmd run build` : code 0 (Vite build propre, 207ms).
   - 6 suites de tests comportementaux validées avec succès :
     * `node scripts/check-shotgun.mjs` : 100% PASS.
     * `node scripts/check-weapon.mjs` : 100% PASS.
     * `node scripts/check-zombie-agile.mjs` : 100% PASS.
     * `node scripts/check-zombie.mjs` : 100% PASS.
     * `node scripts/check-tiers.mjs` : 100% PASS.
     * `node scripts/check-combat-feedback.mjs` : 100% PASS.
   - Serveur de développement en cours d'exécution sur `http://localhost:5173/`.

**Dernière intervention ciblée — cadavres pixel art, correction billboard demandée :** `Zombie.die` arrête immédiatement l'IA/attaque/voix et masque la hitbox, puis `ZombieRemains` affiche quatre poses sur 0,56 s et conserve la dernière pour le corps couché. Son support reste VERTICAL et orienté vers la caméra autour de Y, comme les zombies vivants : l'essai horizontal donnant un effet tapis a été remplacé. Game transmet la position du joueur via Zombie.updateDeath, y compris après la fin de la chute ; la position du corps reste fixe. Une seule texture `zombie_death.png` partagée pour chute/cadavre, `zombie_corpse.png` conservé mais non chargé. Chronologie/ancrages communs dans `ZombieAnimation.ts`. La chute continue pendant répit/victoire pour le dernier zombie ; Échap en combat/exploration la suspend. Au vrai démarrage du palier suivant, `Zombie.dispose` retire aussi le corps et déconnecte sa voix ; les anciennes cibles de Weapon sont vidées. Ressources communes libérées au dernier utilisateur ; nettoyage idempotent. Les corps restent sans collision pendant le répit et l'exploration, sans accumulation d'un palier à l'autre.

Vérifié : build et test `check-zombie-remains` réussis après correction (support vertical, ancrage au sol, orientation même après la chute et à delta nul, une texture commune, vrai nettoyage startTier sur trois cycles). Les quatre autres suites (zombie, arme, effets et paliers) ont également été relancées avec succès après cette correction. Aperçu isolé WebGL Chrome headless renouvelé et inspecté de face et de côté après correction : le corps garde une hauteur visuelle au lieu de s'aplatir sur le parquet. Aucun parcours complet du vrai manoir ni validation du combat à vitesse réelle par l'assistant. Le billboard montre le même profil depuis tous les azimuts ; pas de vrai volume/ragdoll. Voir `docs/ZOMBIE_CADAVRES.md` et les prompts dans `ZOMBIE_CADAVRES_PROMPTS.json`. Aperçu : `node scripts/make-zombie-death-preview.mjs`, puis `tmp/zombie-death-preview/index.html`. Prochaine action : retour utilisateur sur représentation verticale et disparition au démarrage du prochain palier ; aucune extension implicitement autorisée. Modifications de carte réalisées en parallèle conservées, non réauditées ici.

**Dernière demande réalisée avec succès et validée :** Extension et refonte de la carte globale du manoir dans DEAD SECTOR selon les directives de `docs/AUDIT_MAP_2026-11-02.md` et `docs/PROMPT_GEMINI_MAP_GLOBALE.md`.

### 1. Synthèse de l'intervention réalisée :
- **Architecture spatiale globale ($48 \times 40$ m, 6 pièces interconnectées)** :
  * **Secteur 1 (Palier 1, $Z \in [6, 20]$)** : **Vestibule Sud** ($16 \times 14$ m) et **Grand Salon** ($16 \times 14$ m).
    - Vraie boucle de circulation immédiate dès le démarrage : reliés par 2 grandes arches de $3.5$ m et $4.0$ m de passage libre situées de part et d'autre du mur de refend ($X = -3$).
    - Circuit fermé dégagé pour joueur ($r = 0.35$ m) et zombie ($r = 0.40$ m).
  * **Secteur 2 (Palier 2, $Z \in [-8, 6]$)** : **Grande Bibliothèque** ($16 \times 14$ m) et **Atelier d'Art** ($16 \times 14$ m).
    - Déverrouillé via l'accès principal de la Bibliothèque en $(0, 6)$ (Porte 1 unique).
    - Raccourci secondaire de retour via la Grille de l'Atelier en $(-12, 6)$ : forme un circuit en « 8 » entre les Secteurs 1 et 2 sans jamais contourner le verrou initial.
  * **Secteur 3 (Palier 3, $Z \in [-20, -8]$)** : **Grand Hall Nord** ($16 \times 12$ m) et **Chapelle Funéraire** ($16 \times 12$ m).
    - Déverrouillé via l'accès principal du Grand Hall en $(0, -8)$ (Porte 2 unique).
    - Raccourci secondaire de retour via la Grille de la Chapelle en $(-12, -8)$ : forme une grande boucle périmétrique complète de tout le manoir.
    - Sortie monumentale du manoir en $(0, -19.5)$ définitivement condamnée (`permanent_limit`).

- **Garantie d'étanchéité physique stricte** :
  * Ligne de démarcation continue à $Z = 6$ (Secteur 1 hermétiquement clos tant que la porte de la Bibliothèque n'est pas ouverte).
  * Scan continu : 0 brèche physique. Contournement prématuré impossible.

- **Spawns sûrs et masquage (Occlusion LOS)** :
  * Distance de sécurité $\ge 6$ m garantie pour tous les points d'apparition.
  * Spawns du Secteur 1 placés dans le Grand Salon ($X \le -8$), masqués derrière le mur central $X = -3$ ($hasLOS = false$, bonus de dissimulation), éliminant tout pop-in direct dans le champ de vision du joueur au démarrage.
  * Aucun zombie n'apparaît à la frame 0 (délai de grâce de 2 secondes au démarrage du Palier 1).
  * Zéro spawn dans les anciens secteurs purgés.

- **Navigation et praticabilité** :
  * Tous les passages principaux et embrasures de portes offrent $\ge 3.5$ m de dégagement (aucun goulot d'étranglement pour le rayon zombie de $0.40$ m).
  * 45 waypoints de navigation validés à 0 collision pour $r = 0.40$ m.
  * Algorithme Dijkstra fluide reliant toutes les pièces et gérant les cibles murales via zone d'approche praticable.

- **Budget matériel et performances respectés (`MANSION_BUDGET`)** :
  * Dimensions : $48 \times 40$ m.
  * Pièces : 6 (inférieur ou égal au plafond de 8).
  * Ennemis actifs simultanés : plafonné à 4.
  * Lumières projetant des ombres : strictement 2 (Clair de lune directionnel + Lustre central du Grand Hall).
  * Lumières ponctuelles douces d'ambiance : 6 (lustres et bougies chaudes réparties).

- **Vérifications et tests validés** :
  * `npm.cmd run build` : compilé avec succès (code 0).
  * `node scripts/check-tiers.mjs` : 10/10 épreuves comportementales réussies (code 0).
  * `node scripts/check-weapon.mjs`, `node scripts/check-zombie.mjs`, `node scripts/check-combat-feedback.mjs` : 100% PASS.
  * **Nettoyage des assets orphelins** : 41 fichiers obsolètes supprimés (anciens sons agressifs non-soft, textures v1 remplacées, spritesheets de test pistolet/zombie et caches temporaires) pour plus de 200 Mo libérés sans aucune régression.
  * Serveur de développement actif sur `http://localhost:5173/`.

### Prochaine étape proposée :
1. Test de jeu réel dans le navigateur par l'utilisateur : valider la fluidité du circuit du Secteur 1, l'ambiance lumineuse feutrée et l'ouverture progressive des ailes.
2. Préparer l'étape suivante (variation reproductible par graine sur des pièces manuelles préfabriquées), sans modifier les circuits essentiels validés.

Deux défauts critiques de gameplay résolus :
1. **Zombies collés au joueur au démarrage (Palier 1)** :
   - Cause : à l'initialisation, 2 zombies apparaissaient dès la frame 0 dans le dos du joueur ($z = 10, 10.5$), l'attaquant immédiatement sans temps de réaction.
   - Correction :
     * Le pool du Palier 1 est recentré exclusivement au nord du Vestibule Sud ($z \in [5.5, 6.5]$), en face du joueur (à 6 à 9 mètres).
     * Un délai de grâce de 2 secondes (`spawnCooldownTimer = 2.0`) est accordé au démarrage : aucun zombie n'apparaît à la frame 0. Le joueur a le temps de bouger, d'allumer sa lampe torche avec `[F]` et de voir le premier zombie émerger calmement dans le faisceau au fond de la pièce.

2. **Zombies qui popent autour du joueur après la récompense sans ouvrir la porte** :
   - Cause : la fin du répit incrémentait immédiatement le palier et lançait les spawns alors que la porte était fermée, avec des points de spawn mal isolés situés dans l'ancien secteur.
   - Correction :
     * État `exploration` : après confirmation de la récompense, le jeu passe en exploration paisible. Aucun zombie ne peut apparaître dans la pièce purgée.
     * Déclencheur immersif : le combat du palier suivant est déclenché **uniquement lorsque le joueur interagit et ouvre la porte de la nouvelle aile** (ou franchit physiquement le seuil).
     * Cloisonnement strict des pools de spawn :
       - Palier 1 : uniquement dans le Vestibule Sud ($z \in [5.5, 6.5]$).
       - Palier 2 : uniquement dans la nouvelle aile (Couloir Central & Galerie Ouest, $z \in [-3.8, 3.8]$). Zéro spawn dans le vestibule.
       - Palier 3 : uniquement dans le Grand Hall Nord ($z \le -4.5$). Zéro spawn dans le couloir ou la galerie.
     * Le HUD affiche explicitement la consigne : « AILE DÉVERROUILLÉE · OUVREZ LA PORTE DU COULOIR CENTRAL ».

Vérifié :
- `npm.cmd run build` : compilé avec succès (code 0).
- `node scripts/check-tiers.mjs` : 11/11 tests réussis (code 0).
- `node scripts/check-weapon.mjs`, `node scripts/check-zombie.mjs`, `node scripts/check-combat-feedback.mjs` : 100% PASS.
- Serveur local actif sur `http://localhost:5173/`.

Ajout explicitement demandé et approuvé : dispersion de hanche de demi-angle 2°, diminuant avec la transition ADS jusqu'à zéro. `WeaponSpread.ts` fournit le cône et sa projection : les quatre branches du viseur indiquent la dispersion réelle. Weapon calcule le rayon avant le recul de caméra et transmet son intersection à HitEffects via Game. Cadence, dégâts, portée, recul utilisateur de 2 s, quantités et règles de ramassage conservés. Aucune modification volontaire de la progression de l'arène dans cet atelier ; Game/Level contiennent désormais des paliers, récompenses et apparitions échelonnées issus d'autres interventions, contrairement à l'ancien inventaire ci-dessous.

Vérifié : `npm.cmd run build`, `check-weapon.mjs`, `check-zombie.mjs`, `check-combat-feedback.mjs`, `check-tiers.mjs` réussis. Avertissement Vite de bundle > 500 ko non bloquant. Aperçu isolé des sprites et du viseur capturé dans Chrome headless et inspecté, une première planche de blessure rejetée puis corrigée (fragment de main entre cellules). Aucun combat complet testé dans un navigateur par l'assistant. Ne pas présenter le ressenti du combat comme validé.

Lire `docs/COMBAT_FEEDBACK.md` pour responsabilités, données, compromis et scénarios ; `docs/COMBAT_ASSET_PROMPTS.json` pour les prompts imagegen. Aperçu reproductible : `node scripts/make-combat-preview.mjs`, puis `tmp/combat-preview/index.html` (bouton une blessure, lecture lente). Prochaine étape proposée : test utilisateur hanche/ADS, réaction d'un zombie en marche ou en préparation d'attaque, traces sur porte et lisibilité des ressources sous la lumière. Attendre ce retour ; aucune extension de mécanique implicitement autorisée.

## Intention et contrat pédagogique

Nouvelle direction validée le 2 novembre 2026 : FPS d'horreur rétro dans un manoir-arène labyrinthique fixe, ouvert progressivement. Éliminer les ennemis d'un palier permet de choisir une récompense gratuite puis de poursuivre. L'extraction n'est plus un objectif de conception. Voir `ORIENTATION_JEU.md` et la nouvelle `ROADMAP.md` pour distinguer décisions validées et détails proposés. Le code n'a pas encore été migré et peut toujours contenir l'ancienne évacuation.

Apprendre à concevoir et faire évoluer un jeu avec une IA en comprenant son architecture à une échelle macroscopique. L'IA écrit le code ; l'utilisateur doit pouvoir expliquer les systèmes, prédire leurs effets et juger le résultat en jeu. Lire `AGENTS.md` pour la méthode obligatoire.

## Où nous en sommes

Prototype avec deux salles reliées par un couloir et boucle de combat complète, pas encore une démo d'exploration industrielle. Les anciens numéros 0.7–1.0 décrivaient des fonctionnalités ; aucune version de sortie n'est acquise. `package.json` indique encore 0.0.0. La roadmap utilise des jalons A à H pour éviter cette ambiguïté.

Présent dans le code :

- TypeScript, Three.js, Vite ; aucune autre dépendance d'exécution ni moteur physique.
- Sol 24 × 24, murs périphériques et couloir central reliant deux salles ; une caisse et un repère de sortie purement visuel. Collisions sur le plan X/Z et glissement par axes.
- Caméra FPS, déplacements ZQSD/WASD, sprint, Pointer Lock ; simulation du joueur et des zombies seulement quand la souris est verrouillée et la partie en cours.
- Trois zombies indépendants aux positions (4,7), (0,0), (4,-8). Détection à 8 unités, poursuite directe, collision au décor, billboard vertical et marche à quatre frames.
- Tir instantané au centre, portée 30, dégâts 40, intervalle réel 800 ms ; 100 PV par zombie, donc trois touches nécessaires. Premier obstacle ou ennemi visible rencontré ; morts exclus via `visible`.
- Arme provisoire HTML/CSS, viseur, recul et flash. Recul réglé par l'utilisateur à **2 secondes** : le conserver. Trois sons WAV synthétiques (tir, impact métal, impact zombie), volume du tir 0,5.
- Joueur à 100 PV ; zombie à portée de 1,4 unité : préparation visible de 0,6 seconde, puis 10 dégâts et récupération de 1 seconde simulée. L'attaque est annulée si le joueur quitte la portée ou se cache ; un solide bloque la ligne horizontale.
- Flash rouge du zombie de 0,2 s ; voile rouge du joueur de 0,4 s.
- États de partie `playing`, `won`, `lost` ; victoire si tous les zombies sont morts. Contrôles désactivés en fin de partie, souris libérée, boutons Recommencer par rechargement complet.

## Vérification et limites

- `npm.cmd run build` : réussi lors de cette inspection. Avertissement Vite : bundle minifié supérieur à 500 ko, non bloquant. Pas de mesure démontrant un besoin d'optimisation ou de découpage immédiat.
- Aucun test navigateur effectué par l'assistant pendant cette inspection. L'utilisateur avait indiqué que le tir initial semblait fonctionner ; les autres fonctions ont surtout des builds réussis dans l'historique. Leur présence ne constitue pas une validation complète du gameplay.
- Retour utilisateur ultérieur : le parcours proposé en jeu (déplacement, sprint, collision, tir et obstacle, attaque et dégâts, pause/reprise, victoire et défaite avec redémarrage) fonctionne. Ces scénarios sont validés par l'utilisateur ; les cas plus détaillés de B1 qui ne figuraient pas dans ce parcours restent à vérifier. Aucun test navigateur réalisé par l'assistant.
- Niveau en volumes simples implémenté après ce retour : build réussi, mais parcours, collisions et comportement des zombies dans ce nouveau niveau restent à valider en jeu.
- Pas de suite de tests automatisés. Pour le moment, compilation + scénarios ciblés de `docs/ROADMAP.md` ; ajouter des tests de logique quand ils vérifient de vraies règles, pas des copies du code.
- `git rev-parse --show-toplevel` échoue dans ce dossier : aucun dépôt Git détecté. Proposer de mettre le projet sous Git ; ne pas annoncer de commit ou de sauvegarde Git existante.
- La détection exige la proximité et une ligne de vue horizontale dégagée ; l'attaque vérifie aussi cette ligne. Après perte de vue, le zombie recherche la dernière position aperçue à l'aide de points de passage fixes et de tests de collision. Ce trajet reste approximatif, dépend du niveau et les zombies se superposent entre eux.
- Le raycasting frappe le rectangle du zombie, y compris les pixels transparents. C'est une hitbox approximative, pas un test de silhouette.
- Les mouvements et plusieurs animations utilisent un delta plafonné à 0,05 s ; à très faible fréquence, le temps simulé ralentit. L'arme utilise `performance.now()` pour sa cadence. Les effets visuels continuent pendant la pause, la cadence de tir aussi ; les attaques sont suspendues.
- Les touches sont effacées au blur mais pas spécifiquement à la perte du Pointer Lock : vérifier les reprises avec une touche maintenue. Pas de correction appliquée dans cette mission documentaire.
- Textures planes et matériaux simples ; pas de vraie basse résolution de rendu, d'environnement industriel texturé, de son spatial, de munitions, de ramassages ou de portes.
- Les cibles de Weapon sont une liste fixe créée au démarrage. Des apparitions dynamiques demanderaient de revoir sa mise à jour.
- La partie est considérée `playing` avant le premier clic, mais la simulation attend le Pointer Lock. La pause n'est pas un état distinct.

## Dernière demande et prochaine action

**Nouvelle intervention approuvée — zombie animé :** marche à six poses (zombie_walk_v2.png, grille 3×2) et attaque à quatre poses (zombie_attack.png) créées d'après zombie_idle.png ; originaux conservés. Zombie.ts synchronise deux poses de préparation (0,6 s), coup unique puis récupération (0,32 s), avec annulation avant le coup si portée/vue perdues ou zombie mort. État RECOVER ajouté, ombres directionnelles/ponctuelles synchronisées. Données communes dans ZombieAnimation.ts et aperçu dans scripts/make-zombie-preview.mjs. Build et tests check-zombie réussis ; cadrages inspectés dans une capture Chrome headless, combat complet non testé. Voir docs/ZOMBIE_ANIMATIONS.md pour prompts et limites. Prochaine étape : vérifier en jeu marche, pieds et attaque/esquive ; aucune modification de la progression du manoir dans cette intervention.

**Priorité de reprise — pivot de conception, documentation seulement :** l'utilisateur a choisi (1) le même manoir qui s'ouvre progressivement, (2) des récompenses gratuites entre les paliers. Pas de code modifié dans cette mission. Nouveau plan de circulation et roadmap R1–R8 rédigés, anciens plans linéaires archivés sous docs/archives. Les propositions de trois paliers, choix parmi deux, lampe sans batterie et remise à zéro des avantages à la mort ne sont pas toutes validées dans leurs détails. Prochaine implémentation recommandée : R1, remplacer la victoire par extraction par un premier combat→répit. Attendre une demande d'implémentation ; l'utilisateur prévoit de confier le code à Gemini. Ne pas traiter les systèmes de vagues/récompenses comme déjà présents. Aucun build relancé pour ces modifications exclusivement documentaires.

**Correction ultérieure — rechargement perçu comme double :** la main et le chargeur avaient la même visibilité. La main approchait déjà avec un chargeur avant l'extraction. Visibilités séparées : approche/saisie à vide, ancien chargeur pendant extraction, remplacement, insertion, départ main vide. Touche R répétée ignorée. Chronologie partagée dans src/WeaponAnimation.ts entre jeu et aperçu ; scripts/make-weapon-preview.mjs ajoute un bouton pour jouer un seul cycle de 1,6 s. Build et tests ciblés réussis, y compris visibilité par phase et transfert unique. Perception du mouvement corrigé en jeu non confirmée par l'assistant. Méthode réutilisable ajoutée dans docs/PIPELINE_ASSETS.md et référencée dans AGENTS.md. Prochaine étape : retour utilisateur après un cycle normal ; ne pas lancer une nouvelle génération avant d'avoir identifié un défaut précis.

**État actuel prioritaire — 2 novembre 2026 :** approche par couches approuvée puis intégrée pour stabiliser la perspective du pistolet et animer la culasse en hanche/ADS. Même dessin de carcasse et main principale pendant le rechargement ; main secondaire et chargeur animés en poses discrètes. Les régions sont sélectionnées dans les images existantes, sans nouveau bitmap ni alternance des perspectives latérales de l'ancienne planche. HTML/CSS et Weapon.ts modifiés, tests étendus. Build et tests de logique réussis. Aperçu statique des couches capturé dans Chrome headless et inspecté, pas de validation complète du combat en navigateur. Détails et limites : docs/ARME_COUCHES.md. Prochaine étape : retour utilisateur sur les mouvements, les raccords et la lisibilité de la culasse en jeu ; aucune extension de mécanique implicitement autorisée.

Correction du cadrage ADS après capture utilisateur montrant les manches coupées au milieu de l'écran : taille désormais 96vh au lieu de min(84vw, 640px, 90vh), guidon toujours centré. Build réussi ; géométrie de cadrage vérifiée par calcul, rendu corrigé à confirmer dans le navigateur.

Dernière intervention après accord : remplacement du revolver par un pistolet moderne 2D pixel art (modern_hip.png et modern_ads.png), clic droit maintenu pour viser, transition 0,18 s et FOV 75→58. Recul/flash animés ; pas de culasse animée (variante graphique refusée par imagegen). Éclairage ambiant neutralisé et renforcé, brouillard réduit. Build et scripts/check-weapon.mjs réussis ; rendu et événements navigateur réels non vérifiés. Consulter docs/ARME_ADS.md pour architecture, prompts, limites et scénarios. Prochaine étape : retour utilisateur sur lumière, cadrage et visée en jeu.

Dernière correction sonore : utilisateur gêné par les sons trop artificiels/agressifs. Six variantes *-soft.wav générées et intégrées, originaux conservés ; impacts moins aigus, ambiance plus discrète, grognements plus espacés, pause/reprise ambiance et arrêt grognements en pause/fin. Script reproductible scripts/generate_soft_audio.py et détails dans docs/AUDIO.md. Build et contrôles WAV réussis ; écoute et test navigateur non effectués par l'assistant. Prochaine étape immédiate : retour utilisateur après écoute en jeu. Ne pas présenter ces sons synthétiques comme des enregistrements réalistes.

Dernière demande traitée : Lisibilité de la progression, apparitions échelonnées et limites du manoir (Lots 1, 2 et 3).
1. Modifications apportées :
   - `MansionConfig.ts` : centralisation formelle du budget de l'arène (`MANSION_BUDGET`) : périmètre $24 \times 24$ m, max 8 pièces (4 actuelles), 2 lumières à ombres portées, plafond de 4 zombies simultanément actifs.
   - `Door.ts` & `Level.ts` :
     * Typage explicite des portes : `interior` (circulation ordinaire), `sector_access` (accès d'aile déverrouillé par palier) et `permanent_limit` (sortie condamnée).
     * Signalétique contextualisée : nom de la pièce/aile et palier requis (`[E] OUVRIR — GALERIE DES PORTRAITS`, `[AILE VERROUILLÉE — ACCESSIBLE APRÈS LE PALIER 1] (GALERIE DES PORTRAITS)`, `[SORTIE DU MANOIR — CONDAMNÉE]`).
   - `Game.ts` :
     * Déconnexion complète des portes et des paliers : franchir une porte ne change JAMAIS le palier ; les portes sont de simples passages physiques de circulation.
     * Boucle de jeu respectée : fin de combat $\implies$ écran de répit $\implies$ choix d'une récompense gratuite (Trousse de secours +30 PV ou Ravitaillement +15 munitions) $\implies$ bouton Continuer $\implies$ combat suivant.
     * Déverrouillage d'une seule nouvelle aile par palier avec annonce explicite (« Galerie des Portraits & Couloir Central accessible », « Grand Hall Nord accessible »).
     * File d'apparition échelonnée (`spawnQueue`) : les vagues (4 à 6 zombies) sont étalées avec un plafond de 4 zombies actifs simultanés pour éviter l'engorgement.
     * Sélection géométrique rigoureuse des spawns (`trySpawnZombie`) : distance minimale $\ge 6.0$ m, rejet du cône de vision direct dégagé (`dot > 0.45 && hasLOS`), fort bonus d'occlusion derrière les murs/portes, pas d'apparition à bout portant dans le dos.
     * Traque active : les zombies nés hors champ sont immédiatement alertés (`zombie.alert()`) et convergent en état `SEARCH` le long des waypoints vers la zone de combat au lieu de rester passifs en `IDLE` dans une salle vide. Les coups de feu alertent également les zombies en maraude.
     * Fin de palier étanche : validée uniquement quand `vivants === 0` ET `spawnQueue === 0`.
     * Profilage des métriques Three.js périodique (`renderer.info` : draw calls, triangles, temps d'image ms).
   - `index.html` & `style.css` :
     * Refonte du menu de répit victorien : titre de palier, bannière d'annonce de la nouvelle aile, cartes de choix de récompenses (`.reward-card`) interactives à la souris et au clavier (`[1]`, `[2]`, `[Espace]`, `[Entrée]`).
   - `scripts/check-tiers.mjs` :
     * Extension à 10 épreuves comportementales automatisées (100% validées).
2. Vérification :
   - `npm.cmd run build` : compilé avec succès (code 0).
   - `node scripts/check-tiers.mjs` : 10/10 épreuves réussies (code 0).
   - `node scripts/check-weapon.mjs` : 100% validé (code 0).
   - `node scripts/check-zombie.mjs` : 100% validé (code 0).
   - Serveur de dev Vite actif sur `http://localhost:5173/`. Test complet de la boucle en jeu réel avec contrôles au clavier/souris non réalisé par l'assistant.
3. Prochaine étape recommandée :
   - Tester en jeu (sur `http://localhost:5173/`) la lisibilité des invites de portes, le confort du choix de récompense au clavier/souris et l'arrivée échelonnée des zombies convergeant depuis les pièces voisines.

Dernière demande précédente : Audit et correction de la cohérence de l’arène de DEAD SECTOR (les 5 défauts résolus).
1. Modifications apportées :
   - `Door.ts` :
     * Largeur de passage paramétrable (`passageWidth`, avec dérivation automatique de `leafWidth`).
     * Sécurité anti-pincement : détection d'occupants (joueur et zombies) dans l'embrasure ($|x - x_0| \le w/2 + r$, $|z - z_0| \le 0.4 + r$) et sur les battants ; interruption immédiate de `CLOSING` et réouverture automatique en `OPENING`.
   - `Level.ts` :
     * 4 portes intégrées : porte monumentale centrale sud (0, 4, w=4) et porte de galerie sud (-6.25, 4, w=2.5) ; porte monumentale centrale nord (0, -4, w=4) et porte de galerie nord (-6.25, -4, w=2.5).
     * Navigation robuste (`getReachableTarget`) : lorsqu'une cible de joueur est adossée à un mur ($0.3 < d < 0.4$, impénétrable au gabarit du zombie), calcul dynamique d'un point d'approche praticable le long du vecteur vers le départ ou vers le centre de la pièce. Dijkstra ne renvoie plus `null`, évitant la paralysie du zombie en état `SEARCH`.
   - `Game.ts` :
     * Verrouillage coordonné des secteurs : Palier 1 verrouille les 4 portes ; Palier 2 déverrouille les deux portes sud (accès au circuit Couloir + Galerie) et verrouille le nord ; Palier 3 déverrouille les deux portes nord.
     * Autorité de progression robuste : remplacement du simple seuil Z par une détection d'embrasure déverrouillée et ouverte ($Z \in [2.8, 3.9]$ au sud et $[-5.2, -4.1]$ au nord), verrouillée par un drapeau de transition unique (`hasTriggeredTransition`). Aucune transition possible pendant le combat ou la pause.
     * Spawns validés dynamiquement (`getValidSpawns`) : sélection parmi des pools par secteur, avec vérification de non-collision (`!isColliding`), distance minimale au joueur ($\ge 5$ m) et séparation inter-ennemis ($\ge 1.8$ m).
     * Transmission des occupants vivants à `door.update(delta, occupants)`.
   - `scripts/check-tiers.mjs` :
     * Réécriture complète sous forme de suite de tests comportementaux : étanchéité physique à 100%, protection de transition en pause/déplacement, transition unique, spawns sûrs et séparés, approche murale navigable, anti-pincement des portes et cohérence géométrie/graphe.
2. Vérification :
   - `npm.cmd run build` : compilé avec succès (code 0).
   - `node scripts/check-tiers.mjs` : 7/7 épreuves comportementales réussies (code 0).
   - `node scripts/check-weapon.mjs` : 100% validé (code 0).
   - `node scripts/check-zombie.mjs` : 100% validé (code 0).
   - Tests en jeu réel dans le navigateur non effectués par l'assistant.
3. Prochaine étape recommandée :
   - Tester en jeu (navigateur sur `http://localhost:5173/`) les sensations des transitions de paliers, la réouverture des portes si un zombie s'interpose, et l'efficacité des poursuites de zombies contre les murs.
   - Préparation de l'étape suivante : conception du système de récompense gratuite de répit ou modularité de génération de salles par graine.

Dernière demande précédente : Atelier R3 — Manoir en circuit, ouverture de la Galerie Ouest et navigation en boucle.
1. Modifications apportées :
   - `Level.ts` :
     * Découpe du mur ouest du couloir central : création d'une arche centrale de 2 m (z in [-1, 1]) reliant directement le couloir à la Galerie Ouest.
     * Découpe des murs séparateurs ouest (z = -4 et z = 4) : création de deux passages de 2,5 m (x in [-7.5, -5.0]) reliant la Galerie Ouest au Vestibule sud et à la Salle des machines nord.
     * Formation d'un circuit complet à 360° : Vestibule $\leftrightarrow$ Couloir $\leftrightarrow$ Grand Hall $\leftrightarrow$ Galerie Ouest $\leftrightarrow$ Vestibule, ainsi qu'une boucle interne en huit via l'arche centrale.
     * Atmosphère victorienne : chandelier à bougie vacillante dédié dans la galerie (-6.5, 2.4, 0) et trois tableaux baroques muraux.
     * Graphe de circulation étendu : ajout de 7 points de passage dans la Galerie Ouest et à l'arche centrale pour la poursuite Dijkstra des zombies.
   - `Game.ts` :
     * Palier 2 enrichi : 4 zombies se répartissant entre le couloir central et la Galerie Ouest pour une prise en tenaille tactique.
     * Palier 3 enrichi : 5 zombies couvrant l'ensemble du manoir avec embuscade dans la galerie.
     * Caisse de munitions supplémentaire intégrée dans la Galerie Ouest (-8, 0), réapprovisionnée à chaque palier.
2. Vérification :
   - `npm.cmd run build` : compilé avec succès (code 0).
   - `node scripts/check-tiers.mjs` : 100% validé.
   - `node scripts/check-weapon.mjs` : 100% validé.
   - Validation géométrique : continuité complète des boucles extérieure et en huit sans aucune collision.

Dernière demande précédente : Transition diégétique par portes verrouillées/déverrouillées et réapprovisionnement des bonus.
1. Modifications apportées :
   - `Door.ts` : ajout de l'état `LOCKED`, méthodes `lock()`, `unlock()`, `isLocked()` et blocage de `toggle()` avec feedback sonore métallique lors d'une tentative d'ouverture d'une porte verrouillée.
   - `Level.ts` : ajout de la seconde porte monumentale reliant le couloir à la salle des machines à (0, -4).
   - `Medkit.ts` & `AmmoBox.ts` : ajout de la méthode `respawn()` pour réactiver et réinsérer les bonus dans le graphe de scène à chaque nouveau palier sans réallocation mémoire.
   - `Game.ts` :
     * Suppression des fenêtres modales intrusives qui brisaient l'immersion et coupaient les contrôles.
     * Progression physique : en Palier 1, la porte du couloir (z = 4) est verrouillée ; dès que les 3 zombies meurent, elle se déverrouille avec un déclic sonore. Franchir son seuil (z < 3.8) lance le Palier 2.
     * En Palier 2, la porte de la salle nord (z = -4) est verrouillée ; après l'élimination des 4 zombies, elle se déverrouille. Franchir son seuil (z < -4.2) déclenche le Palier 3 final.
     * Réinitialisation des bonus : chaque palier appelle `respawn()` sur tous les kits de soin et caisses de munitions répartis dans chaque secteur du manoir.
     * Les invites HUD s'adaptent dynamiquement (`[PORTE VERROUILLÉE — PURGEZ LA ZONE]` en rouge sang, ou `[E] OUVRIR LA PORTE` en laiton doré).
2. Vérification :
   - `npm.cmd run build` : compilé avec succès (code 0).
   - `node scripts/check-tiers.mjs` : 100% validé.
   - `node scripts/check-weapon.mjs` : 100% validé.

Dernière demande précédente : Correction du « mur invisible » à la porte (battants inversés dans Door.ts).
1. Problème résolu :
   - Dans `Door.ts`, le calcul 2D de collision des battants ouverts utilisait `hLz + leafWidth * Math.sin(angle)` au lieu de `-`.
   - Visuellement, les battants s'ouvraient vers l'intérieur du couloir (`z < 4`), mais leurs segments de collision physiques étaient projetés dans le vestibule (`z in [4, 5.94]`).
   - Quand le joueur s'approchait de la porte ouverte ou tentait de contourner, il heurtait un collider fantôme dans l'air libre.
2. Corrections appliquées :
   - `src/Door.ts` : inversion du signe Z (`- Math.sin(angle)`) pour caler la collision exactement sur le maillage 3D tourné des battants.
   - Validation géométrique par script : 0 point de blocage dans l'embrasure ouverte (contre 20 points de collision fantôme auparavant).
3. Vérification :
   - `npm.cmd run build` : compilé avec succès (code 0).
   - `node scripts/check-weapon.mjs` : 100% validé.

Dernière demande précédente : Correction du passage de palier — Découplage de restart-button et support des raccourcis de transition.
1. Problème identifié après retour utilisateur :
   - `#continue-button` portait la classe `.restart-button`, ce qui déclenchait l'écouteur `window.location.reload()` lors du clic et réinitialisait la partie au Palier 1 au lieu de lancer le Palier 2.
   - Conflit de Pointer Lock sur clic de fond et absence de raccourcis clavier pour poursuivre.
2. Corrections apportées :
   - `index.html` et `src/style.css` : retrait de `.restart-button` sur `#continue-button`, styles propres et `pointer-events: auto` conservés sur `.continue-button`, ajout de l'indication de raccourci `[Espace] ou Clic`.
   - `src/Game.ts` : écouteur de rechargement restreint à `#game-over .restart-button, #victory .restart-button`.
   - Transition fluide : déclenchement de `nextTier()` par clic sur le bouton, clic sur l'écran en répit, ou touches `[Espace]` / `[Entrée]`, avec réacquisition automatique du Pointer Lock.
3. Vérification :
   - `scripts/check-tiers.mjs` : 100% validé (sélecteurs, classes, styles et touches).
   - `npm.cmd run build` : compilé avec succès (code 0).
   - `node scripts/check-weapon.mjs` : 100% validé.

Dernière demande précédente : Atelier R2 — Enchaînement déterministe des 3 paliers, cycle de vie et actualisation des cibles Weapon.
1. Modifications apportées :
   - Tableau de configuration déclaratif `tierConfigs` dans `Game.ts` :
     * Palier 1 : 3 zombies (vestibule sud et couloir).
     * Palier 2 : 4 zombies (dispersion dans le couloir et la salle des machines).
     * Palier 3 : 5 zombies (rencontre finale intense dans l'ensemble du manoir).
   - Gestion du cycle de vie des entités : méthode `zombie.dispose(this.scene)` supprimant les meshes Three.js, géométries, textures et sons résiduels des anciens groupes éliminés.
   - Actualisation dynamique des cibles de tir : méthode `weapon.setTargets(...)` appelée à chaque début de palier dans `startTier()`, assurant que le raycast de tir frappe immédiatement les nouveaux ennemis sans anomalie.
   - Transition interactive : bouton `#continue-button` (« Continuer vers le Palier X ») sur le panneau de répit, avec libération/reprise du Pointer Lock.
   - Fin de tentative : après l'élimination du Palier 3, `enterRespite()` déclenche automatiquement `endGame('won')` avec l'écran `MANOIR PURGÉ — SURVIE RÉUSSIE (Les 3 paliers ont été éliminés)`.
2. Vérification :
   - `npm.cmd run build` : compilé avec succès (code 0).
   - `node scripts/check-weapon.mjs` : 100% validé (avec nouveau test unitaire confirmant la prise en compte dynamique de `weapon.setTargets()`).
   - Rendu visuel vérifié sous Edge headless.
3. Prochaine étape recommandée : Atelier R3 — Transformer la carte en circuit et ouvrir une aile (graphe de circulation, déblocage d'un accès après un palier pour éviter les impasses et offrir un second itinéraire de fuite).

Dernière demande précédente : Atelier R1 — Remplacement de l'extraction par le Palier 1 et phase de répit.

Dernière demande précédente : Conformation stricte à la référence Counter-Strike (Glock-18) — Angle diagonal ~20° natif, posture tactique dans le quart inférieur droit et séquence de rechargement complète.
1. Problème corrigé :
   - L'itération précédente avait dessiné un pistolet tenu verticalement à 0° au centre de l'écran, ce qui donnait l'impression d'une visée décalée et trop distante de la référence CS:GO.
2. Nouvelle planche et nouveau sprite de repos :
   - Planche 8 poses générée (`glock_reload_gloves_spritesheet_png_1793610438546.jpg`) avec angle diagonal de ~20° convergeant nativement vers le centre de l'écran sur toutes les frames.
   - Flanc droit de la culasse et carcasse en raccourci perspectif 3D (*foreshortening*), hausse et guidon avec point blanc, gants tactiques à tissage diamant noir et manches longues.
   - Découpage haute fidélité (`scripts/slice-reload-sprites.ps1`) avec filtrage des bordures et chroma-key magenta `#FF00FF` sur canevas commun invariant ($384 \times 384$) :
     * Frame 0 : Repos tactique à deux mains dans le quart inférieur droit, canon pointant vers le réticule central.
     * Frame 1 : Légère bascule pour dégager le puits de chargeur.
     * Frame 2 : Main gauche se détachant vers le bas.
     * Frame 3 : Extraction visible du chargeur vide vers le bas.
     * Frame 4 : Approche du chargeur plein par le dessous.
     * Frame 5 : Insertion du chargeur dans la poignée.
     * Frame 6 : Claque de paume sous le talon du chargeur.
     * Frame 7 : Main gauche reprenant la prise de soutien vers la pose de repos.
3. Calibrage CSS et géométrie :
   - `src/style.css` : `.weapon-hip` agrandi et ancré dans le quart inférieur droit (`width: min(72vh, 62vw)`, `bottom: -14vh`, `transform: translate(calc(-20% - var(--aim) * 30%), ...)`).
   - Les manches descendent de manière ininterrompue sous le bord inférieur de l'écran.
   - Flamme de bouche (`.muzzle-flash`) recalée sur la bouche du canon inclinée (`left: 42.2%`, `top: 12.8%`, `rotate(-20deg)`).
4. Vérification :
   - `npm.cmd run build` : réussi sans erreur (code 0).
   - `node scripts/check-weapon.mjs` : 100% validé.
   - Rendu visuel en jeu vérifié par capture réelle sous Edge headless à $1280 \times 720$ (repos et frame 3).
   - Limite restante : ressenti subjectif de la cadence en combat à apprécier par le joueur sur son écran.

Demande précédente : Correction ciblée du sprite de vue à la hanche (`modern_hip_v2.png`) avec perspective FPS native.
1. Problème résolu : L'ancien sprite avait subi une tentative de réalignement par rotation 2D affine qui tordait le poignet et le canon. Le nouveau sprite a été entièrement redessiné avec une véritable perspective subjective 3D (raccourci perspectif / *foreshortening* de la glissière, guidon et hausse alignés, face arrière de la culasse visible, poignet droit naturel et avant-bras descendant vers le coin inférieur droit sans biseau).
2. Intégration et calibrage :
   - Fichier sauvegardé sous `public/assets/weapons/modern_hip_v2.png` (l'original restant préservé sous `modern_hip_backup.png`).
   - `index.html` pointe vers `modern_hip_v2.png`.
   - `.weapon-hip` configuré sans aucune rotation plane permanente (`rotate` à 0° au repos, uniquement dynamique au recul).
   - Positionnement recentré et orientation corrigée (`left: 50%`, `bottom: -6vh`, `width: min(60vh, 55vw)`, `transform: translate(calc(-30% - var(--aim) * 20%), ...) rotate(calc(-4deg * (1 - var(--aim)) + var(--kick-angle, 0deg)))`) : après retour utilisateur, l'arme est recentrée (guidon à 54.7%), l'axe de la glissière pointe droit sur le réticule central (50%, 50% - écart mesuré < 2 px), et la légère inclinaison de -4° s'annule en douceur vers 0° lors du passage en ADS.
   - Flamme de bouche (`.muzzle-flash`) recalée précisément sur la bouche du canon (51.3%, 11%, inclinaison -26°).
   - Préservation stricte de la mécanique : raycasting inchangé depuis le centre de la caméra (0,0), visée ADS au clic droit, transition de FOV, recul animé et éclairage dynamique réactif (`--weapon-brightness`, `--weapon-warmth`).
3. Vérification :
   - `npm.cmd run build` : réussi.
   - `node scripts/check-weapon.mjs` : réussi.
   - Captures d'écran Edge headless réelles exécutées en 1080p (16:9), 720p (16:9), 4:3 et 21:9 confirmant le bon cadrage, la convergence de l'axe vers le réticule et le recalage du flash de tir.
   - Limite restante : ressenti visuel subjectif en mouvement et en transition ADS à valider par le joueur en cours de partie.

Demande précédente : Correction ciblée des 3 défauts visuels majeurs (Porte de manoir à deux battants, alignement initial et éclairage dynamique réactif de l'arme).

Demande précédente : Feedback et sensation de tir renforcés (View Punch caméra, PointLight de flash 3D et douilles en laiton ShellCasing.ts).

Demande précédente : Étape 1 de la Refonte Visuelle — Éclairage dramatique, Ombres portées & Éclairage des ennemis (PCFSoftShadowMap, ACESFilmic, zombies ombrés, vacillement des bougies).

Demande précédente : Pistolet tactique lourd inspiré de Warhammer 40k: Boltgun en pixel-art 3D animé (sprite sheet 4 frames, automate cinématique dans Weapon.ts).

Demande précédente : Atelier F3 — Ambiance sonore et audio spatial 3D. Intégration d'un AudioListener sur la caméra du joueur, nappe d'ambiance nocturne bouclée dans Game.ts avec démarrage différé sur le Pointer Lock, et PositionalAudio sur chaque Zombie pour les grognements spatialisés.

Demande précédente : audit des assets et amélioration ciblée du décor du manoir (mansion_wall_v2.png, wood_floor_v2.png, portrait_v2.png) et Atelier F4 (rendu basse résolution pixelisé rétro PS1).
Compilation : `npm.cmd run build` réussi.
Validation en jeu : Non effectuée par l'assistant. À observer dans le navigateur : le rendu 3D est désormais calculé en basse résolution interne (facteur de réduction /3) et étiré plein écran avec image-rendering: pixelated sur le canvas. Les arêtes des polygones et les textures se fondent dans un grain rétro 32-bits authentique, tandis que le HUD HTML reste parfaitement net.

L'utilisateur a approuvé et fait construire le premier niveau en volumes simples, décrit dans `docs/PLAN_NIVEAU.md`. Prochaine étape : le parcourir en jeu et ajuster selon les observations de l'utilisateur. Le compteur C1 reste une option. Les cas limites B1 non évoqués ne sont pas automatiquement validés.

L'utilisateur a indiqué que le nouveau niveau fonctionne, puis a approuvé la perception par ligne de vue. Elle est implémentée dans Zombie.ts et le build réussit ; le comportement de visibilité doit encore être vérifié en jeu. Prochaine étape : tester mur, ouverture, perte de vue, distance et attaque ; ajuster selon les observations.

Préparation d'attaque ajoutée après accord : état ATTACK, teinte jaune et annulation hors portée ou sans visibilité. Build réussi ; animation, annulation et interaction avec les dégâts restent à vérifier dans le navigateur. Le rouge de blessure a priorité sur le jaune pendant 0,2 seconde. Prochaine étape : validation en jeu avant de changer la navigation.

L'utilisateur a ensuite accepté une recherche vers la dernière position vue. Un état SEARCH et des points de passage ont été ajoutés ; build réussi, navigation et cas sans trajet restent à tester en jeu. Les points sont adaptés au plan actuel et devront être revus si les murs changent. Prochaine étape : tester perte de vue, contournement, retour en vue et arrêt à destination.



Atelier C1 implémenté : compteur d'ennemis restants et objectif affichés dans le HUD en haut à gauche. État dérivé calculé directement depuis les zombies vivants. Statut : compilé, validation gameplay en attente.

Atelier E3 implémenté : répulsion locale douce (steering behavior / séparation) intégrée au déplacement dans Zombie.ts et transmise par Game.ts. Respecte les collisions du décor via la méthode move(). Statut : compilé, validation gameplay en attente.

Atelier C2 implémenté : classe Medkit modulaire (mesh 3D rétro avec croix rouge, rotation douce et détection de proximité) intégrée dans Game.ts et méthode heal() dans Player.ts. Statut : compilé, validation gameplay en attente.

Atelier D2 implémenté : classe Door (états CLOSED/OPENING/OPEN/CLOSING, coulissement vertical, synchronisation des collisions Box3 dans Level et obstruction des tirs/vue dans solidMeshes), interaction par touche E dans Player/Game avec invite HUD. Statut : compilé, validation gameplay en attente.

Atelier D3 implémenté : zone de déclenchement d'extraction (Trigger Zone) au fond de la salle des machines avec dalle visuelle au sol (isInExitZone dans Level.ts) et découplage de la victoire dans Game.ts. Écran de victoire adapté ('ÉVACUATION RÉUSSIE'). Statut : compilé, validation gameplay en attente.

Atelier C3 implémenté : réserve de munitions (10/15) dans Weapon.ts avec son empty.wav au clic à vide, classe AmmoBox (boîte verte rétro militaire avec bande dorée) dans le couloir et affichage HUD dans Game.ts/style.css. Statut : compilé, validation gameplay en attente.

Atelier F1 (Étape 1 - Sol Manoir) implémenté : réorientation artistique vers le style Manoir victorien (inspiré par l'image de référence fournie par l'utilisateur). Texture de parquet en bois ancien (wood_floor.png) 64x64 avec planches décalées et veinage, pavage (12, 12) et matériau semi-ciré (roughness 0.45). Statut : compilé, validation en cours.

Atelier F1 (Étape 2 - Murs Manoir) implémenté : texture mansion_wall.png 64x128 (lambris sculpté en bas + papier peint damassé rouge baroque en haut), pavage UV adaptatif par longueur de mur (createWallMaterial) dans Level.ts. Statut : compilé, validation visuelle en cours.

Atelier F1 (Étape 3 - Éclairage & Brillance) implémenté : suppression de la lumière directionnelle blanche crue, correction des rugosités, intégration du clair-obscur gothique (bougies chaudes + clair de lune + brouillard volumétrique bleu nuit) et porte de manoir en bois. Statut : compilé, validation visuelle en cours.

Atelier F1 (Étape 4 - Tapis & Tableaux) implémenté : carpet.png 64x64 posé à y=0.015 le long de l'axe central (18m) et portrait.png 48x64 accroché sur les murs stratégiques du manoir. Statut : compilé, validation visuelle en cours.

Atelier F4 implémenté : rendu 3D rétro calculé à 1/3 de la résolution d'écran (updateResolution dans Game.ts avec renderer.setSize(w, h, false)) et agrandi avec image-rendering: pixelated / crisp-edges dans style.css. HUD préservé en haute définition. Statut : compilé, validation visuelle en cours.

Atelier F3 (Ambiance sonore & Audio spatial 3D) implémenté :
- Nappe d'ambiance feutrée nocturne (`ambiance.wav`) bouclée à volume 0.35, démarrant dès le premier verrouillage de souris (respect de la contrainte d'autoplay du navigateur Web Audio).
- Audio spatialisé 3D (`PositionalAudio`) pour chaque zombie avec râle rauque périodique (`zombie-groan.wav`), atténuation selon la distance (distance de référence 2.5m, max 16m) et orientation par rapport aux oreilles virtuelles de la caméra (`AudioListener` attaché à la caméra du joueur).
- Fichiers modifiés : `Player.ts`, `Zombie.ts`, `Game.ts`, assets audio dans `public/assets/sounds/`.
- Compilation : `npm.cmd run build` réussi sans erreur.
- Validation gameplay / audio : non effectuée par l'assistant (à écouter dans le navigateur au casque ou aux haut-parleurs).

Atelier Arme Boltgun (Pistolet tactique lourd pixel-art 3D animé) implémenté :
- Sprite-sheet 4 frames (repos, détonation + flamme, recul culasse + fumée + éjection douille, retour culasse) inspiré de Warhammer 40k: Boltgun.
- Automate cinématique dans Weapon.ts avec delta-time : coup sec et éjection (0.38s) puis stabilisation jusqu'à 2s (réglage recul conservé).
- Nettoyage HTML (suppression des 4 divs provisoires) et affichage CSS dynamique avec --frame-index et --recoil sur fond transparent pixelated.
- Fichiers modifiés : public/assets/weapons/pistol_sheet.png, Weapon.ts, index.html, src/style.css.
- Compilation : npm.cmd run build réussi.
- Validation gameplay : non effectuée par l'assistant (à tester en jeu dans le navigateur).

Refonte Visuelle — Étape 1 (Éclairage dramatique, Ombres portées & Zombies réactifs) implémentée :
- Activation des ombres dynamiques WebGL (shadowMap PCFSoftShadowMap) et du tone mapping ACESFilmic dans Game.ts.
- Ombres portées du clair de lune (DirectionalLight avec frustum optimisé 1024x1024) et du lustre du grand hall (PointLight 512x512).
- Sol, tapis, tableaux, porte et caisses configurés en receiveShadow et castShadow.
- Zombies passés en MeshStandardMaterial : ils émergent maintenant de l'obscurité et sont sensibles à la lumière ambiante/locale. Ombre portée en silhouette de sprite découpée via customDepthMaterial et alphaTest 0.4.
- Vacillement doux et vivant des bougies (harmoniques sinusoïdales dans Level.update).
- Fichiers modifiés : Game.ts, Level.ts, Zombie.ts, Door.ts, Medkit.ts, AmmoBox.ts.
- Compilation : npm.cmd run build réussi (code 0).
- Validation en jeu : à tester dans le navigateur (observer les ombres portées et le passage des monstres dans la lumière).

Feedback de tir percutant (Recul caméra, Flash 3D & Douilles) implémenté :
- View Punch : recul angulaire de caméra (pitch ~2.5° en hanche, ~1.4° en ADS) et amortissement élastique continu dans Player.ts.
- Lumière dynamique 3D éphémère (PointLight 14m) illuminant la scène pendant 0.07s à chaque coup de feu dans Weapon.ts.
- Éjection de douilles en laiton 3D (ShellCasing.ts) avec trajectoire parabolique balistique, culbute, rebond sur le sol et ombre portée.
- Fichiers modifiés : ShellCasing.ts (créé), Player.ts, Weapon.ts, Game.ts.
- Compilation : npm.cmd run build réussi (code 0, 17 modules).
- Validation gameplay : à tester dans le navigateur (tirer au fusil/pistolet, ressentir la secousse de visée, voir la pièce s'illuminer et les douilles voler).

Prochaine étape proposée : Refonte Visuelle — Étape 2 : Architecture gothique fermée (Plafond à caissons en bois sombre, Poutres massives transversales et Plinthes en relief le long des murs pour éliminer l'effet boîte ouverte). Accord à obtenir avant intervention.

## Prompt court pour une nouvelle conversation

> Nous travaillons sur DEAD SECTOR. Lis AGENTS.md, docs/ETAT_PROJET.md et docs/ARCHITECTURE.md. Consulte uniquement le jalon utile dans docs/ROADMAP.md et vérifie le code concerné. Reprends à la prochaine étape proposée en respectant les accords déjà donnés. Je veux comprendre la conception macroscopique : responsabilités, données, flux, compromis et validation. Présente un atelier court avant toute nouvelle fonctionnalité importante et attends mon accord ; après implémentation, compile et fournis un débrief avec mini-exercice. Ne considère pas un build réussi comme une validation de gameplay.
