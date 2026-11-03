# Recensement des assets graphiques — DEAD SECTOR

État inspecté le 3 novembre 2026, après F5. Périmètre : manoir actuel, deux armes, deux ennemis, interactions, interface et extensions prévues par F5/F6/F7. Ce document propose des productions artistiques ; il ne vaut pas accord pour les générer ou les intégrer.

**Évolution ultérieure le même jour :** l'utilisateur a validé le premier lot et demandé l'examen artistique des armes. A01–A04 sont désormais générés et intégrés aux stèles ; le dépôt compte quatre PNG de plus. Les constats d'absence ci-dessous décrivent l'inventaire avant cette réalisation. Rapport et contrats : `COHERENCE_GRAPHIQUE_BONUS_ARMES_2026-11-03.md`. Aucune image d'arme n'a été remplacée ; les autres propositions restent à traiter par lots.

## Ce que l'audit permet d'affirmer

**Deuxième évolution le même jour :** huit textures supplémentaires et des luminaires simples sont générés/intégrés sur les volumes existants. A07/A08 et A10–A16 sont traités pour leurs surfaces, avec les limites décrites dans `DECOR_SURFACES_2026-11-03.md` (pas de sculpture A09 ni d'accessoires d'atelier). Le présent tableau conserve le constat initial ; l'état courant fait foi dans `ETAT_PROJET.md` et le code. Filtres et luminosité des armes sont également corrigés depuis l'audit : `ARMES_RENDU_RETRO.md`.

- Le dépôt contient **33 PNG dans `public/assets`**, pour environ **28,78 Mio de fichiers compressés**, ainsi qu'un favicon SVG. Ce total comprend des références et variantes non utilisées ; ce n'est ni le poids chargé par une partie ni une mesure de mémoire GPU.
- L'examen des chemins littéraux `assets/...` dans `src` et `index.html` retrouve **quatre chemins absents**, tous dans `UpgradeConfig.spriteAssetId`. Ce sont des noms de fichiers futurs : `UpgradePedestal` ne les charge pas actuellement. Leur absence ne démontre donc pas une erreur réseau en jeu. Cette recherche ne prouve pas tous les chargements dynamiques dans le navigateur.
- Des objets nommés « bibliothèque », « cheminée sculptée » ou « lustre » dans les commentaires ne possèdent pas nécessairement un asset artistique détaillé. Le code réel est décrit ci-dessous.
- Les images `portrait_v2.png` et `reload_draft.png` ont été inspectées isolément ; les autres constats portent sur les fichiers, métadonnées, configurations et composants de rendu. Aucun nouveau parcours navigateur, examen de toutes les animations en mouvement ou profil GPU pendant ce recensement.
- Aucun code de jeu ni bitmap modifié. Aucun build ou test relancé pour cette intervention documentaire.

## 1. Ressources déjà disponibles à conserver comme références

| Ensemble | Présent dans le dépôt et/ou le rendu actuel | Limite à ne pas confondre avec une absence |
| --- | --- | --- |
| Zombie standard | Repos, marche, attaque, blessure, chute/cadavre : cinq PNG | Une orientation visuelle, billboard tourné vers le joueur ; continuité et lecture en jeu à observer |
| Coureur agile | Repos, course, attaque, blessure, chute/cadavre : cinq PNG | Même limite d'orientation ; inutile de recréer les cinq actions pour le simple inventaire |
| Pistolet | `pistol_actions_v3.png`, `modern_ads.png` ; culasse, main et chargeur animés par couches | Les parties découvertes sont simplifiées ; les poses hanche et ADS proviennent de dessins différents |
| Fusil | Repos/pompe/recul hanche et ADS, flash, cartouche, douilles, arme au sol et boîte de cartouches | Le stock inclut des variantes de référence/rejetées. `reload_draft.png` existe, mais n'est pas un cycle complet de rechargement dédié |
| Ramassables | Kit de soin, munitions pistolet, munitions fusil, fusil de profil | Leurs images existent ; les quantités et interactions n'exigent pas de nouveaux dessins |
| Manoir | Papier peint/lambris, parquet, un portrait ancestral encadré | Les trois textures v2 sont présentes. Le même portrait est réutilisé aux dix emplacements de `Level` |
| Effets et interface | Impacts, éclats, voile de blessure, viseur, flash pistolet, HUD et panneaux | Plusieurs sont dessinés par géométrie ou CSS et fonctionnent sans PNG |

