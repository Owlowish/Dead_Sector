# DEAD SECTOR — État courant

Mis à jour le 6 novembre 2026. Branche `perf-assets-chargement` : travaux locaux sauvegardés dans `5dc4288`, fusion de `origin/main` (`5a65ff3`) réalisée et contrôlée. Consulter Git pour l'historique.

## Demande courante

Version du 5 novembre réintégrée : composition des six pièces, lambris, reliefs, feu et retours audiovisuels. HUD UI1–UI3, impacts par surface, Gardien au palier 8, bilan volontaire et nouvelle tentative conservés. Invocations debug signalées au bilan ; agrippement effacé aux resets ; sons bois/pierre soumis au mix et au nettoyage.

UI4–UI6 et G1–G4 restent des propositions dans `ROADMAP.md`, avec conception gameplay et boss dans `ORIENTATION_JEU.md`. `AGENTS.md` fixe l'autonomie, les contrôles et l'entretien documentaire.

## Fonctionnalités présentes

- Manoir de 48 × 40 m, six pièces, demi-niveau à +2,4 m, rampes et portes. Ouverture progressive puis réutilisation de toute la carte.
- Huit rencontres dans le code local : quotas 4/5/6/8/10/12/14/6 ; plafonds actifs 3/4/4/5/6/7/8/4, limités aussi par le budget global de huit. P8 introduit le Gardien, élite utilisant les sprites standards, avec préparation et récupération distinctes.
- Apparitions différées et cadencées sur des points sûrs : collision, secteur, distance minimale, regard et chemin vérifiés. Les points proches sont privilégiés ; alerte des vivants vers le joueur toutes les 0,75 s.
- Standard, Coureur, Cracheur et Rampeuse. Le Cracheur réserve un Coureur d'escorte et lance une bille non guidée à 9 m/s. Deux Rampeuses par rencontre P4–P7 : poursuite saccadée, lampe furie/fuite, esquive en fuite et saisie ralentissante. Plafond accessible par debug seulement ; aucun spawn normal au plafond.
- Pistolet et fusil à pompe : ADS, dispersion, recul, douilles, rechargement, impacts, sons mécaniques discrets et balancement lié au déplacement réel. Recul utilisateur de deux secondes conservé.
- Tir hitscan, masque alpha partagé et zones de tête par pose. Weapon calcule tête/corps : 80/28 au pistolet, 24/12 par plomb au fusil ; la Rampeuse ajoute un multiplicateur tête de 1,5.
- Standard/Coureur : une relève possible à 40 PV (20 % / 12 %) si l'impact fatal ne contient pas de tir tête. Une relève en attente compte comme menace ; corps conservés jusqu'au palier suivant.
- Drops de munitions dans un budget borné par palier : premiers lots garantis tôt, distribution ensuite partiellement aléatoire avec rattrapage, aucun drop au-delà du budget. Les lots persistent au changement de palier. Soins et fusil ramassables conservés ; caisses fixes et piédestaux non instanciés.
- Après la dernière menace définitive : accès ouverts puis dix secondes d'accalmie libre. Décompte suspendu hors contrôle ; combat suivant automatique.
- Après P8 : victoire, déplacement conservé et bilan volontaire par B. Bilan : durée active, paliers, tirs, impacts tête/corps, dégâts et marqueur debug ; nouvelle tentative sans rechargement de page. Code d'améliorations et carillon présents mais inactifs dans la boucle courante.
- Six pièces recomposées : point focal et mur calme, douze panneaux et six portraits épais, mobilier et accessoires en relief ; lambris au sol local, papier sans étirement. Feu animé et poussières bornées, sans lumière ou ombre supplémentaire pour ces lots.
- Éclairage chaud/froid du Salon, orage répercuté sur l'arme DOM et traitement rétro. Mix Ambiance/Effets/Musique/Craquement avec fondus et sauvegarde locale ; voix spatialisées et pas discrets bois/tapis/escalier liés à la distance réelle.
- Menu debug K : choix issu des configurations P1–P8, pause, restauration position/vie, nettoyage de la rencontre ; équipement et munitions conservés. Reprise au clic.
- Diagnostics de temps d'image et de rencontre : `PerfTracker`, `TierDiagnostics` et outils `window.__DEAD_SECTOR_*` décrits dans l'architecture.
- HUD victorien : vie/jauge segmentée/lampe, chargeur et réserve hiérarchisés, sélection d'arme, états critiques et rechargement. Progression X/N, menaces incluant file/relèves, jauge d'accalmie, annonces d'accès et finale, réussite avec B. Invites action/objet ; gains réels fusionnés, au plus deux, pendant 2,2 secondes actives. Présentation dans `GameHud` ; ramassages suspendus hors contrôle, y compris à la frame de mort.

