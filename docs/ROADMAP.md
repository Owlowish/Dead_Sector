# DEAD SECTOR — Travaux restants

Plan actualisé le 7 novembre 2026. État et vérifications dans `ETAT_PROJET.md` ; règles et réglages dans `ORIENTATION_JEU.md`. G1–G3, Maître du Portrait, Rampeuse V3 et UI1–UI3 intégrés ; calage en partie et UI4–UI6 restent ouverts.

## Socle présent

Manoir progressif et décor des six pièces, hache de départ puis pistolet et fusil en récompenses de purge, quatre types d'ennemis, relèves, drops, transitions automatiques, rendu rétro, orage et diagnostics. Les quatre volumes audio sont persistants. P8 : Maître du Portrait, victoire libre, bilan B et nouvelle tentative sans rechargement de page. Leur présence ne vaut pas validation en partie.

## Priorité gameplay — validation et finition

G1–G3 livrés : équité et ressources, introductions/groupes et jauge finale. Maître du Portrait et Rampeuse V3 intégrés ; hache lente avec stun ordinaire et acquisition progressive des armes en place. Contrats dans la direction, provenance dans les manifestes. Poses de hache inspectées dans le manoir ; lecture en combat, contournement des deux circuits et économie réelle restent à valider.

**G4 — Calage de la tentative.** Éprouver d'abord le duel renforcé demandé : minimum de deux minutes, absorption par le cadre, intérêt des tirs espacés/ouvertures, ramassage des drops et soins, confort du fusil et reprise après K. La borne temporelle est contrôlée logiquement ; sensations et durée réelle restent à jouer. Puis P1 à la hache, stun/relèves, acquisitions et récompenses oubliées. Comparer découverte et joueur connaissant les circuits, ajuster un axe à la fois et documenter les écarts aux 10–15 minutes ; garder le rythme des paliers ordinaires. UI4–UI6 restent le lot de confort et de finition.

**Épreuve des ennemis.** Jouer les deux formes du Portrait, ses salves de 6/10 lames, la seconde visée, le combo de phase II et le masque exposé uniquement en récupération finale. Animations, traînées, impacts bornés et transformation intégrés : mesurer leur coût et écouter les deux sons dans le mix réel. Vérifier aussi les reprises hors regard de la Rampeuse ; ajuster un axe à la fois sans conclure à un gain de peur ou de difficulté sur les captures.

## Plan UI — direction et règles

Direction gothique pixel art sobre définie dans `ORIENTATION_JEU.md` : V3 biseautée anthracite/bordeaux intégrée selon la nouvelle référence ; cœur animé V2 conservé. Valeurs et libellés conservés en DOM, indépendants du sprite.

- Bas gauche : barre rouge de vie ; bas droite : état de mêlée ou chargeur / réserve avec pictogramme animé au tir ; haut gauche : progression ; accalmie agrandie en haut au centre ; lampe au bas-centre ; centre : visée et courte interaction seulement.
- Vie, munitions et progression toujours disponibles. Deux notifications simultanées maximum, proches du bloc concerné, fusionnées si répétées et effacées après environ deux secondes actives.
- Les informations de combat restent fiables. Pas de radar, inventaire, batterie de lampe, dégâts flottants ou retour des améliorations dormantes dans ce lot.
- Accalmie libre de dix secondes et victoire sans menu imposé conservées. Le total des paliers vient des configurations ; aucun chiffre 8 figé dans l'UI.

### UI1–UI3 — Socle livré ; validation en partie restante

Fonctionnalités et contrôles dans `ETAT_PROJET.md`, responsabilité de présentation dans `ARCHITECTURE.md`. Avant extension : éprouver lecture vie/munitions/menaces, jauge finale, notifications, invites et transitions en combat hanche/ADS, puis comparer les temps d'image dans les mêmes conditions. Aucune barre sur les ennemis ordinaires.

### UI4 — Accueil, pause et commandes · priorité moyenne

Accueil avec titre, Entrer dans le manoir, Réglages et Commandes. Pause distincte : Reprendre, Réglages, Commandes ; expliquer la reprise au clic et l'échec éventuel de capture souris. Aide complète ZQSD/WASD, Maj, frappe/tir, ADS et R pour les armes à feu, E, F, 1/2/3 et molette. Debug K visuellement séparé. Un seul panneau actif ; clics et clavier des menus sans effet sur le combat.

**Acceptation :** navigation clavier, focus visible/confiné puis restitué, Échap cohérent, alt-tab et refus du Pointer Lock sans blocage. Menus ouverts : simulation, ramassages et décompte suspendus ; retour par geste explicite sans tir accidentel.

### UI5 — Réglages persistants et lisibilité · priorité moyenne

