# DEAD SECTOR — État courant

Mis à jour le 6 novembre 2026. Branche `perf-assets-chargement` : gameplay G1–G3, HUD V2 et décors réunis, compilation et contrôles ciblés réussis avant envoi. Consulter Git pour l'historique.

## Demande courante

Lot courant : gameplay/équilibrage G1–G3 implémentés, avec introductions progressives, deux poussées en P6, ressources sans perte de reliquat et duel final à deux phases. Code compilé et contrôlé ; apparence du Gardien provisoire, difficulté et durée à mesurer en partie. Décors, Salon de Musique et HUD du travail parallèle conservés.

Lot UI parallèle livré : V2 compacte validée par l'utilisateur, cœur pixel art animé et textures du décor atténuées. Les travaux restants sont dans `ROADMAP.md`, la direction dans `ORIENTATION_JEU.md`. `AGENTS.md` fixe autonomie, contrôles et entretien documentaire.

## Fonctionnalités présentes

- Manoir de 48 × 40 m, six pièces, demi-niveau à +2,4 m, rampes et portes. Ouverture progressive puis réutilisation de toute la carte.
- Huit rencontres : quotas 4/5/6/8/10/12/14/1 ; plafonds actifs 3/3/4/4/5/6/7/1, sous la borne globale de huit. P3 introduit Coureurs/Cracheur après deux éliminations définitives, P4 la Rampeuse après deux ; P6 envoie deux groupes de six séparés par trois secondes actives.
- Apparitions différées et cadencées sur des points sûrs : collision, secteur, distance minimale, regard et chemin vérifiés. Les points proches sont privilégiés ; alerte des vivants vers le joueur toutes les 0,75 s.
- Standard, Coureur, Cracheur et Rampeuse. Le Cracheur réserve un Coureur d'escorte, lance une bille non guidée à 9 m/s et ne bloque plus les autres types si sa paire est impossible. Une Rampeuse P4–P5, deux P6–P7 : saccades, lampe furie/fuite, esquive et saisie conservées ; préparation de 0,35 s avec contrôle du volume bas, des sols et des obstacles. Plafond debug seulement.
- Pistolet et fusil à pompe : ADS, dispersion, recul, douilles, rechargement, impacts, sons mécaniques discrets et balancement lié au déplacement réel. Recul utilisateur de deux secondes conservé.
- Tir hitscan, masque alpha partagé et zones de tête par pose. Weapon calcule tête/corps : 80/28 au pistolet, 24/13 par plomb au fusil (104 pour huit plombs corps) ; la Rampeuse ajoute un multiplicateur tête de 1,5.
- Standard/Coureur : une relève possible à 40 PV (20 % / 12 %) si l'impact fatal ne contient pas de tir tête. Une relève en attente compte comme menace ; corps conservés jusqu'au palier suivant.
- Drops bornés par palier et par élimination définitive : pas de drop à la mort provisoire ni de double comptage. Premiers lots garantis, rattrapage, persistance entre paliers et reliquats conservés ; ramassage compatible avec les rampes. Soins et fusil conservés ; caisses fixes et piédestaux non instanciés.
- Après la dernière menace définitive : accès ouverts puis dix secondes d'accalmie libre. Décompte suspendu hors contrôle ; combat suivant automatique.
- Après P8 : victoire, déplacement conservé et bilan volontaire par B. Bilan : durée active, paliers, tirs, impacts tête/corps, dégâts et marqueur debug ; nouvelle tentative sans rechargement de page. Code d'améliorations et carillon présents mais inactifs dans la boucle courante.
- Gardien : duel de 800 PV, balayage et jet de clé non guidé, deux phases à 50 %, blessures non interruptives et récupération explicite au HUD. Trois lots de vingt balles sont préparés après P7, aussi en départ direct/debug P8 ; aucun ravitaillement recréé à la reprise. Sprites standards et signaux visuels temporaires, détails préservés par texture émissive ; aucun nouvel asset généré.
- Six pièces recomposées : point focal et mur calme, douze panneaux et six portraits épais, mobilier et accessoires en relief ; lambris au sol local, papier sans étirement. Feu animé et poussières bornées, sans lumière ou ombre supplémentaire pour ces lots.
- Salon de Musique : mobilier fusionné, clavier/cordes/couvercle/pédales et lustre à six bougies ; grande fenêtre devant l'arrivée, portrait déplacé et poussières rapprochées de la baie. Éclairage du vestibule réaffecté ; aucun nouveau bitmap chargé, aucune lumière ou ombre supplémentaire. Tapis partagé avec les pas ; poursuite corrigée lorsqu'un départ coïncide exactement avec un nœud.
- Cheminée : structure 3D fusionnée, ouverture en arche et fond de brique reculé, ornements éclairés et nouveau feu jaune-orange à huit poses/10 Hz. Le collider physique reste plein ; les tirs traversent les ajours jusqu'aux surfaces réelles. Aucun éclairage ni ombre projetée ajouté.
- Éclairage chaud/froid du Salon, orage répercuté sur l'arme DOM et traitement rétro. Mix Ambiance/Effets/Musique/Craquement avec fondus et sauvegarde locale ; voix spatialisées et pas discrets bois/tapis/escalier liés à la distance réelle.
- Menu debug K : choix issu des configurations P1–P8, pause, restauration position/vie, nettoyage de la rencontre ; équipement et munitions conservés. Reprise au clic.
- Diagnostics : durée de combat active hors pause/focus, tirs/impacts/gains par arme, stocks entrée/sortie et soins nets ; collectes partielles comptées comme collectes réussies. Rencontre courante incluse dans `__DEAD_SECTOR_DIAGNOSTICS()`. Premier contact = premier dégât donné/reçu. Temps d'image par `PerfTracker` ; outils décrits dans l'architecture.
- HUD V2 : blocs compacts, aplats mats/contours fins, PV/chargeur/réserve et lampe en pictogramme ; médaillons et cartouches redondantes retirés. Cœur natif de 32 px en quatre poses, cycle de 1,4 s avec repos de 1,16 s, gel hors contrôle et vie nulle. Mouvement réduit persistant/préférence système. Secteur affiché trois secondes actives par palier ; menaces, accalmie, annonces et gains fiables conservés.

