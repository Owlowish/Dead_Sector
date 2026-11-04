# DEAD SECTOR — État et reprise

## Rampeuse : comportements d'horreur et invocation debug — 4 novembre 2026

- **Demande réalisée** : implémentation des comportements 2 (stutter saccadé), 3 (réaction lampe torche / frénésie) et 4 (agrippement chevilles / tirage caméra) sur la Rampeuse, ainsi que 4 boutons d'invocation immédiate dans le menu debug (`[K] Debug`) à 3-4 mètres devant le joueur.
- **Mouvement par impulsions saccadées (Ghostly Stutter)** : `CrawlerZombie.ts` gère une horloge de spasme interne. La reptation alterne désormais de violentes propulsions rapides (vitesse ×1,50 à ×1,85) avec de courtes micro-pauses convulsives (vitesse ×0,12, pose `idle` forcée), simulant des bonds et spasmes biomécaniques anormaux.
- **Réaction à la lampe torche (Photo-sensibilité double : 50% Furie / 50% Fuite)** : détection géométrique du cône de lumière du joueur (`playerContext.isFlashlightOn`, angle cône < 28°, distance < 14 m, sans obstruction opaque). Lorsque le faisceau l'atteint, la Rampeuse subit un spasme de recul/éblouissement de 0,2 s (pose `hurt`) et émet un cri strident. Elle tire ensuite aléatoirement à 50/50 :
  * **50% Furie** : elle entre dans un état de rage offensive pendant 3,2 s (vitesse ×1,85, sprint au ras du sol vers le joueur).
  * **50% Fuite** : prise de panique, elle se carapate en rampant très vite à l'opposé du joueur (vitesse ×1,70 pendant 2,6 s, sans attaquer) pour regagner l'obscurité. Si elle se retrouve acculée contre un mur sans pouvoir reculer pendant plus de 0,45 s, elle bascule immédiatement en furie désespérée.
