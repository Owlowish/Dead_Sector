# Cohérence graphique : bonus et armes — 3 novembre 2026

**Évolution après ce premier audit :** le retour utilisateur sur la netteté, la luminosité et le cadre transparent des armes a conduit à une correction de rendu dans `WeaponPresentation.ts`, le CSS et le pilotage lumineux. Voir `ARMES_RENDU_RETRO.md` pour l'état actuel. Les constats d'empreintes identiques ci-dessous décrivent la passe d'icônes antérieure ; les PNG et les chronologies restent conservés, tandis que la présentation a maintenant changé.

## Périmètre et résultat

L'utilisateur a validé la première production issue du recensement et demandé d'examiner les sprites d'armes utilisés, en conservant rechargements et autres mécanismes. Cette passe réalise les quatre icônes de bonus et leur affichage sur les stèles. Elle examine les armes et fixe leur contrat artistique/technique. Les autres objets du recensement seront traités par lots cohérents.

Les armes partagent déjà des choix visuels utilisables comme référence : gants noirs fermés, manches gris bleuté, acier sombre, petits reflets ivoire et contours sombres. Les différences à surveiller sont la densité de détail des dessins sources, la taille des contours à l'écran et les cadrages hanche/ADS/rechargement. Cette observation artistique ne justifie pas le remplacement immédiat de toutes leurs images. Aucun nouveau sprite d'arme n'a été généré ou activé pendant cette passe.

## Les quatre icônes produites et intégrées

| Bonus | Image dans `public/assets/sprites/upgrades/` | Repère visuel |
| --- | --- | --- |
| Cartouchière renforcée | `upgrade-ammo-pouch.png` | Pochette de cuir brun et fermoir en laiton |
| Canon ajusté | `upgrade-tight-choke.png` | Pièce filetée d'acier sombre et collier de laiton |
| Élixir de vitalité | `upgrade-vitality-vial.png` | Fiole d'apothicaire à liquide rouge, bouchon et étiquette sans texte |
| Bottes souples | `upgrade-light-boots.png` | Paire de bottes brunes, lacets et œillets métalliques |

Images générées avec **l'outil intégré image_gen**, à partir de la trousse de soin existante puis de la première cartouchière. Chaque image est un PNG RGBA de 1 254 × 1 254, avec alpha réel (valeurs 0–255). Aucun redimensionnement, détourage ou autre retouche bitmap externe. Prompts exacts et origine des quatre fichiers : `asset-packs/BONUS_2026-11-03_PROMPTS.json`.

Le contrat du lot : un objet centré par canevas, silhouettes distinctes, cuir/noix, laiton patiné, acier charbon, petites touches ivoire/rouge et pixels lisibles à petite taille. Les quatre icônes n'ont pas besoin d'avoir les mêmes couleurs dominantes : la fiole rouge reste un repère de santé et les métaux restent plus froids.

`UpgradePedestal.setOffer` crée un plan éclairé avec le même `PickupSprite` que les ramassables. `Game` lui transmet la position du joueur ; `update` oriente ce plan autour de Y pour éviter sa tranche, sans incliner tout le pupitre. Une faible émission par la texture maintient le symbole visible dans le Salon sans lampe ; aucune lumière n'est ajoutée. L'essai initial sans émission était trop sombre.

Le choix cache l'image ; `close` retire son mesh et libère géométrie/matériau. La texture reste dans le cache partagé de `PickupSprite`. On ne reconstruit pas la géométrie à chaque frame. Le texte et l'effet du bonus viennent toujours du même `UpgradeSpec` : l'image n'applique ni bonus ni départ de rencontre.

Les sources restent grandes pour des icônes : les quatre textures RGBA sans mipmaps représentent environ 24 Mio si elles sont toutes chargées, hors surcoûts. Ce n'est pas un profil GPU. Un atlas ou des versions de diffusion plus petites pourraient être évalués plus tard en conservant les sources.

## Quelles images les armes utilisent réellement