## Assets et provenance

Salon de Musique : géométrie Three.js native et textures existantes réutilisées. Concept utilisateur conservé à l'identique ; inventaire, ancrages, transformations et budgets dans `docs/asset-packs/SALON_MUSIQUE_2026-11-06.json`. Aucun nouvel atlas ni son. Aperçu par `make-composition-preview` avec vues départ, deux arches, piano et console.

Cheminée : atlas de reliefs RGBA 512 × 512 (304 ko) et nouveau feu RGBA 512 × 256 (146 ko). Base et cycle sources conservés ; export du feu avec échelle commune 0,88 et racine visible ligne114, cadence inchangée. Exports reproductibles `scripts/export-hearth-reliefs.ps1` et `scripts/export-hearth-fire.ps1`. Prompts exacts ImageGen, provenance précédente, ancrages et mesures dans le manifeste existant `docs/asset-packs/FEU_CHEMINEE_2026-11-05.json`.

HUD V2 : atlas PNG RGBA 128 × 32 de 956 octets, quatre poses 32 × 32, six couleurs opaques et alpha binaire. Base/action imagegen conservées, export déterministe par `scripts/export-hud-heart.ps1`, chronologie commune dans `HeartAnimation.ts`, aperçu `node scripts/make-hud-preview.mjs`. Prompts, ancrages et provenance V1/V2 dans `docs/asset-packs/HUD_GOTHIQUE_2026-11-06.json`. Les grands médaillons V1 ne sont plus chargés. Détails murs/boiseries/tapis atténués au chargement ; PNG sources intacts.

Lots du 5 novembre : atlas d'habillage et de lambris, textures du Salon, atlas feu (huit poses à 10 images/s). Sources, prompts exacts et transformations dans les manifestes `DECOR_MANOIR`, `COMPOSITION_LAMBRIS`, `SALON_SURFACES`, `MANOIR_RELIEF_AMBIANCE`, `FEU_CHEMINEE` et `ARMES_SONS_MOUVEMENT`, tous suffixés `_2026-11-05.json` dans `docs/asset-packs/`. Pas et manipulations synthétisés sur le contexte audio existant.

