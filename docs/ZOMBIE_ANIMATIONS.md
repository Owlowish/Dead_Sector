# Zombie — marche et attaque animées

Intervention du 2 novembre 2026, approuvée par l'utilisateur à partir du zombie initial.

## Livrables
Images créées avec imagegen intégré, référence : public/assets/zombies/zombie_idle.png.
- public/assets/zombies/zombie_walk_v2.png : six poses, grille de trois colonnes et deux lignes.
- public/assets/zombies/zombie_attack.png : quatre poses, une ligne.
Le sprite initial et l'ancienne marche sont conservés.

Les images ont été inspectées, puis les zones de lecture réglées pour rapprocher leur échelle et leur ligne de sol. Le découpage est appliqué par les coordonnées UV au rendu, sans retouche des PNG. Les images générées ne sont pas des modèles rigides : de petites variations de pose et de proportions restent à juger pendant le mouvement.

## Logique et présentation
ZombieAnimation.ts décrit les grilles, la cadence et les durées. Le jeu et l'aperçu partagent ces données.
- Marche : boucle à six images, 0,14 s par pose, seulement si le zombie se déplace réellement. Repos sinon.
- Préparation : deux premières poses, durée totale inchangée de 0,6 s.
- Coup : troisième pose au moment où les dégâts sont transmis à Game, une seule fois.
- Récupération : fin de la troisième pose puis quatrième pose ; état RECOVER durant 0,32 s au total après le coup. Reprise des décisions ensuite.
- La sortie de portée, un mur ou la mort annulent le coup avant son déclenchement. Après les dégâts, la récupération continue même si le joueur s'éloigne : elle ne peut pas infliger un deuxième coup.
- L'attaque a priorité visuelle sur la marche. Le flash rouge de blessure et la teinte de préparation sont conservés.
- Les matériaux d'ombre directionnelle ET ponctuelle partagent la texture animée avec le matériau visible. Leurs silhouettes suivent donc les UV du même atlas.
- Chaque instance conserve ses propres textures et compteurs ; dispose libère aussi textures et matériaux d'ombre.

## Vérification
Build et scripts/check-zombie.mjs réussis. Les tests sans WebGL vérifient : sélection de la marche, seconde ligne de l'atlas, correspondance des ombres, absence de dégâts pendant la préparation, pose du coup, coup unique, récupération, annulation par distance/mur/mort et indépendance des instances.

scripts/make-zombie-preview.mjs crée tmp/zombie-preview/index.html (marche en boucle et bouton pour une attaque, avec lecture lente) ainsi que poses.html (planche fixe). Les cadrages ont été capturés et inspectés dans Chrome headless. Pas de validation complète du combat dans le navigateur pendant cette intervention.

À observer en jeu : continuité repos/marche, pieds au sol, lisibilité de l'attaque dans l'obscurité, disparition du coup lorsque le joueur esquive et comportement de plusieurs zombies. Les hitboxes et la navigation n'ont pas été modifiées. Une seule orientation du personnage, tournée vers le joueur, est conservée.

## Prompts exacts — mode intégré
### Marche
Use case: stylized-concept. Game asset: a WALK CYCLE sprite atlas based on reference image 1 (character identity and pixel art style). Same fictional undead character, same torn off-white shirt, dark pants, dark boots, pale face, hair, body proportions and muted palette. Create SIX clearly different sequential walking poses in exact 3 columns x 2 rows, no gutters or labels. Overall portrait aspect ratio 3:4; each cell has width:height 1:2. Every cell is the same canvas, same character scale and front three-quarter camera as reference; head near y=5%, soles on y=95%, body centered x=50%. Frames read left to right top row then bottom: left step forward, left planted/right passing, right toe passing, right step forward, right planted/left passing, left toe passing. Opposing arm swing and torso lean visibly change, preserve the character rather than six copies of idle. Small vertical bob only, feet stay on one ground line, no changes of costume or face, no added limbs. Strict 2D hand-painted retro FPS pixel art, crisp clustered pixels, no smooth 3D render, limited neutral palette. Entire figure and limbs inside each cell, generous transparent left/right margins. NO ground shadow, NO ground plane, NO text, NO frame, NO scene, NO grid lines. Genuine transparent background with alpha.

### Attaque
Use case: stylized-concept. Game asset: FOUR-frame melee swipe animation atlas for the fictional retro zombie character in reference image 1. Preserve identity, pixel art style, torn off-white shirt, dark trousers, dark boots, face and hair. EXACT layout one horizontal row, 4 equally sized portrait cells width:height1:2, overall image aspect2:1. Front three-quarter view identical in every pose, same scale, top of head near y5%, boot soles y95%, body centered x50%. Read left to right: 1 anticipation leaning back with right forearm beginning to rise; 2 arm raised to shoulder/head height preparing one swipe; 3 arm thrust/swipe FORWARD TOWARD THE VIEWER, strongly foreshortened, readable silhouette but within cell; 4 arm lowering and torso returning to initial posture. One action only, no victim, no weapon, no effects, no added gore, no new wounds. Clear pose changes, same body proportions in all four frames. Each character including hands must fit WITHIN middle 80 percent of cell width, transparent margins on both sides, no limb crossing cell boundaries. No ground shadow or scenery, no text, no labels, no gridlines. Genuine transparent alpha. 2D clustered pixel art, not photorealistic, same muted palette as reference.
