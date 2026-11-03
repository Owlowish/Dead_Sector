# Proposition d'atelier — horde, précision et ressources

Cette fiche formalise les demandes de l'utilisateur du 3 novembre 2026 pour une autre IA chargée de l'implémentation. **Aucun comportement décrit ici n'est encore implémenté.** Vérifier les signatures et le code au moment de l'atelier. Les demandes récentes de suppression des piédestaux et de départ automatique remplacent, pour cet atelier, les anciennes propositions de choix gratuit et d'activation manuelle dans `docs/ORIENTATION_JEU.md`. La liberté de mouvement, le plafond de quatre menaces et la lisibilité des attaques restent des contraintes.

## Constat vérifié dans le code

- `Weapon.shoot` résout un rayon pour le pistolet ou huit rayons pour le fusil, accumule les dégâts par mesh et appelle `onHit(mesh, damage)` une fois. Il ne distingue pas tête et corps. `THREE.Mesh.raycast` renvoie les intersections de géométrie sans appliquer l'`alphaTest` du matériau : les marges transparentes des billboards peuvent donc être touchées lors du raycast. Les UV des atlas standard et agile changent selon la pose.
- Le pistolet inflige 40 dégâts par balle ; le fusil, 15 par plomb, huit plombs. Santé : standard 100, Coureur 80, Cracheur 240. Au P7, la composition de 4 standards, 7 Coureurs et 3 Cracheurs demande **44 impacts de pistolet parfaits** avec les dégâts actuels, avant ratés et relèves. Les mesures de `scripts/measure-tiers-4-7.mjs` éliminent les ennemis par commande de test avec zéro tir réel : elles ne mesurent pas cette économie.
- `Zombie` et `SpitterZombie` partagent le système de cibles de `Weapon`, mais la relève du standard et du Coureur est décidée à la mort. Le Cracheur utilise le nombre de dégâts reçu pour sa règle d'interruption du crachat. Un bonus de dégâts sur la tête ne doit pas transformer involontairement chaque balle de pistolet en gros choc.
- Les paliers 4–7 ont 8/10/12/14 apparitions et au plus quatre menaces simultanées. `Game.trySpawnZombie` choisit actuellement chaque type et chaque point de spawn séparément, en favorisant aussi les quadrants vides ; un Cracheur peut donc apparaître isolé. `Zombie.alert` ne donne qu'une dernière position connue à l'apparition ; la poursuite s'arrête quand cette information devient périmée.
- `Game.enterRespite` propose les piédestaux et attend une porte ou le carillon pour lancer la rencontre suivante. Le graphe de `Level` ne considère une porte traversable que dans l'état `OPEN` ; la déverrouiller sans l'ouvrir ne suffit pas à une transition automatique.

## Règles de combat proposées

### Tir à la tête et corps

Premiers chiffres à essayer ; ils restent réglables après un vrai parcours :

| Arme | Impact sur la tête | Impact sur le reste du corps |
| --- | ---: | ---: |
| Pistolet 9 mm | 80 dégâts par balle | 28 dégâts par balle |
| Fusil à pompe | 24 dégâts par plomb | 12 dégâts par plomb |

Les zombies gardent leurs PV actuels dans le premier essai. Ainsi, au pistolet, un standard demande 2 tirs précis à la tête contre 4 impacts au corps ; un Coureur 1 contre 3 ; un Cracheur 3 contre 9. Au P7, l'extrême « tout corps » demande **64 impacts parfaits**, l'extrême « toutes têtes » **24**. Ces deux bornes montrent pourquoi le budget de munitions doit être calibré **après** l'intégration de la précision. Le fusil classe chaque plomb séparément, puis applique une seule somme de dégâts par cible et par tir ; son maximum théorique de huit plombs sur la tête est de 192 dégâts, donc il ne tue pas un Cracheur neuf en une seule détonation.

Le joueur doit pouvoir comprendre son tir précis : petit marqueur ou son bref distinct au moins pour le pistolet, sans gros texte flottant ni flash qui masque la cible. Une élimination par impact fatal à la tête qui **empêche la relève** du standard ou du Coureur est une idée complémentaire recommandée : elle récompense la précision et évite de tuer deux fois le même ennemi. L'IA doit la garder paramétrable et vérifier que la relève reste perceptible pour les autres morts.

### Détection correcte sur sprites animés

