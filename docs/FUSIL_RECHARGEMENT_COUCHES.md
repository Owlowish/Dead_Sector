# Fusil : rechargement par couches — 2 novembre 2026

À la demande de trouver une solution pour le rechargement, réutilisation de la technique DOM/CSS déjà employée par le pistolet. Aucun nouvel appel à la génération d'images ni bitmap dérivé : le rendu anime des régions des assets existants.

## Composition

`index.html` ajoute quatre couches dans le rig de hanche : arme/main droite, port ventral simplifié, cartouche, main secondaire. `style.css` masque la main et la cartouche présentes dans `reload_draft.png`, conserve l'arme fixe, utilise la cellule 7 de `pistol_actions_v3.png` pour une main réellement vide et affiche `live_shell.png` séparément. Le retournement vertical et la rotation de la cartouche placent son extrémité sertie vers l'avant. Une découpe progressive masque cette extrémité pendant l'insertion ; la main repart sans cartouche. Masques et positions sont définis dans le même canevas.

Le port est une petite surface CSS sombre et métallique ; la main est réutilisée, pas redessinée anatomiquement pour chaque pose. Le geste reste une approximation stylisée en couches, sans déformation réelle des doigts. Les masques de la carcasse et de la main sont calibrés pour les assets actuels ; les changer oblige à revoir ces masques. L'approche et le retour de la position de chargement vers la position de tir restent des changements de pose directs, sans dessin intermédiaire de bascule.

## Temps et munitions

`ShotgunAnimation.ts` contient six poses discrètes, partagées avec l'aperçu : approche vide, présentation, alignement, insertion, encliquetage, retrait vide. Un cycle dure toujours 0,65 s. L'encliquetage à 0,50 s ajoute une cartouche et retire une unité de réserve ; les 0,15 s suivantes terminent le geste.

`Weapon.commitShotgunShell` verrouille ce transfert pour le cycle courant. Une interruption avant 0,50 s n'ajoute ni ne consomme rien ; une cartouche déjà engagée est conservée. Le reste de delta-time est reporté entre les cycles au lieu d'être jeté, avec arrêt à la capacité ou à la réserve épuisée. La cadence de tir existante reste une condition séparée de l'interruption du rechargement. Pause, perte de focus et changement d'arme utilisent l'annulation existante.

## Vérification

Compilation réussie, avertissement Vite sur bundle > 500 kB inchangé. Tests fusil et pistolet réussis. Cas ajoutés : annulation à 0,49 s sans perte, insertion à 0,50 s, aucun nouveau transfert pendant le retrait, conservation après annulation, grand delta sans dépassement de capacité ni double consommation.

`node scripts/make-shotgun-preview.mjs` régénère `tmp/shotgun-preview/standalone.html`. Cocher « Insertion d’une cartouche » et jouer un cycle ou le ralentir. L'aperçu utilise la chronologie et les couches du jeu. Chrome headless : six poses capturées à 1280/390 px, cycle joué jusqu'au retour au repos. Revue des images ayant conduit à corriger un fragment de l'ancienne cartouche, un fragment d'arme dans le masque de main et une insertion trop proche du flanc au lieu du dessous. Pas de combat réel ni de validation artistique du geste par l'utilisateur.

Prochaine vérification : ressenti de la boucle avec plusieurs cartouches et interruption par tir dans le manoir. Ne pas confondre validation logique acquise et validation artistique encore attendue.
