# Prompt pour Gemini — reprendre la carte du manoir-arène

Tu reprends DEAD SECTOR, un FPS rétro TypeScript/Three.js/Vite. Lis AGENTS.md, la section prioritaire de docs/ETAT_PROJET.md, docs/ARCHITECTURE.md, docs/ORIENTATION_JEU.md, le jalon R3 et surtout docs/AUDIT_MAP_2026-11-02.md. Vérifie ensuite les signatures et le code réel de Level.ts, Game.ts, Door.ts, MansionConfig.ts, Player.ts et de la navigation de Zombie.ts. Les documents historiques peuvent contredire l'implémentation actuelle.

## Objectif

Je veux un manoir-arène plus spacieux et labyrinthique, avec de vraies salles de combat et des boucles, ouvert progressivement. Les espaces actuels par palier sont trop peu profonds. Un palier est une phase de combat ; il peut utiliser plusieurs pièces. Les secteurs déjà ouverts restent accessibles. Préserve le cycle combat → récompense gratuite unique → exploration → activation de la nouvelle aile → combat. Pas d'extraction.

## Diagnostic à prendre en compte

- Sol 24 × 24, vestibule et grand hall environ 23 × 7 m libres ; joueur 5 m/s en marche, 9 en course. Ne change pas ses vitesses pour masquer la taille des salles.
- Passages latéraux de la galerie : 0,75 m libres, contre 0,8 m de diamètre zombie. Le joueur passe mais les ennemis ne peuvent pas suivre la même boucle.
- Trois points du vrai graphe sont dans des obstacles : (-2,5 ; 2), (-2,5 ; -2), (-4 ; -8).
- Poche centrale est sans accès, même après déverrouillage de toutes les ailes.
- Palier 2, joueur en (0 ; 0) regardant l'ouest : la vraie méthode trySpawnZombie ne trouve aucun candidat admissible. Le manque de cachettes rend la file dépendante de l'orientation du joueur.
- MansionConfig ne pilote pas actuellement la géométrie de Level. Les secteurs/spawns dans Game et les seuils z<3,8 / z<-4,2 dépendent de l'ancien plan.
- Les 11 tests actuels passent mais plusieurs recopient règles et coordonnées : MockSession, evaluateSpawn, navNodes et un ancien pool. Ils ne suffisent pas comme preuve d'intégration.

## Étape 1 — Proposer, sans modifier le code

Présente un plan coté vu du dessus et son graphe de circulation. Explique les responsabilités des fichiers concernés et deux concepts : topologie des trajets et cohérence géométrie/collision/navigation. Attends mon accord avant l'implémentation importante.

Base proposée à discuter : enveloppe maximale 48 × 40 m, six à huit espaces, trois secteurs ; pièces principales de 12–16 m par 10–14 m, passages principaux de 3–4 m libres APRÈS murs, portes et mobilier. N'agrandis pas tous les objets par un facteur global et ne remplis pas l'enveloppe avec un hangar vide.

Premier secteur : trois espaces reliés en boucle, par exemple Vestibule/Salon/Galerie. Deuxième : Bibliothèque/Petit hall/Atelier ajoutant un détour et un retour vers l'ancien circuit. Troisième : Grand hall/Chapelle reliés au circuit, sans impasse de combat imposée. Ajuste noms, dimensions et assemblage pour obtenir un plan réellement réalisable dans l'enveloppe ; prouve que les connexions dessinées existent physiquement.

Prévois une entrée de progression clairement identifiée par nouvelle aile. Les raccourcis de retour ne doivent pas permettre de contourner son verrouillage ; ils peuvent devenir disponibles après activation de l'aile. Montre sur le plan les points d'apparition masqués, les repères, ressources et trajets de repli.

## Étape 2 — Après mon accord, implémenter par lots vérifiables

