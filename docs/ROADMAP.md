# DEAD SECTOR — Travaux restants

Plan actualisé le 6 novembre 2026. État et vérifications dans `ETAT_PROJET.md` ; règles et réglages dans `ORIENTATION_JEU.md`. G1–G3 et UI1–UI3 sont implémentés en prototype ; calage en partie, habillage du Gardien et UI4–UI6 restent ouverts.

## Socle présent

Manoir progressif et décor des six pièces (lambris/relief/feu/poussières), deux armes avec manipulations et balancement, quatre types d'ennemis, relèves, drops, transitions automatiques, rendu rétro, orage et diagnostics. Les quatre volumes audio sont déjà persistants. P8 propose le duel du Gardien, victoire libre, bilan B et nouvelle tentative sans rechargement de page. Leur présence dans le code ne vaut pas validation en partie.

## Priorité gameplay — validation et finition

G1–G3 livrés : équité et ressources, introductions/groupes, deux phases du Gardien et jauge finale. Contrôles et limites dans l'état ; les plans exécutés sont remplacés par les règles de la direction. Lecture en combat, contournement des deux circuits et économie réelle restent à valider.

**G4 — Calage de la tentative.** Comparer une découverte et un joueur connaissant les circuits, puis ajuster un axe à la fois. Documenter écarts à la cible de 10–15 minutes ; ne pas les masquer par attentes ou PV artificiels. Conserver les valeurs expérimentales seulement si les parties les justifient. UI4–UI6 restent le lot de confort et de finition.

**Habillage du boss.** Après essai du duel : silhouette d'intendant et sons de préparation distincts via `PIPELINE_ASSETS.md`, base/action pilote avant extension. Les sprites standards et signes temporaires suffisent au prototype actuel ; aucune génération de lot final n'a été réalisée.

## Plan UI — direction et règles

Direction gothique pixel art sobre définie dans `ORIENTATION_JEU.md` : V2 compacte et cœur animé intégrés après allègement de la référence initiale. Valeurs et libellés conservés en DOM, indépendants du sprite.

- Bas gauche : vie et lampe ; bas droite : arme et munitions ; haut gauche : progression et annonces ; centre : visée et courte interaction seulement.
- Vie, munitions et progression toujours disponibles. Deux notifications simultanées maximum, proches du bloc concerné, fusionnées si répétées et effacées après environ deux secondes actives.
- Les informations de combat restent fiables. Pas de radar, inventaire, batterie de lampe, dégâts flottants ou retour des améliorations dormantes dans ce lot.
- Accalmie libre de dix secondes et victoire sans menu imposé conservées. Le total des paliers vient des configurations ; aucun chiffre 8 figé dans l'UI.

### UI1–UI3 — Socle livré ; validation en partie restante

Fonctionnalités et contrôles dans `ETAT_PROJET.md`, responsabilité de présentation dans `ARCHITECTURE.md`. Avant extension : éprouver lecture vie/munitions/menaces, jauge finale, notifications, invites et transitions en combat hanche/ADS, puis comparer les temps d'image dans les mêmes conditions. Aucune barre sur les ennemis ordinaires.

### UI4 — Accueil, pause et commandes · priorité moyenne

Accueil avec titre, Entrer dans le manoir, Réglages et Commandes. Pause distincte : Reprendre, Réglages, Commandes ; expliquer la reprise au clic et l'échec éventuel de capture souris. Aide complète ZQSD/WASD, Maj, tir, ADS, R, E, F, 1/2 et molette. Debug K visuellement séparé. Un seul panneau actif ; clics et clavier des menus sans effet sur le combat.

**Acceptation :** navigation clavier, focus visible/confiné puis restitué, Échap cohérent, alt-tab et refus du Pointer Lock sans blocage. Menus ouverts : simulation, ramassages et décompte suspendus ; retour par geste explicite sans tir accidentel.

### UI5 — Réglages persistants et lisibilité · priorité moyenne

Échelle HUD 80–150 %, taille/contraste du réticule, sensibilité, luminosité calibrée et bornée ; reprendre les quatre volumes déjà persistants dans le panneau commun, sans dupliquer `AudioMix`. Réduction des éclairs, du voile rouge et des scanlines sans supprimer les vrais signaux d'attaque. Libellés français, contraste et états lisibles sans dépendre seulement d'une couleur ; annonces d'accessibilité brèves sans lecture à chaque cartouche. Valeurs validées et persistantes, bouton rétablir les valeurs initiales.

**Acceptation :** effet réel de chaque réglage, persistance après recharge et redémarrage, stockage indisponible toléré. Vérifier notamment les deux chemins audio (`Audio` et Three.js). Tester 1280 × 720, 1920 × 1080, 1024 × 768 et ultralarge, échelle maximale comprise. Conserver le recul de deux secondes.

### UI6 — Mort, victoire et bilan · priorité moyenne

Habiller le bilan existant comme un rapport : résultat/paliers d'abord, durée active/dégâts ensuite, tirs et impacts en détail. Après victoire : Continuer à explorer et Nouvelle tentative ; après mort : bilan et nouvelle tentative sans proposer de reprendre le combat. Marquer clairement les essais debug. Ne pas présenter impacts/tirs comme un pourcentage de précision : plusieurs plombs peuvent toucher par tir.

**Acceptation :** bilan volontaire par B après réussite, déplacement conservé tant qu'il est fermé ; fermeture cohérente après mort ; deux redémarrages successifs sans état résiduel. Réutiliser les métriques existantes plutôt qu'inventer un score.

## Ordre d'implémentation et vérification

Priorité : G4 sur le prototype livré, puis habillage du Gardien. Dans l'UI, valider le socle en partie avant UI4 → UI5 pour le confort ; UI6 termine la cohérence des écrans. Valider chaque lot avant extension, sans tout livrer d'un coup.

Points d'entrée UI : `index.html` / `src/style.css`, `GameHud.ts` et callbacks de `Game.ts`. Garder la progression dans `Game`, sans bus ni framework. Les futurs réglages visuels et de contrôle demandent de vrais points d'application dans le joueur et le rendu ; les niveaux audio passent déjà par `AudioMix`. Préserver les sélecteurs/calques d'armes consommés par le jeu et les scripts d'aperçu.

Après code : `npm.cmd run build`, contrôles ciblés des états/transferts/pause, puis captures aux formats cibles et essais au Pointer Lock : tir/recharge, dégâts/soins, accalmie interrompue, finale, mort et nouvelle tentative. Comparer le temps d'image avant/après dans les mêmes conditions. Distinguer compilation, logique, rendu observé et partie jouée.

## Autres travaux encore ouverts

- Observer les six pièces et le HUD réunis, feu/poussières ; écouter horreur/impacts/pas/manipulations ; vérifier reprise après K et performances en partie, sans déduire un gain des seuls budgets techniques.
- Actualiser les anciens tests attachés aux caisses/carillon/piédestaux lorsqu'ils sont concernés. Les contrôles P8, Cracheur, cadavres et HUD ont été adaptés au duel et aux collectes partielles.
- Plus tard : silhouette d'horreur contextuelle, variantes reproductibles et démo ; objectif spatial facultatif seulement après petit prototype utile.