Références de style : palette `VisualStyle.ts`, armes et mains existantes (gants noirs fermés, manches gris bleuté), zombie standard/coureur, textures v2. Viser une densité de pixels cohérente à la taille affichée, plutôt qu'une même résolution source pour tous les objets.

## 2. Manques explicites et représentations provisoires existantes

Priorité **haute** : rend une action ou une pièce immédiatement plus compréhensible. **Moyenne** : enrichit un élément déjà fonctionnel. Les formes 3D simples restent une solution valable ; toutes n'ont pas besoin d'être remplacées par des sprites.

| ID | Asset ou petit ensemble à produire | Constat dans le code réel | Proposition et rôle | Priorité / dépendance |
| --- | --- | --- | --- | --- |
| A01 | Cartouchière renforcée | `UpgradeConfig.ts` annonce `assets/sprites/upgrades/upgrade-ammo-pouch.png`, absent | Une icône transparente de cartouchière ; affichable sur la stèle et réutilisable dans le suivi des bonus | Haute ; intégration d'image à ajouter au support |
| A02 | Canon ajusté | `upgrade-tight-choke.png`, absent | Une pièce mécanique/symbole de précision distinct et lisible | Haute ; même contrat visuel que A01 |
| A03 | Élixir de vitalité | `upgrade-vitality-vial.png`, absent | Une fiole clairement différente du kit de soin déjà présent | Haute ; même contrat visuel |
| A04 | Bottes souples | `upgrade-light-boots.png`, absent | Une paire de bottes ou silhouette de botte identifiable à petite taille | Haute ; même contrat visuel |
| A05 | Habillage des stèles d'offrandes | `UpgradePedestal.ts` : socle cubique, plaque et lumière ; aucune image du bonus | Une surface gravée commune ou un petit pupitre plus travaillé, avec emplacement stable pour A01–A04 | Moyenne ; commencer par les icônes avant de refaire le meuble |
| A06 | Habillage du carillon | `EncounterBell.ts` : deux cylindres et une veilleuse | Cloche en laiton avec battant/support identifiable et distinction disponible/inactive par la forme ou l'habillage | Haute pour la lecture de l'interaction ; modèle simple ou texture, pas nécessairement animation raster |
| A07 | Bibliothèques et livres | Rayonnages dans `MansionConfig`, rendus comme boîtes en bois par `Level` | Façade d'étagères garnies, dessus et côtés cohérents ; 2–3 variantes de dos de livres | Haute : donner une identité à la Bibliothèque sans déplacer les obstacles |
| A08 | Établi et matériel d'atelier | Un seul obstacle cubique décrit comme « établi et générateur » | Habillage de table, pots, pinceaux, châssis/toiles ; décider si le générateur appartient réellement à la direction artistique | Haute ; conserver l'encombrement actuel au premier essai |
| A09 | Sculpture de Galerie | Le « piédestal de sculpture » est un bloc ; aucune sculpture distincte | Buste, statue ou urne ; silhouette différente d'un ennemi, sur le volume existant | Moyenne ; vérifier les vues depuis plusieurs côtés |
| A10 | Colonnes du Grand Hall | Deux boîtes en bois unies | Fûts, bases et chapiteaux simples ; bois sculpté ou pierre à choisir | Moyenne ; une texture/forme modulaire peut suffire |
| A11 | Tapis damassé | `createSalonCarpetAndFrames` : plans bordeaux et bordure unie, sans `map` | Motif central sobre, bordures et extrémités raccordables pour les segments du circuit | Haute : enrichir le repère de circulation en gardant son contraste utile |
| A12 | Pierre et briques de cheminée | `createSalonFireplace` : volumes séparés, matériaux unis pierre/âtre/braises | Pierre usée, briques noircies, suie et petite texture de braises ; le relief existe déjà en géométrie | Moyenne ; pas besoin d'un nouveau feu animé au premier lot |
| A13 | Portes victoriennes et ferrures | `Door.ts` réutilise la texture du parquet sur les panneaux ; poignées/ferrures en boîtes | Texture de vantail à panneaux, serrurerie, variante de grille si souhaitée ; adapter l'image aux deux battants existants | Haute ; garder pivots, passages et collisions actuels |
| A14 | Plafond et boiseries de structure | Le plafond réutilise le parquet ; poutres et marches ont une couleur unie | Texture de plafond/panneaux, faces de marches et bois de poutres, avec raccords prévisibles | Moyenne ; petit atlas partagé plutôt qu'une texture par marche |
| A15 | Garde-corps et soutènement | Plusieurs volumes sont classés `wall` et reçoivent donc le matériau mural commun | Surfaces adaptées : boiserie basse, pierre, balustres ou grille visuelle | Moyenne ; ne pas rendre la collision trompeuse avec une grille percée laissant croire que les tirs passent |
| A16 | Lustre, bougies et appliques visibles | `Level` crée les lumières du lustre et des bougies, sans mesh de luminaire associé dans ce code | Un lustre central, une applique/bougie réutilisable et un support ; flamme statique ou petit cycle séparé ensuite | Haute pour expliquer les sources lumineuses ; réutiliser les lumières existantes |
| A17 | Rechargement dédié du fusil | Cycle jouable par couches à partir de `reload_draft`, d'une main du pistolet et de `live_shell` ; port simplifié en CSS | Calques propres carcasse/port/main/cartouche, avec approche vide → présentation → insertion → retrait vide et transitions vers la pose de tir | Moyenne à haute selon ressenti ; ce n'est pas une animation absente. Les anciens refus de génération sont consignés dans les documents du fusil |
| A18 | Calques propres du pistolet | Main/chargeur découpés d'une planche et métal découvert par dégradé CSS | Calques transparents conçus ensemble pour carcasse, culasse, intérieur, mains et chargeur | Moyenne ; remplacer seulement après comparaison d'un cycle avec l'existant |

