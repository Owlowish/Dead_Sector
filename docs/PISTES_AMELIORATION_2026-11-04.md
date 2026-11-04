# DEAD SECTOR — Pistes d’amélioration du jeu

Document de conception du 4 novembre 2026. Ces pistes sont des propositions à discuter, pas une autorisation de les implémenter toutes. Le code et `ETAT_PROJET.md` décrivent l’avancement réel. Ce document privilégie le run courant, le feeling de tir et l’esthétique ; la rencontre finale reste un chantier ultérieur.

**Mise à jour du 4 novembre** : après retour de jeu, la pression des vagues a été traitée en premier : plafond progressif jusqu’à huit menaces, trois Cracheurs possibles à P6–P7 et apparitions sûres plus proches. Une première passe sonore et un grain commun ont aussi été implémentés. Les sections ci-dessous restent des pistes de conception datées ; consulter `ETAT_PROJET.md` pour les vérifications et les limites actuelles.

## 1. Intention générale

Faire du manoir un lieu que le joueur apprend à utiliser, dont il redoute les surprises, et dans lequel chaque tir et chaque déplacement donnent une information compréhensible. La cible reste une tentative courte de 10 à 15 minutes, avec une progression de tension et une conclusion prévue par la roadmap.

Le projet possède déjà beaucoup de mécanismes. Le prochain gain de qualité viendra surtout de leur cohérence : un son qui correspond à l’arme, une blessure qui correspond à l’impact, une récompense qui arrive au bon endroit, une attaque que l’on comprend même dans l’obscurité.

## 2. Point de départ et incertitudes

Le code local comprend deux armes, trois types d’ennemis, des cadavres et relèves, une progression de sept rencontres, un manoir à plusieurs niveaux, des effets d’impact et une ambiance d’orage. Le dernier atelier ajoute les tirs tête/corps, des drops de munitions, des escortes de Cracheurs et un décompte automatique entre les paliers. Les caisses fixes et les piédestaux ne sont plus créés dans ce flux.

Ces changements récents compilent et plusieurs tests ciblés passent. Cela ne valide pas encore leur équilibre. Les régions de tête, les budgets de munitions et les escortes doivent être observés pendant une vraie tentative. L’essai automatisé Chrome n’a pas permis d’obtenir cette validation ; certains tests historiques attendent encore les anciennes règles. Leur échec doit être examiné, pas automatiquement déclaré sans importance.

Les propositions de choix gratuits et d’activation manuelle des anciens documents ont été remplacées, pour le dernier atelier, par la fiche `SPEC_HORDE_PRECISION_2026-11-03.md`. Ne pas réintroduire les piédestaux ou un menu obligatoire au détour d’une amélioration.

## 3. Priorités proposées

| Ordre | Atelier | Bénéfice attendu | Effort relatif |
| --- | --- | --- | --- |
| 0 | Vérifier une tentative réelle et les nouveaux mécanismes | Disposer d’une base fiable pour décider | Moyen |
| 1 | Donner une identité sonore et visuelle aux tirs et impacts | Sentir l’arme et comprendre ce que l’on touche | Moyen |
| 2 | Harmoniser les armes, ennemis et effets à la résolution du jeu | Donner une identité graphique plus cohérente | Moyen |
| 3 | Tester un objectif facultatif dans une pièce | Créer une décision de déplacement pendant le combat | Moyen à élevé |
| 4 | Construire une séquence d’horreur contextuelle | Faire monter l’inquiétude sans brouiller les attaques | Moyen |
| 5 | Varier quelques situations entre les tentatives | Donner envie de rejouer sans ajouter des systèmes lourds | Moyen |

L’ordre est indicatif. L’atelier 0 peut faire remonter une correction précise avant tout nouvel ajout.

## 4. Feeling de tir : rendre le résultat sensible

### Constat

`Weapon` possède déjà recul, flash, lumière et sons. `Game` transmet les impacts à `HitEffects`, tandis que les ennemis gèrent leurs blessures. Le pistolet et le fusil utilisent actuellement le même fichier de détonation dans `Weapon`. Les effets de décor restent génériques. Ce sont deux leviers concrets à travailler avant de multiplier les effets.

### Proposition : une identité par arme et par impact