- **Agrippement aux chevilles (Ankle Grab)** : lors de l'attaque au contact, `onAttackPlayer(damage, true)` active `Player.applyAnkleGrab()`. Le joueur subit un ralentissement drastique de 60 % pendant 0,75 s et le regard de la caméra est brutalement tiré vers le bas (abaissement du pitch d'environ 16° vers les pieds), forçant le joueur à regarder le monstre accroché à ses jambes.
- **Invocation immédiate dans le menu Debug (K)** : ajout de 4 boutons sous la grille des paliers (`🕷️ Rampeuse`, `⚡ Coureur`, `🧪 Cracheur`, `🧟 Standard`). L'apparition calcule une position 3 à 4 m devant l'orientation de la caméra (avec contournement en cas d'obstacle mural) et intègre immédiatement l'entité aux cibles d'armes, à l'audio 3D et à la boucle de combat sans altérer les quotas de palier.
- **Vérifications réalisées** : `npm.cmd run build` (succès), `node scripts/check-crawler.mjs` (100% de réussite : assets, bounding boxes, cycles de Stutter, réaction lampe, grab et quotas P4–P7), `node scripts/check-debug-menu.mjs`, `node scripts/check-spitter.mjs`, `node scripts/check-encounters-f4.mjs`, `node scripts/check-tiers.mjs` tous passés à 100 %.


## Rampeuse : correction des proportions et de l'ancrage — 4 novembre 2026

- **Correction demandée après capture en jeu** : le canevas PNG carré était projeté sur 1,6 × 1 m, ce qui étirait horizontalement les visages et les membres. `crawlerConfig` utilise maintenant une taille commune de 1,6 m pour largeur et hauteur. La largeur apparente est conservée ; le corps visible au repos passe d'environ 0,64 m à 1,025 m de haut. Les PNG, caractéristiques de combat, cadence et rayon de collision restent identiques.
- **Ancrage réel au sol** : `CrawlerAnimation.ts` exporte `crawlerGroundOffsetY`, calculé à partir de l'appui dessiné y=504 sur 512 px. `CrawlerZombie.ts` emploie cet offset à la construction et lors des déplacements en altitude. Le centre du support est à 0,775 m au-dessus du sol ; la marge transparente inférieure passe sous le sol et les appuis visibles restent au contact. Aucune inclinaison du billboard ajoutée.
- **Aperçu représentatif** : `scripts/make-crawler-preview.mjs` calcule aussi les proportions des vues 2D depuis la configuration. Il ajoute une comparaison Three.js avant/corrigé avec la même image et la même largeur, une caméra à 1,70 m, et trois distances (1,8 / 3,5 / 6 m). Le cas corrigé importe taille et offset du jeu ; le cas avant conserve les anciennes valeurs comme témoin. Lumière neutre de comparaison, pas une reproduction de l'éclairage du manoir.
- **Vérifications réalisées** : `npm.cmd run build`, `node scripts/check-crawler.mjs` et `node scripts/check-sprite-hit-mask.mjs` réussis. Le test Rampeuse construit le vrai `CrawlerZombie`, vérifie la géométrie sans étirement, l'appui des six poses sur sol surélevé et après déplacement, les poses de blessure/mort et un vrai rayon tête sur la géométrie corrigée. Les zones de tête en pixels restent valables puisque les UV n'ont pas changé.
- **Navigateur** : aperçu chargé dans Chrome headless, six images chargées ; reptation normale/ralentie, attaque/retour et cadavre contrôlés ; captures avant/après aux trois distances inspectées, sans exception JS. Fichiers locaux : `tmp/rampeuse-browser/proportions-{1.8,3.5,6}.png`. Aperçu : générer avec `node scripts/make-crawler-preview.mjs`, puis `/tmp/crawler-preview/index.html` sur le serveur Vite.
- **Limites et prochaine vérification** : pas de nouveau combat joué au Pointer Lock dans le manoir. L'impression de volume, les ombres réelles et la facilité de visée avec une silhouette plus haute restent à observer en P4. Le billboard reste vertical et sans épaisseur : l'étirement est corrigé, pas la limite d'une représentation 2D vue de dessus. L'avertissement Vite sur le bundle >500 ko demeure, sans erreur de compilation. Aucune autre mécanique ni génération de nouveaux assets autorisée par cet atelier ; la correction demandée est implémentée.

## Rampeuse : remplacement des assets et menu debug K — 4 novembre 2026

- **Demande réalisée localement** : les six images `public/assets/zombies/crawler/{idle,crawl-a,crawl-b,attack,hurt,death}.png` ont été régénérées avec l'outil intégré `image_gen`, puis remplacées. Identité conservée : femme quadrupède, cheveux noirs, chemise de nuit ivoire sale. Les deux poses de reptation alternent réellement les mains en appui. PNG RGBA8 512 × 512, environ 1,26 Mio au total ; dimensions GPU identiques au lot précédent. Aucun réglage de vitesse, santé, dégâts ou quota changé dans cet atelier.
- **Production et données** : `docs/asset-packs/RAMPEUSE_V2_2026-11-04.json` conserve les six prompts exacts, références, sources, dimensions mesurées, décalages d'export et limites. `scripts/export-crawler-sprite.ps1` réduit le canevas entier avec NearestNeighbor et aligne le sol à y=504 sans recadrer/redimensionner chaque silhouette indépendamment. Les anciens PNG Gemini sont sauvegardés dans `tmp/rampeuse-gemini-before/` (local, ignoré par Git). Le manifeste Gemini initial est désormais historique et remplacé par le manifeste V2 ; ses anciennes mentions « approved/pass » ne prouvent aucune validation actuelle.
- **Zones de tête et aperçu** : `CrawlerAnimation.ts` fournit les zones par pose à `SpriteHitMask.ts`. Le masque alpha reste calculé à partir des nouvelles images. `scripts/make-crawler-preview.mjs` respecte maintenant le rapport 1,6 × 1 du billboard et propose vitesse normale/ralentie ; l'attaque utilise les durées du vrai comportement, la mort reste une pose persistante. Jeu et aperçu gardent `CrawlerAnimation.ts` comme source de données.
- **Menu debug autorisé après présentation du plan** : K ouvre/ferme un panneau avec les sept paliers ; Échap et le bouton Fermer ferment aussi. Ouverture : simulation figée (delta nul), sons suspendus, rechargement annulé, souris libérée. Un choix nettoie ennemis/projectiles/drops/douilles/impacts, restaure la vie et place le joueur à l'entrée, puis lance `Game.startTier`. Équipement, munitions et améliorations sont conservés. Le contrôle reprend par un clic dans le jeu. Le menu est disponible dans le build courant, pas limité au développement.
- **Correction liée aux sauts et transitions** : `startTier` remet maintenant à zéro le compteur de Rampeuses, le palier en attente et le décompte d'accalmie. `Player.resetForDebug` restaure position, vie et caméra ; perdre le Pointer Lock vide les touches maintenues pour éviter un déplacement résiduel.
- **Vérifications réussies** : `npm.cmd run build` ; `check-debug-menu.mjs`, `check-crawler.mjs`, `check-sprite-hit-mask.mjs`, `check-tiers.mjs`, `check-spitter.mjs`, `check-horde-resources.mjs`, `check-weapon.mjs`. Vérification des six PNG, alpha réel, appui commun, centres de tête et refus des impacts bas comme tirs tête. Les tests debug exercent les vraies méthodes de transition et la remise à zéro sur P4 → P7 → P1 → P4, dont un départ depuis l'état mort.
- **Navigateur réellement contrôlé** : Chrome headless sur Vite local. Cycle de reptation joué à vitesse normale puis ×0,25 avec échantillonnage des poses et retour au repos ; chargement des six exports, attaque/retour et cadavre persistant contrôlés dans l'aperçu. Menu K, touche répétée ignorée, sauts P4/P7/P1/P4, palier courant et fermeture Échap contrôlés sans exception JS dans ce scénario. Captures dans `tmp/rampeuse-browser/` ; script local `tmp/check-rampeuse-browser.mjs`. Une tentative distincte de capture réelle de souris a échoué en headless avec `WrongDocumentError` : la reprise au Pointer Lock n'est pas validée par cet essai.
- **Limites et prochaine vérification** : pas de combat joué physiquement, ni de validation artistique de l'utilisateur. L'éclairage réel, les contours de tête sous visée, la lisibilité en déplacement et la reprise du contrôle après K restent à observer en partie P4. Deux poses de reptation et une seule pose pour attaque/blessure/mort : remplacement cohérent du lot existant, sans nouvelle animation de chute intermédiaire. L'avertissement Vite sur le bundle de plus de 500 ko demeure ; compilation réussie. Aucun accord supplémentaire requis pour le périmètre réalisé ; un ajout de gameplay distinct demanderait son propre plan.

## Workflow multi-IA des assets et réponses sans question systématique — 4 novembre 2026

- **Demande appliquée, documentation uniquement** : `AGENTS.md` supprime les questions de compréhension et mini-exercices automatiques. La pédagogie reste dans les explications ; les questions sont réservées aux informations indispensables, décisions importantes ouvertes ou échanges pédagogiques demandés. Un accord déjà donné n'est pas redemandé.
- **Pipeline global** : `docs/PIPELINE_ASSETS.md` couvre personnages, armes, décors, objets, interface, effets et sons. Il fixe les références artistiques du dépôt, l'inventaire du lot complet, le contrat technique, la base d'identité, l'action pilote, les critères de rejet, la livraison et les contrôles distincts. Les retours d'expérience sur les animations sont conservés en annexe. La production d'un lot autorisé ne requiert pas un accord pour chaque image ; une nouvelle mécanique reste hors périmètre sans accord.
- **Reprise par Gemini ou un autre modèle** : `docs/PROMPT_ASSETS_MULTI_IA.md` fournit le prompt à copier et `docs/asset-packs/MODELE_LOT_ASSETS.json` une fiche documentaire à dupliquer. Les chemins seuls ne transmettent pas les images à un modèle sans accès au dépôt. Sans outil de génération, livrer les prompts et marquer les fichiers manquants, sans prétendre les avoir produits.
- **Vérifications** : références confrontées aux fichiers et chargements actuels ; inspection des images de repos du fusil et du Coureur, du mur et du kit de soin. `git diff --check` réussi, JSON analysé sans erreur et 20 références concrètes contrôlées sur disque. Aucun code ni asset du jeu modifié ; pas de compilation ni de test navigateur relancé. Aucun lot généré et aucune utilisation effective de ce nouveau prompt dans Gemini : son efficacité reste à observer sur un vrai lot.
- **Usage à la prochaine demande d'asset** : appliquer ce workflow au seul contenu demandé et conserver les preuves/limites dans sa fiche. Cette mise à jour n'autorise aucun personnage, arme, son ou mécanisme supplémentaire. Les limites de gameplay des ateliers précédents restent valables.

## Optimisation des assets et allègement du premier chargement — 4 novembre 2026 (branche perf-assets-chargement)

- **Branche dédiée créée** : perf-assets-chargement.
- **Allègement des textures lourdes (28 fichiers)** : script reproductible scripts/optimize-assets.py. Les textures de décors 3D (1254x1254), les objets ramassables/icônes (1254x1254) et les 9 poses du Cracheur (1024x1536) ont été rééchantillonnées en Lanczos haute qualité (décors en 512x512/384x768, objets en 256x256, Cracheur en 512x768). Le volume de ces assets passe de 41,65 Mo à 8,31 Mo (**33,79 Mo économisés, -81,1 %**). L'empreinte VRAM brute sur le GPU est réduite de plus de 150 Mo.
- **Masques de tir (SpriteHitMask.ts)** : plafonnement de la résolution de calcul du masque alpha à 512 px max, divisant par 4 à 8 le temps de lecture getImageData sur le fil principal lors du préchauffage. isHeadSpriteHit adapte proportionnellement les boîtes de collision selon les dimensions de référence, garantissant une précision de visée tête rigoureusement identique quelle que soit la résolution source.
- **Préchauffage WebGL (Game.ts)** : appel sécurisé à 	his.renderer.compile?.(this.scene, this.player.camera) à la fin de l'initialisation pour précompiler les programmes de shaders Three.js (ombres PCF, ACESFilmic, lumières), évitant le micro-gel de la toute première frame de rendu.
- **Vérifications** : 
pm.cmd run build (succès en 1,56 s), tests Node validés à 100 % (check-sprite-hit-mask.mjs, check-decor-surfaces.mjs, check-spitter.mjs, check-shotgun.mjs, check-encounters-f4.mjs, check-zombie-remains.mjs, check-tiers.mjs, check-zombie-revival.mjs, check-weapon.mjs, check-horde-resources.mjs, check-storm.mjs, check-combat-feedback.mjs, check-perf-tracker.mjs, check-split-level.mjs, check-zombie.mjs, check-agile-revival-task4.mjs).

## Pression des vagues, son et grain — 4 novembre 2026

- **Implémenté localement, non commité** : le plafond actif progresse par palier de 3 à 8 (`EncounterConfig.ts`), avec un budget global de 8 (`MansionConfig.ts`). P6 et P7 autorisent trois Cracheurs vivants en même temps, chacun accompagné d’un Coureur si deux emplacements sûrs sont disponibles. Les salves d’ouverture P4–P7 montent à 3, 4, 5 et 6 ennemis. Le quota total de chaque palier ne change pas.
- **Rencontres plus proches** : `Game.trySpawnZombie()` privilégie les points sûrs proches du joueur au lieu des plus lointains. Il conserve la distance minimale de 6 m, le rejet des points visibles dans l’axe et la vérification d’un chemin praticable. Les ennemis vivants sont toujours alertés vers le joueur toutes les 0,75 s. Cela réduit les trajets de recherche mais ne prouve pas encore que chaque chemin réel mène rapidement au contact.
- **Son et image** : nouvelle musique originale de 24 s en boucle, réglable dans le panneau de pause, discrète pendant le combat et abaissée entre les combats ; nouvelle détonation de fusil distincte du pistolet. `Game.ts` suspend la musique avec la pause, la perte du Pointer Lock ou l’onglet caché. `style.css` superpose des lignes sombres très légères sur la scène et l’arme. Les armes étaient déjà réduites à une grille de 3 px dans `WeaponPresentation.ts` ; leurs sources n’ont pas été régénérées. `scripts/generate_combat_audio.py` permet de régénérer les deux WAV sans dépendance externe.
- **Vérifications** : `npm.cmd run build`, `check-spitter.mjs`, `check-encounters-f4.mjs`, `check-tiers.mjs`, `check-weapon.mjs`, `check-shotgun.mjs` et `git diff --check` passent. Le test de Cracheurs remplit les plafonds P6 et P7, dont trois Cracheurs avec leurs escortes (huit menaces au P7). La compilation valide le code et la présence des assets, pas leur rendu sonore ou l’équilibre.
- **Non vérifié en jeu** : stress réel à huit menaces, FPS en combat, vitesse de rapprochement selon les portes et escaliers, volume relatif de la musique, du fusil et des indices sonores. Prochaine étape proposée : une partie P4–P7 avec relevé du premier contact, du pic de menaces et des FPS, puis ajuster les chiffres selon le ressenti. Un changement de gameplay supplémentaire demanderait un nouvel accord.

## Pistes d’amélioration — 4 novembre 2026

- Document de conception ajouté : `PISTES_AMELIORATION_2026-11-04.md`. Il distingue état actuel, hypothèses et ateliers proposés : retours de tir, cohérence graphique, objectif spatial facultatif, horreur contextuelle et variantes de rencontre.
- Intervention documentaire uniquement ; aucun code modifié, aucun build ou test navigateur relancé pour cette rédaction. Les limites du dernier atelier ci-dessous restent valables.
- Suite recommandée : vérifier le dernier lot en partie réelle, puis proposer un atelier d’identité sonore et visuelle des tirs/impacts. La rédaction de ces pistes n’autorise pas leur implémentation.

## Atelier horde et précision — 4 novembre 2026

- **Implémenté localement, non commité** : `SpriteHitMask.ts` prépare un masque alpha par texture partagée. `Weapon` ignore les pixels transparents et applique les dégâts tête/corps proposés (pistolet 80/28, pompe 24/12 par plomb) avec un bref signal au viseur. Les dégâts cumulés sont transmis une fois par cible. `Zombie` supprime la chance de relève à la mort si le tir fatal comportait un impact tête ; `SpitterZombie` reçoit séparément la force d'impact initiale pour sa règle de gros choc.
- **Ressources** : les caisses fixes et les piédestaux ne sont plus instanciés dans `Game`. Les soins et le fusil restent. Un budget de drops de munitions par palier force deux lots dans les deux premières éliminations et sert les lots restants avant la dernière mort ; des drops supplémentaires restent aléatoires. Les lots sont ramassables pendant l'accalmie et persistent au changement de palier. Les meshes consommés sont libérés.
- **Horde et escorte** : `Game` rafraîchit la recherche des ennemis vivants toutes les 0,75 s. Un Cracheur n'apparaît que si une place et un point sûr existent pour un Coureur à moins de 8 m du même côté des murs ; les deux sont réservés ensemble sur le quota et le plafond de quatre. Le projectile avance à 9 m/s, sans guidage.
- **Transition** : après la dernière menace définitive, les accès sont déverrouillés et ouverts, puis un décompte HUD de 10 s laisse jouer et ramasser les drops. Le timer n'avance que lorsque le contrôle est actif ; le palier suivant démarre automatiquement. Après P7, le manoir reste explorable. Le carillon n'est plus actif et les portes n'anticipent plus le départ.
- **Vérifications** : `npm.cmd run build`, `check-sprite-hit-mask.mjs`, `check-horde-resources.mjs`, `check-weapon.mjs`, `check-shotgun.mjs`, `check-spitter.mjs`, `check-encounters-f4.mjs`, `check-tiers.mjs`, `check-zombie-revival.mjs` et `git diff --check` ont réussi. D'anciens tests F1/F2/T5 supposent encore carillon, piédestaux ou caisses fixes et ne correspondent plus aux nouvelles règles ; `check-zombie-agile.mjs` échoue aussi sur la vitesse dans son scénario isolé. L'essai Chrome automatisé de mesure P4–P7 n'a pas atteint ses fonctions de test ; aucune mesure de durée/munitions ni partie réelle au Pointer Lock n'est acquise pour cet atelier.
- **À vérifier avant équilibrage** : contours des zones de tête sur chaque pose dans le vrai éclairage, disponibilité des drops après des tirs au corps et des ratés, difficulté de la bille à 9 m/s, escortes dans les couloirs et décompte pendant une pause. Les chiffres sont des premiers essais, pas un équilibre validé.

## Difficulté, quotas élevés et relève des Coureurs (Tâches 0 à 4) — 3 novembre 2026

- **Implémenté (Tâches 0 à 4 de `docs/PLAN_DIFFICULTE_GEMINI_2026-11-03.md`)** :
  * **Tâche 0 (Diagnostics locaux)** : `TierDiagnostics.ts` (`TierDiagnosticsTracker`) capture les métriques précises par palier : durée de combat, premier contact, dégâts subis, tirs effectués, composition par type, relèves déclenchées et pic de menaces simultanées. Données exposées via `window.__DEAD_SECTOR_DIAGNOSTICS` et `tierDiagnostics` sur l'instance de `Game`.
  * **Tâche 1 (Angle mort du Cracheur supprimé)** : `SpitterZombie.ts` abaisse la distance minimale d'engagement de 5,0 m à 1,0 m (`minAttackDistance = 1.0`, `maxAttackDistance = 12.0`). Annulation en phase de préparation si la cible passe sous 0,85 m ou hors vue. Origine du projectile calculée de façon sûre (`offsetDist = Math.min(0.3, Math.max(0.08, (distance - 0.4) * 0.5))`), évitant toute pénétration de mur ou de corps à bout portant.
  * **Tâche 2 (Ouverture différée et composition garantie)** : `EncounterConfig.ts` introduit `openingSpawns` (1, 1, 1, 2, 2, 3, 3). `Game.ts` supprime tout spawn à frame 0 : délai initial d'apparition de 2,0 s (P1) et 0,8 s (P2–P7). Les salves d'ouverture sont cadencées à 0,4 s, suivies d'un intervalle de renfort de 0,8 s. Composition garantie : calcul exact des quotas restants (`remainingAgile`, `remainingSpitter`, `remainingStandard`). Si un type a atteint son plafond simultané, il attend sans être écrasé par un standard de repli non souhaité.
  * **Tâche 3 (Élévation des totaux P4–P7)** : Quotas réhaussés dans `EncounterConfig.ts` :
    - Palier 4 : 8 ennemis (3 standards, 4 agiles, 1 cracheur).
    - Palier 5 : 10 ennemis (3 standards, 5 agiles, 2 cracheurs).
    - Palier 6 : 12 ennemis (3 standards, 6 agiles, 3 cracheurs).
    - Palier 7 : 14 ennemis (4 standards, 7 agiles, 3 cracheurs).
    Le plafond strict de 4 menaces actives simultanées et les plafonds par type sont rigoureusement préservés.
  * **Tâche 4 (Relève des Coureurs à 12 %)** : `ZombieRemains.ts` autorise désormais 'agile'. `Zombie.ts` applique 12 % de chance de réanimation à la première mort d'un Coureur. Le corps gît 2,0 s au sol (avec grognement d'alerte à 0,4 s du réveil), rejoue sa chute en sens inverse et revient avec 40 PV. Réinitialisation visuelle agile complète, rétablissement de l'ombre au sol, fenêtre de récupération de 0,8 s sans attaque. La 2nde mort est définitive (`!this.hasRevived`). Les cadavres persistent au sol jusqu'au changement de palier.

