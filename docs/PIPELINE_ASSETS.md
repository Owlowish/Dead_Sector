# Workflow global de production d'assets — DEAD SECTOR

Mis à jour le 4 novembre 2026. À appliquer avec tout assistant de code et tout générateur d'images ou de sons, notamment dans un échange avec Gemini. Ce document décrit une méthode ; il ne génère rien automatiquement et ne suppose aucun outil propre à un modèle.

Entrée courte : « Nouveau contenu : [description]. Prépare/génère le lot d'assets cohérent avec le jeu. » L'assistant prend en charge l'inventaire, les références, les prompts, la production accessible avec ses outils, les contrôles et la livraison. Prompt réutilisable : [PROMPT_ASSETS_MULTI_IA.md](PROMPT_ASSETS_MULTI_IA.md). Fiche à copier par contenu : [MODELE_LOT_ASSETS.json](asset-packs/MODELE_LOT_ASSETS.json).

## A. Périmètre et comportement de l'assistant

- Lire `AGENTS.md`, le début de `ETAT_PROJET.md`, les responsabilités utiles d'`ARCHITECTURE.md`, puis le code qui charge les ressources concernées. Consulter `ORIENTATION_JEU.md` et le seul jalon utile de `ROADMAP.md` si le contenu touche la direction ou le gameplay. Les anciens inventaires et prompts sont datés ; le code fait foi.
- Expliquer brièvement le lot, les fichiers et les contrôles prévus. Une demande de lot complet comprend ses poses, calques et ressources nécessaires : avancer sans question pour chaque image. Résoudre les détails réversibles par une hypothèse écrite. Un vrai choix de gameplay non autorisé nécessite un accord ; la génération n'autorise pas son implémentation.
- Ne pas terminer chaque réponse par une question ou un exercice. Une référence indispensable inaccessible ou une décision majeure non tranchée justifie une demande ciblée. Ne pas inventer la réponse et ne pas bloquer les ressources indépendantes.
- Vérifier les capacités réellement disponibles : lecture d'images, génération, édition avec références, alpha, export, aperçu. Si le modèle n'a que du texte, livrer contrats, prompts et liste exacte des images à joindre au générateur ; marquer les fichiers comme manquants. Ne pas prétendre avoir généré, inspecté ou intégré un fichier absent.
- Utiliser les règles des outils de l'environnement pour générer et retoucher. Ne pas changer de modèle, installer un outil, déléguer, publier ou ajouter une dépendance implicitement.

## B. Référentiel artistique commun

### Références à regarder, pas seulement à citer

Choisir 2 à 4 références proches du contenu, issues des chemins actuellement chargés, et une vue en jeu si accessible. Indiquer le rôle de chaque référence : **style**, **cadrage** ou **identité**. Une image de cadrage n'autorise pas à remplacer le style du jeu. En dehors du dépôt, joindre les images au générateur : un chemin écrit dans un prompt ne lui donne pas accès au PNG.

| Contenu | Références de départ à vérifier dans le code | Ce qu'elles fixent |
| --- | --- | --- |
| Ennemi | `public/assets/zombies/zombie_idle.png`, `public/assets/zombies/agile/idle.png`, `public/assets/zombies/spitter/idle.png` | Traitement des corps, contours, palette et silhouette ; choisir le voisin pertinent |
| Arme FPS | `public/assets/weapons/shotgun/hip-rest-v2.png`, `public/assets/weapons/shotgun/ads_pump_v2.png`, `public/assets/weapons/pistol_actions_v3.png` | Matières, gants noirs fermés, manches gris bleuté ; isoler la bonne cellule d'un atlas |
| Objet / icône | `public/assets/pickups/medkit.png`, `public/assets/pickups/ammo.png`, `public/assets/sprites/upgrades/upgrade-vitality-vial.png` | Volume simplifié, contraste et lecture à petite taille |
| Décor | `public/assets/textures/mansion_wall_v2.png`, `public/assets/textures/wood_floor_v2.png`, `public/assets/textures/mansion/door-panel-v1.png` | Damas bordeaux, bois usé, matériaux et ornement victorien |
| Son | `public/assets/sounds/` et les volumes/appels de lecture du système concerné | Intensité relative, durée, espace et place dans le mix ; écouter si l'outil le permet |

