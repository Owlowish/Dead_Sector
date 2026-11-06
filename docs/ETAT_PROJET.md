# DEAD SECTOR — État courant

Mis à jour le 6 novembre 2026. Base code : `88d13ad`, branche `perf-assets-chargement`, avec travail local sur horreur sonore, impacts et finale. Consulter Git pour l'historique.

## Demande courante

Travaux locaux partagés : impacts par surface, Gardien au palier 8, bilan volontaire et nouvelle tentative implémentés ; le lot UI1–UI3 ajoute le HUD et les retours de combat. Préserver les changements des chats parallèles.

Agent aussi autonome que possible : aucune pédagogie ni question systématique, décisions courantes prises seul, question réservée à un risque majeur pour le jeu. `AGENTS.md` définit ces règles et le nettoyage documentaire régulier.

Lot UI courant : UI1–UI3 implémentés et contrôlés ; UI4–UI6 restent dans `ROADMAP.md`. La conception gameplay/équilibrage/boss parallèle reste une proposition : valeurs dans `ORIENTATION_JEU.md`, ordre G1–G4 dans `ROADMAP.md`. Aucun réglage de combat ou nouvel asset ajouté par le lot UI.

## Fonctionnalités présentes

- Manoir de 48 × 40 m, six pièces, demi-niveau à +2,4 m, rampes et portes. Ouverture progressive puis réutilisation de toute la carte.
- Huit rencontres dans le code local : quotas 4/5/6/8/10/12/14/6 ; plafonds actifs 3/4/4/5/6/7/8/4, limités aussi par le budget global de huit. P8 introduit le Gardien, élite utilisant les sprites standards, avec préparation et récupération distinctes.
- Apparitions différées et cadencées sur des points sûrs : collision, secteur, distance minimale, regard et chemin vérifiés. Les points proches sont privilégiés ; alerte des vivants vers le joueur toutes les 0,75 s.
- Standard, Coureur, Cracheur et Rampeuse. Le Cracheur réserve un Coureur d'escorte et lance une bille non guidée à 9 m/s. Deux Rampeuses prévues par rencontre P4–P7.
- Pistolet et fusil à pompe : ADS, dispersion, recul, douilles, rechargement et retours d'impact. Recul utilisateur de deux secondes conservé.
- Tir hitscan, masque alpha partagé et zones de tête par pose. Weapon calcule tête/corps : 80/28 au pistolet, 24/12 par plomb au fusil ; la Rampeuse ajoute un multiplicateur tête de 1,5.
- Standard/Coureur : une relève possible à 40 PV (20 % / 12 %) si l'impact fatal ne contient pas de tir tête. Une relève en attente compte comme menace ; corps conservés jusqu'au palier suivant.
- Drops de munitions dans un budget borné par palier : premiers lots garantis tôt, distribution ensuite partiellement aléatoire avec rattrapage, aucun drop au-delà du budget. Les lots persistent au changement de palier. Soins et fusil ramassables conservés ; caisses fixes et piédestaux non instanciés.
- Après la dernière menace définitive : accès ouverts puis dix secondes d'accalmie libre. Décompte suspendu hors contrôle ; combat suivant automatique.
- Après P8 : victoire, déplacement conservé et bilan volontaire par B. Bilan : durée active, paliers, tirs, impacts tête/corps, dégâts et marqueur debug ; nouvelle tentative sans rechargement de page. Code d'améliorations et carillon présents mais inactifs dans la boucle courante.
- Éclairage et ombres, textures victoriennes, orage/fenêtres, musique et craquements réglables, grognements spatialisés. Traitement rétro de l'arme et de la scène.
- Menu debug K : choix issu des configurations P1–P8, pause, restauration position/vie, nettoyage de la rencontre ; équipement et munitions conservés. Reprise au clic.
- Diagnostics de temps d'image et de rencontre : `PerfTracker`, `TierDiagnostics` et outils `window.__DEAD_SECTOR_*` décrits dans l'architecture.
- HUD victorien : vie/jauge segmentée/lampe, chargeur et réserve hiérarchisés, sélection d'arme, états critiques et rechargement. Progression X/N, menaces incluant file/relèves, jauge d'accalmie, annonces d'accès et finale, réussite avec B. Invites action/objet ; gains réels fusionnés, au plus deux, pendant 2,2 secondes actives. Présentation dans `GameHud` ; ramassages suspendus hors contrôle, y compris à la frame de mort.

## Assets et provenance

Impacts : deux WAV bois/pierre originaux de 16,8 ko au total ; métal existant réutilisé. Générateur reproductible `scripts/generate_surface_impacts.py`, provenance/mesures/SHA dans `docs/asset-packs/IMPACTS_SURFACES.json`. Aucun nouveau bitmap. Un son de décor maximum par détonation ; plafonds de 64 particules et 24 traces conservés.

Six PNG RGBA 512 × 512 dans `public/assets/zombies/crawler/`, femme quadrupède en chemise de nuit ivoire et cheveux noirs. Billboard carré de 1,6 × 1,6 m pour éviter l'étirement ; appui dessiné y=504 définissant l'offset au sol partagé avec l'aperçu.

Manifeste : `docs/asset-packs/RAMPEUSE_V2_2026-11-04.json`. Deux poses de reptation, une pose pour attaque/blessure/mort ; aucun volume 3D. Aperçu : `node scripts/make-crawler-preview.mjs`, puis `/tmp/crawler-preview/index.html` via Vite.

## Défauts et limites ouverts

