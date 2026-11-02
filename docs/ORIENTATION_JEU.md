# DEAD SECTOR — Manoir-arène et progression d'une tentative

Décisions de conception du 2 novembre 2026. Ce document définit la nouvelle cible ; il ne décrit pas des fonctionnalités déjà implémentées.

## Décisions validées par l'utilisateur

- Un manoir abandonné composé de salles de combat et de couloirs, avec une structure labyrinthique.
- Le même manoir s'ouvre progressivement ; on ne change pas de carte après chaque palier.
- Éliminer les ennemis permet de passer au palier suivant.
- La progression rend disponibles davantage d'armes et d'ennemis.
- Une récompense gratuite à choisir entre les paliers ; pas d'économie de points à ce stade.
- L'ambiance reste horrifique et sombre. Une lampe torche est envisagée pour éclairer devant le joueur ; ses paramètres restent à valider.
- L'extraction ne fait plus partie de l'objectif souhaité pour le moment.
- Mission actuelle : conception et documents seulement. Gemini pourra implémenter les ateliers ensuite, après accord sur chacun.

## Boucle proposée

```text
Début de tentative : équipement de départ et secteur initial accessible
  → Combat : explorer les espaces ouverts et éliminer le groupe du palier
  → Répit : tous les ennemis prévus sont éliminés
  → Choix : prendre une récompense gratuite parmi les propositions
  → Transition : ouvrir éventuellement un accès et préparer le groupe suivant
  → Combat suivant, dans le même manoir agrandi

Mort à tout moment → bilan → recommencer une tentative
```

Le répit n'est pas chronométré dans la proposition initiale : le joueur peut lire son choix. Un bouton « Continuer » lance le palier suivant après sélection. Les accès ne doivent pas se refermer sur le joueur au changement de palier.

## Vocabulaire pour éviter les ambiguïtés

- **Tentative / run** : une partie complète, composée de plusieurs paliers, jusqu'à la mort ou à la fin éventuelle d'un prototype de test.
- **Palier** : une rencontre à terminer, suivie d'un choix. Ce n'est ni une nouvelle carte ni un étage physique.
- **Secteur** : ensemble de salles et couloirs accessibles dans le manoir. Plusieurs paliers peuvent utiliser le même secteur.
- **Débloquer une arme** : la rendre éligible aux récompenses ; cela ne signifie pas forcément l'ajouter automatiquement à l'inventaire.
- **Récompense** : un avantage effectivement choisi et appliqué une seule fois.

## Proposition pour le premier prototype — pas encore validée dans le détail

Trois paliers, une ouverture de secteur, deux armes au total (pistolet et une seconde arme), un ennemi initial puis une variante. Récompenses d'abord déterministes pour régler les choix ; tirage variable seulement lorsque les options sont équilibrées.

À la mort, recommencer avec l'équipement initial ; aucune amélioration permanente entre tentatives pour cette première version. Le nombre d'armes transportables, le contenu exact des choix et la fin après le troisième palier restent à décider. Ne pas imposer une boucle infinie, un écran de victoire ou une méta-progression sans discuter de ce point.

Exemple à tester, non contractuel :

| Palier | Espaces | Objectif de conception |
| --- | --- | --- |
| 1 | Vestibule et petit circuit adjacent | Comprendre le combat et apprendre un itinéraire de fuite |
| Répit 1 | Espaces existants | Choisir un avantage ; accès à une aile débloqué |
| 2 | Secteur précédent et nouvelle aile | Exploiter deux chemins, introduire une nouvelle possibilité d'équipement |
| Répit 2 | Manoir accessible | Choisir un avantage compatible avec l'équipement actuel |
| 3 | Espaces précédents et nouvelle liaison si utile | Mélanger les menaces et vérifier la viabilité des combinaisons |

