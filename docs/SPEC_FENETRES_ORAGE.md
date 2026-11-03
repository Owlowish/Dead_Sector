# Fenêtres et orage — spécification de l'atelier

## Résultat attendu

Depuis plusieurs pièces du manoir, le joueur distingue des fenêtres donnant l'impression d'un orage extérieur : vitres sombres, pluie lisible à la résolution rétro et brefs éclairs froids. Une pluie discrète vient de l'extérieur ; le tonnerre suit l'éclair avec un court retard. L'événement crée une inquiétude sans changer le combat, les contrôles, les portes ou les collisions.

## Révision visuelle après retour utilisateur du 3 novembre

La première version de petits panneaux était trop basse dans certaines pièces, recouvrait des portraits et ne produisait pas la profondeur de la référence fournie. Les six baies retenues sont hautes et étroites, avec sommet en ogive, remplages, rideaux sombres et une image d'extérieur orageux partagée. Elles forment notamment deux paires de part et d'autre des portraits de la Galerie et de la Bibliothèque. Les appuis restent à environ 0,8 m au-dessus du sol propre à chaque pièce ; les centres sont contrôlés contre les portraits. La lumière de l'éclair éclaire la pièce et dessine momentanément les divisions de la fenêtre sur le sol. Le ciel généré est la **base fixe** ; le trait de foudre et la projection sont des couches mobiles pilotées par l'intensité du flash, sans changer la carte ni créer de trou dans les murs.

## Placement et représentation

- Placer quelques fenêtres sur des murs **extérieurs** dans des pièces déjà accessibles, avec au moins un repère dans le secteur initial et un sur le demi-niveau. Vérifier leurs faces, hauteurs et dégagements contre portes, cheminée, meubles et autres éléments du décor.
- Construire cadre, montants, vitre et traces de pluie avec géométrie/matériaux Three.js partagés. L'enveloppe du manoir reste physiquement fermée ; une vitre rapportée au mur suffit pour ce premier atelier. Ne pas présenter cette surface comme une vraie ouverture traversante.
- Réutiliser les matériaux et limiter les nouveaux appels de rendu. Aucun nouveau projecteur d'ombre. Les fenêtres ne créent ni collider ni cible de tir supplémentaire, sauf nécessité démontrée.
- Un seul bitmap d'extérieur est réutilisé dans les baies et alterné horizontalement. La forme, les montants et les rideaux restent du code Three.js. La foudre et l'empreinte au sol sont synchronisées avec le flash ; vérifier base, flash et retour à la base à la taille du jeu suivant `docs/PIPELINE_ASSETS.md`.

## Temporalité et audio

- Pluie douce en fond, liée à la direction des fenêtres ou à une source extérieure proche ; démarrage après déverrouillage audio par le joueur, pause/reprise avec l'onglet et le Pointer Lock comme l'ambiance existante.
- Éclairs à intervalles irréguliers avec assez de silence entre eux. Une séquence peut avoir deux impulsions courtes ; luminosité plafonnée, retour exact à l'état initial. L'éclair rehausse réellement l'éclairage des surfaces de la pièce, pas seulement la couleur de la vitre.
- Tonnerre grave et bref après l'éclair, à volume modéré. Employer une source spatiale ou une atténuation cohérente avec l'extérieur. Précharger/réutiliser les ressources ; ne pas créer de nouvel objet audio à chaque événement.
- Si aucun bruitage d'orage convenable n'existe dans le projet, créer des fichiers audio locaux simples et vérifiables, sans nouvelle dépendance ni ressource distante à licence incertaine.

## Responsabilités et validation

- `MansionConfig` décrit les positions ; `Level` construit les fenêtres et porte l'intensité lumineuse ; un petit contrôleur dédié ne se justifie que si la temporisation et l'audio alourdissent `Game`. `Game` relie la boucle, l'état de la partie, la caméra et l'audio.
- Vérifier build, tests pertinents, absence de collision/occlusion gênante et absence d'erreur de chargement. Observer au moins une fenêtre sans éclair, pendant l'éclair et après, à la résolution rétro. Écouter pluie et tonnerre à volume modéré si l'environnement le permet ; déclarer explicitement toute validation visuelle ou sonore non effectuée.
- Documenter les limites : la vitre est un panneau sur un mur fermé, le son et la lumière sont des effets d'ambiance, et aucun éclair ne modifie les états ennemis ou la santé.