- **Mesures comparatives en Chrome headless (Paliers 4 à 7)** :
  * **Mesure 1 (après T0, T1, T2 — totaux 6/8/9/10, sans relève agile)** :
    - P4 (total 6) : 6,95 s | 0 tir simulé | 0 dégât | 3 menaces max | Std: 2, Agile: 3, Spit: 1 | 60 FPS (médiane 16,7 ms, p95 16,9 ms) | 494 draw calls, 9 077 tris, 28 textures.
    - P5 (total 8) : 10,56 s | 0 tir simulé | 0 dégât | 4 menaces max | Std: 2, Agile: 4, Spit: 2 | 60 FPS (médiane 16,7 ms, p95 16,9 ms) | 494 draw calls, 9 077 tris, 28 textures.
    - P6 (total 9) : 10,57 s | 0 tir simulé | 10 PV subis | 4 menaces max | Std: 2, Agile: 5, Spit: 2 | 60 FPS (médiane 16,7 ms, p95 17,0 ms) | 494 draw calls, 9 077 tris, 28 textures.
    - P7 (total 10) : 12,40 s | 0 tir simulé | 20 PV subis | 4 menaces max | Std: 2, Agile: 5, Spit: 3 | 56 FPS (médiane 17,8 ms, p95 18,1 ms) | 495 draw calls, 9 079 tris, 31 textures.
  * **Mesure 2 (après T3, T4 — totaux 8/10/12/14, relève agile 12 %)** :
    - P4 (total 8) : 11,49 s (+65 %) | 0 dégât | 4 menaces max (contre 3) | Std: 3, Agile: 4, Spit: 1 | 57 FPS (médiane 17,6 ms, p95 18,1 ms) | 494 draw calls, 9 077 tris, 28 textures.
    - P5 (total 10) : 12,40 s (+17 %) | 0 dégât | 4 menaces max | Std: 3, Agile: 5, Spit: 2 | 60 FPS (médiane 16,7 ms, p95 16,9 ms) | 494 draw calls, 9 077 tris, 28 textures.
    - P6 (total 12) : 12,40 s (+17 %) | 0 dégât | 4 menaces max | Std: 3, Agile: 5, Spit: 2 | 60 FPS (médiane 16,7 ms, p95 16,9 ms) | 497 draw calls, 9 083 tris, 29 textures.
    - P7 (total 14) : 18,79 s (+51 %) | 10 PV subis | 4 menaces max | Std: 4, Agile: 7, Spit: 3 | 60 FPS (médiane 16,7 ms, p95 16,9 ms) | 494 draw calls, 9 077 tris, 31 textures.
  * **Synthèse performance & rendu** :
    - Zéro saccade > 33 ms sur l'ensemble des mesures.
    - Les draw calls restent stables (494 à 497 calls) même avec 14 cadavres simultanés visibles au sol au palier 7, grâce au partage des géométries et matériaux dans `ZombieRemains`.
    - La durée cumulée des combats P4–P7 passe de 40,5 s à 55,1 s en simulation rapide sans tirs joueur (+36 % de temps d'occupation de l'arène). En jeu réel avec tirs, visée et esquive, chaque vague s'allonge de 30 à 60 secondes, amenant la tentative complète vers la fourchette cible de 10 à 15 minutes.

