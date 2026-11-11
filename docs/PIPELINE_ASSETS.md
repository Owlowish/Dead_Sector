# DEAD SECTOR — Production d'assets

Mis à jour le 6 novembre 2026. Workflow commun aux personnages, armes, décors, objets, effets, interface et sons. Prompt réutilisable : [PROMPT_ASSETS_MULTI_IA.md](PROMPT_ASSETS_MULTI_IA.md). Modèle : [MODELE_LOT_ASSETS.json](asset-packs/MODELE_LOT_ASSETS.json).

## Périmètre et autonomie

Appliquer `AGENTS.md`, inspecter le code qui charge les ressources et terminer le lot demandé sans confirmations intermédiaires. Choisir les détails réversibles seul ; réserver les questions aux risques majeurs pour le jeu. Respecter une demande explicite de préparation ou génération seule ; ne pas inventer une mécanique pour remplir un lot.

Vérifier les outils disponibles avant de produire. Sans génération ou référence accessible, avancer sur les parties possibles et marquer les ressources manquantes. Ne pas prétendre avoir généré, vu ou écouté un fichier inaccessible. Les contrôles artistiques ordinaires sont faits par l'assistant ; une approbation humaine ne se déduit jamais d'un test automatique.

## Références réelles

Inspecter 2 à 4 références proches, issues des chemins chargés. Identifier leur rôle : style, cadrage ou identité. Une référence de cadrage ne remplace pas le style. Joindre les images au générateur lorsqu'il n'a pas accès au dépôt.

| Contenu | Références de départ à vérifier |
| --- | --- |
| Ennemi | `public/assets/zombies/zombie_idle.png`, `agile/idle.png`, `spitter/idle.png`, `crawler/idle.png` sous le même dossier zombies |
| Arme FPS | `public/assets/weapons/shotgun/hip-rest-v2.png`, `shotgun/ads_pump_v2.png`, `pistol_actions_v3.png` sous le même dossier weapons ; isoler la cellule utile |
| Objet/icône | `public/assets/pickups/medkit.png`, `public/assets/pickups/ammo.png`, `public/assets/sprites/upgrades/upgrade-vitality-vial.png` |
| HUD gothique | V2 : `public/assets/ui/gothic/heart-beat-v2.png`, quatre poses natives de 32 px ; chronologie `HeartAnimation.ts`. Référence initiale et sources V1/V2 documentées dans `docs/asset-packs/HUD_GOTHIQUE_2026-11-06.json` ; anciens médaillons réservés à la provenance |
| Décor | `public/assets/textures/mansion_wall_v2.png`, `public/assets/textures/wood_floor_v2.png`, `public/assets/textures/mansion/door-panel-v1.png` |
| Son | Source WAV dans `assets-src/sounds/`, Ogg servi dans `public/assets/sounds/` via `scripts/encode-sounds-ogg.mjs` ; déclaration dans `AudioManager` (réserve, spatial ou `SoundEffects`) et volumes ; écouter si possible |

Les anciens essais ou poses rejetées ne deviennent pas des références par leur seule présence. Viser la cohérence à la taille d'affichage plutôt qu'une résolution source identique pour tous les objets.

## Socle artistique

> Asset de jeu DEAD SECTOR, FPS rétro dans un manoir victorien hanté. Reprendre les références jointes : formes lisibles, groupes de pixels perceptibles, contours en marches d'escalier, détails hiérarchisés survivant à petite taille. Palette sourde de bois brun, bordeaux, ivoire vieilli, laiton patiné, fer sombre et gris bleuté selon le matériau. Usure sobre, contraste utile, ombres larges compatibles avec le rendu. Respecter identité et matières sans copier la silhouette d'un autre personnage. Aucun rendu photo, lissage brillant, cartoon arrondi, texte, signature, filigrane ou décor de présentation.

Palette indicative de `VisualStyle.ts` : ivoire `#d4c6a5`, laiton `#b69a60`, bois `#684532`, fer `#343a3b`, olive `#515546`, pierre `#48423c`, tapis `#4d161a`. Les couleurs de télégraphie restent fonctionnelles et exceptionnelles.

Armes FPS : gants noirs fermés et manches gris bleuté constants. Surfaces éclairées par Three.js : aucune ombre de pièce ou lumière contradictoire peinte ; isoler une émission volontaire. Ne pas imposer le même nombre de pixels à une fiole et un corps entier.

## Inventaire et contrat

Compléter le manifeste du lot existant ou copier le modèle vers `docs/asset-packs/<identifiant>.json`. Ne pas créer de note ou prompt séparé par pose ou micro-correction.

