# Fusil à pompe et Coureur — livraison artistique

Préparation du 2 novembre 2026. Demande : images cohérentes avec le pistolet et le zombie initiaux, puis démarche/prompt pour Gemini. Aucune intégration de ces nouvelles mécaniques dans `src/` par cet atelier.

## État exact

**Zombie agile : cinq planches disponibles**, repos, course, attaque, blessure et mort/cadavre. **Fusil : poses hanche/ADS/pompe, flash, cartouche, douilles et ramassages disponibles ; planche de rechargement manquante.** Deux demandes de planche d'insertion ont été refusées par le système de sécurité de l'outil d'images. Aucun `reload.png` n'a été créé. Le pack fusil ne doit pas être annoncé complet. Le journal de prompts consigne ces refus.

Les ressources sont des candidats artistiques inspectés, pas des mécaniques validées en jeu. Les vues de repos recommandées proviennent des mêmes planches que leurs poses de pompe pour limiter les différences de cadrage. Les variantes rejetées restent identifiées et conservées.

## Fichiers à utiliser

Tous les chemins de ce tableau sont relatifs à `public/assets/`.

| Fichier | Contenu et usage |
| --- | --- |
| `weapons/shotgun/hip_pump.png` | Deux poses hanche ; cellule droite = prête/retour, gauche = pompe arrière |
| `weapons/shotgun/ads_pump_v2.png` | Deux poses ADS ; droite = prête/retour, gauche = support ramené vers le joueur ; boîtier conservé |
| `weapons/shotgun/flash.png` | Deux flashes séparés, à placer sur l'ancrage bouche ; recul réalisé par transformation de rendu |
| `weapons/shotgun/shells.png` | Quatre vues de douille vide rouge/laiton ; régions irrégulières mesurées |
| `weapons/shotgun/live_shell.png` | Cartouche fermée disponible, distincte de la douille vide |
| `weapons/shotgun/ammo_pickup.png` | Boîte de cartouches pour un ramassage identifiable |
| `weapons/shotgun/pickup.png` | Arme de profil pour ramassage et icône, sans mains |
| `zombies/agile/idle.png` | Une pose de repos |
| `zombies/agile/run.png` | Six poses de course sur place |
| `zombies/agile/attack.png` | Quatre poses : préparation, anticipation, coup unique, retour |
| `zombies/agile/hurt.png` | Deux poses de réaction |
| `zombies/agile/death.png` | Quatre poses de chute ; conserver la dernière en billboard vertical |

Quatre autres fichiers sont des références/essais, pas les vues à alterner en jeu : `hip.png` (base artistique), `ads.png` (vue trop plongeante), `ads_v2.png` (référence corrigée mais cadrage différent de la planche retenue), `ads_pump.png` (pièce incorrecte devant le boîtier). Ils portent le statut `reference_or_rejected` dans le manifeste.

## Cohérence artistique

Références actuelles : `pistol_actions_v3.png` et `modern_ads.png`. Mêmes gants noirs **fermés**, mêmes manches gris bleuté. Les anciens `pistol_frame_*.png` montrant des doigts nus ne sont pas la référence de cette livraison.

Le Coureur porte des cheveux noirs, un gilet ocre et une chemise bleu pétrole. Sa silhouette ramassée et son balancement de course doivent compléter la différence de couleur. Ce n'est pas un remplacement du zombie lent en chemise ivoire. Aucune capacité de saut, esquive ou traversée d'obstacle n'est représentée ni autorisée implicitement.

Les images IA n'assurent pas une mécanique identique au pixel près entre toutes les poses. Les deux planches retenues réduisent les variations de cadre, mais le réglage final hanche/ADS et la lecture des gestes doivent être approuvés à taille de jeu. Ne pas corriger une mauvaise perspective par écrasement non uniforme ou cisaillement de l'image.

## Manifeste : contrat entre images et code

Lire `pompe-agile.manifest.json`. Il contient les dimensions réellement mesurées, les régions `rect`, ancrages, durées, événements et statuts. Les images n'ont pas toutes respecté la grille demandée ; **ne pas appliquer aveuglément width/columns**.

- Origine image en haut à gauche, X vers la droite, Y vers le bas. Durées en secondes.
- Pour les zombies, `anchor` et `clipPolygon` sont en pixels **absolus de l'atlas**. Pour les armes, `anchors` sont en pixels **locaux à la cellule**.
- `pixelsPerUnit` des animations ennemies conserve une densité comparable entre poses. Pour un point source `(sx,sy)`, sa position par rapport à l'appui vaut `((sx-anchorX)/pixelsPerUnit, (anchorY-sy)/pixelsPerUnit)`. Ajouter le petit décalage de sol. Si l'origine du mesh reste à y=1 pour la logique de vision existante, soustraire ce décalage dans les sommets visuels plutôt que déplacer arbitrairement l'origine de simulation.
- Le V de Three.js est inversé par rapport au Y image : `v = 1 - sourceY / imageHeight`. Les UV et les matériaux d'ombre doivent sélectionner la même région.
- Deux masques polygonaux simples dans `attack` excluent les minces débordements des figures voisines ; l'aperçu les applique. On peut construire une géométrie de sprite découpée avec les UV correspondants, mise en cache. Pas de nouveau calcul de géométrie à chaque frame.
- La dernière frame de `death` reste affichée, orientée autour de Y vers le joueur. Aucun tapis horizontal ni retour à l'image du zombie original.