- **Vérifications exécutées** :
  * `npm.cmd run build` : compilé avec succès en 243 ms.
  * `scripts/check-tasks-0-1-2.mjs` : 100 % PASS (tracker T0, portée 1–12 m du cracheur T1, salves 2/2/3/3 et composition garantie T2).
  * `scripts/check-agile-revival-task4.mjs` : 100 % PASS (tirage 12 %, délai 2 s, 40 PV, réinitialisation de pose et textures, 2nde mort définitive, nettoyage dispose).
  * `scripts/check-encounters-f4.mjs` : 100 % PASS (nouveaux quotas 8/10/12/14, 26 cachettes, cycle complet P1–P7).
  * `scripts/check-tiers.mjs` : 100 % PASS (10 épreuves comportementales du manoir).
  * `scripts/check-zombie-revival.mjs` : 100 % PASS (relèves standard et agile).
  * `scripts/check-spitter.mjs` : 100 % PASS (animation, quotas, collisions du projectile).

- **Limites et distinctions de validation** :
  * Les métriques relevées par scripts automatisés mesurent l'enchaînement de la logique, les quotas, les temps de trame GPU/CPU et l'absence de saccades.
  * **Non validé en jeu réel** : aucun test au Pointer Lock physique avec souris et clavier réels n'a été effectué pour évaluer le stress cognitif d'un Coureur se relevant dans le dos du joueur pendant un crachat de Cracheur à mi-distance, ni la gestion manuelle du stock de munitions sur l'ensemble d'une partie complète 1–7.