- **Pistolet** : attaque sonore courte et nette, petit bruit mécanique, réaction visuelle brève.
- **Fusil** : détonation plus ample, puis bruit de pompe clairement séparé dans le temps. Sa puissance doit se lire dans ce rythme, pas seulement dans un volume supérieur.
- **Bois** : éclats bruns et impact mat ; **pierre** : poussière claire et choc sec ; **métal** : quelques étincelles et résonance courte.
- **Corps et tête** : confirmation discrète mais distincte. Le retour d’une tête touchée doit rester perceptible en visée et ne pas se confondre avec celui d’une élimination.

Premier périmètre : deux sons de tir distincts et deux surfaces représentatives du manoir, puis comparaison avec un impact ennemi. Éviter un catalogue complet de matériaux avant d’avoir entendu et vu ce premier résultat.

**Fichiers concernés :** `Weapon.ts` déclenche le son et produit l’impact ; `Level.ts` ou les données du décor identifient la surface ; `HitEffects.ts` choisit les éclats ; `Game.ts` relie les systèmes ; `style.css` porte le retour au viseur.

**Concepts :** synchroniser plusieurs retours sur le même événement ; distinguer la simulation des dégâts de leur représentation. Le recul utilisateur de deux secondes reste la référence tant qu’un changement n’est pas expressément retenu.

**Validation :** tirer avec chaque arme sur les mêmes cibles, en hanche puis en visée, dans une pièce sombre et une pièce éclairée. Vérifier que le joueur reconnaît le résultat, que le son ne masque pas la préparation du Cracheur et que les particules ne cachent pas un second ennemi.

**Compromis :** trop de flash ou de secousses peut donner une impression de puissance tout en rendant la visée pénible. La priorité est un choc bref suivi d’un retour lisible. Les nouveaux sons devront avoir une provenance et une licence documentées.

## 5. Esthétique : unifier ce qui est déjà visible

### Proposition : une scène de référence à taille de jeu

Choisir une pièce et y comparer pistolet, fusil, standard, Coureur, Cracheur et ramassages à leurs distances habituelles. Examiner leur taille de pixels, les contours transparents, la palette et la réaction à la lumière. Des sources très détaillées peuvent paraître cohérentes en grand et devenir trop lisses ou illisibles une fois réduites.

Le premier atelier serait une passe de cohérence sur cette scène : éclairage des armes accordé au décor, silhouette des ennemis lisible, effets d’impact de la même famille graphique, ressources reconnaissables sans lueur excessive. Étendre seulement les réglages qui améliorent cette référence.

**Fichiers concernés :** `WeaponPresentation.ts`, `VisualStyle.ts`, `MansionMaterials.ts`, `PickupSprite.ts`, `style.css` et les modules d’animation des ennemis.

**Validation :** comparer les mêmes cadrages avant/après, près et loin, avec et sans lampe. Regarder aussi un déplacement réel : une capture fixe ne prouve pas la continuité d’une animation. Pour un nouvel asset animé, suivre `PIPELINE_ASSETS.md` et valider un cycle isolé avant de produire les autres.

**Compromis :** un filtre rétro global ne corrige pas à lui seul des proportions ou des palettes incompatibles. Éviter une régénération massive des assets et les effets plein écran qui feraient perdre les détails utiles au combat.

## 6. Run courant : donner une raison de choisir une pièce

### Hypothèse de conception

La boucle actuelle demande surtout d’éliminer les ennemis et de récupérer les munitions. Un objectif facultatif pourrait donner au joueur une raison de traverser une aile pendant le combat, au-delà de la fuite.

### Proposition : rétablir l’éclairage d’une aile

Au palier 4, un boîtier accessible permettrait de rétablir l’éclairage d’une pièce jusqu’à la fin du palier. Le joueur maintiendrait une interaction courte tout en gardant la possibilité de partir ; l’action s’annulerait proprement si la portée ou le contrôle est perdu. L’avantage serait uniquement spatial et visuel dans ce premier essai.

L’objectif resterait facultatif et se déroulerait pendant le combat. Le décompte de dix secondes ne convient pas à un détour obligatoire à travers le manoir. La fin du palier resterait conditionnée aux ennemis et aux relèves, jamais à ce boîtier.

**Fichiers concernés :** `Game.ts` pour le contexte du palier, `Level.ts` pour la pièce et sa lumière, `MansionConfig.ts` pour le placement. Une classe dédiée à l’interaction ne serait utile que si cette responsabilité devient substantielle.