## Chronologies proposées

**Fusil :** impulsion/flash sur la pose prête, pompe arrière à 0,19 s (événement d'éjection unique), retour à la pose prête ; séquence 0,5 s environ. Le temps minimal entre tirs proposé est 0,9 s, distinct de la durée du flash. Les huit plombs éventuels ne génèrent ni huit sons ni huit douilles.

**Rechargement :** le manifeste décrit seulement les phases attendues et des durées proposées, avec `asset: null` et `status: missing_art_tool_rejected`. Il manque les poses main vide → présentation d'une cartouche → insertion → retrait main vide. Ces données ne prouvent pas l'existence d'une animation. Obtenir une ressource appropriée et la valider avant de déclarer cette partie terminée. Ne pas remplacer silencieusement cette demande par un simple abaissement de l'arme.

**Coureur :** course à six poses de 0,09 s, attaque avec 0,45 s de préparation puis coup unique et retour, réaction de 0,18 s, mort de 0,56 s. Ce sont des réglages de départ. Les dégâts sont un résultat de simulation synchronisé, pas un effet déclenché à chaque affichage de la pose d'impact.

## Proposition de gameplay pour la reprise, non implémentée

- Fusil : capacité abstraite 5, réserve 20, huit rayons de 12 dégâts, portée 18, cône de demi-angle 5° hanche/3° ADS, cadence minimale 0,9 s. Ces valeurs sont à approuver et tester ; ne pas les présenter comme équilibrées. À ce réglage, le maximum brut de 96 dégâts ne tue pas un zombie initial de 100 PV en une seule décharge : discuter de passer à 15 dégâts/plomb si l'on souhaite une élimination rapprochée en un coup.
- Coureur : vitesse 2,7 contre 1,5 pour l'original, 80 PV, rayon de collision 0,4 conservé, préparation 0,45 s et dégâts 10. Introduire d'abord un seul coureur parmi les quatre vivants simultanés, à partir du deuxième palier, après validation. L'animation sur place ne déplace pas l'ennemi ; la vitesse réelle utilise le delta-time.
- Ne pas inventer une économie, des améliorations ou une refonte de carte pour intégrer ces deux nouveautés.

## Vérifications et reproduction

1. `node scripts/make-shotgun-agile-manifest.mjs` reconstruit les données depuis les PNG, sans modifier leurs pixels.
2. `node scripts/check-shotgun-agile-assets.mjs` vérifie RGBA, alpha, dimensions, 38 références de régions/masques, nombre de poses, événements uniques et absence explicitement déclarée du rechargement.
3. `node scripts/make-shotgun-agile-preview.mjs` construit `tmp/shotgun-agile-preview/index.html`. Ouvrir ce fichier, lire un cycle normal puis lent ; comparer initial/coureur, lancer attaque/blessure/mort.

Aperçu ouvert dans Chrome headless et captures inspectées : repos hanche/ADS, pompe et éjection, flash, course, attaque, blessure, cadavre final. Les images se chargent ; les personnages sont lisibles à petite taille. Les compteurs de l'aperçu illustrent la chronologie uniquement, sans modifier une vraie santé ou réserve. Aucun nouvel ennemi ni fusil n'est jouable dans le jeu après cette seule livraison ; pas de test de navigation/combat nouveau revendiqué.

Prompts exacts et sources dans `PROMPTS_POMPE_AGILE.json`. Images générées par l'outil intégré imagegen, alpha conservé, originaux conservés. Aucun bitmap fabriqué ou retouché par le script de diagnostic PNG ; il lit seulement les pixels pour mesurer les régions. Les scripts d'aperçu dessinent les sources sans altérer les fichiers.

## Ordre conseillé pour Gemini

1. Lire le contrat et ouvrir l'aperçu ; faire valider les bases et les gestes. Signaler d'abord le rechargement manquant.
2. Intégrer le Coureur comme variante de données de Zombie et ZombieRemains, en conservant l'ancien type par défaut ; tester les deux jusqu'à leur mort et au changement de palier.
3. Ajouter un inventaire minimal de deux armes, puis le tir du fusil, ses événements et ses réserves séparées ; préserver le pistolet.
4. Compléter/valider la ressource de rechargement, puis implémenter les insertions atomiques et interruptibles. Le lot visuel de rechargement reste incomplet jusque-là.
5. Ajouter au mélange des paliers seulement après ces contrôles ; mesurer le coût avec quatre vivants, les douilles bornées et les cadavres nettoyés.

Prompt détaillé : `PROMPT_GEMINI_POMPE_AGILE.md`.