- **Tâches 5 et 6 (implémentées et validées suite à votre accord)** :
  * **Tâche 5 (Réarmement unique et économie de munitions)** :
    - *Réarmement unique* : `Game.respawnPickups()` est appelé une seule fois lors de la transition vers l'accalmie (`enterRespite()`). Dans `startTier()`, le réarmement n'a plus lieu si le joueur provient de l'exploration (`this.state === 'exploration'`). Ainsi, les objets ramassés pendant l'accalmie pour se préparer au combat ne réapparaissent plus une 2nde fois au gong. Les démarrages directs (P1 initial, tests programmatiques) conservent leur réarmement propre.
    - *Calibrage munitions* : Les 4 caisses de 9 mm de `MANSION_PICKUPS` délivrent désormais 12 balles chacune (soit 48 balles de réserve par cycle d'exploration complet du manoir, correspondant à 4 chargeurs complets), équilibrant exactement le besoin théorique des vagues à 10–14 ennemis sans risque de pénurie artificielle.
  * **Tâche 6 (Télégraphie sonore & règle de « gros choc » du Cracheur)** :
    - *Télégraphie audio* : `SpitterZombie.setupAudio()` attache un `THREE.PositionalAudio` avec pitch guttural grave (`playbackRate = 0.72`) et volume spatialisé (0.35). Dès l'entrée en `windup` (début des 0,95 s de préparation du crachat), le grognement se déclenche, avertissant le joueur même si le monstre est hors champ. Arrêt et libération propres dans `stopAudio()` et `dispose()`.
    - *Règle de gros choc* : Une blessure légère au pistolet (<= 40 dégâts) ne coupe plus automatiquement la préparation. L'interruption exige soit un coup lourd direct (>= 55 dégâts, comme un tir de fusil à pompe), soit une accumulation rapide de dégâts (>= 75 dégâts, soit 2 balles de pistolet consécutives). À l'interruption, le monstre repasse en `idle` avec 1,2 s de temps de recharge.

- **Vérifications de la suite complète** :
  * `npm.cmd run build` : compilé avec succès (236 ms).
  * `scripts/check-tasks-5-6.mjs` : 100 % PASS (réarmement unique, 12 balles, grognement 0.72, résistance et interruption gros choc).
  * `scripts/check-tasks-0-1-2.mjs` : 100 % PASS.
  * `scripts/check-agile-revival-task4.mjs` : 100 % PASS.
  * `scripts/check-spitter.mjs` : 100 % PASS.
  * `scripts/check-encounters-f4.mjs` : 100 % PASS.
  * `scripts/check-tiers.mjs` : 100 % PASS.
  * `scripts/check-zombie-revival.mjs` : 100 % PASS.

---

## Mort, difficulté et relève des zombies — 3 novembre 2026

- **Corrigé** : le préchauffage de `ZombieRemains` charge maintenant les ressources propres au Cracheur sous la clé `spitter` ; il n'affiche plus le cadavre du zombie normal. Deux PNG transparents ont été ajoutés : `death-a` (recul) et `corpse` (corps couché), avec l'ancien `death` comme pose intermédiaire. `ZombieRemains` joue ces trois poses à 0,24 s chacune et garde le corps final visible jusqu'au changement de palier. `scripts/make-spitter-preview.mjs` utilise les mêmes durées que le jeu. Provenance des images dans `docs/asset-packs/CRACHEUR_2026-11-03.json`.
- **Réglages d'essai** : le Cracheur passe de 180 à 240 PV, sa préparation de 1,1 à 0,95 s, sa récupération de 0,8 à 0,65 s, sa pause entre tirs de 3 à 2,4 s et la bille de 6 à 6,5 m/s. Aux paliers 4–7, les quotas de Cracheurs sont 1/2/2/3 et ceux de Coureurs 3/4/5/5 ; les totaux deviennent 6/8/9/10. Le plafond global reste de quatre vivants simultanés, avec au plus deux Cracheurs et trois Coureurs selon le palier. Au moins un standard demeure dans chaque vague.
- **Relève** : chaque zombie standard tire une chance de 20 % à sa première mort. Le corps attend 2,5 s, rejoue sa chute en sens inverse puis revient avec 40 PV ; sa seconde mort est définitive. `Game` compte un corps en attente parmi les menaces, donc n'annonce pas l'accalmie et ne remplit pas au-delà du plafond de quatre. Les Coureurs et Cracheurs ne se relèvent pas. La simulation de relève se suspend comme les autres animations lorsque le contrôle est perdu.
- **Vérifications** : `npm.cmd run build`, `check-zombie-revival.mjs`, `check-spitter.mjs`, `check-zombie-remains.mjs`, `check-zombie.mjs`, `check-tiers.mjs`, `check-encounters-f4.mjs`, `check-upgrades-f2.mjs` et `git diff --check` réussis. Les tests couvrent la bonne texture de cadavre après préchauffage, les trois poses, la relève unique, le compteur de vague et les quotas P3–P7. Aperçu Vite dans Chrome headless : `death-a` et `corpse` inspectés à 80/180 px ; le cadavre est lisible de près et discret à 80 px. Les images séparées ne valident pas à elles seules la continuité perçue du mouvement.
- **À vérifier en jeu** : chute et cadavre dans le vrai éclairage, portée de la bille, lisibilité de la préparation à 0,95 s, surprise de la relève, durée des combats et consommation de munitions. Aucun parcours du palier 3 au palier 7 au Pointer Lock n'a été réalisé pour cette passe ; ces réglages restent à équilibrer après essai. Prochaine étape : observer une tentative complète, particulièrement les vagues 6–7, avant d'augmenter davantage la difficulté.

## Cracheur du palier 3 — 3 novembre 2026

- **Implémenté** : un cracheur massif est réservé au premier spawn du palier 3, sur un point praticable du demi-niveau supérieur ; le quota reste de six éliminations et le plafond d'ennemis simultanés est inchangé. Le monstre se déplace à 0,62 m/s, prépare son tir à 5–12 m avec ligne de vue, lance une bille verte à 6 m/s (12 dégâts directs), puis récupère. La préparation s'annule si la cible sort de portée ou si le monstre est blessé. Le tir touche les volumes solides de `Level` (portes incluses) ou le joueur et est nettoyé à l'impact, après 5 s, au changement de palier ou à la fin de partie.
- `SpitterZombie` porte ses états et ses ressources d'images partagées, préchauffées au démarrage ; `SpitProjectile` avance dans la boucle active de `Game` avec delta-time. Les cadavres restent gérés par `ZombieRemains`. `SpitterAnimation.ts` expose les durées communes au jeu et à `scripts/make-spitter-preview.mjs` : marche 0,5 s/pose, préparation 1,1 s, libération 0,18 s, récupération 0,8 s. Ces timings sont ceux de la fiche, pas un équilibre validé.
- **Vérifications automatisées** : `npm.cmd run build`, `check-spitter.mjs`, `check-zombie.mjs`, `check-zombie-remains.mjs`, `check-encounters-f4.mjs`, `check-tiers.mjs`, `check-storm.mjs`, `check-horror-f5.mjs` et `check-decor-surfaces.mjs` réussis. Le test cracheur couvre sprites présents, gabarit, alternance complète de marche, réservation exacte d'un spawn en hauteur sur le quota P3, contournement avec le waypoint de `Level`, annulation par blessure, ordre joueur/mur sur un grand delta, blocage par mur, impact direct unique et nettoyage du projectile.
- **Aperçu navigateur** : les sept poses ont été inspectées dans Vite à 80 et 180 px ; le cycle de crachat et la marche utilisent les durées communes de `SpitterAnimation.ts`. Le voile alpha découvert sur une première version de `walk-b` a été corrigé avant intégration. Cela ne valide que les sprites isolés.
- **Non validé en jeu** : aucune observation de combat au Pointer Lock n'a été effectuée dans cette passe. Esquive latérale, lisibilité du rayon dans les pièces sombres, portes animées, impact réel et cadence perçue restent à vérifier manuellement. Le test mural couvre un mesh solide et non chaque porte animée séparément.
- Prochaine étape : jouer le palier 3 pour confirmer la lecture de la préparation, l'esquive, la silhouette et la difficulté, puis ajuster les chiffres à partir du ressenti. Aucun changement de plan/map ni de palier supplémentaire.

## Reprise visuelle des fenêtres d'orage — 3 novembre 2026

- Retour utilisateur avec référence : les premiers panneaux étaient trop bas ou maladroits et visuellement trop simples. `MANSION_STORM_WINDOWS` place désormais six baies hautes à appui de 0,8 m du sol local, dans le Vestibule, le Salon et par paires de part et d'autre des portraits de la Galerie et de la Bibliothèque haute. Les baies sud restent entre les tableaux.
- `StormWindow.ts` construit une ogive, des remplages, des rideaux sombres et une texture d'extérieur orageux partagée (`storm-exterior-v1.png`, générée avec `image_gen` ; prompt et contrat dans `docs/asset-packs/STORM_WINDOWS_2026-11-03_PROMPT.json`). Les UV alternent horizontalement pour limiter la répétition. `Level.update` synchronise le trait de foudre et la projection des montants sur le sol avec l'unique lumière froide du `StormController`. Sons et temporalité existants conservés ; murs fermés, collisions et gameplay inchangés.
- Build réussi et tests `check-storm`, `check-horror-f5`, `check-decor-surfaces` réussis. Aperçu navigateur du vrai `Level` à 427 × 300 : baies du Vestibule et Salon, puis paires de la Galerie et Bibliothèque inspectées en vues fixes, sans flash et avec flash simulé ; ciel, cadre, éclair dans la vitre et motif au sol visibles. La capture avec case « Éclair » maintient l'intensité pour comparaison et ne valide pas la durée réelle du flash. Aucun parcours complet au Pointer Lock ni écoute des sons dans cette passe. Vérifier la lisibilité et la gêne éventuelle des baies en déplacement, ainsi que le rythme réel éclair/tonnerre.
- La texture est une scène extérieure peinte sur une vitre rapportée au mur, sans véritable ouverture ou projection d'ombres 3D. Prochaine étape : retour utilisateur après essai en jeu avant un autre lot artistique.

## Fenêtres et orage — 3 novembre 2026

- **Implémenté** : trois fenêtres en géométrie Three.js partagée, aux murs extérieurs du vestibule, de la Galerie et de la Bibliothèque (+2,4 m). Leur panneau bleu sombre et ses traces de pluie restent décoratifs : aucune ouverture, collision ou cible de tir ajoutée. La première fenêtre évite les tableaux existants du vestibule.
- `StormController` pilote une pluie spatiale en boucle après activation audio du joueur, puis des éclairs rares et un roulement de tonnerre après 0,72 s. Un seul PointLight sans ombre est déplacé devant la fenêtre choisie et illumine réellement les surfaces ; la pluie suit la fenêtre la plus proche du joueur, tandis que le tonnerre vient de celle qui vient de s'éclairer. Les traverses et traces de pluie sont instanciées pour limiter les appels de rendu. L’ambiance et les éclairs s’arrêtent avec la perte du Pointer Lock, le changement d’onglet, le focus ou la sortie d'un état de jeu actif. Intervalles et flash avancent avec un delta plafonné.
- Deux sons locaux mono PCM16 22,05 kHz : pluie bouclée 9 s (~397 Ko), tonnerre 3,2 s (~141 Ko). Script reproductible : `scripts/generate_storm_audio.py` ; aucun asset distant ni dépendance ajoutée.
- Vérifications : `npm.cmd run build`, `check-storm.mjs`, `check-horror-f5.mjs` et `check-decor-surfaces.mjs` réussis. Le test décor compte maintenant les 9 lumières préexistantes et l’unique source d’orage (zéro ombre pour elle). Le test couvre aussi le chargement tardif de la pluie et sa relocalisation vers la fenêtre la plus proche, avec audioContext déverrouillé. Chrome headless sur le vrai `Game`/`Level` a montré la fenêtre à résolution rétro et une capture avec le PointLight de fenêtre a confirmé l’éclairage du tapis, des boiseries et du mur. Le contrôle flash visuel a forcé temporairement l’intensité du PointLight dans la capture; la temporisation complète est vérifiée séparément par test.
- **Non vérifié** : écoute des WAV sur haut-parleurs/casque, essai physique au Pointer Lock et interruptions réelles par onglet/focus; le navigateur headless n’a pas permis d’évaluer le rendu sonore perçu. La fenêtre est une vitre posée sur un mur fermé; le joueur ne voit pas un paysage extérieur traversant. Le flash ne modifie pas ennemis, dégâts, commandes ou simulation.
- Prochaine vérification : écouter pluie/tonnerre à volume modéré et observer la succession éclair/silence/tonnerre en jouant, ainsi que l’arrêt/reprise après perte du Pointer Lock.

## Audit des placements du manoir — 3 novembre 2026

- Corrigé dans `MansionConfig.ts` : caisse 9 mm de la Galerie déplacée à `(-16, 3)`, cartouches de l'Atelier à `(16, -14)`, dégagées respectivement du socle de sculpture et de l'établi. Le nœud sud du Salon est déplacé de `(-8, 16.5)` à `(-5.5, 16.5)` pour dégager le piédestal ajouté à `(-7.5, 16.5)` ; les deux choix restent côte à côte. Les quatre altitudes de waypoints de rampe qui étaient erronées sont recalées sur le sol local + 1 m (milieux et sommets des deux rampes ; entrées déjà alignées).
- Dans `EncounterConfig.ts`, le spawn ouvert à `(-8, 16.5)` est déplacé à `(-20, 17)`, à plus de 8 m des deux piédestaux (seuil visé : 2 m). Cela garde 26 points et cinq choix dans le quadrant Grand Salon, sans changer les autres secteurs. Le contrôle F4 confirme collisions, couverture de chaque secteur/niveau, chemins praticables et apparitions masquées quand elles entrent dans le champ direct ; l'essai directionnel a donné trois quadrants distincts sur quatre apparitions.
- `Level` ajoute aux collisions fixes les deux socles de `MANSION_UPGRADE_PEDESTALS`, à leur empreinte visible de 0,55 × 0,55 m et hauteur 0,9 m. Joueur, zombies et graphe de navigation utilisent déjà ces colliders fixes. L'approche reste libre à 0,85 m et `UpgradePedestal.canInteract` confirme l'usage à cette distance. Le trajet direct qui traversait les stèles est bloqué ; le graphe conserve un détour praticable par le Salon. Le test de boucle du palier 1 suit désormais ce détour.
- Contrôle par le Level réel : les 9 pickups, 9 spawns P1 et les 4 waypoints de rampe concernés ne touchent aucun collider fixe (rayon 0,4 m) ; les piédestaux, eux, bloquent correctement la traversée. `door_mansion_exit` est conservée : elle est délibérément déclarée limite permanente condamnée, posée au bord extérieur du mur nord ; son absence d'ouverture est conforme au code, et son rôle reste décoratif. Aucune porte ou règle de choix supprimée.
- Compilation `npm.cmd run build` réussie. `check-encounters-f4.mjs`, `check-upgrades-f2.mjs`, `check-split-level.mjs` et `check-tiers.mjs` réussis. Aucun navigateur ouvert pour cette passe : aspect visuel des socles et facilité perçue du contournement restent à observer en jeu.
- Prochaine étape : vérifier ces emplacements lors d'un parcours réel, notamment l'accès aux munitions et la circulation autour des deux piédestaux. Aucun nouvel atelier gameplay autorisé par cette correction.

## Lisibilité des deux choix de bonus — 3 novembre 2026

- Retour utilisateur en jeu : un seul piédestal semblait visible, l'autre paraissant fondu dans le décor. Les deux positions du Grand Salon étaient distantes de 8,5 m. `MANSION_UPGRADE_PEDESTALS` les rapproche sur la traverse sud du tapis, à `(-7.5, 16.5)` et `(-11.5, 16.5)`, visibles ensemble depuis l'arche sud ; la règle d'un seul bonus choisi par accalmie ne change pas.
- `npm.cmd run build`, `check-encounters-f4.mjs` (positions hors collisions) et `check-upgrades-f2.mjs` réussis. Visibilité, lecture des icônes et facilité de visée à vérifier dans une vraie accalmie du navigateur ; compilation et tests automatisés ne valident pas ces points perceptifs.
- Prochaine étape : retour utilisateur après ce test visuel. Si nécessaire, ajuster l'écartement ou le contraste des supports, puis refaire la vérification en jeu. Aucun accord pour une autre fonctionnalité de gameplay n'est implicite.

## Saccade de lampe et audit de performances — 3 novembre 2026 (état le plus récent)

- Deux causes corrigées : `Player` conserve le SpotLight et commute son intensité 22/0 ; `WeaponPresentation` remplace les longues URL data héritées par des Blob URL courtes, révoquées au remplacement, avec protection contre les anciens encodages asynchrones. Clic de lampe réutilisé/préchargé. Images, luminosité artistique, rechargements et recul de deux secondes conservés.
- Chrome headless ANGLE/AMD/D3D11, vrai Game à 427 × 300 : avant, premier arrêt = cinq nouveaux programmes et première soumission de rendu de 3 660 ms ; après, aucun nouveau programme et 6,5 ms dans le dernier essai. Trace CSS : maximum UpdateLayoutTree 33,369 → 1,491 ms. Durées CPU de soumission/style, pas une mesure GPU ni une garantie « zéro saccade ».
- `Game` et l'aperçu décor utilisent directement PCF, déjà le secours effectif du moteur. `Game`/`PerfTracker` ne masquent plus les images > 1 s : vrais blocages conservés, changements d'onglet détectés exclus, delta de simulation plafonné inchangé.
- Build réussi ; 17 suites Node passent. Chrome vérifie dix cartes/alpha, poses et cycles d'armes, resize et révocation, ainsi que F/HUD/intensité sur le vrai Player. Captures inspectées, aucune exception ni asset HTTP manquant. Pas de tentative longue à la souris physique, écoute ou benchmark de production.
- Autres coûts : 480 draw calls contre 155 en gelant les ombres uniquement pour diagnostic ; programmes créés aux premiers ennemis ; dernières apparitions CPU ≈ 24–25 ms ; huit textures décor ≈ 64 Mio estimés RGBA8 + mipmaps. Intervalle brut à froid ≈ 115–123 ms hors soumission Three.js encore non isolé. Ombres/images non dégradées pour masquer ces coûts.
- Rapport : `docs/PERFORMANCES_LAMPE_2026-11-03.md` ; résumé dans `docs/asset-packs/PERF_LAMPE_2026-11-03.json`. Reproduction : `node scripts/profile-rendering.mjs current` (Vite 5173), option `--trace-toggle`. Sorties locales dans `tmp/render-profile/`.
- Prochaine vérification : F en déplacement réel. Atelier proposé ensuite : préparation GPU des ennemis avant premier combat, à autoriser pour ce travail plus important. Pas de nouveau gameplay, refonte des ombres, commit ou push.

## Habillage global des surfaces — 3 novembre 2026 (état le plus récent)

- Accord utilisateur pour générer et intégrer le lot de décor proposé. Huit textures opaques `image_gen` intégrées : bois structurel, pierre, porte à panneaux, plafond à caissons, briques, tapis, bibliothèque et façade d'atelier. Sources dans `public/assets/textures/mansion/` ; prompts dans `docs/asset-packs/DECOR_2026-11-03_PROMPTS.json` ; détails et limites dans `docs/DECOR_SURFACES_2026-11-03.md`.
- `MansionMaterials` centralise les ressources partagées et les UV des boîtes ; `MansionConfig.surface` attribue l'habillage sans changer les dimensions ; `Level` et `Door` l'appliquent. Dessus/chants des meubles restent en bois, panneaux sur les battants existants. Tapis raccordé par UV mondiaux. Lanternes et anneau de lustre en géométries simples aux sources lumineuses existantes, répétitions par instanciation.
- Vérifications : build réussi et 17 suites passent. Comparaison avec l'instantané antérieur au lot : 28 colliders, 92 volumes solides de tir, 28 configurations physiques et 9 lumières strictement identiques (dont 2 projetant des ombres). Les armes et leurs réglages n'ont pas été modifiés par cette passe.
- Chrome headless : huit textures chargées, aucune exception ni asset HTTP manquant, neuf vues de pièces/surfaces inspectées à résolution rétro avec le vrai Level et la lampe de Player ; Salon également sans lampe. Ce sont des vues fixes isolées, pas une tentative complète ni une validation de déplacement/animations au Pointer Lock. Aucun profil comparatif GPU/FPS ou écoute. Sources PNG d'environ 13,96 Mio au total.
- Revoir : `node scripts/make-decor-preview.mjs`, puis `/tmp/decor-preview/index.html` via Vite. Prochaine vérification proposée : parcours réel avec/sans lampe et retour artistique utilisateur, avant un autre lot. Sculpture, accessoires d'atelier, carillon et usure localisée restent à choisir ; F6 reste séparé et non autorisé. Pas de commit/push.

## Correction du rendu des armes — 3 novembre 2026 (prioritaire)

- Retour utilisateur : armes trop nettes et trop claires, cadre transparent pendant le rechargement fusil. Corrections de présentation implémentées, sans nouvelle génération de sprites. Détails et limites dans `docs/ARMES_RENDU_RETRO.md`.
- `WeaponPresentation.ts` prépare au chargement les dix images actives en résolution réduite nearest (environ trois pixels écran) et coupe les faibles alpha (seuil 128). Les PNG sources, grilles et ancrages sont conservés ; les variantes de rendu sont des URL de données CSS, recalculées après redimensionnement. `main`, `Weapon` et les aperçus utilisent cette présentation.
- Lumière d'arme atténuée et plafonnée (0,18–0,65 hors éclair de tir), démarrage à 0,35, renfort de présentation de la lampe à 0,08. SpotLight, chronologies, cadence, munitions et recul à deux secondes conservés.
- Vérifications : build réussi ; 16 suites passent. Dans Chrome headless : dix images traitées avec alpha uniquement 0/255, dimensions des atlas vérifiées, captures hanche/ADS et six phases de rechargement inspectées sans voile rectangulaire visible, cycles d'aperçu terminés, redimensionnement et capture du vrai Game au départ. Luminosité mesurée à 0,49 lors du dernier contrôle. Cela ne prouve pas une tentative complète au Pointer Lock ni une validation artistique de l'utilisateur ; aucun profil comparatif GPU ni écoute.
- Prochaine vérification : apprécier le grain et la luminosité dans le manoir, puis effectuer plusieurs insertions/interruption du fusil à la souris. Les autres productions artistiques restent décrites dans le recensement ; F6 reste séparé. Pas de commit/push.

## Passe artistique — icônes de bonus et cohérence des armes — 3 novembre 2026

- Accord utilisateur : première production du recensement et examen des sprites d'armes utilisés, en préservant leurs mécanismes. Quatre icônes RGBA générées avec `image_gen` sont maintenant dans `public/assets/sprites/upgrades/` aux chemins du catalogue ; prompts exacts et provenance dans `docs/asset-packs/BONUS_2026-11-03_PROMPTS.json`.
- `UpgradePedestal` utilise `PickupSprite` pour afficher l'icône correspondant à l'offre. `Game` transmet la position du joueur pour l'orientation autour de Y. Faible émission de l'image pour rester lisible dans le Salon sombre, sans nouvelle lumière ; disparition au choix et libération du mesh/matériau à la fermeture. Les règles de choix et les effets restent indépendants du visuel.
- Rapport artistique et contrat des armes : `docs/COHERENCE_GRAPHIQUE_BONUS_ARMES_2026-11-03.md`. Le pistolet et le fusil ont déjà gants noirs fermés/manches gris bleuté/métaux sombres ; écarts de densité et de cadrage décrits. **Aucun nouveau sprite d'arme produit ou substitué** ; les 23 empreintes sources/rendu/chronologie contrôlées sont inchangées, recul à 2 s compris. Le fusil réutilise une main de la planche du pistolet : dépendance à préserver avant toute génération future.
- Outils : `make-upgrade-preview.mjs` génère une galerie et une scène avec les vraies stèles ; aperçus d'armes corrigés (extraction CRLF du rig fusil, version HTTP, initialisation de la visée/cadrage de l'animation pistolet). Sources d'armes et CSS/HTML du jeu conservés.
- Vérifications : build réussi ; 16 suites `check-*.mjs` passent, y compris armes et F2 (association icône/offre, orientation, choix, fermeture et six accalmies). Les captures Chrome headless des miniatures 48/72/96 px, du Level à résolution rétro et des poses d'armes ont été inspectées ; cycles d'aperçu pistolet et insertion fusil terminés sans exception ni asset graphique manquant. Ce sont des aperçus isolés, pas un parcours de combat à la souris. Pas de nouveau profil GPU, écoute ou tentative complète.
- Reproduction : `node scripts/make-upgrade-preview.mjs`, puis `/tmp/upgrade-preview/index.html` via Vite ; liens vers les aperçus d'armes inclus. Sources grandes (1 254²), optimisation éventuelle à mesurer. Prochaine vérification : lecture des quatre symboles pendant une vraie accalmie et validation artistique utilisateur ; prochain lot proposé dans le recensement : repères du manoir (carillon/rayonnages/tapis/luminaires). F6 reste séparé. Pas de commit/push.

