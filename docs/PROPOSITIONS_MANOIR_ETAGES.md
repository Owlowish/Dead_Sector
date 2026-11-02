# Manoir-arène : propositions de circulation et de hauteur

Discussion du 2 novembre 2026. **Propositions uniquement : aucun plan choisi, aucune implémentation autorisée par ce document.** Aucun code du jeu modifié.

## Ce que le plan doit résoudre

Conserver le même manoir ouvert progressivement, avec des boucles de combat plutôt qu'une suite de pièces. Un palier est une phase de combat, pas un étage physique. Les secteurs précédents restent accessibles. Les raccourcis de retour restent verrouillés avant l'activation du secteur : pas de passage permettant de contourner la progression.

La carte actuelle comporte six grandes zones principalement rectangulaires dans une emprise de 48 × 40 unités. Modifier les proportions, les connexions et les points de repère peut apporter davantage que simplement agrandir les pièces. Les propositions suivantes décrivent des connexions, pas des plans cotés.

## Trois variantes

### Demi-niveau — recommandation pour une première version légère

- Secteur initial : vestibule, salon et galerie reliés en boucle.
- Après le premier palier : accès au grand hall depuis le salon, puis liaison de retour vers la galerie.
- Après le deuxième palier : bibliothèque et atelier à +2,4 m, reliés entre eux ; un escalier depuis la galerie et un autre vers le hall.
- Aucune pièce jouable sous les pièces hautes. La hauteur crée des vues et des trajets variés sans deux sols superposés à gérer au même endroit.
- Compromis : moins spectaculaire qu'une galerie suspendue autour d'un atrium.

### Atrium et galerie haute — identité du manoir

- Secteur initial : vestibule, salon et atrium en boucle.
- Premier agrandissement : bibliothèque et chapelle forment une deuxième boucle avec le salon et l'atrium.
- Deuxième agrandissement : galerie haute surplombant l'atrium, accessible par deux escaliers depuis la bibliothèque et la chapelle.
- Repère central fort, vue sur les ennemis et les anciens secteurs.
- Compromis : passer réellement sous la galerie impose de représenter plusieurs surfaces praticables au même X/Z. L'atrium ne doit pas devenir un refuge où les zombies ne peuvent pas atteindre le joueur.

### Double boucle — priorité à la circulation tactique

- Secteur initial : vestibule, salon et hall en boucle.
- Premier agrandissement : bibliothèque entre salon et hall, créant un détour.
- Deuxième agrandissement : atelier, chapelle surélevée et deux escaliers forment un autre circuit rejoignant le hall.
- Deux circuits permettent de changer de route lorsque les ennemis occupent un passage.
- Compromis : le hall peut concentrer tous les trajets. Prévoir des accès larges et décalés ; éviter de rendre le passage central obligatoire à chaque tour.

## Escaliers : coût graphique et coût de conception

Quelques escaliers statiques sont géométriquement modestes. Le changement principal concerne les règles du jeu : le déplacement et les collisions actuels reposent sur X/Z. `Player` remet la caméra à une hauteur fixe ; les collisions et la navigation de `Level` ignorent l'altitude. Plusieurs calculs de perception et d'attaque des zombies utilisent également des distances horizontales.

Première étape proposée : deux hauteurs (0 et +2,4 m), deux escaliers, aucun espace jouable superposé. Des marches visibles peuvent recouvrir une rampe de déplacement invisible : le personnage suit une pente continue, sans moteur physique ni collision indépendante avec chaque marche. Il faut néanmoins empêcher de monter sur le côté d'une plateforme et prévoir des garde-corps. Une unique fonction de hauteur ne suffit pas à décider si un déplacement est autorisé.

Responsabilités à adapter si cette option est retenue :

- `MansionConfig.ts` : surfaces, escaliers et connexions explicites.
- `Level.ts` : hauteur de support, collisions selon l'intervalle vertical et navigation autorisant les changements de hauteur uniquement par les escaliers.
- `Player.ts` : position des pieds et caméra à hauteur des yeux au-dessus du support.
- `Zombie.ts` : suivi des escaliers, perception et portée d'attaque tenant compte de la hauteur et des obstacles.
- Objets ramassables, douilles, impacts et cadavres : utiliser le sol local au lieu de supposer Y = 0.
- Tirs : ajouter les plateformes aux obstacles touchables, pour ne pas traverser les planchers. Les rayons de l'arme sont déjà en 3D ; cela ne garantit pas que tous les nouveaux obstacles leur seront fournis.

## Garder le jeu léger

Conserver initialement l'emprise maximale actuelle de 48 × 40 unités et six à huit espaces, plutôt que dupliquer un étage complet. Réutiliser matériaux et textures ; limiter lumières, ombres et effets persistants. Les réglages actuels plafonnent notamment à quatre zombies simultanés et deux lumières projetant des ombres. Le nettoyage des cadavres à chaque palier reste pertinent. Ces limites sont un point de départ, pas une garantie de performances : aucune mesure de FPS n'a été faite pour ces propositions.

Une variation contrôlée de passages secondaires, d'obstacles légers et de décors peut venir ensuite. Garder un squelette connecté, les accès de progression lisibles, deux sorties pour les zones de combat et des emplacements d'apparition éloignés du joueur. Ne pas combiner d'emblée étages et génération entièrement aléatoire.

## Validation proposée avant une nouvelle carte

Après choix et accord : prototype isolé avec deux plateformes, deux escaliers et un zombie de chaque type. Vérifier déplacement dans les deux sens, poursuite, absence de raccourci à travers le vide, pas d'attaque à travers le plancher, tirs bloqués par celui-ci et objets/cadavres au bon niveau. Compiler puis tester en jeu : la compilation seule ne valide pas ces comportements.

Cette discussion n'ajoute ni moteur physique, ni dépendance, ni refonte générale. L'étage complet avec pièces superposées reste une option distincte, plus exigeante à concevoir.