Impacts : deux WAV bois/pierre originaux de 16,8 ko au total ; métal existant réutilisé. Générateur reproductible `scripts/generate_surface_impacts.py`, provenance/mesures/SHA dans `docs/asset-packs/IMPACTS_SURFACES.json`. Aucun nouveau bitmap. Un son de décor maximum par détonation ; plafonds de 64 particules et 24 traces conservés.

Six PNG RGBA 512 × 512 dans `public/assets/zombies/crawler/`, femme quadrupède en chemise de nuit ivoire et cheveux noirs. Billboard carré de 1,6 × 1,6 m pour éviter l'étirement ; appui dessiné y=504 définissant l'offset au sol partagé avec l'aperçu.

Manifeste : `docs/asset-packs/RAMPEUSE_V2_2026-11-04.json`. Deux poses de reptation, une pose pour attaque/blessure/mort ; aucun volume 3D. Aperçu : `node scripts/make-crawler-preview.mjs`, puis `/tmp/crawler-preview/index.html` via Vite.

## Défauts et limites ouverts

- Le craquement reste soumis à un point accessible hors regard, au contrôle actif et au volume. Les quatre secondes de silence à la reprise sont conservées : une pause tardive peut laisser l'accalmie silencieuse, sans prolonger sa durée. Rendu audio et fréquence ressentie non vérifiés au casque.
- Aucun combat réel au Pointer Lock n'a validé les comportements de Rampeuse, ses ombres, les tirs tête ou la reprise après K. Préchauffage et destruction globale de ses ressources partagées à vérifier ; le plafond debug ne valide pas son intégration aux rencontres normales.
- Difficulté des nouvelles compositions P4–P8, économie, premier échange et durée complète non établis par une tentative jouée. La cible de 10–15 minutes n'est pas prouvée par des éliminations simulées.
- Finale, bilan et redémarrage testés logiquement ; bilan inspecté dans un scénario navigateur de victoire simulée. Aucun combat final joué : la capture de souris est refusée dans le navigateur intégré (`WrongDocumentError`). Durée complète et équilibre du Gardien restent à établir.
- Le Gardien garde l'apparence d'un zombie standard et des signes de clé temporaires. Costume d'intendant et sons dédiés restent à produire après essai du duel ; les signaux visuels actuels ont été inspectés en scènes préparées, pas sous pression.
- Visuel et audio réunis restent à observer/écouter en combat : six pièces, poussières, orage, pas, manipulations et mix avec indices d'attaque. Nouveau feu inspecté dans la cheminée réelle par harnais navigateur ; fluidité perçue du raccord et confort en combat non établis. Budgets de géométrie et de voix ne mesurent ni coût GPU ni confort sonore.
- Salon de Musique observé hors combat : arrivée, piano de près, deux arches, console et vue initiale du jeu avec HUD. Aucun combat joué ni écoute après réaménagement ; coût GPU et confort du contournement sous pression non mesurés.
- UI4–UI6 restent à faire : accueil/pause distincts, aide complète, réglages visuels/contrôle persistants et présentation du bilan. Les quatre volumes audio sont déjà persistants. HUD inspecté sur captures de scénarios préparés ; lecture sous pression, ADS en combat et coût en temps d'image non établis par une partie réelle.
- Cinq scripts historiques ont des attentes périmées : `check-encounters-f1`, `check-shotgun-agile-assets`, `check-tasks-0-1-2`, `check-tasks-5-6` et `check-upgrades-f2`. Retrait de la collision orpheline du salon confirmé par F4 après fusion. Ne pas annoncer toute la suite verte sur les seuls tests ciblés.
- Avertissement Vite pour le bundle de plus de 500 ko ; avertissements Three.js « Texture marked for update but no image data found » observés au démarrage navigateur, sans erreur JS ni échec de chargement visible dans la vue initiale.

## Vérifications réellement effectuées