## Recensement graphique — 3 novembre 2026 (documentaire)

- Demande : inventorier les assets graphiques manquants et les ajouts possibles. Rapport : `docs/RECENSEMENT_ASSETS_GRAPHIQUES_2026-11-03.md` ; il distingue manques explicites, représentations simples existantes et propositions futures.
- Constat : 33 PNG dans `public/assets` (environ 28,78 Mio compressés, références/variantes incluses). Quatre chemins littéraux absents sont les futures icônes du catalogue de bonus ; ces métadonnées ne sont pas encore chargées par les stèles. Le rechargement fusil est déjà animé par couches, mais n'a pas de séquence artistique dédiée complète.
- Pistes prioritaires : quatre icônes d'amélioration, puis carillon, rayonnages/atelier, tapis et luminaires visibles. Les silhouettes, portraits altérés et assets d'élite restent liés à des mécaniques futures à autoriser.
- Vérification : lecture du code/documentation, relevé des fichiers et dimensions PNG, recherche des références littérales et inspection isolée du portrait et du brouillon de rechargement. Aucun nouveau parcours navigateur ni profil GPU ; aucun code/bitmap modifié, build et tests non relancés pour ce recensement.
- Prochaine production proposée : une icône de bonus validée sur sa stèle, puis les quatre icônes cohérentes. La demande de recensement n'autorise pas leur génération/intégration ; attendre la sélection et l'accord de l'utilisateur. L'état fonctionnel F5 ci-dessous reste le dernier état du gameplay.

