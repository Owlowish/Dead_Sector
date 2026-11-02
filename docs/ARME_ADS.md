# Pistolet moderne 2D et visée ADS

Note de reprise : les sections ci-dessous décrivent la première implémentation. Depuis le 2 novembre 2026, la culasse est animée par couches et le rechargement utilise une arme fixe ; voir `ARME_COUCHES.md` pour l'état actuel et ses limites.

## Comportement
Clic gauche : tir ; clic droit maintenu : visée. Transition de 0,18 s ; champ de vision de 75 à 58 degrés, sensibilité souris réduite de 25 % en visée. Relâcher le clic droit revient à la vue normale. Perte de Pointer Lock, blur ou fin de partie annulent la visée. La portée, les dégâts, les munitions et la cadence existants sont conservés.

Weapon possède l'entrée et la progression de visée ; Game transmet cette progression à Player.setAimAmount. Player met à jour la projection et la sensibilité. Les deux perspectives de sprite sont superposées avec une transition d'opacité. Le réticule s'efface en visée. Le rayon part toujours du centre de la caméra.

## Images et animation
Assets créés avec imagegen intégré et copiés dans public/assets/weapons :
- modern_hip.png : perspective à la hanche.
- modern_ads.png : perspective arrière centrée.

Anciens assets conservés. Proportions carrées préservées ; pas de spritesheet étirée. La position du guidon de l'image ADS est estimée à 50 % / 43,8 % de l'image, utilisée comme ancrage au centre de l'écran au repos. L'alignement perceptuel doit être vérifié en jeu. Le recul déplace ce point pendant le tir.

Une variante dessinée avec la culasse en arrière a été refusée par le système de génération d'images (violence). Cette variante n'a pas été retentée. L'animation intégrée utilise donc déplacement, rotation et flash séparé, sans animation mécanique de culasse. Ne pas présenter cette limitation comme une spritesheet de tir complète.

Recul conservé à 2 s selon le réglage utilisateur ; impulsion courte puis amortissement. Les images ont un style pixel art mais une résolution source élevée ; le filtrage CSS préserve les pixels, sans créer à lui seul une grille basse résolution supplémentaire. Les sprites HTML ne reçoivent pas les lumières du monde 3D.

## Lisibilité du niveau
Level utilise désormais un remplissage ambiant neutre 0xc0c4ce / 0,85 plutôt que le bleu très sombre 0x182030 / 0,45. Brume réduite de 0,045 à 0,025 et couleur relevée à 0x20242b. Ombres, éclairage des bougies et clair de lune conservés.

## Validation

Correction suite à capture utilisateur : la largeur ADS n'est plus plafonnée à 640 px. Le sprite carré mesure 96vh, avec le même ancrage du guidon à 43,8 %. Son bord inférieur se trouve à 50 % + (100 % - 43,8 %) × 96 % = 103,952 % de la hauteur d'écran, hors recul : les manches se prolongent donc sous le bord inférieur. Le sprite est plus grand en visée, sans déformation. Le cadrage doit être confirmé en jeu après correction.

npm.cmd run build réussi.
node scripts/check-weapon.mjs réussi avec Node 26 (import TypeScript natif). Ce contrôle emploie un DOM simulé et vérifie ADS, transition, FOV, rayon central, tir, cooldown et annulation après blur/pause/fin. Il ne valide ni les vrais événements Pointer Lock ni le rendu navigateur.
Pas de validation visuelle navigateur lors de cette intervention.

Essais manuels : lumière dans chaque salle ; position et taille du pistolet ; maintenir clic droit et tirer ; relâcher ; Échap pendant la visée ; changer de fenêtre ; viser après reprise ; changer la taille de fenêtre ; tirer à vide ; finir la partie en visant.

## Prompts retenus (mode intégré)
### Vue à la hanche
Use case: stylized-concept. Single game asset: modern semiautomatic 9mm pistol FPS hip-fire sprite, square canvas, genuinely transparent background. Hand drawn 2D pixel art, chunky visible square pixels and restrained 24-color palette, 1990s Doom-style sprite, not photorealistic or smooth 3D render. Compact squared slide in worn charcoal steel, muted dark polymer grip, black fabric glove and dark cuff, no logos. Seen FROM BEHIND by player, strongly foreshortened barrel pointing away toward upper-left. Muzzle front sight at image (25%,22%), rear slide at (58%,53%), gloved firing hand at (67%,77%), sleeve extends through bottom-right edge. Whole pistol inside image, no side profile, no revolver, no flash, no smoke, no bullet. One hand, neutral REST pose. Soft neutral lighting so details read in dark environment, no ornate gold or wood. Transparent outside weapon, crisp alpha edges, no cast shadow, no grid, no caption. Usable video game sprite, same width and height.

### Vue centrée
Use case: stylized-concept. ONE neutral resting inventory/game viewmodel asset for a retro first-person game: rear-facing view of a modern compact dark gray semiautomatic pistol with black fabric gloves and dark sleeve. Camera directly centered behind the rear sight, symmetrical 2D pixel art, strongly foreshortened, viewed along top. Three small ivory sight markings aligned in a horizontal row at x=45%,50%,55% and y=24% of square image; rear notch and small front sight centered on vertical axis. Gun body extends straight down from the sight line into gloved hands at lower center, sleeves exit bottom edge. Entire upper area above sight line transparent. Resting, stationary pose, no action, no flash, no smoke, no ammunition, no person visible beyond gloved hands. Muted gray steel and charcoal polymer, hand-painted chunky pixels, about 24-color palette, no smooth 3D render. Transparent background, square canvas, centered composition. No labels, no logos, no frame. This is the centered sight-view counterpart of a hip-view asset.