Ces références ne sont pas toutes interchangeables. Les sources ont des résolutions et des niveaux de détail différents ; viser la cohérence **à la taille d'affichage**, pas un nombre de pixels identique pour une fiole et un corps entier. Les anciens essais `ads.png`, `hip.png` ou les poses rejetées ne sont pas des références prioritaires parce qu'ils existent encore.

### Socle à recopier dans chaque prompt visuel

> Asset de jeu pour DEAD SECTOR, FPS rétro dans un manoir victorien hanté. Reprendre le traitement des références jointes : formes lisibles, groupes de pixels perceptibles, contours en marches d'escalier, détails hiérarchisés qui survivent à une petite taille. Palette sourde de bois brun, bordeaux, ivoire vieilli, laiton patiné, fer sombre et gris bleuté selon le matériau. Usure sobre, contraste utile à la silhouette. Ombres larges et diffuses ; aucune lumière ou ombre portée étrangère au rendu prévu. Respecter l'identité et les matériaux existants sans copier la silhouette d'un autre personnage. Pas de rendu photo, lissage brillant, esthétique cartoon arrondie, décor de présentation, texte, signature ou filigrane. Ne produire que les éléments demandés.

Repères de `src/VisualStyle.ts` : ivoire `#d4c6a5`, laiton `#b69a60`, bois `#684532`, fer `#343a3b`, olive `#515546`, pierre `#48423c`, tapis `#4d161a`. Ils orientent les matériaux ; ce ne sont pas les seules couleurs autorisées. Une couleur vive de télégraphie doit rester exceptionnelle et liée à une fonction déjà décidée.

Les mains et manches FPS restent celles du joueur, quelle que soit l'arme. Une surface recevant l'éclairage de Three.js ne doit pas contenir une grosse ombre de pièce ou une source lumineuse peinte en contradiction avec le niveau. Une émission volontaire, comme la gorge du Cracheur, doit être indiquée séparément.

## C. Inventorier le lot complet avant de produire

Créer `docs/asset-packs/<identifiant>.json` en copiant le modèle. Chaque ressource reçoit un usage, un chemin prévu, un statut, ses dépendances et des critères observables. Pour chaque ligne ci-dessous, noter **à produire**, **réutilisé** ou **non applicable avec raison**. « Complet » signifie toutes les ressources nécessaires au contenu demandé, pas toutes les possibilités de la roadmap.

| Famille | Ressources à examiner | Conditions à respecter |
| --- | --- | --- |
| Personnage / ennemi | Base/repos, déplacement, préparation/action/récupération, blessure, chute/cadavre ; relève ou autre action spéciale si prévue | Seulement les états du rôle retenu. Un PNJ n'a pas automatiquement attaque/mort. Les ennemis actuels sont des billboards : ne pas imposer huit directions ou un squelette 3D |
| Arme | Repos hanche, visée ADS si utilisée, tir/recul/retour, action mécanique, rechargement complet, calques fixes/mobiles, ancrages bouche/guidon/mains | Ajouter arme au sol, munitions, douille, flash et icône seulement s'ils servent ; réutiliser les effets compatibles et séparer cartouche intacte/douille usagée |
| Décor / surface | Faces visibles, côtés/dessus, raccords et variantes indispensables ; états d'interaction si présents | Définir les axes de pavage, l'échelle du motif, les UV et le support 3D ; ne pas dessiner une pièce en perspective pour une texture de mur |
| Objet / interface / effet | Sprite ou icône, états réellement utilisés, séquence si animée | Texte dynamique en HTML/CSS ; ne pas produire un bitmap si la géométrie ou le CSS existant convient |
| Son | Repos/déplacement/action/impact/rechargement/ambiance selon le rôle | Vérifier réutilisations, volume relatif, durée, boucle/coupe et simultanéité ; un générateur d'images ne produit pas ces sons |

Ne pas ajouter silencieusement un son, une attaque, une nouvelle direction ou un objet de récompense pour remplir le tableau. Si une action prévue n'a pas sa ressource, la signaler comme manquante ; une pose fixe ne devient pas un cycle complet par changement de nom.

### Contrat technique du lot

Renseigner avant génération :

