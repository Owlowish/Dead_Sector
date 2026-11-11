# DEAD SECTOR — Travaux restants

Plan actualisé le 10 novembre 2026. État et vérifications dans `ETAT_PROJET.md`. Règles et réglages dans `ORIENTATION_JEU.md`. G1–G3, Maître du Portrait, Rampeuse V3 et UI1–UI4 intégrés. Calage en partie et UI5–UI6 ouverts.

## Socle présent

Manoir progressif et décor des six pièces, hache de départ puis pistolet et fusil en récompenses de purge, quatre types d'ennemis, relèves, drops, transitions automatiques, rendu rétro, orage et diagnostics. Les quatre volumes audio sont persistants. P8 : Maître du Portrait, victoire libre, bilan B et nouvelle tentative sans rechargement de page. Leur présence ne vaut pas validation en partie.

## Priorité gameplay — validation et finition

**G4 — Calage de la tentative.** Jouer une découverte et une tentative avec les trajets connus. Observer le premier duel à la hache, l'écoute des relèves et des deux signaux de lampe, l'usage du repère d'accalmie et les changements de trajet au P5–P7. Au Portrait, évaluer le signal avant le tir, les munitions absorbées, la collecte des soins et le rythme des deux phases. Relever les écarts à la cible de 10–15 minutes et ajuster un axe à la fois.

**Épreuve des ennemis.** Jouer les deux formes du Portrait, ses salves de 6/10 lames, la seconde visée, le combo de phase II et le masque exposé uniquement en récupération finale. Animations, traînées, impacts bornés et transformation intégrés : mesurer leur coût et écouter les deux sons dans le mix réel. Vérifier aussi les reprises hors regard de la Rampeuse ; ajuster un axe à la fois sans conclure à un gain de peur ou de difficulté sur les captures.

## Plan UI — direction et règles

Direction gothique pixel art sobre définie dans `ORIENTATION_JEU.md` : V3 biseautée anthracite/bordeaux intégrée selon la nouvelle référence ; cœur animé V2 conservé. Valeurs et libellés conservés en DOM, indépendants du sprite.

- Bas gauche : barre rouge de vie ; bas droite : état de mêlée ou chargeur / réserve avec pictogramme animé au tir ; haut gauche : progression ; accalmie agrandie en haut au centre ; lampe au bas-centre ; centre : visée et courte interaction seulement.
- Vie, munitions et progression toujours disponibles. Deux notifications simultanées maximum, proches du bloc concerné, fusionnées si répétées et effacées après environ deux secondes actives.
- Les informations de combat restent fiables. Pas de radar, inventaire, batterie de lampe, dégâts flottants ou retour des améliorations dormantes dans ce lot.
- Accalmie libre de dix secondes et victoire sans menu imposé conservées. Le total des paliers vient des configurations ; aucun chiffre 8 figé dans l'UI.

### UI1–UI3 — Socle livré ; validation en partie restante

Fonctionnalités et contrôles dans `ETAT_PROJET.md`, responsabilité de présentation dans `ARCHITECTURE.md`. Avant extension : éprouver lecture vie/munitions/menaces, jauge finale, notifications, invites et transitions en combat hanche/ADS, puis comparer les temps d'image dans les mêmes conditions. Aucune barre sur les ennemis ordinaires.

### UI4 — Accueil, pause et commandes livrés

Accueil « La Nuit », pause et panneaux communs intégrés. Contrôles et limites dans `ETAT_PROJET.md`.

### UI5 — Réglages persistants et lisibilité · priorité moyenne

Échelle HUD 80–150 %, taille/contraste du réticule, sensibilité, luminosité calibrée et bornée ; reprendre les quatre volumes déjà persistants dans le panneau commun, sans dupliquer `AudioMix`. Réduction des éclairs, du voile rouge et des scanlines sans supprimer les vrais signaux d'attaque. Libellés français, contraste et états lisibles sans dépendre seulement d'une couleur ; annonces d'accessibilité brèves sans lecture à chaque cartouche. Valeurs validées et persistantes, bouton rétablir les valeurs initiales.