Les quatre noms A01–A04 existent déjà dans le catalogue ; les noms/organisations des autres futures ressources restent à décider. Aucun de ces ajouts n'exige automatiquement un modèle 3D importé : petites géométries texturées et sprites suffisent souvent.

## 3. Ajouts possibles pour donner une identité aux pièces

Ces éléments n'ont pas été promis comme fonctionnalités manquantes. Ce sont des propositions artistiques, à choisir selon les vues et les trajets réellement utilisés.

| ID | Ensemble proposé | Usage concret | Production minimale proposée |
| --- | --- | --- | --- |
| B01 | Variantes de tableaux | Réduire la répétition d'un même ancêtre et fournir des repères par pièce | 2–3 œuvres supplémentaires : portrait, paysage, nature morte ; cadre partagé si pertinent |
| B02 | Plaques de pièces et symboles d'accès | Identifier Hall, Bibliothèque, Atelier et raccourcis pendant l'exploration | Une plaque commune et des pictogrammes ; générer le texte lisible par code plutôt que l'enfermer dans une image IA |
| B03 | Fenêtre et rideaux | Donner une origine visuelle au clair de lune, rythmer les murs | Un module de fenêtre opaque trompe-l'œil et un rideau ; une vraie ouverture nécessiterait un atelier de géométrie distinct |
| B04 | Mobilier du Salon/Vestibule | Donner une échelle et une histoire au lieu | Un fauteuil/canapé et une console, placés hors des passages ; silhouettes visibles de plusieurs côtés |
| B05 | Accessoires de Bibliothèque | Compléter A07 sans encombrer la boucle | Livre fermé/ouvert, pile, globe ou pupitre ; sélectionner quelques objets, pas tous |
| B06 | Accessoires d'Atelier | Renforcer A08 | Chevalet, toile retournée, outils de peinture ; une toile peut réutiliser B01 |
| B07 | Usure localisée | Rompre les répétitions de papier peint/parquet | Petit atlas de fissures, humidité, papier décollé, frottements, poussière, toiles d'araignée ; alpha et contraste contenus |
| B08 | Porte condamnée | Rendre la limite nord compréhensible | Planches/scellé/serrure, sans signal d'extraction puisque l'extraction n'est pas l'objectif du jeu |

