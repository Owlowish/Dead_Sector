# Habillage du manoir — 3 novembre 2026

Demande autorisée : générer et intégrer le premier lot de surfaces décoratives proposé, en gardant les volumes et les mécanismes existants. Production réalisée avec l'outil intégré `image_gen`, en prenant le parquet et les murs v2 comme références. Prompts exacts et provenance : `asset-packs/DECOR_2026-11-03_PROMPTS.json`.

## Ce qui est intégré

Sources opaques dans `public/assets/textures/mansion/`, sans retouche des images générées :

| Fichier | Usage réel | Dimensions |
| --- | --- | --- |
| `wood-structure-v1.png` | Marches, poutres, boiseries de soutènement, encadrements, côtés des meubles | 1254 × 1254 |
| `stone-ashlar-v1.png` | Cheminée, deux colonnes du Hall, piédestal de Galerie | 1254 × 1254 |
| `door-panel-v1.png` | Faces des deux battants des portes ; ferrures existantes conservées | 887 × 1774 |
| `ceiling-coffer-v1.png` | Plafonds sud et nord, caissons bois/enduit vieilli | 1254 × 1254 |
| `hearth-brick-v1.png` | Fond de cheminée noirci | 1254 × 1254 |
| `carpet-damask-v1.png` | Trois segments du tapis du Salon, bordure géométrique existante conservée | 1254 × 1254 |
| `bookshelf-front-v1.png` | Deux rangées de bibliothèque, faces avant/arrière garnies | 1254 × 1254 |
| `workbench-front-v1.png` | Façade de meuble d'atelier à tiroirs et placards | 1448 × 1086 |

Des lanternes en petites géométries 3D et un anneau de lustre rendent visibles les éclairages déjà présents. Le Hall porte quatre lanternes autour de sa lumière centrale ; les six autres sources ont une lanterne chacune. La lanterne du Salon est décalée devant la cheminée pour éviter l'intersection avec le manteau. Les flammes sont fixes, sans nouveau cycle animé.

Le lot couvre les surfaces de A07/A08/A10–A16 du recensement, parfois partiellement. Il ne produit pas une sculpture A09, des chapiteaux, de nouveaux outils sur l'établi, des variantes de livres ou un feu texturé. Carillon A06, mobilier et événements visuels restent des propositions séparées.

## Responsabilités et choix

- `MansionConfig.surface` est une indication artistique optionnelle ; dimensions et positions restent les données physiques existantes.
- `MansionMaterials.ts` charge et partage textures/matériaux. Les images sont en espace couleur sRGB et passent par l'éclairage réel ; elles ne sont pas émissives. Le filtrage nearest et le rendu interne réduit gardent le caractère rétro.
- `Level` choisit l'habillage et construit les volumes. `Door` applique les panneaux au mesh de battant existant, sous les mêmes pivots. Ni `Weapon`, ni ses sources/chronologies, ni le déplacement ne sont modifiés par ce lot.
- Les **UV** donnent la position dans l'image : les blocs homogènes utilisent une densité par dimension réelle, généralement une tuile pour deux mètres. Les longues poutres ne reçoivent donc pas une seule image étirée.
- Les meubles et portes distinguent faces utiles et chants en bois : deux matériaux partagés, deux groupes de rendu, trois pour l'établi dont seule la face avant est dessinée. Les rayonnages répètent horizontalement une travée d'environ 1,75 m, sans répéter les étagères en hauteur. Les blocs homogènes gardent un seul matériau plutôt que six groupes.
- Les trois tapis utilisent les coordonnées mondiales X/Z pour leurs UV : un même point aux intersections lit le même motif, malgré des plans différents. La bordure existante n'est pas redessinée dans la texture.
- Les éléments répétés des lanternes sont des `InstancedMesh` : cinq lots partagés plus l'anneau. Ils ne rejoignent pas les colliders ou les meshes solides de tir et ne projettent pas d'ombres supplémentaires.

## Vérifications réellement effectuées

- `npm.cmd run build` réussi. Avertissement Vite habituel du bundle supérieur à 500 ko ; aucune nouvelle dépendance.
- Les 17 suites `scripts/check-*.mjs` passent. `check-decor-surfaces.mjs` contrôle les huit PNG utilisés, les façades de meubles, les UV raccordés du tapis, le partage des matériaux et le budget lumineux. F3 vérifie désormais les textures pierre/brique/tapis au lieu des anciennes couleurs unies.
- Instantanés Node du vrai `Level` avant/après : mêmes 28 boîtes de collision, mêmes 92 boîtes englobantes de meshes solides, mêmes 28 spécifications physiques et mêmes 9 lumières (positions, intensités initiales, drapeaux d'ombre). Les deux lumières projetant des ombres restent les mêmes. Résultats locaux dans `tmp/decor-pass/world-before.json` et `world-after.json`.
- Chrome headless : chargement des huit cartes, aucune exception JavaScript ni réponse HTTP d'asset manquant ; captures à résolution rétro avec le vrai `Level`, la caméra/lampe de `Player`, les ombres et l'exposition du jeu. Neuf vues : Salon, porte, Bibliothèque, Atelier, escaliers, Hall, lustre, plafond et tapis ; Salon également sans lampe. Les captures sont inspectées visuellement. L'aperçu ne simule pas une progression ou un combat.

Reproduire : `node scripts/make-decor-preview.mjs`, puis ouvrir `http://127.0.0.1:5173/tmp/decor-preview/index.html` avec Vite démarré. Le menu choisit les caméras fixes et la case permet de comparer avec/sans lampe. Les portes restent fermées ; certaines vues sont placées directement dans les zones hautes.

## Compromis et suite

Huit sources totalisent environ **13,96 Mio de PNG** ; ce n'est pas leur mémoire GPU. Le partage limite les doublons de chargement, mais ce lot ne fournit pas de mesure comparative de temps GPU ou de FPS sur la machine de jeu. Les objets conservent leurs silhouettes cubiques : texture et relief véritable sont deux choses différentes. La répétition des caissons/livres et les raccords des tuiles restent à apprécier en déplacement.

Aucune tentative complète, validation Pointer Lock, écoute ou validation artistique de l'utilisateur n'est déduite des captures. Prochaine étape proposée : parcourir le Salon et les escaliers puis examiner les rayonnages et l'établi avec/sans lampe ; relever les surfaces encore gênantes avant de choisir un prochain lot. Pas de nouveau jalon de gameplay autorisé par cette production.

Mini-exercice : dans `mansionBoxGeometry`, prévoir l'effet d'une modification de `tileSize`, puis l'essayer et regarder une poutre dans l'aperçu ; compiler ensuite. Question de compréhension : pourquoi cette modification peut-elle changer la taille apparente du veinage sans modifier le passage ou les collisions ?