Ouvrir un secteur doit apporter une option de circulation, une ressource ou un risque nouveau. Ajouter seulement un couloir plus long ne rend pas automatiquement la partie plus intéressante. Tout le niveau peut exister géométriquement au départ, avec des accès fermés : pas besoin de charger/générer un nouveau monde à chaque étape.

## Récompenses : décision simple avant la richesse du catalogue

Proposition : choisir une option parmi deux au début. Exemples futurs : nouvelle arme, amélioration d'une arme possédée, soin ou ravitaillement. Pas de boutique et pas de coût en points.

- Une arme ne doit pas être proposée avant d'être implémentée et disponible à ce palier.
- Une amélioration doit avoir une conséquence compréhensible et compatible avec l'équipement.
- Éviter un choix composé uniquement d'options inutiles (soin à vie pleine, munitions déjà au plafond, doublon sans effet).
- Afficher précisément l'effet avant de confirmer ; appliquer une seule récompense par palier.
- Séparer récompense et minimum de survie : la partie ne doit pas devenir impossible si le joueur ne choisit pas des munitions. Définir un ravitaillement minimal ou une solution de secours avant d'équilibrer la rareté.

La variété des décisions peut donner une dimension rogue à un manoir fixe. Carte procédurale et progression permanente ne sont pas nécessaires au premier prototype.

## Horreur et lisibilité

La proposition est une obscurité dirigée : faibles lumières fixes pour les repères, faisceau frontal pour explorer, sons et silhouettes pour anticiper les menaces. Prévoir un plafond ou une fermeture visuelle cohérente avec le manoir, plutôt qu'un ciel vide au-dessus des murs.

Lampe proposée sans batterie au départ, pour régler son faisceau avant d'ajouter une ressource. Elle ne change pas la règle de perception ennemie dans ce premier atelier. La visibilité des passages et la lecture d'une attaque doivent être vérifiées avant d'assombrir globalement le jeu. Les phases de répit et la progression des groupes contribuent autant à la tension que la luminosité.

## Invariants à transmettre à l'implémentation

1. Un palier est terminé seulement si tous ses ennemis prévus sont apparus et morts. « Aucun ennemi vivant à cet instant » n'est pas suffisant si des apparitions sont différées.
2. Aucun ennemi n'apparaît dans un secteur fermé, un obstacle ou un endroit inaccessible depuis le joueur. Éviter les apparitions immédiatement au contact du joueur.
3. Le tir doit prendre en compte les nouvelles instances ennemies : l'ancienne liste de cibles créée au démarrage ne peut pas rester la seule référence.
4. Le passage combat → récompense → combat suivant se produit une seule fois. Pas de progression déclenchée à chaque image après la mort du dernier zombie.
5. Pause et menu de choix suspendent attaques, déplacements hostiles et commandes de combat. Reprise sans touche ou visée bloquée.
6. La géométrie affichée, les collisions et la navigation doivent être d'accord sur les portes/secteurs ouverts.
7. Une nouvelle tentative remet à zéro paliers, accès, ennemis, ressources et améliorations. Le rechargement de page actuel peut suffire dans un premier temps.

## Macroscopiquement, quels systèmes changent ?

- **Game** : coordonne les phases et les transitions. Inspecter le code réel avant de décider d'extraire un gestionnaire de paliers.
- **Level / Door** : décrivent les secteurs, les accès et les emplacements praticables. Le graphe de circulation précède le détail du décor.
- **Zombie** : conserve ses règles individuelles ; le palier décide du groupe à créer, pas chaque zombie.
- **Weapon** : conserve tir/rechargement et doit recevoir les cibles actuelles. L'ajout d'une seconde arme vient dans un atelier distinct.
- **Récompenses / HUD** : présentent des options et transmettent un choix unique aux systèmes concernés, sans garder de copies indépendantes de leurs données.

La conception est une proposition de responsabilités, pas l'ordre de créer toutes ces classes. Le code existant reste la base ; pas de moteur externe, bus d'événements ou framework d'entités requis pour ce prototype.