| Usage actuel | Sources actives | Contraintes à préserver |
| --- | --- | --- |
| Pistolet hanche, culasse, rechargement | `weapons/pistol_actions_v3.png` : atlas 1 254², grille 3 × 3 | La cellule de base fournit carcasse/main principale. Des régions précises fournissent culasse, main et chargeur ; les anciennes poses complètes ne sont pas alternées |
| Pistolet ADS | `weapons/modern_ads.png`, 1 254² | Cadrage et guidon centrés, masque de culasse et raccords des deux poignets |
| Fusil hanche | `weapons/shotgun/hip-rest-v2.png`, `hip-back-v2.png`, `hip-kick-v2.png`, chacun 1 254² | Même canevas, position de la bouche, emplacement des mains et bord inférieur ; repos/choc/pompe sont choisis par `ShotgunAnimation` |
| Fusil ADS | `weapons/shotgun/ads_pump_v2.png`, 1 774 × 887, et `ads-kick-v2.png`, 1 254² | Cellules repos/pompe et pose de recul, guidon, échelle et cadrage du bas des manches |
| Fusil rechargement | `weapons/shotgun/reload_draft.png` (1 448 × 1 086), une main de `pistol_actions_v3.png`, `live_shell.png` (1 774 × 887) | Arme fixe, port simplifié CSS, main réellement vide, cartouche séparée ; découpage et masquage d'insertion calibrés pour ces sources |
| Flash du fusil | `weapons/shotgun/flash.png`, 1 774 × 887 | Région de flash et ancrage de bouche propre aux poses |
| Flash du pistolet et métal découvert | Géométrie/gradients CSS | Pas de PNG manquant empêchant l'animation actuelle ; toute finition doit respecter ces pièces mobiles |

Les images `hip.png`, `ads.png`, `ads_v2.png`, `ads_pump.png` et les anciennes planches de pompe conservées ne constituent pas toutes des vues actives de l'arme dans le jeu. Les images de ramassage ont un autre rôle. Les douilles en jeu restent géométriques. Ne pas remplacer les chemins actifs en prenant simplement le premier fichier portant « ads » ou « hip ».

**Dépendance importante : le fusil réutilise une main de la planche du pistolet.** Redessiner cette planche complète ou déplacer ses cellules peut donc casser les deux rechargements, même sans changer une ligne de logique de munitions.

## Direction commune et contrat pour de futurs sprites d'armes

1. **Identité** : garder les gants fermés, les manches gris bleuté et les matériaux sombres. Les métaux peuvent être froids dans les armes et les éléments de décor plus chauds, sans changer la forme des mains entre actions.
2. **Densité visuelle** : comparer les pixels à la taille affichée, pas les PNG à 100 %. Une cellule de pistolet mesure environ 418² dans son atlas ; une pose de fusil occupe une image de 1 254². Leur résolution source identique ne garantirait pas un même rendu perçu.
3. **Invariants** : conserver canevas, perspective, échelle, appui des manches, ancrage de bouche/guidon, alpha et régions des calques. Les polygones de `style.css` sont les contraintes réelles. Un redessin libre déplacera probablement les contours ; il ne doit pas être substitué sans adapter et vérifier ses calques.
4. **Parties fixes et mobiles** : produire/valider les couches de carcasse, culasse ou pompe, main et chargeur/cartouche séparément. Une arme rigide ne doit pas changer de longueur ou de perspective à chaque pose.
5. **Phases conservées** : pistolet, approche vide → saisie → extraction → échange → présentation → insertion → encliquetage → retrait ; fusil, approche vide → présentation → alignement → insertion → encliquetage → retrait vide. Pas de chargeur ou cartouche dessinés dans une main censée être vide.
6. **Chronologie conservée** : pistolet 1,6 s ; fusil 0,65 s par cartouche avec transfert unique à 0,50 s ; éjection de pompe à 0,19 s ; recul général utilisateur de 2 s. Une nouvelle pose ne décide pas du transfert de munitions.
7. **Validation progressive** : candidat versionné → une base acceptée à la taille du jeu → un cycle isolé, normal puis lent → interruption et retour au repos → tests de simulation → comparaison dans le manoir. Suivre `PIPELINE_ASSETS.md` avant toute nouvelle génération animée. Les sources et chemins courants restent la référence tant que le candidat ne passe pas ces contrôles.