- Identifiant stable, rôle, périmètre autorisé (préparer / générer / intégrer), décisions reçues et hypothèses. L'intégration artistique et l'ajout d'une mécanique sont des périmètres distincts.
- Références exactes et leur rôle ; attributs d'identité verrouillés : proportions, vêtements, accessoires, matières, orientation, nombre de membres/pièces. Une nouvelle créature peut avoir sa propre silhouette en gardant le langage graphique.
- Dimensions source et export, format, alpha ou opacité, taille cible d'affichage, marges, disposition et ordre des cellules. Mesurer le fichier obtenu plutôt que croire les dimensions demandées au générateur.
- Ancrages en pixels, avec origine en haut à gauche du **canevas ou de la cellule explicitement nommée** ; repère au sol pour les personnages, bouche et guidon pour les armes. Pas de recadrage automatique différent à chaque pose.
- Phases, durées en secondes, parties fixes/mobiles et instants des événements uniques. Définir les parties cachées/découvertes, les interruptions et la transition vers le repos. Ne pas déduire les dégâts ou les munitions du nombre d'images.
- Budget du lot : fichiers, poids disque, dimensions et mémoire de texture approximative (`largeur × hauteur × 4` octets en RGBA8 avant mipmaps). Choisir selon l'affichage ; ne pas régénérer systématiquement des sources immenses.

Un redimensionnement impose de revoir découpes, ancrages et éventuelles zones de tête dans `SpriteHitMask.ts`, ou de conserver explicitement un espace de coordonnées de référence avec conversion. Un chemin identique ne garantit pas la compatibilité. `scripts/optimize-assets.py` modifie les fichiers existants : ne pas le relancer comme simple contrôle.

## D. Produire par étapes, avec un contrôle entre chaque étape

1. **Base unique.** Générer une pose ou un module avec les références de style. Inspecter le fichier et le comparer côte à côte avec l'existant à taille de jeu. Rejeter une identité, un cadrage ou des matières incorrects avant de multiplier les variantes.
2. **Verrouillage de l'identité.** Conserver le fichier de base retenu, ses attributs, ancrages et le prompt exact. Toutes les variantes utilisent cette base comme référence d'identité, plus la référence de style d'origine si nécessaire. Ne pas travailler uniquement à partir de la dernière variante, ce qui accumulerait les dérives.
3. **Une action pilote.** Produire les calques/poses de la plus petite action représentative. Inspecter chaque image puis un cycle normal, lent, et son retour au repos. Pour une surface, examiner un pavage ; pour un objet statique, examiner son support et plusieurs tailles.
4. **Reste du lot.** Étendre seulement après ce contrôle. Utiliser le même contrat et le même bloc de style. En cas de dérive, corriger le fichier fautif avec une demande ciblée ; ne pas régénérer les ressources acceptées sans raison. Ne pas changer de fournisseur au milieu d'une action sans refaire la comparaison de cohérence.
5. **Livraison puis intégration autorisée.** Contrôler la couverture du lot et livrer les fichiers, données et preuves. Intégrer uniquement dans le périmètre reçu ; une préparation de pack peut se terminer sans changer le gameplay.

Ces contrôles intermédiaires sont effectués par l'assistant avec les outils disponibles. Ils ne sont pas des demandes d'accord humain automatiques à chaque image. Si l'utilisateur a demandé de choisir la base, attendre ce choix avant les variantes ; sinon avancer dans le lot autorisé en distinguant « contrôlé par l'assistant » et « approuvé par l'utilisateur ». Si l'outil ne permet pas de voir une animation, son mouvement reste non vérifié et l'intégration animée ne peut pas être déclarée validée.

### Prompts de production : structure stable

Chaque appel contient : **usage → références et rôles → sujet → invariants → seule variation demandée → format/ancrages → exclusions → critères de contrôle**. Copier le socle artistique, ne pas le réécrire librement à chaque pose.

Pour la base : « Références jointes R1/R2 = style, R3 = cadrage seulement. Créer [sujet, usage]. Conserver [attributs]. Sortie [format, canevas, alpha, taille cible, ancrages, marges]. [Socle artistique]. Une seule base, sans variantes ni étiquettes. »

Pour une variante : « Base jointe B = identité exacte, R1 = style. Modifier uniquement [partie et pose]. Garder [canevas, orientation, proportions, vêtements, palette, ancrages]. Parties fixes [liste] ; mobiles [liste]. Visible [liste] ; caché [liste]. Aucun accessoire ou effet ajouté. [Socle artistique et sortie du contrat]. »

Ne demander une planche de plusieurs cellules que si leur nombre, leur ordre et leurs limites sont contrôlables. Sinon produire des poses séparées et assembler de manière reproductible. Un damier dessiné ou un fond noir ne constitue pas une transparence alpha ; ne pas supprimer une couleur sombre au hasard sur une arme ou des vêtements.