1. Centralise les données concrètes du plan : pièces/secteurs identifiés, passages et accès, dimensions, navigation et emplacements. Utilise des objets/tableaux lisibles, pas un nouveau framework de génération. Fais consommer ces données au rendu, aux règles d'accès et aux tests quand c'est pertinent ; ne maintiens pas trois cartes contradictoires.
2. Construis d'abord en volumes simples : murs, sol, portes/arches, collisions et départ. Supprime les poches involontaires. Si des portes tournées de 90° sont nécessaires, leur orientation doit affecter rendu, collision, interaction et anti-pincement.
3. Vérifie la navigation avec les vrais gabarits : joueur rayon 0,35, zombie 0,4. Aucun point dans un obstacle. Chaque boucle doit être praticable par le zombie dans les deux sens. Les anciennes zones restent accessibles et aucun verrou ne peut être contourné avant sa progression.
4. Repositionne spawns et ressources. Conserve distance de sécurité d'au moins 6 m, séparation, rejet d'apparition directement visible et chemin praticable. Prévois de vraies cachettes/entrées ennemies plutôt que de relâcher ces règles. Si aucun point n'est admissible, garde la file et rends cette attente compréhensible ; assure-toi que des positions normales de jeu permettent d'en sortir, sans exiger une rotation arbitraire du joueur. Pas de zombie créé sur lui ni de suppression d'ennemis prévus pour finir artificiellement un palier.
5. Adapte progression et déclencheurs aux identifiants et volumes du nouveau plan. Remplace les seuils Z de l'ancienne carte. Préserve l'exploration sécurisée et le départ unique du combat à l'activation du bon accès, avec prise en charge de la pause et des anciens secteurs.
6. Habille et éclaire ensuite : manoir victorien sombre, pixel art cohérent, repères lisibles à la lampe. Préserve armes, ADS, munitions/rechargement, recul utilisateur de 2 s, animations et effets existants. Aucun ajout de nouvelle arme, ennemi ou dépendance dans ce chantier.
7. Conserve d'abord quatre zombies simultanés et au plus deux lumières avec ombres. L'enveloppe de carte n'est pas une garantie de performance. Mesure avant/après sur la même machine/résolution : temps d'image, draw calls, triangles, lumières/ombres. Adapte la couverture des ombres à la nouvelle taille, sans ajouter une lumière à ombres par pièce. Distingue lumières fixes et flash de tir.

## Vérifications exigées

- Après chaque lot de code : npm.cmd run build et contrôles ciblés.
- Tests basés sur les vrais données et comportements, pas une réécriture simplifiée de Game. Contrôler aussi les points de navigation effectivement utilisés.
- Parcours des boucles dans les deux sens par joueur et zombies ; poursuite jusqu'au joueur autour des obstacles ; vérification des portes fermées/ouvertes.
- Premier secteur jouable et intéressant avant tout déverrouillage ; chaque aile ajoute une possibilité de trajet identifiable.
- Aucun accès anticipé à une aile, aucun déclenchement depuis une ancienne pièce, aucune récompense/transition doublée.
- File d'apparition qui peut progresser dans des positions/orientations représentatives, pas de pop visible ou au contact, pas de dernier zombie inaccessible. Inclure le cas réel palier 2 centre-regard-ouest ou son équivalent sur le nouveau plan.
- Tests des trois paliers, de la mort et du redémarrage ; contrôle du tir, ADS, rechargement, ressources, lampe et pause.
- Distinguer compilation, tests de logique, tests navigateur et ressenti. Ne pas annoncer un gameplay validé si tu ne l'as pas joué.

## Variation et pédagogie

Commence par une carte fixe fiable. Ensuite seulement, propose une variation par graine sur des emplacements réservés de mobilier, ressources et apparitions, avec validation des chemins et largeurs. La graine doit permettre de reproduire un défaut ; ne génère pas librement la structure ni les verrous dans ce lot.

Après chaque lot, explique ce qui change, comment Level/Door/Game/Zombie communiquent et pourquoi l'approche reste simple. Signale les compromis, propose une courte expérience de compréhension et actualise docs/ETAT_PROJET.md avec vérifications réelles, limites et prochaine étape. Mets à jour architecture et plan de niveau si leurs responsabilités ou leur géométrie changent.