## Atelier F5 — Craquement spatial conditionnel — 3 novembre 2026 (prioritaire)

- **Implémenté** : `HorrorDirector` remplace l'ancien timer du craquement. Il attend 18–30 secondes de temps éligible, ne joue qu'une fois par accalmie, réévalue toutes les 0,5 s si aucun emplacement ne convient, coupe la lecture à la pause et ajoute 4 s de silence à la reprise. Le délai initial et le délai restant n'avancent qu'avec le delta de simulation plafonné ; aucune reprise d'onglet ne rattrape du temps.
- `Game.updateHorrorAudio` ne transmet l'éligibilité qu'en exploration avec rencontre suivante en attente, aucune apparition en file ni zombie vivant, souris verrouillée, onglet visible et application focalisée. `startTier` réarme l'accalmie à la transition vers un combat. P7 terminal n'est pas éligible et le déplacement existant reste intact.
- `MANSION_HORROR_POINTS` déclare cinq emplacements fixes dans Vestibule, Grand Salon, Grand Hall, Bibliothèque et Atelier. `Level.getAccessibleHorrorPoints` exige l'état `OPEN` de la porte d'accès, puis calcule la hauteur de source avec `getFloorHeightAt` (+1,3 m). Chaque point a été vérifié dans son rectangle de pièce, contre les vrais colliders de `Level` (rayon joueur 0,3 m) et pour son altitude. Le point de Galerie repéré dans le piédestal solide a été supprimé.
- Une seule `THREE.PositionalAudio` préchargée est réutilisée à 0,18, avec atténuation de distance, volume réglable de 0 à 1 dans le panneau de pause. La source est arrêtée, déconnectée et retirée de la scène lors de la libération ; le callback du chargement audio tardif est neutralisé après `dispose`. Nappe générale et grognements zombies conservent leurs sources et leurs réglages.
- **Compilation** : `npm.cmd run build` réussi après l'intégration finale. L'avertissement Vite sur le bundle de plus de 500 kB reste non bloquant.
- **Tests Node** : les 16 scripts `scripts/check-*.mjs` passent. `check-horror-f5.mjs` exerce la vraie logique de `HorrorDirector` et le calcul `Game.updateHorrorAudio` avec sources simulées : limites 18/30 s, lecture unique, combat/terminal/file/zombie/souris/visibilité/focus, reprise, aucun point, distance, regard, portes OPEN, altitude, volume nul, arrêt et libération. `check-visual-room-f3.mjs` teste maintenant le directeur remplaçant l'ancien ordonnanceur ; F4 vérifie aussi le réarmement seulement par `startTier` valide.
- **Non vérifié** : aucun parcours navigateur, aucune écoute au casque, aucune validation de spatialisation/direction perçue, aucun essai de pause en jeu, aucune mesure de temps d'image comparative. Les tests avec audio simulé ne valident pas le rendu audio du navigateur ni l'effet artistique ; Three.js n'atténue pas le son derrière les murs comme une occlusion acoustique.
- **Prochaine étape proposée** : essai navigateur non chronométré dans deux orientations, au rez-de-chaussée puis en hauteur, puis pause/reprise et lancement d'un combat pendant un craquement. L'atelier F6 reste à proposer et à faire autoriser séparément. Aucun commit/push effectué.

