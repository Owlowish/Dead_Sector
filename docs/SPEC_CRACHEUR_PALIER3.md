# Cracheur — ennemi du palier 3

## Révision de difficulté et de mort — 3 novembre 2026

Retour de jeu : le Cracheur manque d'une chute animée et son cadavre n'est pas visible. La cause technique du cadavre est un préchauffage qui enregistre par erreur les ressources du zombie standard sous la clé `spitter` ; corriger la correspondance avant de régler l'art.

Nouvelle séquence visuelle : `idle` → `death-a` (recul du torse, gorge qui s'éteint) → `death` (affaissement à genoux, déjà généré) → `corpse` (corps couché sur le côté, tête et membres inertes). Les nouveaux PNG doivent reprendre exactement le manteau, les boutons, la chaîne, la palette, la direction et l'échelle du Cracheur existant, sur un canevas transparent de 1024 × 1536 px avec la même ligne de sol. Le cadavre final reste sur un plan vertical orienté vers le joueur, comme les autres zombies ; éviter une disparition instantanée et un faux second tir. Vérifier base, cycle isolé et cadavre à environ 80 px avant intégration.

Réglages d'essai : 240 PV, préparation 0,95 s, récupération 0,65 s, pause de tir 2,4 s et projectile à 6,5 m/s. Une menace un peu plus rapide mais toujours annoncée. À partir du palier 4, augmenter progressivement le nombre de Cracheurs et de Coureurs tout en gardant au moins un zombie standard par vague et le plafond de quatre ennemis actifs. Le zombie standard a 20 % de chance de se relever **une seule fois** : son corps reste au sol un court délai, rejoue les poses de mort en sens inverse, puis il revient avec une partie de sa santé. La vague et son HUD restent en combat tant qu'une relève est en attente ; une seconde mort est définitive. Les valeurs sont à vérifier en vrai combat.

## Intention de jeu

Un unique zombie massif et très lent apparaît au palier 3, sur le plateau de la Bibliothèque ou de l'Atelier. Il oblige le joueur à changer de position : il prépare visiblement un crachat, lance un projectile vert assez lent pour être esquivé latéralement, puis reste vulnérable pendant sa récupération. Les zombies standards et agiles continuent à exister ; le quota total de la rencontre reste borné et la carte, les portes et la progression ne changent pas.

Premier réglage à essayer, à ajuster après un vrai combat : gabarit visuel environ 1,6 × 2,7 m, déplacement 0,55–0,7 m/s, une seule apparition au palier 3, distance de tir 5–12 m avec ligne de vue, préparation environ 1,1 s, projectile à environ 6 m/s, récupération environ 0,8 s et intervalle entre attaques d'au moins 3 s. Dégâts d'un impact direct : environ 12 PV ; pas de zone de dégâts ou de poison persistant dans ce premier atelier. Aucun tir à travers mur/porte, aucun départ instantané au moment de l'apparition. Les chiffres sont des paramètres d'essai, pas un équilibrage validé.

## Contrat visuel avant génération

- **Usage et cadrage** : billboard de zombie dans le monde, vu de face à léger trois-quarts, corps entier, fond transparent. Le rendu final est pixelisé ; l'ennemi doit être reconnaissable à environ 60–100 px de haut dans une pièce sombre.
- **Silhouette et palette fixes** : torse énorme, épaules larges, ventre lourd, jambes courtes et lentes ; manteau d'employé du manoir gris bleu déchiré, chaîne au bras gauche, gorge gonflée et malade avec lueur vert acide. Garder les mêmes vêtements, chaîne, visage, chaussures, proportions et orientation d'une image à l'autre. Ne pas transformer l'ennemi en monstre différent entre les poses.
- **Ancrage** : canevas et échelle identiques pour toutes les poses, pieds sur une même ligne proche du bas, marge autour des bras et de la tête. Le centre de visée reste sur le torse ; la bouche garde une position prévisible pour la naissance du projectile.
- **Éléments mobiles** : alternance lente des jambes à la marche ; poitrine et gorge qui se gonflent, tête qui se relève, mâchoire qui s'ouvre, puis corps qui retombe. Le projectile lui-même n'est **jamais dessiné dans la main ni dans une pose d'attaque** : c'est un objet de simulation distinct.
- **Cycle isolé à valider** : base au repos → marche lourde gauche/droite → préparation (gorge plus verte, tête levée) → libération (bouche ouverte, sans projectile attaché) → récupération (épaules affaissées) → retour au repos. Prévoir aussi une réaction de blessure et une chute simple si l'intégration en a besoin. Vérifier la continuité des pieds, du manteau et de la chaîne à taille réelle avant de multiplier les frames.

## Lot d'images généré et contrôlé

Les neuf PNG transparents de `public/assets/zombies/spitter/` sont des canevas de 1024 × 1536 px : `idle`, `walk-a`, `walk-b`, `windup`, `release`, `recovery`, `death-a`, `death` et `corpse`. La pose `release` ne contient aucun projectile. Le script `scripts/make-spitter-preview.mjs` sert à voir les poses à 80 et 180 px via Vite. La base, les trois phases de crachat, la marche et les trois poses de mort ont été inspectées séparément ; le cadavre final est lisible comme un corps couché à 180 px et plus discret à 80 px. Un voile alpha aux coins de la première version de `walk-b` a été supprimé et les coins des deux nouvelles poses ont un alpha nul. La fluidité perçue pendant le combat reste à vérifier.

Durées actuelles : marche A/B à 0,5 s chacune ; préparation 0,95 s ; libération 0,18 s ; récupération 0,65 s ; mort à 0,24 s par pose avant le cadavre persistant. `SpitterAnimation.ts` fournit les durées à l'aperçu et au jeu. Ces fichiers sont des sources relativement volumineuses : charger une fois les textures du type et les réutiliser, sans créer une texture par apparition.

## Responsabilités prévues pour Luna

- `EncounterConfig`/`Game` : réserver exactement une apparition du nouveau type au palier 3, dans un point libre du plateau et hors du champ direct lors de l'apparition ; conserver le plafond de quatre ennemis actifs et le quota total existant.
- `Zombie` ou une classe `SpitterZombie` ciblée : santé, déplacement très lent, choix de l'état, préparation annulable à la mort/blessure, cadence, point de naissance à la bouche. Éviter de compliquer davantage l'IA du zombie standard si la responsabilité de tir devient distincte.
- Un petit système de projectile : position/vitesse mises à jour avec le delta-time, rayon et durée de vie bornés, collision avec décor/portes et joueur, un seul transfert de dégâts par impact, destruction et nettoyage au changement de palier. Le rayon vert et son contraste doivent rester lisibles à la résolution rétro. Le joueur esquive par déplacement, sans nouvelle commande.
- `Player` reçoit les dégâts par l'interface déjà existante ; `Game` coordonne les projectiles dans la boucle et les arrête en pause/perte de contrôle selon les règles actuelles. Les assets et timings d'animation doivent partager une source de données avec un aperçu isolé.

## Validation demandée

1. Inspecter la base à taille de jeu, puis un cycle de crachat isolé avant l'intégration ; comparer proportions et ancrage entre poses. Si une planche générée dérive, la retoucher ou la rejeter.
2. Build `npm.cmd run build`, tests ciblés de cadence/annulation, collisions décor/joueur, projectile unique, cycle de palier et nettoyage. Ne pas appeler cela une validation du combat.
3. Dans le navigateur, observer préparation lisible, esquive latérale, impact sur mur/porte, dégâts directs, mort pendant la préparation et circulation du palier 3. Signaler séparément ce qui n'a pas pu être vérifié.
