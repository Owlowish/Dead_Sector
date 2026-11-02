# Premier niveau — proposition en volumes simples

Objectif : tester un parcours industriel avec les mécaniques existantes, avant d'ajouter des textures ou des portes interactives. Une première version est construite ; elle reste à tester en jeu.

## Vue de dessus

```text
                       NORD (-Z)
                          ↑
       ┌────────────────────────────────┐
       │       C — SALLE DES MACHINES   │
       │      caisse          zombie 3  │
       │                                │
       │    ouverture         SORTIE    │
       ├───────  ───────────────────────┤
       │      B — COULOIR               │
       │             zombie 2           │
       ├───────  ───────────────────────┤
       │ A — ARRIVÉE                    │
       │   joueur              zombie 1 │
       └────────────────────────────────┘
```

Les ouvertures sont des passages libres, sans porte mobile. Le dessin représente les connexions et le rythme, pas encore les dimensions exactes. Le joueur suit A → B → C. La sortie est désormais un sas d'évacuation actif : pénétrer dans la zone déclenche la victoire de mission (Évacuation réussie).

## Rôle des espaces

- **A — Arrivée** : un espace assez large pour se déplacer et prendre ses repères ; un premier ennemi permet de retrouver les commandes.
- **B — Couloir** : espace de transition plus étroit, qui limite les directions possibles et change la manière d'éviter un ennemi. Le passage reste assez large pour le joueur et les zombies.
- **C — Machines** : une zone plus ouverte avec une caisse comme couverture, un ennemi et un repère de sortie. Le joueur peut comparer combat en espace étroit et combat en espace ouvert.

La détection des zombies utilise une distance et une ligne de vue horizontale : leurs emplacements et les distances devront être essayés en jeu. Ils poursuivent directement le joueur et peuvent rester bloqués par un obstacle ; ne pas concevoir un détour obligatoire avant d'avoir amélioré leur navigation.

## Comment le construire ensuite

1. Adapter `Level.ts` avec un sol, des segments de murs et des obstacles simples. Chaque solide doit être à la fois visible, bloquer les déplacements et bloquer les tirs via les mécanismes existants.
2. Choisir dans `Game.ts` et `Player.ts` des positions de départ dégagées, en conservant trois zombies et les règles de victoire actuelles.
3. Vérifier d'abord le parcours et les collisions, puis le combat et les fins de partie. Ajuster les dimensions à partir de l'expérience en jeu.

Pas de nouveaux systèmes de porte, clé, sortie interactive ou navigation dans ce premier atelier. Le niveau sera encore composé de formes simples : son rôle est de tester les espaces avant leur habillage.

## Questions à observer

- Le chemin est-il facile à comprendre sans être une simple ligne droite ?
- Peut-on traverser les ouvertures sans accrocher les bords ?
- Le joueur dispose-t-il d'une marge pour éviter un zombie dans le couloir ?
- Les ennemis restent-ils bloqués ou détectent-ils trop tôt à travers une paroi ?
- La caisse procure-t-elle une couverture compréhensible pour les tirs et les attaques ?