Pour chaque rayon, examiner les intersections triées dans l'ordre de distance. Lorsqu'une intersection concerne un zombie, vérifier d'abord l'opacité du pixel touché à partir de `intersection.uv` et de sa texture/pose courante. Un pixel sous le seuil alpha 0,4 est traversé : continuer vers le prochain objet, y compris un autre zombie ou un mur. Préparer un masque d'opacité compact **une fois par texture partagée**, avant le combat ; ne pas lire un canvas ni créer une texture à chaque plomb. Respecter l'inversion verticale des UV de Three.js et les UV d'atlas déjà modifiés dans les géométries.

Sur un pixel opaque, décider si le point est dans la tête visible de la **pose courante**. Définir les régions en coordonnées de sprite ou d'atlas dans un petit module de données, vérifié sur les poses `idle`, marche/course, attaque et blessure des trois variantes. La zone ne doit pas couvrir la gorge verte, le chapeau éventuel, l'épaule, les mains ou les pixels transparents. Un simple seuil de hauteur mondial pour tous les zombies ne convient pas : les géométries agile et standard changent de cadrage selon les poses. Produire un aperçu de débogage montrant les régions sur les sprites à leur taille en jeu, puis le retirer de l'interface normale.

Conserver la première collision **valide** et le blocage par les murs/portes. Accumuler les plombs de fusil par cible avant `takeDamage`, avec un résumé du nombre d'impacts tête/corps pour l'effet et les diagnostics. La force d'interruption du Cracheur doit rester distincte des dégâts finaux : une balle 9 mm à la tête vaut 80 PV de dégâts, mais garde la force d'impact d'une balle 9 mm pour la règle de gros choc.

## Autres changements souhaités dans la même direction

### Ressources et drops

Retirer les deux piédestaux et les caisses fixes de munitions du cycle normal. Conserver les soins et le fusil ramassable, sauf nouvelle décision. Les zombies tués peuvent lâcher un petit lot de 9 mm ou de cartouches, visible et ramassable au sol local. Le hasard choisit **qui** le porte ; un budget de munitions par palier garantit **combien** tombe au minimum et assez tôt. Un simple `Math.random() < chance` indépendant à chaque mort est insuffisant : une moyenne supérieure aux tirs théoriques laisse une probabilité de pénurie avant la prochaine élimination.

Déterminer le budget à partir des tirs effectivement mesurés, de la précision tête/corps, des relèves et des deux armes. Prévoir au moins un drop dans les premières éliminations de chaque palier avancé, puis un mécanisme de rattrapage si les drops garantis n'ont pas encore été servis. Garder les drops accessibles après le décompte et le début du palier suivant ; ne pas effacer les balles du dernier zombie au moment de la transition. Borner le nombre de meshes de drops actifs en regroupant les lots proches si nécessaire, sans perdre leur valeur. Tester avec plusieurs graines et un joueur qui privilégie le corps, pas seulement avec des tirs parfaits.

### Horde et escorte

Pendant le combat, toutes les menaces vivantes reçoivent à intervalles raisonnables (essai : 0,75 s) une position approximative et récente du joueur, même hors vue. Elles suivent le graphe existant, respectent collisions/altitudes/portes et attaquent seulement selon leurs règles de portée et de visibilité. Échelonner les recalculs de chemin pour préserver le temps d'image. Les apparitions cachées peuvent être rapprochées dans une bande sûre, à mesurer, afin que les quatre ennemis d'une salve arrivent comme un groupe plutôt qu'après de longues traversées.

Chaque nouveau Cracheur des paliers concernés est accompagné d'au moins un Coureur, idéalement deux si le quota et les quatre places le permettent. Réserver le groupe avant d'instancier ses membres ; placer les Coureurs à quelques mètres du Cracheur, du même côté des murs et sur des chemins praticables, hors du champ direct. Si aucun groupe sûr ne tient, attendre une place et réessayer plutôt que créer un Cracheur seul. Tester les quotas restants, les relèves en attente, les portes et l'absence de dépassement du plafond.

Premier réglage du projectile du Cracheur : comparer **6,5 m/s puis 9 m/s** dans le vrai décor, avec la préparation actuelle de 0,95 s et une esquive latérale possible. Garder le projectile non guidé. Tester l'escorte et la vitesse avant d'augmenter les 240 PV ; si le Cracheur tombe encore trop vite, essayer 280 PV en recalculant le budget de munitions.

