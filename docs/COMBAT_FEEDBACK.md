# DEAD SECTOR — Lisibilité du combat et précision

Intervention du 2 novembre 2026, approuvée par l'utilisateur : ramassages pixel art, réaction à une balle, impacts de décor, éclaboussures et précision hanche/ADS. Pas de refonte de l'arène dans cette intervention.

## Résultat observable

- Kit de soin ivoire/cuir et boîte de munitions olive/laiton, sprites transparents dans le monde. Léger flottement ; orientation verticale vers le joueur, sans rotation qui montrerait la tranche du plan. Quantités, rayon de ramassage de 1,2 et réapparition existants conservés.
- Zombie survivant à une balle : deux poses de blessure, arrêt de 0,2 seconde, puis reprise. Une attaque préparée est annulée ; une nouvelle préparation entière est obligatoire. La séparation entre voisins est aussi suspendue pendant l'arrêt. La blessure ne repousse pas physiquement le zombie à travers le décor.
- Touche sur un zombie : neuf petits éclats rouges transitoires au point touché. Pas de trace permanente sur son plan.
- Touche sur un solide : six éclats et une petite trace en contour pixelisé pendant cinq secondes. La trace suit un battant mobile. Pas de trace sur un tir sans intersection.
- Tir à la hanche : direction aléatoire dans un cône de demi-angle 2° ; ADS complet : direction centrale. Transition continue sur les 0,18 seconde de visée existantes. Les quatre branches du viseur indiquent le bord du cône projeté à l'écran.

## Fichiers et responsabilités

| Fichiers | Rôle |
| --- | --- |
| `src/PickupSprite.ts`, `Medkit.ts`, `AmmoBox.ts` | Fabrique de plans éclairés avec alpha, textures immuables partagées, flottement et orientation ; chaque ramassage conserve sa règle de consommation |
| `src/Zombie.ts`, `ZombieAnimation.ts` | Réaction de blessure, durée, sélection des deux cellules, interruption et arrêt du déplacement |
| `src/WeaponSpread.ts` | Angle, échantillonnage du cône et projection en pixels du viseur |
| `src/Weapon.ts` | Direction du rayon, première intersection, notification `setOnImpact`, recul déclenché après le calcul du tir, mise à jour du viseur |
| `src/HitEffects.ts` | Représentation temporaire des intersections : particules et marques, plafonds et nettoyage |
| `src/Game.ts` | Relie Weapon à HitEffects ; fournit la position du joueur aux billboards et met les effets à jour |
| `index.html`, `src/style.css` | Quatre branches et point central ; fondu existant pendant l'ADS |
| `public/assets/pickups/medkit.png`, `ammo.png` | Images générées avec alpha réel |
| `public/assets/zombies/zombie_hurt_v2.png` | Deux poses chargées par le jeu ; `zombie_hurt.png` conservé comme variante rejetée, débordement de main entre cellules |
| `scripts/check-combat-feedback.mjs`, `check-weapon.mjs`, `check-zombie.mjs` | Vérifications de logique et intersections Three.js sans rendu WebGL |
| `scripts/make-combat-preview.mjs` | Aperçu isolé des sprites à 40/64 px, poses et bouton pour une seule blessure ; utilise les mêmes données d'animation |

## Trois mécanismes à comprendre

### 1. Le viseur représente une probabilité

`spreadAngle(aimAmount)` donne le demi-angle du cône. `sampleShotDirection` choisit une direction uniformément dans son angle solide, puis Weapon la tourne dans le repère mondial de la caméra. Le rayon part toujours de la caméra ; ce n'est ni un projectile mobile ni un rayon émis par l'image du canon.

`spreadRadiusPixels` utilise `tan(angle) / tan(FOV_vertical / 2) × hauteur / 2`. À une hauteur de 900 px et un FOV de 75°, la hanche donne environ 20,5 px du centre au bord intérieur des branches. Le viseur et le rayon utilisent le même angle. Un affichage écarté seul ne change pas la précision. L'ADS continue de rétrécir le FOV de 75 à 58 ; la projection prend son FOV courant.

Pas de pénalité de déplacement ajoutée. Cadence, dégâts, portée et recul utilisateur de deux secondes conservés. Le recul de caméra se déclenche après le calcul de l'intersection : il prépare la visée suivante.

### 2. La blessure est une règle de simulation

`Zombie.takeDamage` diminue la santé. S'il survit, il initialise `hurtRemaining`, annule la préparation d'attaque, choisit la première pose et passe à IDLE. `Zombie.update` consomme le delta, affiche la pose appropriée et retourne avant poursuite, séparation et attaque. Après l'arrêt, les décisions ordinaires reprennent. Le sprite est un retour visuel d'une vraie interruption ; une simple teinte rouge n'aurait pas arrêté le déplacement.