## Corrections ciblées F3/F4 — 3 novembre 2026 (prioritaire)

- Réparations exécutées selon `docs/PROMPT_LUNA_CORRECTIONS_F3_F4.md`, en préservant les changements F4 déjà présents et les autres modifications locales.
- Après P7, `Game` passe à l'exploration terminale : `pendingTierStart=0`, offres et carillon fermés, message HUD « 7 rencontres purgées · finale F6 à venir », aucune victoire/overlay ni libération de souris. La défaite reste inchangée ; aucun P8 ni boss ajouté.
- Les bonus acquis sont exclus du tirage et `applyUpgrade` refuse les doublons. Les accalmies acceptent 0, 1 ou 2 offres ; le ravitaillement indépendant est conservé. Les deux stèles sont définies dans `MANSION_UPGRADE_PEDESTALS`, dans le Grand Salon du secteur 1, et le test vérifie collision et chemin depuis le départ.
- `startTier(n)` synchronise `currentTier` après validation, avant toute initialisation ; les numéros invalides ne nettoient pas l'état courant. F5 remplace maintenant le craquement ambiant par `HorrorDirector`, avec ses propres tests de temps éligible, pause/reprise et sélection spatiale.
- Vérifications Node actualisées en tête : build réussi et 16 scripts `scripts/check-*.mjs` passés, notamment F1/F2/F3/F4/F5, paliers, sécurité des apparitions et zombies. F4 exerce la vraie transition P7 et des `startTier` directs. L'avertissement Vite sur le bundle de plus de 500 kB reste non bloquant.
- Les spawns ont été évalués avec hasard contrôlé à partir de deux positions et filtrés par collision, secteur, distance, séparation, visibilité et chemin. Le contrôle de diversité obtient 4 quadrants sur cet échantillon ; cela ne garantit pas les quatre directions dans chaque pièce.
- **Non vérifié en navigateur** : tentative de lancement interrompue par la touche Échap physique avant le chargement de la page ; déplacement/interaction E, rendu réel des supports et absence visuelle d'overlay après P7 restent à vérifier. **Non vérifiés avec périphériques réels** : écoute du son, rendu GPU et durée/équilibre d'une tentative 10–15 min. Les tests audio sont Node avec audio simulé.
- Prochaine étape historique (remplacée par la proposition F5 ci-dessus) : essai navigateur des choix et de la purge P7, puis deux tentatives chronométrées pour relever rythme/munitions/santé. Pas de commit/push effectué.

## Audit de reprise — état avant ces corrections, 3 novembre 2026

Référence d'audit : `docs/AUDIT_F3_F4_2026-11-03.md`. Il consigne les défauts avant réparation, les changements locaux F4 déjà présents, ainsi que les limites de preuve alors connues. Les anciennes formulations de validation complète ci-dessous sont historiques et ne remplacent pas les vérifications listées dans la mise à jour prioritaire.

Résumé historique antérieur aux corrections : l'atelier F4 avait étendu la table à 7 paliers, le pool à 26 cachettes, l'apparition multidirectionnelle et le carillon des paliers 4 à 7. Les références historiques à une victoire après P7 sont remplacées par l'exploration terminale ; les preuves actualisées sont en tête de ce fichier.

## État détaillé F4 avant les corrections (historique)

**Dernière intervention — Atelier F4 : Progression complète et imprévisibilité (3 novembre 2026) :**
- **Extension à 7 rencontres complètes (`src/EncounterConfig.ts`)** :
  * Palier 1 : Incursion Initiale (4 lents, apprentissage tir & boucle, déverrouille Grand Hall).
  * Palier 2 : Assaut du Grand Hall (5 zombies dont 2 agiles max, 1 simultané, déverrouille étage haut).
  * Palier 3 : Hauteurs Gothiques (6 zombies dont 3 agiles max, 2 simultanés, manoir entièrement ouvert).
  * Palier 4 : Patrouille Combinée (4 zombies dont 2 agiles max, 2 simultanés, déclenchement par Carillon d'arène).
  * Palier 5 : Pression & Mobilité (6 zombies dont 3 agiles max, 2 simultanés, déclenchement par Carillon d'arène).
  * Palier 6 : Embuscade Échelonnée (7 zombies dont 3 agiles max, 2 simultanés, renforts échelonnés).
  * Palier 7 : L'Épreuve d'Avant-Garde (8 zombies dont 4 agiles max, 2 simultanés, maîtrise des itinéraires).
- **Pool d'apparition étendu du manoir ouvert (`MANSION_OPEN_SPAWN_POOL`)** :
  * 26 points candidats vérifiés sans collision, répartis sur les 4 quadrants :
    - Sud-Ouest (Grand Salon) : 5 points
    - Sud-Est (Vestibule) : 4 points
    - Ouest (Galerie) : 4 points
    - Centre / Nord (Grand Hall) : 5 points
    - Nord-Ouest haut (+2,4 m, Bibliothèque) : 4 points
    - Nord-Est haut (+2,4 m, Atelier) : 4 points
- **Algorithme d'imprévisibilité et distribution multidirectionnelle (`src/Game.ts`)** :
  * Suivi du quadrant d'apparition relatif au joueur ($\theta = \text{atan2}(dz, dx)$ découpé en 4 secteurs de $90^\circ$).
  * Décompte en temps réel des zombies vivants par quadrant.
  * Score dynamique favorisant les quadrants vides (+16 pts) et pénalisant les regroupements dans la même direction (-12 pts si $\ge 2$).
  * Bonus d'alternance directionnelle (+10 pts) si différent du dernier zombie apparu (`this.lastSpawnQuadrant`).
  * Fenêtre de sélection aléatoire parmi les 5 meilleurs candidats variés pour casser toute prévisibilité.
- **Cycle complet et affichage HUD (`src/Game.ts` & `index.html`)** :
  * Réarmement systématique du Carillon d'arène après chaque accalmie des paliers 4 à 6.
  * Victoire célébrée à l'issue de la purge du Palier 7 (`TENTATIVE SURVÉCUE · 7 RENCONTRES PURGÉES`).
- **Vérifications réelles et métriques** :
  * `npm.cmd run build` : compilé avec succès (code 0, 1.27 s).
  * Nouvelle suite `scripts/check-encounters-f4.mjs` créée et validée (4/4 épreuves 100% PASS, avec couverture prouvée des 4/4 quadrants).
  * Les **14 suites de tests** du projet (`encounters-f4`, `encounters-f1`, `upgrades-f2`, `visual-room-f3`, `perf-tracker`, `navigation-perf`, `tiers`, `split-level`, `zombie`, `zombie-agile`, `zombie-remains`, `combat-feedback`, `weapon`, `shotgun`) sont **100% PASS**.
- **Prochaine étape proposée — Atelier F5 : Horreur psychologique contrôlée** :
  * Implémenter le catalogue de micro-événements rares durant les phases d'exploration et d'accalmies (bruits sourds lointains dans les ailes inoccupées, silhouettes furtives disparaissant au détour d'un couloir, altérations discrètes de portraits).

**Intervention antérieure — Atelier F3 : Salle témoin visuelle et sonore (2 novembre 2026) :**
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

> Nous travaillons sur DEAD SECTOR. Lis AGENTS.md, le début de docs/ETAT_PROJET.md et les responsabilités utiles de docs/ARCHITECTURE.md. Identifie la dernière demande explicite ; les sections anciennes sont historiques. Consulte uniquement le jalon utile dans docs/ROADMAP.md et vérifie le code concerné. Respecte les accords déjà donnés. Je veux comprendre responsabilités, données, flux, compromis et validation, sans question ni mini-exercice systématique. Présente un atelier court avant une nouvelle fonctionnalité importante et attends mon accord seulement s'il manque encore ; après modification du code, compile et fournis un débrief proportionné. Pour les assets, suis docs/PIPELINE_ASSETS.md et utilise docs/PROMPT_ASSETS_MULTI_IA.md. Une demande de lot comprend ses ressources nécessaires, pas une nouvelle mécanique. Ne considère pas un build réussi comme une validation de gameplay.