Un objet posé dans le monde peut demander plusieurs faces ou un petit volume 3D ; un sprite frontal tourné vers le joueur convient aux ramassables, mais peut être perceptible comme un panneau pour une grande bibliothèque ou un fauteuil. Le choix dépend du rôle et des angles de vue.

## 4. Effets et interface : améliorations facultatives

| ID | Asset proposé | Existant à préserver | Gain visé / limite |
| --- | --- | --- | --- |
| C01 | Petit atlas d'impacts bois/pierre/métal | `HitEffects` dessine déjà éclats et marques, avec plafonds et disparition | Différencier les matériaux. Il faudrait aussi identifier la surface dans le code ; l'image seule ne suffit pas |
| C02 | Flash pistolet dessiné | Le pistolet utilise un flash en dégradé CSS ; celui du fusil a déjà sa planche | Cohérence pixel art du flash ; une ou deux poses, ancrage de bouche stable |
| C03 | Braises/flamme, poussière légère | Braises actuellement en matériau émissif et brume Three.js | Petite animation uniquement si les images fixes ne suffisent pas ; limiter la transparence superposée et garder les ennemis lisibles |
| C04 | Icônes HUD santé, munitions, lampe, armes | HUD textuel et viseur CSS déjà fonctionnels | Compréhension plus rapide. Réutiliser les dessins de ramassables/armes et A01–A04 lorsque possible |
| C05 | Logo DEAD SECTOR et favicon propre | Titre HTML textuel ; `favicon.svg` existant est une icône abstraite violette/bleue | Identité de la démo ; logo vectoriel possible. Une grande illustration d'accueil n'est pas nécessaire à la boucle actuelle |
| C06 | Habillage de pause et de bilan | Panneaux HTML/CSS existants ; bilan final F6 non défini | Bordure/papier/ornement discret, texte dynamique séparé. Ne pas produire d'écran final figé avant de définir son contenu |

Les douilles sont déjà de petits cylindres 3D ; ajouter des sprites n'est pas automatiquement une amélioration. Le viseur doit continuer à refléter le cône de dispersion, même si son aspect change. Le voile de dégâts n'exige pas une image « sang sur l'écran » supplémentaire.

## 5. Ressources futures conditionnées par les ateliers

| ID | Ensemble futur | Ce qu'il faudra éventuellement produire | Accord/décision avant production |
| --- | --- | --- | --- |
| D01 | Silhouette d'ambiance F5 | Une base lisible, puis quelques poses de retrait si un mouvement est retenu | L'événement visuel n'est pas implémenté ni autorisé par l'atelier sonore F5 ; aucune collision/cible/attaque fictive |
| D02 | Portrait altéré F5 | Une variante du portrait strictement alignée sur sa base (cadre, taille et position identiques) | Choisir le changement et ses conditions d'apparition ; une belle variante seule ne crée pas l'événement |
| D03 | Identité de l'élite finale F6 | Base, déplacement, préparation d'attaque, impact, récupération, blessure et mort selon le comportement retenu | F6 n'est pas encore autorisé ; définir l'attaque avant le nombre de poses. Un prototype peut d'abord réutiliser un ennemi existant |
| D04 | Orientations des zombies | Vues latérales et arrière cohérentes pour les actions utiles, sur les deux variantes | Extension facultative : le système actuel est un billboard à une vue. Le choix de direction, les UV et les ombres demandent aussi du code ; le volume artistique se multiplie vite |
| D05 | Variantes d'apparence des ennemis | Quelques vêtements/visages alternatifs gardant le type standard/agile identifiable | Tester d'abord que la diversité ne masque pas la distinction des deux menaces ; pas de nouvelles statistiques implicites |
| D06 | Illustrations de présentation F7 | Capture propre, visuel de couverture et éventuellement écran titre | À préparer une fois le rendu représentatif et le format de démo fixés ; publication séparément autorisée |