**Concepts :** interaction interrompable et avantage limité dans le temps. **Validation :** observer si le joueur hésite réellement entre le détour et une trajectoire sûre, et si les deux choix permettent de terminer la vague.

**Compromis :** si la pièce est inutilisable sans l’objectif, celui-ci devient obligatoire. Si l’éclairage change à peine la lecture du lieu, le détour ne vaut rien. Tester ces deux extrêmes avant d’ajouter d’autres objectifs.

## 7. Horreur : faire réagir le manoir au contexte

### Proposition : une seule séquence maîtrisée

Pendant une accalmie, un bruit local vient d’une pièce déjà parcourue. Si le joueur tourne son regard vers elle, il peut percevoir une silhouette brève ou un détail déplacé. L’événement se termine avant le prochain combat, sans prendre le contrôle de la caméra.

`HorrorDirector` pourrait choisir le moment ; `Level` fournirait des points accessibles ; `Game` communiquerait l’état réel de la partie. Les sons d’ambiance doivent rester distincts des signaux d’attaque indispensables.

**Validation :** vérifier les cas où le joueur regarde déjà l’endroit, l’ignore complètement, met en pause ou commence le palier suivant. L’événement doit rester cohérent dans chacun de ces cas.

**Compromis :** trop fréquent, il devient prévisible. Trop semblable à une vraie menace, il apprend au joueur à ignorer les signaux utiles. Une seule bonne séquence est un meilleur premier test qu’une longue liste d’événements aléatoires.

## 8. Rejouabilité : varier la situation sans perdre les repères

Après validation de la boucle, tester deux variantes d’un même palier : même budget d’ennemis et de munitions, mais lieux d’arrivée ou pièce de l’objectif différents. Le joueur doit pouvoir réutiliser sa connaissance du manoir tout en adaptant son trajet.

Conserver une graine de hasard de diagnostic permettrait de rejouer exactement une situation problématique. Les différences doivent rester contrôlées : ne pas modifier simultanément quotas, dégâts, vitesse, éclairage et ressources.

**Fichiers concernés :** `EncounterConfig.ts`, `Game.ts`, `TierDiagnostics.ts`. **Validation :** comparer deux variantes au même palier, avec les mêmes armes, puis mesurer durée, munitions et causes d’échec. Une nouvelle arme ou un nouveau monstre ne serait envisagé que pour un rôle encore absent.

## 9. Protocole de décision

Pour chaque atelier, écrire une hypothèse courte avant le code : « Le joueur doit reconnaître un impact sur le bois sans regarder le marqueur », par exemple. Préparer une situation reproductible, changer une dimension, puis noter ce qui s’est réellement passé.

Pour une tentative complète, relever : temps par palier, tirs et ramassages, réserves avant les dernières éliminations, dégâts subis, attente sans menace visible, chutes de fluidité et moments d’incompréhension. Les éliminations forcées par script ne mesurent pas l’économie réelle de munitions.

Une piste peut être conservée, ajustée ou abandonnée. Sa présence dans ce document ne la rend pas nécessaire au jeu.

## 10. Prochain atelier recommandé

Vérifier d’abord le dernier lot dans une partie réelle et corriger les problèmes bloquants observés. Ensuite, retenir **l’identité sonore et visuelle des tirs et impacts** comme premier atelier de finition : il s’appuie sur des systèmes existants et donne un résultat immédiatement comparable.

Petit exercice de conception : après cinq tirs au pistolet puis cinq au fusil, noter séparément ce que l’oreille, l’arme à l’écran et la cible indiquent. Quel signal manque lorsqu’un impact semble faible ? Cette observation aidera à choisir le bon levier sans augmenter tous les effets à la fois.

## Références du projet

- `ETAT_PROJET.md` : implémentations et vérifications datées.
- `SPEC_HORDE_PRECISION_2026-11-03.md` : derniers besoins de combat et de progression.
- `COMBAT_FEEDBACK.md` : flux des impacts, dispersion et effets existants ; certaines limites sont historiques.
- `FUSIL_RECUL_ADS.md` et `FUSIL_RECHARGEMENT_COUCHES.md` : animation du fusil et limites de validation.
- `ORIENTATION_JEU.md` et `ROADMAP.md` : direction générale et jalons, à lire avec les décisions plus récentes.
- `PIPELINE_ASSETS.md` : préparation et validation des assets animés.