- Ennemi : repos, locomotion, anticipation/attaque/récupération, blessure, mort/cadavre selon le comportement réel ; ombres, zones de tête, projectile et sons si nécessaires.
- Arme : hanche/ADS, choc, cycle mécanique, rechargement, calques, douille, flash, munitions et sons ; toutes les phases d'un rechargement forment une action unique.
- Objet/interface : états d'interaction/consommation et variantes utiles. Décor : faces visibles, pavage, UV, support physique et états nécessaires.
- Chaque ressource : usage, chemin source/export, statut à produire/réutilisé/non applicable, références, outil, prompt exact et transformations.
- Contrat technique : dimensions mesurées, alpha/opacité, cellules, marges, ancrages en coordonnées du canevas ou de la cellule explicitement nommée, taille réelle d'affichage et budget disque/texture.
- Animation : identité et composition invariantes, éléments fixes/mobiles, visibilité par phase, durées, événements uniques, interruptions et retour au repos.

Ne pas recadrer/redimensionner les silhouettes différemment entre poses. Une réduction impose de convertir ancrages, UV et zones de tête ou de conserver un espace de référence explicite. La mémoire RGBA8 vaut environ largeur × hauteur × 4 avant mipmaps.

## Production

1. Produire une seule base avec les références de style ; l'inspecter à taille de jeu avant les variantes.
2. Conserver cette base comme identité, ses ancrages et son prompt ; ne pas dériver chaque variante uniquement de la précédente.
3. Produire une action pilote ; inspecter les poses, puis le mouvement normal/lent et le retour au repos. Pour une surface, contrôler le pavage 3 × 3 selon les axes.
4. Compléter le lot avec les mêmes invariants et le même bloc de style ; corriger uniquement les fichiers défectueux. Aucun changement de fournisseur silencieux au milieu d'une action.
5. Mesurer/exporter, contrôler la couverture du lot puis intégrer si ce périmètre fait partie de la demande. Partager données et chronologie entre aperçu et jeu.

Structure de chaque prompt : usage → références jointes/rôles → sujet → invariants → variation unique → format/ancrages → exclusions → contrôles. Pour une variante, préciser ce qui bouge, reste fixe, est visible ou caché.

Privilégier des calques d'une base pour les pièces rigides ; de vraies poses pour les déformations organiques. Une déformation CSS ne répare pas une perspective incohérente. Préférer des poses séparées à une planche dont les cellules ne peuvent pas être contrôlées. Un damier dessiné ou un fond noir n'est pas une transparence alpha.

## Contrôles distincts

| Niveau | Vérifier |
| --- | --- |
| Fichier | Présence, dimensions, format, alpha réel, cellules, marges, ancrages et absence de découpe |
| Artistique | Comparaison à taille cible, identité, silhouette, matières, halos sur fonds clair/sombre |
| Continuité | Cycle normal/lent, premier/dernier état, appuis stables ; pavage si surface |
| Intégration | Chargement, filtrage, lumière/ombres, masques de tir, événements uniques, pause/interruption et libération |
| Jeu | Lisibilité et coût dans le vrai niveau, à plusieurs distances et éclairages ; écoute du mix si son |

Ces niveaux ne se remplacent pas : un build ou une planche ne prouve ni mouvement lisible ni équilibre. Si le mouvement ou le son ne peuvent pas être observés, indiquer « non vérifié ».

Réutiliser `scripts/sprite-png-info.mjs`, les `make-*-preview.mjs` et `check-*.mjs` pertinents après inspection de leurs entrées/sorties. Compiler avec `npm.cmd run build` après modification de code. Les générateurs audio et `scripts/optimize-assets.py` modifient les assets ; ne pas les lancer comme contrôles de lecture seule.

Modules usuels : `*Animation.ts` pour poses/temps, `Weapon` et classes d'ennemis pour logique, `ZombieRemains` pour corps, `WeaponPresentation`/CSS pour armes, `MansionMaterials` pour surfaces, `Game` pour orchestration. Ne pas libérer une ressource encore partagée.

## Livraison et entretien

Dans le manifeste : fichiers réellement produits/réutilisés/manquants, prompts exacts, références réellement jointes, outil connu, transformations, données techniques et limites. Distinguer production, conformité et approbation humaine ; les mesures actuelles font foi sur les dimensions sources anciennes.

Mettre à jour brièvement l'état courant sans empiler l'historique. Retirer les fiches remplacées seulement après conservation de la provenance encore utile et vérification des dépendances. `pompe-agile.manifest.json` est consommé par des scripts : ne pas le supprimer comme simple note.

Pour une reprise : transmettre demande, manifeste, base retenue, références et dernier défaut précis, puis continuer à l'étape restante. Conserver les licences et la provenance des assets en usage ; Git conserve les anciens essais et documents.