Les textures visibles et les deux matériaux d'ombre changent ensemble, comme pour marche et attaque. Pas de nouvel état général de partie, ni d'IA refondue.

### 3. L'intersection relie simulation et représentation

`Weapon → onImpact({kind, object, point, normal, direction}) → Game → HitEffects.emit`. Séparément, `Weapon → onHit(mesh, damage) → Game.find → Zombie.takeDamage` garde les dégâts dans le système existant. L'effet reçoit le même premier contact que les dégâts, avant une éventuelle mort/fin de palier.

La normale d'une face est transformée par la matrice normale du mesh pour obtenir son orientation mondiale, même pour une porte tournée. La marque est décalée de 0,006 unité pour éviter le scintillement de surfaces superposées, puis attachée au solide en préservant sa pose mondiale. Elle suit ainsi la porte. Les particules restent indépendantes dans la scène.

## Budget et limites

- Au plus 64 particules et 24 marques. Au dépassement, l'effet le plus ancien est retiré et son matériau libéré. Deux géométries sont partagées ; pas de nouvelle texture à chaque balle. Les deux textures de ramassage sont partagées entre instances, sans mipmaps inutiles pour le filtre choisi.
- Particules : 0,22 à 0,38 seconde avec gravité visuelle, sans collision physique. Marques : cinq secondes, fondu final. Les effets sont suspendus quand la simulation est inactive ou la souris déverrouillée, y compris sur l'écran de fin.
- Billboards éclairés par `MeshStandardMaterial`, filtrage Nearest. Ce ne sont pas des objets volumétriques. Leur lumière dépend de l'orientation du plan ; les images contiennent déjà des ombres dessinées.
- Les marques sont de petits plans, pas des décalcomanies projetées qui épousent tous les angles : elles peuvent dépasser légèrement d'une arête. Éclats de décor génériques, sans distinction pierre/bois/métal dans cette étape.
- Le raycasting existant touche le rectangle du zombie, y compris ses pixels transparents. Cette approximation de hitbox n'est pas corrigée ici.
- L'asset généré reste une interprétation du zombie d'origine. La seconde version corrige un débordement entre cellules ; le raccord et le ressenti à vitesse réelle doivent encore être confirmés en jeu.

## Vérifications effectuées

- `npm.cmd run build` réussi ; avertissement Vite de taille de bundle > 500 ko toujours présent.
- `node scripts/check-weapon.mjs` : règles de tir/rechargement existantes, vraies intersections, obstacle devant cible, normale mondiale tournée, recul après rayon, absence d'effet pour tir refusé.
- `node scripts/check-zombie.mjs` : marche/attaque/ombres existantes, blessure en deux poses, immobilisation même avec voisin, reprise et nouvelle préparation entière.
- `node scripts/check-combat-feedback.mjs` : 4 000 échantillons dans le cône, ADS central, projection du bord sur le viseur, marques suivant une porte, plafonds, pause, expiration/nettoyage, ramassage/refus/réapparition.
- `node scripts/check-tiers.mjs` : les dix épreuves existantes passent au moment de cette intervention.
- Aperçu généré avec `node scripts/make-combat-preview.mjs`, ouvert dans Chrome headless et capture inspectée : transparence, petites tailles, cadrage des deux poses et branches du viseur. Capture : `tmp/combat-preview/preview.png`. Bouton disponible pour une blessure isolée et lecture lente ; aucun combat complet ni Pointer Lock testé dans le navigateur par l'assistant.

### Parcours à tester en jeu

1. Tirer plusieurs fois sur un mur à la hanche, puis en ADS : groupe dispersé, puis groupement centré. Maintenir le clic droit jusqu'à la fin de la transition.
2. Toucher un zombie en marche : deux poses, arrêt court, sang au contact, poursuite reprise. Le toucher juste avant son attaque : son ancien coup ne doit pas arriver après la blessure.
3. Tirer sur une porte puis l'ouvrir : trace solidaire du battant, disparition après cinq secondes simulées.
4. Comparer kit et munitions sous différentes lumières ; vérifier ramassage, refus à pleine santé/réserve et réapparition au palier suivant.

## Génération et reprise

Outil intégré imagegen, pas de CLI ni de dépendance ajoutée. Prompts exacts, références et noms sources dans `docs/COMBAT_ASSET_PROMPTS.json`. Les images utilisées sont copiées dans `public/assets` ; les originaux générés sont conservés. Les effets géométriques sont dessinés par Three.js, pas par une nouvelle image de sang par balle.

Prochaine action : retour utilisateur sur dispersion, durée de blessure et lisibilité en lumière réelle. Toute extension (dispersion de mouvement, autres armes, sang persistant ou nouvelle règle d'arène) reste à proposer et faire approuver séparément.
