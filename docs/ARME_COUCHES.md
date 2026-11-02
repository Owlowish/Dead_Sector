# Arme 2D par éléments séparés — 2 novembre 2026

## Demande et décision

Correction suivante : la chronologie est partagée dans `src/WeaponAnimation.ts`. Le chargeur est masqué pendant l'approche/saisie et après insertion, indépendamment de la main. Cela évite de montrer une arrivée avec un chargeur avant d'avoir extrait l'ancien. L'aperçu propose maintenant une lecture unique à vitesse normale ; la méthode générale est décrite dans `PIPELINE_ASSETS.md`.

L'utilisateur a signalé des changements de perspective pendant le rechargement et demandé une culasse mobile à la hanche comme en ADS. L'approche par éléments séparés a été approuvée.

La planche `pistol_actions_v3.png` est conservée comme source, mais ses dessins complets des poses de rechargement ne sont plus alternés : ils changeaient la géométrie de l'arme. Sa cellule 0 fournit désormais la même arme et la même main principale pour toutes les poses. Une découpe de la cellule 3 fournit la main secondaire et le chargeur. L'image `modern_ads.png` fournit la vue centrée. Aucun nouveau bitmap n'a été généré pour cette correction ; les masques et transformations s'appliquent au rendu DOM/CSS.

## Responsabilités

- `index.html` : couches distinctes dans chaque perspective (carcasse, culasse et partie découverte sous la culasse), plus main secondaire et chargeur à la hanche.
- `src/style.css` : sélection des régions des images par `clip-path`. Le masque de carcasse est l'inverse du masque de culasse, pour éviter de laisser une seconde culasse dessinée dessous. Un petit élément métallique remplit la zone découverte. Tous les points utilisent le même canevas carré ; pas de recadrage variable ni de déformation par pose.
- `src/Weapon.ts` : pose de la main secondaire, cycle de culasse et règles de munitions. Le rechargement est une série de poses discrètes ; sa durée totale de 1,6 seconde est calculée depuis la liste. La main sort brièvement du champ pendant l'échange du chargeur, puis revient l'insérer. Aucun déplacement du dessin entier de l'arme ne remplace les gestes.

Le cycle de culasse utilise 0,5 → 1 → 0,5 → 0 en environ 0,12 s. À la hanche, la pièce se translate en diagonale vers la main ; en ADS, vers le bas de l'écran. Le recul général reste réglé à 2 secondes et agit sur l'ensemble. Le rechargement annule les effets du tir précédent, puis interdit les nouveaux tirs jusqu'à sa fin. Les munitions sont transférées une seule fois ; pause, blur ou fin annulent sans transfert.

## Ce qui est vérifié

- `npm.cmd run build` réussi (avertissement de taille du bundle inchangé).
- `node scripts/check-weapon.mjs` réussi. Contrôles ajoutés pour les phases de culasse en ADS/hanche, son arrêt au rechargement et la restauration après blur/fin de partie.
- Aperçu des couches capturé avec Chrome headless depuis un fichier autonome, et inspecté : repos, culasse reculée dans les deux vues, saisie, extraction, présentation et insertion. Les premières captures ont permis de corriger un fragment restant de la culasse et une main trop basse.
- Pas de parcours complet en jeu ni de contrôle du ressenti temporel à la souris pendant cette correction.

Pour reconstruire l'aperçu : `node scripts/make-weapon-preview.mjs`. Il crée `tmp/weapon-preview/index.html` (serveur Vite) et `standalone.html` (ouverture locale). Les profils temporaires des navigateurs de capture ne font pas partie des assets du jeu.

## Limites assumées

Il s'agit d'un assemblage 2D stylisé. Les zones exposées sous la culasse sont des surfaces métalliques simplifiées, sans modélisation mécanique complète. Les masques sont calibrés pour ces images et doivent être revus si on les remplace. L'échange ancien/nouveau chargeur est en partie hors champ ; la saisie, l'extraction et la remontée sont représentées par la même main réutilisée. Aucune animation d'arrêtoir distincte ni culasse bloquée ouverte au dernier coup n'est ajoutée. Les vues hanche et ADS restent deux dessins indépendants.

Prochaine validation utilisateur : voir si les gestes se lisent en mouvement, si la culasse est perceptible sans être exagérée, et si les raccords au poignet sont satisfaisants dans le vrai niveau.