## E. Contrôles et transfert entre modèles

| Niveau | Preuve à conserver | Ce que ce niveau ne prouve pas |
| --- | --- | --- |
| Fichier | Existence, dimensions mesurées, format, alpha réel, nombre de cellules, absence de débordement, chemins/découpes/ancrages cohérents | Style et mouvement |
| Artistique | Comparaison avec les références à taille cible, silhouette, matières, absence de halo sur fonds clair/sombre | Animation et gameplay |
| Continuité | Cycle isolé normal/lent, premier/dernier état, identité et appuis stables ; pavage 3 × 3 selon les axes pour les surfaces | Règles de combat |
| Intégration | Chargement réel, filtrage, lumière/ombres, masques de tir, événements uniques, interruption/pause et nettoyage des ressources | Équilibrage d'une partie complète |
| Jeu | Observation dans le niveau, plusieurs tailles/distances, lisibilité et coût comparables à l'existant | Toute situation qui n'a pas été essayée |

Réutiliser les outils pertinents : `scripts/sprite-png-info.mjs` expose des fonctions de lecture RGBA8, d'alpha et de régions ; les `make-*-preview.mjs` créent des aperçus et les `check-*.mjs` testent des comportements précis. Ce ne sont pas des validateurs universels. Inspecter leurs entrées, commandes et chemins de sortie avant emploi. Si du code est modifié, exécuter `npm.cmd run build` et les contrôles ciblés ; ne pas écrire une nouvelle suite pour une simple retouche documentaire.

Pour l'intégration, vérifier les responsabilités réelles : `*Animation.ts` pour les données de poses/temps, `Weapon` ou les classes d'ennemis pour la logique, `ZombieRemains` pour les corps, `WeaponPresentation` et le CSS pour l'arme à l'écran, `MansionMaterials` pour les surfaces, `Game` pour l'orchestration. Aperçu et jeu consomment les mêmes chronologies ; ne pas créer un fichier d'animation séparé qui ne sert qu'à la démonstration. Partager les textures utiles et ne pas libérer une ressource encore utilisée.

### Livrables minimaux du lot

- Fiche `docs/asset-packs/<identifiant>.json` renseignée et fichiers explicitement listés, avec chemin source, export et URL prévue (`public/assets/...` sur disque devient `/assets/...` en jeu).
- Prompts exacts par ressource, références effectivement jointes, outil/modèle réellement utilisé si connu, transformations appliquées et statut des essais rejetés. Une fiche documentaire n'est pas automatiquement chargée par le jeu.
- Poses/calques, ordre des cellules, dimensions mesurées, ancrages, durées et événements ; indiquer quel module consomme ces données ou ce qui reste à intégrer.
- Aperçu accessible et contrôles réellement exécutés, défauts restants, ressources réutilisées/manquantes. Ne pas ajouter des copies inutiles de sons/effets existants.
- Bilan court dans `ETAT_PROJET.md` : réalisé, compilation si concernée, observation navigateur réellement faite, limites et éventuel accord restant. Finir par ce bilan sans question rituelle.

Séparer les statuts de production (`à produire`, `généré`, `réutilisé`, `rejeté`, `manquant`, `non applicable`) des validations (`non vérifié`, `conforme`, `à corriger`) et de l'approbation humaine. Ne jamais marquer tout le lot terminé si une ressource requise manque. Au transfert vers un autre modèle, transmettre la demande, la fiche, la base retenue, les références réelles et le dernier défaut précis ; il reprend à l'étape restante au lieu de tout régénérer.

## Annexe — Animation : principes et retour d'expérience

### Pourquoi les itérations précédentes ont échoué

Une planche pouvait sembler correcte image par image tout en changeant la forme du pistolet entre les poses. Ensuite, les tests de munitions passaient, sans vérifier si le geste de rechargement se lisait bien. Enfin, le même masque affichait un chargeur dans une main censée approcher vide : le mouvement suggérait deux opérations. Génération d'image, animation et règle de gameplay sont trois problèmes à valider séparément.

### 1. Écrire le contrat avant de générer

Définir en une courte fiche :