## Assets et provenance

Lots du 5 novembre : atlas d'habillage et de lambris, textures du Salon, atlas feu (huit poses à 10 images/s). Sources, prompts exacts et transformations dans les manifestes `DECOR_MANOIR`, `COMPOSITION_LAMBRIS`, `SALON_SURFACES`, `MANOIR_RELIEF_AMBIANCE`, `FEU_CHEMINEE` et `ARMES_SONS_MOUVEMENT`, tous suffixés `_2026-11-05.json` dans `docs/asset-packs/`. Pas et manipulations synthétisés sur le contexte audio existant.

Impacts : deux WAV bois/pierre originaux de 16,8 ko au total ; métal existant réutilisé. Générateur reproductible `scripts/generate_surface_impacts.py`, provenance/mesures/SHA dans `docs/asset-packs/IMPACTS_SURFACES.json`. Aucun nouveau bitmap. Un son de décor maximum par détonation ; plafonds de 64 particules et 24 traces conservés.

Six PNG RGBA 512 × 512 dans `public/assets/zombies/crawler/`, femme quadrupède en chemise de nuit ivoire et cheveux noirs. Billboard carré de 1,6 × 1,6 m pour éviter l'étirement ; appui dessiné y=504 définissant l'offset au sol partagé avec l'aperçu.

Manifeste : `docs/asset-packs/RAMPEUSE_V2_2026-11-04.json`. Deux poses de reptation, une pose pour attaque/blessure/mort ; aucun volume 3D. Aperçu : `node scripts/make-crawler-preview.mjs`, puis `/tmp/crawler-preview/index.html` via Vite.

## Défauts et limites ouverts