### Passage automatique entre les paliers

Après la dernière mort **définitive**, quand la file d'apparition et les relèves en attente sont vides, lancer un décompte visible d'environ 10 s. Il laisse marcher, viser, recharger et récupérer les drops. Pas de menu ni de perte de Pointer Lock. Le timer se suspend avec la pause ou la perte de contrôle. À zéro, le palier suivant commence sans touche E ni passage de porte. Déverrouiller et ouvrir automatiquement les portes d'accès nécessaires assez tôt pour que la navigation des ennemis reste possible ; les autres portes peuvent rester interactives. Vérifier que le joueur et les ennemis ne sont pas coincés par l'animation d'ouverture. Après le palier 7, conserver la fin explorable actuelle au lieu de lancer un palier absent.

Le décompte doit rester lisible sans couvrir le viseur ni cacher une attaque tardive. Les corps et les drops doivent être visibles pendant cette transition. Si une relève est encore programmée, le décompte n'a pas commencé : le HUD continue d'annoncer la menace.

## Découpage demandé à l'IA

1. **Précision** : masque alpha, zones de tête par pose, dégâts pistolet/fusil, retour visuel/sonore, effet de l'impact fatal sur la relève. Fichiers principaux : `Weapon.ts`, `Zombie.ts`, `SpitterZombie.ts`, `ZombieAnimation.ts`, `AgileZombieAnimation.ts`, `SpitterAnimation.ts` et un petit module de données de zones. Vérifier build et tests de raycasting, puis aperçu à taille de jeu.
2. **Ressources** : retirer les piédestaux et caisses fixes, ajouter drops avec budget garanti, vérifier l'économie après les nouveaux dégâts. Fichiers : `Game.ts`, `MansionConfig.ts`, `AmmoBox.ts` ou un composant de drop ciblé, `EncounterConfig.ts`, `TierDiagnostics.ts`. Tester les extrêmes de chance, l'accessibilité, les limites de réserve et la persistance entre deux paliers.
3. **Horde** : actualiser la cible de recherche de toute la vague, réserver les groupes Cracheur/Coureurs, tester projectile 9 m/s. Fichiers : `Game.ts`, `Zombie.ts`, `SpitterZombie.ts`, `EncounterConfig.ts`, `Level.ts` seulement si une règle de porte l'exige. Mesurer temps de chemin et pic de quatre menaces dans le vrai manoir.
4. **Transition** : état de décompte, HUD discret, ouverture des accès et démarrage automatique, nettoyage au bon moment. Fichiers : `Game.ts`, `style.css`, `Door.ts`/`Level.ts` si nécessaire. Tester P1→P2, P2→P3, P6→P7 et fin P7, pause/focus, dernier zombie qui se relève et drop du dernier ennemi.

Chaque lot doit être compilable et observable avant le suivant. Conserver `erasableSyntaxOnly`, les réglages d'armes expérimentés par l'utilisateur dont le recul à 2 s, et les changements non committés du dépôt. Mettre à jour `docs/ETAT_PROJET.md` avec tests automatiques, tests navigateur **réellement effectués**, limites et nouveaux chiffres. `npm.cmd run build` après chaque intervention sur le code ; tests ciblés de tirs, quotas, progression, relèves, ressources et performances. Ne pas qualifier la difficulté de validée à partir de `scripts/measure-tiers-4-7.mjs` : ce script tue les ennemis par commande de test sans dépenser de munitions.

## Message prêt à transmettre

> Lis `AGENTS.md`, `docs/ETAT_PROJET.md`, `docs/ARCHITECTURE.md`, la section F4 de `docs/ROADMAP.md`, puis `docs/SPEC_HORDE_PRECISION_2026-11-03.md` et les signatures des classes concernées. Implémente les quatre lots dans l'ordre, en gardant chaque étape jouable et en testant les interactions entre précision, munitions, escorte et décompte. Préserve les modifications non committées. Ne change pas la vitesse de sprint ni le plafond de quatre menaces. Vérifie `npm.cmd run build`, les tests ciblés et le comportement dans le vrai manoir ; rapporte séparément mesures techniques et ressenti à valider par le joueur. Actualise `docs/ETAT_PROJET.md`. Aucun commit ou push sans demande.