- Le craquement reste soumis à un point accessible hors regard, au contrôle actif et au volume. Les quatre secondes de silence à la reprise sont conservées : une pause tardive peut laisser l'accalmie silencieuse, sans prolonger sa durée. Rendu audio et fréquence ressentie non vérifiés au casque.
- Aucun combat réel au Pointer Lock n'a validé la Rampeuse corrigée, ses ombres, la facilité des tirs tête ou la reprise après K.
- Difficulté P4–P7 à huit menaces, durées, munitions et premier contact non établis par une tentative complète. Les anciennes éliminations simulées sans tirs ne démontrent pas une durée de 10–15 minutes.
- Finale, bilan et redémarrage testés logiquement ; bilan inspecté dans un scénario navigateur de victoire simulée. Aucun combat final joué : la capture de souris est refusée dans le navigateur intégré (`WrongDocumentError`). Durée complète et équilibre du Gardien restent à établir.
- Audit gameplay : chaque impact non fatal interrompt le Gardien ; la Rampeuse ne contrôle ni obstacle ni altitude à l'impact ; les collectes partielles perdent le reliquat ; une paire Cracheur/escorte bloquée empêche d'essayer les autres types. Défauts établis depuis les sources, effets en partie non observés.
- Mesures à fiabiliser avant calage : durées par palier incluant les pauses, tirs/plombs non séparés par arme, collectes de drops non comptées dans `recordAmmoBox`. Le temps total actif de tentative existe déjà. Conception et réglages proposés ne constituent pas un équilibrage validé.
- Impacts bois/pierre/métal différenciés dans le code local. Rendu des surfaces et équilibre sonore avec musique/indices d'attaque à observer et écouter en jeu.
- UI4–UI6 restent à faire : accueil/pause distincts, aide complète, réglages persistants et présentation du bilan. HUD inspecté sur captures de scénarios préparés ; lecture sous pression, ADS en combat et coût en temps d'image non établis par une partie réelle. Contrôle natif interrompu par Échap utilisateur ; aucune autre action navigateur après cet arrêt.
- Anciennes suites F1/F2/T5 encore attachées au carillon, aux piédestaux ou caisses fixes ; échec de vitesse agile isolé signalé précédemment. Ne pas annoncer toute la suite verte sur la base de tests ciblés.
- Avertissement Vite existant pour le bundle de plus de 500 ko, sans erreur de compilation.

## Vérifications réellement effectuées

- **6 novembre, intégration du backlog** : `npm.cmd run build` et 16 scripts ciblés réussis : impacts/armes, élite/finale/progression/debug, Rampeuse/cadavres/relèves/Cracheur, horreur/manoir/décors. Nouvelles suites : `check-impact-surfaces.mjs`, `check-final-elite.mjs`, `check-final-run.mjs`. F4 exerce le vrai spawn P8 (six ennemis dont une élite, escorte incluse dans le plafond de quatre) et l'attente de toute la file avant la victoire.
- **Cohérence** : pauses, munitions, masques, portes et resets vérifiés. Durée active réelle indépendante du delta de simulation plafonné, dégâts réellement perdus et échelle/ancrage du cadavre élite corrigés. Cadavres gelés pendant pause/bilan, reprise sous contrôle. L'ancien scénario supposant un menu automatique après la dernière élimination a été actualisé ; son assertion d'ancrage est conservée.
- **Navigateur intégré** : K affiche P1–P8 et le saut P8 fonctionne. Harnais local ignoré par Git `/tmp/backlog-review/index.html` : victoire simulée sans bilan automatique, ouverture B/bouton, fermeture Échap et retour P1 par Nouvelle tentative inspectés, sans erreur JS propre à ce scénario. Capture de souris refusée sur la page normale : aucun combat, aucune reprise physique ni écoute des nouveaux sons validés.
- **6 novembre, conception UI/gameplay en parallèle** : inspection des sources et relectures indépendantes du rythme, de l'économie et du boss ; calcul des compositions et budgets. `check-final-elite.mjs`, `check-final-run.mjs` et `check-horde-resources.mjs` réussis sur le prototype actuel, avec audio/DOM simulés selon le script. Références, formats et `git diff --check` contrôlés. Documentation seule, sans build ni nouvelle observation navigateur/partie jouée.
- **6 novembre, implémentation UI1–UI3** : `npm.cmd run build` puis `check-hud.mjs`, `check-encounters-f4.mjs`, `check-final-run.mjs`, `check-debug-menu.mjs` et `check-horror-f5.mjs` réussis. Le test HUD exerce vrais transferts de ressources, recharge cartouche/interruption, pause/focus, file/relèves, frame de mort et deux resets avec DOM/audio simulés. Harnais `/tmp/ui-review/` : aucun débordement géométrique à 1280 × 720, 1920 × 1080, 1024 × 768 et 2560 × 1080 ; captures HUD critique, invite, accalmie et réussite inspectées. Pointer Lock headless refusé (`WrongDocumentError`) ; capture de recharge sans contrôle non probante et avertissement de fermeture du harnais. Aucun combat joué ni mesure comparative de performances.

## Prochaine priorité

UI1–UI3 livrés ; valider leur lecture en combat réel avant UI4–UI6. Côté gameplay : G1, puis G2 avec le nouveau HUD pour éprouver rythme et ressources ; G3 transforme ensuite l'élite en duel final. Validation jouée toujours ouverte : P4–P8, reprise après K, écoute du craquement/des impacts et tentative complète.

Autres travaux dans `ROADMAP.md`, direction dans `ORIENTATION_JEU.md`, responsabilités dans `ARCHITECTURE.md` et règles d'assets dans `PIPELINE_ASSETS.md`.