Ces règles visent la cohérence de représentation. Elles ne promettent pas qu'une génération IA conservera exactement les proportions et les ancrages : les écarts doivent être mesurés et corrigés dans un candidat avant activation.

## Aperçus et preuves

Commandes de reconstruction :

```text
node scripts/make-upgrade-preview.mjs
node scripts/make-weapon-preview.mjs
node scripts/make-shotgun-preview.mjs
```

Avec Vite lancé : `/tmp/upgrade-preview/index.html`, `/tmp/weapon-preview/index.html`, `/tmp/shotgun-preview/index.html`. Les fichiers de prévisualisation sont temporaires, reconstruits depuis les classes, le catalogue et les données d'animation courants. La scène des bonus en affiche quatre pour la comparaison ; le jeu conserve sa règle de zéro à deux offres.

L'aperçu fusil a été réparé pour normaliser les fins de ligne Windows avant extraction du rig, échouer explicitement si ce rig est introuvable et fournir une version HTTP en plus de `standalone.html`. L'aperçu pistolet initialise la visée et cadre son cycle afin de ne pas superposer ses perspectives dans la fenêtre d'animation. Ces corrections concernent les outils, pas le CSS du jeu.

Vérifications réalisées :

- `npm.cmd run build` réussi après les interventions sur le code ; avertissement Vite > 500 kB toujours présent.
- Les **16 scripts `check-*.mjs` passent**, notamment armes, fusil, F2/F3/F4/F5. F2 contrôle les fichiers d'icônes, l'association image/bonus, l'orientation, la disparition au choix et le remplacement/fermeture des visuels, en plus des effets et six accalmies existants.
- Comparaison SHA-256 de **23 fichiers** identiques avant/après : les 18 fichiers du dossier d'armes et `Weapon.ts`, `WeaponAnimation.ts`, `ShotgunAnimation.ts`, `style.css`, `index.html`. Relevé : `asset-packs/ARMES_BASELINE_2026-11-03.json`. Cela couvre leur état local au début de cette passe, y compris les modifications utilisateur déjà présentes.
- Chrome headless dans un profil séparé : douze miniatures (48/72/96 px) chargées, quatre vraies stèles dans `Level`, capture à résolution interne 320 × 240 puis agrandie, poses hanche/ADS/rechargement inspectées ; cycles d'aperçu pistolet et insertion fusil joués jusqu'à leur fin. Aucun asset demandé par ces aperçus en échec ni exception JavaScript ; une requête automatique de favicon `.ico` des pages temporaires est distincte des assets testés et du favicon SVG du jeu.
- Captures locales : `tmp/art-pass/bonus-gallery.png`, `bonus-scene.png`, `pistol-poses.png`, `shotgun-rest.png`, `shotgun-ads-kick.png`, `shotgun-reload.png`. Rapport d'automatisation : `tmp/art-pass/browser-check.json`.

Limites : les aperçus utilisent les vraies couches/données, mais pas toute la simulation de combat. Pas de nouvelle tentative jouée à la souris, d'écoute ou de mesure comparative de performance dans cette passe. Les petites formes sont identifiables sur les captures inspectées ; la validation artistique de l'utilisateur et leur lecture pendant une vraie accalmie restent à obtenir.

## Exercice

Dans une accalmie, contourner une stèle sans choisir, puis choisir son bonus : observer l'orientation de l'image et sa disparition. Essayer ensuite le cycle d'insertion dans l'aperçu du fusil à vitesse normale puis ralentie. Question : pourquoi une nouvelle image parfaitement transparente peut-elle quand même casser l'illusion du rechargement alors que le nombre de cartouches reste correct ?