Les silhouettes, le portrait altéré et l'élite finale ne sont pas des PNG perdus du dépôt : leur production appartient à des ateliers futurs. Le premier F5 sonore ne demande aucun nouvel asset graphique.

## 6. Ordre de production conseillé

1. **Lot court recommandé : les quatre bonus A01–A04.** C'est le manque le plus explicite et il touche une décision déjà jouable. Valider une icône sur une vraie stèle à taille réelle avant de produire les quatre. Une intégration sera nécessaire : renseigner `spriteAssetId` ne dessine rien à lui seul.
2. **Identité des lieux et des interactions : A06, A07, A08, A11 et A16.** Carillon, rayonnages, établi, tapis et luminaires produisent des repères reconnaissables. Commencer dans une pièce témoin avec les mêmes vues avant/après.
3. **Surfaces partagées : A12–A15 et B01–B02.** Améliorer les zones vues en mouvement, puis les détails décoratifs B03–B08 si le budget le permet.
4. **Finition des armes : A17/A18 et éventuellement C02.** La priorité exacte dépend de la lecture réelle des gestes ; ne pas jeter les animations jouables actuelles sans cycle de remplacement validé.
5. **Extensions D01–D06**, à mesure que leurs mécaniques sont choisies. Ne pas commander un gros pack de boss ou des dizaines de directions d'ennemis avant leur contrat.

## 7. Contrat de production et vérifications à appliquer

- **Icône/sprite** : PNG avec alpha réel, marges et ancrage stables ; proposition de travail de 64 à 128 pixels utiles pour une icône à tester. Dimension définitive selon la taille affichée, pas une obligation de générer tous les fichiers en 1 024 px.
- **Texture de surface** : définir d'abord le pavage horizontal/vertical et les UV ; petits modules, palette commune, illumination diffuse sans ombres directionnelles déjà dessinées. Une porte n'a pas les mêmes raccords qu'un sol.
- **Objet volumétrique** : silhouette et faces visibles avant les microdétails ; réutiliser matériaux et géométries. Conserver les dégagements, collisions et blocages de tirs, sauf changement explicitement décidé.
- **Animation** : suivre `PIPELINE_ASSETS.md` : composition, invariants, parties mobiles, phases ; accepter une base puis un cycle isolé à taille réelle. Jeu et aperçu doivent partager les données. Les anciens refus de génération ne constituent pas une invitation à contourner les limites de l'outil.
- **Intégration** : une image produite n'est pas une fonction intégrée. Par exemple : `Game` tire un bonus → `UpgradePedestal` reçoit son `UpgradeSpec` → un futur élément visuel charge l'icône → la sélection appelle toujours l'effet existant. L'image ne doit pas modifier les statistiques.
- **Budget** : les PNG actuels sont souvent de grandes sources (jusqu'à 2 172 px de large). Des variantes de diffusion plus petites pourraient être évaluées en conservant les originaux ; ne pas confondre poids PNG, taille utile de sprite et mémoire GPU. Mesurer avant/après en scène réelle, surtout pour les couches transparentes.
- **Validation** : inspecter à la résolution interne du jeu, sous la lumière réelle et en déplacement, puis contrôler chargement, alpha, lisibilité, continuité, collisions et performance. Ni la présence d'un fichier ni la compilation ne prouvent ces qualités.

Sources principales : `UpgradeConfig.ts`, `UpgradePedestal.ts`, `EncounterBell.ts`, `Level.ts`, `MansionConfig.ts`, `Door.ts`, `HitEffects.ts`, `ShotgunAnimation.ts`, `WeaponAnimation.ts`, `style.css`, `index.html`, `FUSIL_RECHARGEMENT_COUCHES.md`, `ARME_COUCHES.md`, `asset-packs/POMPE_AGILE_LIVRAISON.md`, `ROADMAP.md`. Les anciennes listes d'assets des documents peuvent décrire des variantes supprimées depuis ; les 33 fichiers constatés et les chargements du code courant font foi pour cet inventaire.