- **Usage et composition** : vue FPS, objet d'interface ou personnage dans le monde ; position à l'écran et taille réelle d'affichage. Une référence de cadrage ne doit pas devenir une consigne de copier tout son style.
- **Style** : palette, taille des pixels, ombres, densité de détail et éclairage déjà dessiné dans l'image.
- **Invariants** : proportions et identité, perspective, canevas identique, points d'ancrage, transparence et marges. Donner les coordonnées des ancrages dans le canevas, pas dans une silhouette recadrée différemment à chaque pose.
- **Éléments mobiles** : préciser quelles pièces bougent et lesquelles restent identiques. Exemple : culasse, chargeur et main secondaire, tandis que la carcasse reste stable.
- **Scénario de l'action** : une phrase par phase, indiquant le mouvement ET ce qui doit être visible ou caché. Exemple : approche main vide → extraction → échange → insertion → retrait main vide.
- **Règle de gameplay associée** : quand se produit le résultat, et que se passe-t-il si l'action est interrompue ? L'affichage ne doit pas déclencher implicitement un second transfert de balles.

### 2. Choisir une technique adaptée à la précision

- Pose de repos : un sprite unique peut suffire.
- Pièces rigides en mouvement : préférer des couches issues de la même base plutôt que plusieurs redessins indépendants. Si leur perspective change vraiment, une simple rotation 2D ne suffit pas.
- Déformation organique (marche, visage) : utiliser de vraies poses dessinées, avec silhouette et points d'ancrage vérifiés.
- Perspective mécanique complexe : envisager de produire les sprites à partir d'un modèle 3D de référence cohérent, même si le jeu les affiche ensuite uniquement en 2D. C'est une possibilité future, pas une refonte automatique du projet.

La génération IA donne une matière visuelle ; elle ne garantit ni les proportions exactes ni une animation mécaniquement cohérente. Accepter de retoucher, de séparer les pièces ou de rejeter une planche au lieu d'essayer de tout compenser en CSS.

### 3. Trois validations avant d'étendre l'intégration

1. **Base** : afficher une seule pose à sa taille de jeu. Vérifier orientation, silhouette, raccords et lisibilité. Ne pas produire vingt poses autour d'une base incorrecte.
2. **Action hors gameplay** : regarder une planche puis jouer un seul cycle, avec lecture lente si nécessaire. Vérifier début, milieu, fin, nombre d'actions, ordre des pièces et absence de saut d'échelle. Un aperçu en boucle automatique peut masquer un retour au repos incorrect.
3. **Intégration** : vérifier l'état de départ, l'annulation et la fin, les effets, les données et l'interface ; puis observer l'action dans le vrai décor, à différentes résolutions et conditions d'éclairage.

Après ces contrôles, conserver l'asset accepté, sa fiche et la liste des limites. Les variantes rejetées restent identifiables, sans ambiguïté sur celle que le jeu charge.

### Application actuelle : pistolet

`src/WeaponAnimation.ts` est la chronologie commune du jeu et de l'aperçu. Elle nomme les phases et indique la visibilité indépendante de la main et du chargeur. `scripts/make-weapon-preview.mjs` utilise ces mêmes données ; il ne maintient plus une copie des poses.

Exécuter `node scripts/make-weapon-preview.mjs`, puis ouvrir `tmp/weapon-preview/standalone.html`. Le bouton joue un cycle sans simulation de combat. Observer d'abord sans lire le titre des phases : le geste doit se comprendre par lui-même. Les tests de `scripts/check-weapon.mjs` vérifient la chronologie et les munitions, pas la qualité artistique.

### Fiche courte pour une action animée

> Asset à créer : [objet / personnage / interface]. Usage et cadrage : […]. Référence de style : […]. Invariants : [dimensions, palette, perspective, proportions et ancrages]. Parties fixes : […]. Parties mobiles : […]. Action à raconter une seule fois : […]. Pour chaque phase, préciser ce qui est visible, ce qui bouge et sa durée. Produire d'abord une base et une courte prévisualisation à la taille cible ; valider ces éléments avant de généraliser. Vérifier séparément qualité visuelle, continuité d'animation et règles d'intégration. Signaler les limites de l'outil au lieu de remplacer silencieusement une exigence par une approximation.

Ce protocole s'applique aussi à un ennemi (silhouette et appuis des pieds), une porte (charnières et collision) ou une interaction d'interface (état initial, action unique, résultat). Il réduit les ambiguïtés ; il ne supprime pas le besoin d'observer le résultat.