**Acceptation :** effet réel de chaque réglage, persistance après recharge et redémarrage, stockage indisponible toléré. Vérifier notamment les buffers d’effets et les lecteurs musicaux reliés à Web Audio. Tester 1280 × 720, 1920 × 1080, 1024 × 768 et ultralarge, échelle maximale comprise. Conserver le recul de deux secondes.

### UI6 — Mort, victoire et bilan · priorité moyenne

Habiller le bilan existant comme un rapport : résultat/paliers d'abord, durée active/dégâts ensuite, tirs et impacts en détail. Après victoire : Continuer à explorer et Nouvelle tentative ; après mort : bilan et nouvelle tentative sans proposer de reprendre le combat. Marquer clairement les essais debug. Ne pas présenter impacts/tirs comme un pourcentage de précision : plusieurs plombs peuvent toucher par tir.

**Acceptation :** bilan volontaire par B après réussite, déplacement conservé tant qu'il est fermé ; fermeture cohérente après mort ; deux redémarrages successifs sans état résiduel. Réutiliser les métriques existantes plutôt qu'inventer un score.

## Ordre d'implémentation et vérification

Priorité : G4 avec la hache, les acquisitions et les nouveaux ennemis. Dans l'UI, valider le socle en partie avant UI5 ; UI6 termine la cohérence des écrans.

Points d'entrée UI : `index.html` / `src/style.css`, `GameHud.ts` et callbacks de `Game.ts`. Garder la progression dans `Game`, sans bus ni framework. Les futurs réglages visuels et de contrôle demandent de vrais points d'application dans le joueur et le rendu ; les niveaux audio passent déjà par `AudioMix`. Préserver les sélecteurs/calques d'armes consommés par le jeu et les scripts d'aperçu.

Après code : `npm.cmd run build`, contrôles ciblés des états/transferts/pause, puis captures aux formats cibles et essais au Pointer Lock : frappe/stun, acquisitions, tir/recharge, dégâts/soins, accalmie interrompue, finale, mort et nouvelle tentative. Comparer le temps d'image avant/après dans les mêmes conditions. Distinguer compilation, logique, rendu observé et partie jouée.

## Performance — priorités issues de l'audit

Chargement initial, banques d’effets prêtes, streaming musical, dérivés d’armes et préparation graphique sont intégrés. Mesures et limites dans `ETAT_PROJET.md`. Préserver gameplay, provenance et contrats UV/ancrages.

1. **Haute — Validation matérielle.** Rejouer premiers sons, poses et finale sur machine modeste/réseau ralenti. Mesurer temps de chargement et mémoire native/GPU, sans confondre poids fichier, buffers estimés et mémoire du processus.
2. **Moyenne — Images des personnages.** Évaluer les atlas encore grands à leur taille utile ; comparer transparences et tirs tête avant intégration. Conserver les sources et zones de tête.
3. **Moyenne — Ombres et appels de dessin.** Réutiliser les cartes pendant K/bilan avec invalidation à la reprise/reset ; préserver les ombres mobiles en combat. Regrouper marches/bâtis/ferrures par ensemble animable.
4. **Moyenne — CPU et mesures.** Présélection des chemins, portée de matrices aux spawns, rejet rapide des portes et rayon local du Cracheur réalisés. Profiler le rendu/les ombres dominants et les dernières allocations ; mutualiser davantage les matrices IA seulement si une mesure le justifie. Mesurer GPU et corriger la résolution diagnostique. Pas de refonte de navigation justifiée.
5. **Basse — Entretien.** Unifier les ressources de mort préparées en double, limiter les styles d’arme inchangés et compléter la destruction globale avant recréation de Game. Filtrer la livraison des assets dormants sans supprimer leur provenance.

## Autres travaux encore ouverts

- Observer les six pièces et le HUD réunis, feu/poussières ; écouter horreur/impacts/pas/manipulations ; vérifier reprise après K et performances en partie, sans déduire un gain des seuls budgets techniques.
- Actualiser les anciens tests attachés aux caisses/carillon/piédestaux lorsqu'ils sont concernés. Les contrôles P8, Cracheur, cadavres et HUD ont été adaptés au duel et aux collectes partielles.
- Plus tard : silhouette d'horreur contextuelle, variantes reproductibles et démo ; objectif spatial facultatif seulement après petit prototype utile.