- **6 novembre, gameplay G1–G3** : `npm.cmd run build` et dix-huit contrôles ciblés réussis : `check-crawler`, `check-encounter-pacing`, `check-gameplay-flow`, `check-encounters-f4`, `check-horde-resources`, `check-gameplay-economy`, `check-guardian`, `check-final-run`, `check-debug-menu`, `check-hud`, `check-shotgun`, `check-weapon`, `check-combat-feedback`, `check-sprite-hit-mask`, `check-zombie-revival`, `check-zombie-remains`, `check-spitter`, `check-horror-f5`. Scripts `.mjs` sous `scripts/` ; attentes périmées corrigées puis contrôles concernés rejoués. Mort par projectile en milieu de file, nettoyage et dégâts tardifs couverts. Références et `git diff --check` contrôlés ; avertissement bundle >500 ko conservé.
- **Observation G1–G3** : K/P8 contrôlé dans le jeu ; Pointer Lock refusé (`WrongDocumentError`). Harnais temporaire `/tmp/gameplay-review/index.html` dans le vrai Level : préparations et clé en vol inspectées ; jauge, récupération, phase II et mort contrôlées dans le HUD. Formats 1280 × 720 et 1024 × 768, aucune erreur JS propre au harnais. Émissif uniforme corrigé après inspection pour conserver les détails du sprite. Pas de partie complète ni d'écoute ; durée, difficulté et performance sous pression non validées.

- **6 novembre, salon de musique** : build réussi ; `check-piano-room`, `check-room-composition`, `check-storm`, `check-decor-surfaces`, `check-mansion-audio`, `check-mansion-atmosphere`, `check-encounters-f4` et `check-salon-fireplace` réussis. Rayons clavier/couvercle et vide sous la caisse, libération, 18 points sûrs et six itinéraires atteints contrôlés. Rendu du Level et vue initiale du jeu inspectés dans le navigateur intégré, aucune erreur JS ; avertissements de textures au démarrage conservés. Compilation, logique et observation hors combat seulement.

- **6 novembre, cheminée et feu** : `check-hearth-fire`, `check-salon-fireplace` et `check-salon-surfaces` réussis ; sources, PNG, alpha, racines, pause, nettoyage et SHA256 vérifiés. Vues Face/Proche du vrai Level, normal/ralenti, comparaison ancien/nouveau sur fonds sombre/pierre : 16 textures reçues, aucune erreur JS. Plusieurs poses inspectées ; aucun combat joué. Compilation complète réussie par `npm.cmd run build -- --outDir tmp/hearth-build`, sortie isolée pour éviter la concurrence sur `dist`. Le lot de géométrie précédent avait aussi passé F3, décors/mobilier et F4. Avertissement bundle >500 ko conservé.

- **Contrats croisés** : F4 exerce les huit rencontres, la finale et la victoire seulement après la file et toutes les menaces. Finale : bilan volontaire, contrôle conservé et deux redémarrages, agrippement compris. HUD : vrais transferts, recharge/interruption, pause/focus, file/relèves, frame de mort et resets. Fixture HUD adaptée au mix ajouté ; le mix est couvert séparément par les suites audio.
- **6 novembre, HUD V2** : build et `check-hud`, `check-final-run`, F4 réussis ; cœur/secteur, pause/focus/vie nulle/mouvement réduit, transferts et resets exercés sur vrais modules avec DOM/audio simulés. Contrôles des surfaces Salon/décor et proportions des lambris réussis. Aperçu navigateur : quatre poses, pause, sauvegarde du réglage et préférence système contrôlés ; aucun fichier manquant ni exception JS. Captures de scènes préparées normal/critique, hanche/ADS, accalmie et victoire inspectées à 1280 × 720 ; géométrie également contrôlée à 1920 × 1080, 1024 × 768 et 2560 × 1080. Aucun combat ni coût comparatif mesuré.

## Prochaine priorité

G4 : jouer la tentative avec les nouvelles compositions et le duel, comparer découverte et connaissance des circuits, relever stocks/dégâts/durée active. Observer décor et HUD réunis, écouter les indices et vérifier la reprise après K. Habillage dédié du Gardien après essai ; UI4–UI6 restent séparés. Aucun nouvel allongement d'attente ou de PV pour forcer la cible de durée.

Autres travaux dans `ROADMAP.md`, direction dans `ORIENTATION_JEU.md`, responsabilités dans `ARCHITECTURE.md` et règles d'assets dans `PIPELINE_ASSETS.md`.
