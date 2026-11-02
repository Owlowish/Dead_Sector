# DEAD SECTOR — Orientation de la tentative

Décisions mises à jour le 2 novembre 2026. Ce document décrit la cible ; ETAT_PROJET et le code décrivent les fonctionnalités réelles. Ancienne orientation archivée dans `archives/ORIENTATION_TROIS_PALIERS_2026-11-02.md`.

## Validé par l'utilisateur

- Même manoir abandonné labyrinthique, ouvert progressivement, avec circuits de fuite.
- Progression par élimination des rencontres, sans extraction.
- Tentative finie d'environ **10 à 15 minutes avec rencontre finale**, plutôt qu'une survie infinie.
- Progression au-delà du palier 3, sans nouvelle aile obligatoire à chaque étape.
- Choix gratuits d'amélioration entre les combats.
- **Aucun menu surgissant automatiquement après la dernière élimination** ; conserver le déplacement et le contrôle.
- Style pixel art cohérent, obscurité jouable, jeu léger.
- Horreur privilégiée : **psychologique**, par sons, silhouettes et événements inquiétants dans le manoir victorien.
- Collaboration pédagogique : expliquer responsabilités, données, flux et validations.

## État actuel à distinguer de la cible

Trois paliers, manoir à demi-niveau et plafonds, deux armes, deux variantes et lampe déjà présents. `enterRespite` réapprovisionne puis laisse explorer ; pas de choix actif dans ce flux. Optimisations de performance confiées à Gemini et changements locaux en cours : résultat à vérifier. Les huit paliers, les nouveaux choix et la finale sont planifiés, pas implémentés par ces documents.

## Boucle proposée sans interruption imposée

Combat → dernière élimination → signal discret → accalmie libre → choix sur deux supports du monde → préparation → activation volontaire d'un départ distinct → rencontre suivante.

Ignorer explicitement une offre la ferme pour ce palier. Aucun compte à rebours forcé au premier prototype. Une pression de E ne sélectionne pas et ne démarre pas simultanément. Dispositif, placement et ergonomie restent à tester ; aucun modèle précis d'autel n'est encore validé.

## Progression proposée

Huit paliers comme première hypothèse : trois pour ouvrir/apprendre le manoir, quatre pour varier les rencontres sur la carte ouverte, puis un final. Nombre et durées à équilibrer pour obtenir réellement 10–15 minutes. Ce n'est pas une limite de temps punitive.

Difficulté par composition, directions et rythme de renforts, en conservant d'abord quatre ennemis actifs maximum. Récompenses bornées, occasions de recharger et économie de munitions viable quelle que soit l'amélioration retenue. Pas d'inflation simultanée santé/vitesse/quantité.

## Invariants

1. Terminer une rencontre après toutes ses apparitions et éliminations prévues, une seule fois.
2. Navigation, accès, altitude et collisions concordent ; apparitions éloignées, accessibles et dans les zones autorisées.
3. Supprimer les corps à chaque palier en conservant les ressources graphiques communes utiles à la suite.
4. Une offre produit au plus un avantage et expire au départ ; recommencer remet les bonus et l'état de tentative à zéro.
5. Les bonus de vitesse respectent toute la chronologie des tirs/rechargements et les événements uniques de munitions.
6. L'ambiance n'inflige pas de dégâts arbitraires et ne change pas secrètement les trajets ; les signaux d'attaque restent fiables.
7. La pause explicite reste disponible ; aucune capture automatique de souris pour un menu de transition.
8. Mesurer le temps d'image et observer la lisibilité dans le navigateur ; build et tests logiques ne suffisent pas.

## À préciser avant les ateliers concernés

Nombre définitif de paliers, bonus/plafonds, placement des dispositifs, identité/attaques de la finale, événements psychologiques précis et éventuelle méta-progression. Les propositions de ROADMAP ne valent pas validation de ces détails.

## Prochaine étape

Terminer/vérifier F0 performance, puis F1 rencontres indépendantes des secteurs. Voir ROADMAP et `PROMPT_GEMINI_TENTATIVE_FINIE.md`. Cette mise à jour est documentaire ; aucun code du jeu modifié.