- Le craquement reste soumis à un point accessible hors regard, au contrôle actif et au volume. Les quatre secondes de silence à la reprise sont conservées : une pause tardive peut laisser l'accalmie silencieuse, sans prolonger sa durée. Rendu audio et fréquence ressentie non vérifiés au casque.
- Aucun combat réel au Pointer Lock n'a validé les comportements de Rampeuse, ses ombres, les tirs tête ou la reprise après K. Préchauffage et destruction globale de ses ressources partagées à vérifier ; le plafond debug ne valide pas son intégration aux rencontres normales.
- Difficulté P4–P7 à huit menaces, durées, munitions et premier contact non établis par une tentative complète. Les anciennes éliminations simulées sans tirs ne démontrent pas une durée de 10–15 minutes.
- Finale, bilan et redémarrage testés logiquement ; bilan inspecté dans un scénario navigateur de victoire simulée. Aucun combat final joué : la capture de souris est refusée dans le navigateur intégré (`WrongDocumentError`). Durée complète et équilibre du Gardien restent à établir.
- Audit gameplay : chaque impact non fatal interrompt le Gardien ; la Rampeuse ne contrôle ni obstacle ni altitude à l'impact ; les collectes partielles perdent le reliquat ; une paire Cracheur/escorte bloquée empêche d'essayer les autres types. Défauts établis depuis les sources, effets en partie non observés.
- Mesures à fiabiliser avant calage : durées par palier incluant les pauses, tirs/plombs non séparés par arme, collectes de drops non comptées dans `recordAmmoBox`. Le temps total actif de tentative existe déjà. Conception et réglages proposés ne constituent pas un équilibrage validé.
- Visuel et audio réunis restent à observer/écouter en jeu : six pièces, feu, poussières, orage, pas, manipulations et mix avec indices d'attaque. Budgets de géométrie et de voix ne mesurent ni coût GPU ni confort sonore.
- UI4–UI6 restent à faire : accueil/pause distincts, aide complète, réglages visuels/contrôle persistants et présentation du bilan. Les quatre volumes audio sont déjà persistants. HUD inspecté sur captures de scénarios préparés ; lecture sous pression, ADS en combat et coût en temps d'image non établis par une partie réelle.
- Cinq scripts historiques ont des attentes périmées : `check-encounters-f1`, `check-shotgun-agile-assets`, `check-tasks-0-1-2`, `check-tasks-5-6` et `check-upgrades-f2`. Retrait de la collision orpheline du salon confirmé par F4 après fusion. Ne pas annoncer toute la suite verte sur les seuls tests ciblés.
- Avertissement Vite pour le bundle de plus de 500 ko ; avertissements Three.js « Texture marked for update but no image data found » observés au démarrage navigateur, sans erreur JS ni échec de chargement visible dans la vue initiale.

## Vérifications réellement effectuées

- **6 novembre, version fusionnée** : `npm.cmd run build` réussi et 26 scripts distincts verts : 16 sur décors/murs/feu/atmosphère/audio/pas/armes/impacts/horreur, puis Rampeuse, élite, cadavres, relèves, Cracheur, ressources de horde, HUD, finale/redémarrage, progression F4 et debug. Contrôles logiques/structurels avec DOM/audio simulés selon le script ; aucune suite historique complète annoncée. Références documentaires, JSON et `git diff --check` contrôlés.
- **Contrats croisés** : F4 exerce les huit rencontres et le vrai spawn P8 (six ennemis dont une élite, escorte incluse dans le plafond de quatre) ; victoire seulement après la file et toutes les menaces. Finale : bilan volontaire, contrôle conservé et deux redémarrages, agrippement compris. HUD : vrais transferts, recharge/interruption, pause/focus, file/relèves, frame de mort et resets. Fixture HUD adaptée au mix ajouté ; le mix est couvert séparément par les suites audio.
- **Observation du lot fusionné** : vue initiale via Vite dans le navigateur intégré, lambris, HUD et quatre réglages audio présents ensemble. Aucune erreur JS dans les logs, avertissements de textures au démarrage. Les six pièces, le feu animé, les nouveaux comportements et le son n'ont pas été validés par cette observation ; aucun combat complet joué ni écoute.
- **Observations UI antérieures à la fusion** : scénarios préparés de HUD critique/invite/accalmie/réussite inspectés, sans débordement géométrique à 1280 × 720, 1920 × 1080, 1024 × 768 et 2560 × 1080. K/P8, bilan B/Échap et retour P1 inspectés dans des harnais locaux. Pointer Lock intégré refusé (`WrongDocumentError`) ; ni recharge observée sous contrôle, ni combat, ni comparaison des performances établis.

## Prochaine priorité

Observer le décor et le HUD réunis en combat réel avant UI4–UI6. Côté gameplay : G1, puis G2 avec le nouveau HUD pour éprouver rythme et ressources ; G3 transforme ensuite l'élite en duel final. Validation jouée toujours ouverte : P4–P8, reprise après K, écoute du craquement/des impacts et tentative complète.

Autres travaux dans `ROADMAP.md`, direction dans `ORIENTATION_JEU.md`, responsabilités dans `ARCHITECTURE.md` et règles d'assets dans `PIPELINE_ASSETS.md`.