Échelle HUD 80–150 %, taille/contraste du réticule, sensibilité, luminosité calibrée et bornée ; reprendre les quatre volumes déjà persistants dans le panneau commun, sans dupliquer `AudioMix`. Réduction des éclairs, du voile rouge et des scanlines sans supprimer les vrais signaux d'attaque. Libellés français, contraste et états lisibles sans dépendre seulement d'une couleur ; annonces d'accessibilité brèves sans lecture à chaque cartouche. Valeurs validées et persistantes, bouton rétablir les valeurs initiales.

**Acceptation :** effet réel de chaque réglage, persistance après recharge et redémarrage, stockage indisponible toléré. Vérifier notamment les deux chemins audio (`Audio` et Three.js). Tester 1280 × 720, 1920 × 1080, 1024 × 768 et ultralarge, échelle maximale comprise. Conserver le recul de deux secondes.

### UI6 — Mort, victoire et bilan · priorité moyenne

Habiller le bilan existant comme un rapport : résultat/paliers d'abord, durée active/dégâts ensuite, tirs et impacts en détail. Après victoire : Continuer à explorer et Nouvelle tentative ; après mort : bilan et nouvelle tentative sans proposer de reprendre le combat. Marquer clairement les essais debug. Ne pas présenter impacts/tirs comme un pourcentage de précision : plusieurs plombs peuvent toucher par tir.

**Acceptation :** bilan volontaire par B après réussite, déplacement conservé tant qu'il est fermé ; fermeture cohérente après mort ; deux redémarrages successifs sans état résiduel. Réutiliser les métriques existantes plutôt qu'inventer un score.

## Ordre d'implémentation et vérification

Priorité : G4 avec la hache, les acquisitions et les nouveaux ennemis. Dans l'UI, valider le socle en partie avant UI4 → UI5 pour le confort ; UI6 termine la cohérence des écrans. Valider chaque lot avant extension, sans tout livrer d'un coup.

Points d'entrée UI : `index.html` / `src/style.css`, `GameHud.ts` et callbacks de `Game.ts`. Garder la progression dans `Game`, sans bus ni framework. Les futurs réglages visuels et de contrôle demandent de vrais points d'application dans le joueur et le rendu ; les niveaux audio passent déjà par `AudioMix`. Préserver les sélecteurs/calques d'armes consommés par le jeu et les scripts d'aperçu.

Après code : `npm.cmd run build`, contrôles ciblés des états/transferts/pause, puis captures aux formats cibles et essais au Pointer Lock : frappe/stun, acquisitions, tir/recharge, dégâts/soins, accalmie interrompue, finale, mort et nouvelle tentative. Comparer le temps d'image avant/après dans les mêmes conditions. Distinguer compilation, logique, rendu observé et partie jouée.

## Performance — priorités issues de l'audit

Mesures antérieures aux nouveaux sprites et limites dans `ETAT_PROJET.md` ; optimisations encore ouvertes. Préserver gameplay, provenance et contrats UV/ancrages.

1. **Haute — Livraison des images.** Exporter personnages/armes à la taille utile ; comparer poses, transparences et tirs tête avant intégration. Conserver les sources. Éviter de garder tous les originaux d'armes décodés si des dérivés suffisent.
2. **Haute — Premières apparitions.** Chargement anticipé Rampeuse/Portrait ajouté ; compléter la préparation réelle du décodage, masques alpha, upload et compilation. Mesurer premiers types/poses et images stabilisées, sans déplacer toute la saccade dans le début jouable.
3. **Moyenne — Ombres et appels de dessin.** Réutiliser les cartes pendant K/bilan avec invalidation à la reprise/reset ; préserver les ombres mobiles en combat. Regrouper marches/bâtis/ferrures par ensemble animable. Le passage unique des sprites est secondaire et exige un contrôle visuel.
4. **Moyenne — CPU et mesures.** Mutualiser les raycasts de visibilité par ennemi/image et les matrices du décor ; présélectionner les points d'apparition avant les tests coûteux. Mesurer cumuls IA/navigation et GPU, vérifier que chaque benchmark simule réellement le combat, corriger la résolution diagnostique. Pas de refonte de navigation justifiée.
5. **Basse — Entretien.** Unifier les ressources de mort préparées en double, limiter les styles d'arme inchangés et compléter la destruction globale avant recréation de Game. Filtrer la livraison des assets dormants sans supprimer leur provenance ; découper le bundle seulement avec bénéfice de chargement mesuré.

## Autres travaux encore ouverts

- Observer les six pièces et le HUD réunis, feu/poussières ; écouter horreur/impacts/pas/manipulations ; vérifier reprise après K et performances en partie, sans déduire un gain des seuls budgets techniques.
- Actualiser les anciens tests attachés aux caisses/carillon/piédestaux lorsqu'ils sont concernés. Les contrôles P8, Cracheur, cadavres et HUD ont été adaptés au duel et aux collectes partielles.
- Plus tard : silhouette d'horreur contextuelle, variantes reproductibles et démo ; objectif spatial facultatif seulement après petit prototype utile.
