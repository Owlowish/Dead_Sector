# DEAD SECTOR — Direction du jeu

Consolidée le 6 novembre 2026. Direction et réglages du prototype ici ; avancement et vérifications dans `ETAT_PROJET.md`. Le gameplay et le duel ci-dessous sont implémentés ; leur équilibrage en partie reste ouvert.

## Direction retenue

- FPS rétro dans un même manoir victorien labyrinthique ouvert progressivement, avec circuits de fuite et accès anciens conservés.
- Progression par élimination des rencontres, sans extraction ni survie infinie.
- Tentative finie d'environ 10–15 minutes avec finale. Cible à mesurer, sans chronomètre punitif.
- Horreur psychologique par sons, silhouettes et événements du bâtiment ; vrais signaux de combat fiables.
- Style pixel art cohérent, obscurité jouable, performances légères et contrôles conservés.

## Direction artistique — référence gothique

Référence utilisateur du 6 novembre conservée dans `asset-packs/references/hud-gothic-reference.png` : manoir victorien brun/bordeaux, bougies ambre, fenêtres froides, laiton patiné et pénombre lisible. Réutiliser le décor et les silhouettes existants ; rapprocher les couleurs sans altérer les signaux d'attaque.

HUD V3 selon la référence utilisateur : cartouches anthracite biseautées, liserés bordeaux, texte monospace et chiffres ivoire. Vie en barre rouge à côté du cœur, sans chiffre visible ; arme en bas à droite, avec indication de mêlée pour la hache ou chargeur / réserve pour les armes à feu. Pictogramme de balle animé sur le vrai tir et cartouche distincte au fusil. Palier/menaces en haut à gauche ; les dix secondes d’accalmie sont annoncées en grand en haut au centre. Lampe F au bas-centre, sans batterie. Cœur V2 et retour de tir suivent le temps actif ; mouvement réduit persistant = cœur fixe et flash de munition sans déplacement. Secteur temporaire, alertes et jauge finale conservés ; centre de visée dégagé. Références, sources et contrats dans `asset-packs/HUD_GOTHIQUE_2026-11-06.json`.

Fenêtres : cadres de pierre gothiques et ferronneries devant un ciel d’orage froid, tissu bordeaux déchiré et petites bougies chaudes. Variantes vitrail/fissures/sceau fixes, sans mécanique supplémentaire. Pluie oblique en fond, coulures et perles discrètes sur le verre, avec fondus ; les éclairs locaux réutilisent le cycle existant ; murs et éclairage de gameplay conservés. Concept et contrat dans `asset-packs/STORM_WINDOWS_2026-11-03_PROMPT.json`.

## Boucle courante à préserver

La demande horde/précision du 3 novembre remplace les anciennes propositions de piédestaux et de départ manuel :

Combat → dernière menace définitivement éliminée → ouverture des accès nécessaires → dix secondes d'accalmie libre et ramassage → départ automatique de la rencontre suivante.

Hache équipée au départ ; pistolet et fusil offerts après les purges prévues, sans achat ni menu. Munitions sur les ennemis à partir de P2 avec budget par palier ; soins ramassables. Les drops non consommés persistent entre paliers. Aucun choix d'amélioration actif ; ne pas réintroduire carillon ou piédestaux à partir d'un ancien plan.

Le prototype local enchaîne huit rencontres dont le Maître du Portrait en finale ; victoire avec exploration conservée et bilan volontaire. Cette réalisation reste à valider en partie ; la durée de 10–15 minutes est toujours une cible à mesurer. Avancement et limites dans `ETAT_PROJET.md`.

## Invariants

1. Finir une rencontre une seule fois, après toutes ses apparitions et menaces, y compris les relèves en attente.
2. Conserver déplacement, contrôle et pause explicite ; aucun menu automatique après la dernière élimination.
3. Suspendre décompte et combat hors contrôle ; garder les événements de dégâts, munitions et transition uniques.
4. Faire concorder navigation, altitude, portes et collisions ; ne pas apparaître dans une zone inaccessible ou immédiatement sous le regard.
5. Garder plafond actif borné et ressources suffisantes ; mesurer la difficulté en partie réelle avant de conclure à un équilibre.
6. Aucun dégât d'ambiance arbitraire, changement secret des trajets ou noir supprimant toute lecture du combat.
7. Partager les ressources graphiques utiles et nettoyer corps/effets sans supprimer les drops persistants.
8. Préserver le recul de deux secondes et les réglages expérimentés sauf correction justifiée ou demande.

## Gameplay global — prototype implémenté

Faire évoluer les décisions demandées au joueur : reconnaître une menace, choisir son arme, dégager une sortie puis exploiter une récupération. La composition, l'ordre des introductions et les deux poussées de P6 donnent une identité aux rencontres. Leur effet sur la pression réelle reste à éprouver.

- **Hache rustique · arme 1, équipée de base : proximité et contrôle.** 55 dégâts sans bonus tête, portée de 2,05 m ; préparation de 0,48 s, contact à 0,62 s et cycle complet de 1,45 s. Un coup touche une seule cible, évaluée à l'instant du contact et occultée par le décor. Standard/Coureur/Cracheur/Rampeuse survivants sont étourdis 0,85 s : geste préparé annulé, mouvement volontaire arrêté puis nouvelle préparation obligatoire ; le Maître résiste à cet effet. Deux coups éliminent un standard, sans empêcher sa relève éventuelle. Aucune munition, visée ADS ni recharge ; la récupération ne se saute pas en changeant d'arme. Fer usé et manche en bois droit. Garde basse diagonale avec la main gauche en bas et la droite en haut, redressement à la levée, frappe verticale et retour lent.
- **Pistolet · arme 2 : précision et économie.** Récompense de la purge P1, ramassable pendant l'accalmie avant P2. Conserver 28 dégâts corps / 80 tête, cadence de 0,8 s et réserves actuelles. Standard : quatre corps ou deux têtes ; Coureur : trois corps ou une tête. Garder la tête comme moyen fiable d'empêcher une relève.
- **Fusil · arme 3 : dégagement rapproché.** Récompense de la purge P3, ramassable avant P4 et l'arrivée de la Rampeuse. 13 dégâts corps / 24 tête par plomb : huit plombs corps totalisent 104 dégâts, assez pour tuer un standard de 100 PV. Puissance d'impact indépendante des dégâts : plombs reçus × proximité, forte jusqu'à 3 m puis atténuée ; poussée standard jusqu'à 0,72 m en 0,26 s, Coureur plus sensible, Cracheur/Rampeuse plus résistants. Les murs/portes et ruptures de sol arrêtent le recul ; les rampes conservent l'appui. Le boss réagit visuellement sans déplacement ni interruption de ses préparations. Sur forte mort des quatre familles ordinaires : 80 ms de pose de choc puis chute emportée et cadavre stable, avec relève éventuelle au nouvel appui. Gerbe courte graduée, sang sombre ou toile/peinture du Portrait ; pas de nouvel effet plein écran. Dégâts, dispersion, cadence, rechargement et recul de l'arme de deux secondes conservés ; comparer à 2/4/6 m pour le calage en partie.
- **Circulation :** exploiter les circuits salon–vestibule–hall–galerie et les deux rampes vers l'étage. Conserver les accès ouverts, choisir des arrivées complémentaires et laisser une sortie praticable. Marche 5 m/s et sprint 9 m/s dépassent tous les poursuivants : vérifier les tours de piste en partie avant toute pénalité de mouvement ou d'ADS.
- **Signaux :** différencier préparation d'attaque, blessure et relève ; garder le décompte des menaces honnête pendant une relève. L'ambiance ne doit pas couvrir un vrai indice de combat. Pas de nouveau système d'endurance, d'achat ou d'objectif obligatoire pour ce lot.

### Rencontres actuelles P1–P7

Totaux conservés pour isoler l'effet de la composition. S/C/T/R = Standard/Coureur/Cracheur/Rampeuse ; les escortes sont incluses dans C. « Ouverture » désigne une salve cadencée, pas des apparitions instantanées.

| Palier | S / C / T / R | Plafond actif | Ouverture | Décision dominante |
| --- | --- | --- | --- | --- |
| P1 | 4 / 0 / 0 / 0 | 3 | 1 | Préparer la hache, profiter du stun et reculer ; reconnaître une relève. |
| P2 | 3 / 2 / 0 / 0 | 3 | 1 | Apprendre tir précis/recharge au pistolet et prioriser le Coureur. |
| P3 | 3 / 2 / 1 / 0 | 4 | 1 | Utiliser couvert et altitude contre le premier projectile ; gagner le fusil. |
| P4 | 3 / 3 / 1 / 1 | 4 | 2 | Exploiter le fusil et identifier la Rampeuse avant les mélanges de hauteurs. |
| P5 | 3 / 4 / 2 / 1 | 5 | 3 | Alterner tir précis et dégagement, changer de circuit. |
| P6 | 4 / 4 / 2 / 2 | 6 | 3 | Tenir deux poussées finies et profiter d'une récupération. |
| P7 | 5 / 5 / 2 / 2 | 7 | 4 | Synthèse des priorités et préparation du duel final. |

Plafonds par type : deux Coureurs simultanés P3–P6, trois P7 ; un Cracheur jusqu'à P6, deux P7 ; une Rampeuse P4–P5, deux ensuite. P2 conserve un seul Coureur simultané. Le plafond global de huit reste une borne technique.

Ordre explicite : P3 commence par des standards, puis Cracheur et escorte après deux éliminations définitives ; P4 autorise la Rampeuse après deux éliminations. P6 sépare ses douze ennemis en deux groupes de six : 3/2/1/0 puis 1/2/1/2, avec trois secondes actives de récupération après élimination définitive du premier groupe. Cette attente appartient au combat ; la file restante empêche toute fin anticipée. Les autres cadences restent à 0,4 s en ouverture puis 0,8 s.

Une paire Cracheur/escorte sans place ou sans deux points sûrs est différée au profit d'un autre type éligible, avec quota d'escorte réservé. Ne jamais contourner collision, chemin, distance minimale de 6 m ou protection contre l'apparition sous le regard pour remplir une salve.

### Ressources et équité

La Rampeuse V3 garde 40 PV, 12 dégâts et une préparation de 0,35 s avec sifflement dès son début. Dos cassé haut, tête basse inclinée et appuis alternés renforcent la silhouette ; six poses et provenance dans le [lot Rampeuse](asset-packs/RAMPEUSE_V2_2026-11-04.json). La saisie vérifie volume bas du joueur, sols et obstacles au départ et à l'impact, y compris à l'atterrissage debug.

À distance, le regard visible provoque une fixation de 0,55 s, répétable au plus toutes les 2,1 s et seulement au-delà de 3 m. Détourner le regard relance immédiatement une traction plus rapide ; les pauses d'appui arrêtent réellement le déplacement, sans téléportation. Lampe furie/fuite, esquive en fuite et saisie restent présentes ; les déplacements vérifient les collisions par sous-pas. Lisibilité et difficulté sous pression restent à éprouver.

P1 ne produit aucun drop de munitions ; conserver les budgets P2–P7 et les soins de 30 PV réarmés une seule fois par transition, sans soin automatique. Une arme offerte oubliée est acquise au début du palier requis, P2 pour le pistolet et P4 pour le fusil, départ debug compris : le joueur ne doit pas affronter les introductions prévues sans son arme disponible. Les récompenses restent des ramassages du monde, par proximité ou E. Conserver les reliquats : une boîte de dix ramassée avec 59/60 doit laisser neuf balles au sol. Un ennemi initial compte une seule fois, à son élimination définitive : seule celle-ci consomme un droit au drop ; une mort provisoire n'en consomme aucun. Les drops persistent entre les paliers.

Repère économique, fusil acquis avant P4 : hors ravitaillements périodiques du boss, stocks d'acquisition, drops et lots initiaux de finale fournissent au maximum 260 balles et 46 cartouches sur P1–P8. Les apports supplémentaires pendant le duel sont décrits dans la section boss. Ces bornes ne démontrent pas un équilibre : plafonds de réserve, collecte, ratés et emploi des trois armes comptent. Les reliquats restent au sol ; munitions et soins comparent les hauteurs réelles de ramassage sur les rampes.

## Boss final — Maître du Portrait

Ancien propriétaire cadavérique au masque ivoire fissuré, toile bordeaux et laiton : en phase I, le corps reste entièrement prisonnier du cadre ; en phase II, il en sort avec bras déployés et cadre éclaté. Vingt-huit poses couvrent marche, anticipation en deux dessins, libération/suivi, récupération, trois étapes de transformation et mort. PNG carrés de 384 px sur un support de 2,6 × 2,6 m, appui commun au bord exclusif y=360 ; têtes mesurées par pose, alpha et ancrage partagés avec l'aperçu. Sources et transformations dans le [lot Maître du Portrait](asset-packs/MAITRE_PORTRAIT_2026-11-06.json).

P8 reste un duel sans renfort dans tout le manoir. Le joueur réemploie couvert, changement de trajectoire et précision ; le boss emprunte chemins et rampes réels, sans refermer les accès ouverts. Pas de téléportation, de saut entre étages ni de dégâts traversant murs ou planchers.

### Attaques et contre-jeu

| Attaque | Préparation | Effet | Réponse et ouverture |
| --- | --- | --- | --- |
| Éventail de lames | Première préparation de 1,1 s ; seconde volée annoncée séparément. Chaque cible est nouvelle puis verrouillée 0,35 s avant départ. | Phase I : deux volées de trois, espacées de 0,55 s, demi-angle 0,28 rad. Phase II : deux de cinq, espacées de 0,5 s, demi-angle 0,5 rad. Lames animées non guidées à 16 m/s, 18 dégâts chacune ; ligne de vue jusqu'à 18 m, arrêt au premier obstacle ou après 3 s. | Changer d'esquive entre volées ou prendre couvert. Seconde volée annulée si couvert, étage ou portée deviennent invalides ; après la dernière, récupération de 2 s en phase I, transition d’enchaînement en phase II. |
| Déchirure | 1,4 s, main abaissée et bande de fissures brun/bordeaux à liserés ambre. Direction fixée au début du geste. | Un impact de 22 dégâts dans une bande de 11 m maximum et de demi-largeur 0,65 m ; tracé arrêté par le sol et les obstacles, rupture brève à l'impact. | Quitter latéralement la bande ou passer derrière un obstacle ; récupération immobile de 2 s en phase I, 1,6 s en phase II. |
| Balayage de la main — phase II | 1,1 s, bras tiré en arrière et secteur frontal marqué au sol. | Un impact de 24 dégâts à 2,4 m maximum ; les secteurs sont tronqués aux obstacles et le coup reste limité à la zone annoncée. | Sortir du secteur, de portée ou prendre couvert ; récupération immobile de 1,6 s. |

**Corps et déplacement :** 2 400 PV et rayon de collision de 0,4 m. Le cadre limite les dégâts cumulés à 20 PV par seconde active depuis l'apparition : réserve initialement vide, rechargée au temps de simulation et plafonnée à 160 PV. Chaque impact consomme au plus cette réserve, commune aux trois armes ; attendre au couvert ne permet pas de stocker toute sa vulnérabilité. Mort impossible avant 120 secondes actives, sans plancher final à 1 PV ; le boss continue ses attaques. Les coups absorbés produisent une teinte laiton et le HUD « LE CADRE ABSORBE LES COUPS ». Les blessures n'annulent pas les gestes ; stun de hache sans effet. Poursuite à 3/3,5 m/s selon phase, approche entre attaques de 0,9/1,2 s et arrêt à 1,2 m sur le même sol. Navigation conservée entre étages ; aucun déplacement pendant préparation, combo, récupération ou transformation.

**Masque :** protégé hors vraie récupération finale : tête à 40 au pistolet et 12 par plomb, contre 80/24 une fois exposée. Corps à 28/13 ; ces valeurs brutes passent ensuite par la résistance du cadre, tête et corps compris. Les poses et le HUD indiquent protection et ouverture sans couvrir le visage. Ni intervalle entre volées, ni transition de combo, ni transformation ne constituent une exposition ; les décharges mixtes réduisent uniquement leur composante tête avant la résistance commune. Espacer les tirs et exploiter les ouvertures économise les munitions.

**Deux phases :** la première associe lames et déchirure. À 50 % des PV ou moins, attendre la sortie de récupération puis jouer 1,3 s de transformation vulnérable : rassemblement de fragments, éclatement à 55 % du geste, cadre ouvert et main déployée. La phase II ajoute le balayage rapproché et les enchaînements. Le seuil ne soigne pas, ne réinitialise pas la réserve de vulnérabilité et n'inflige aucun impact immédiat. La résistance empêche de supprimer la moitié restante d'une seule rafale. La mort interrompt tous les états, retire les marquages et conserve le cadavre dédié, sans relève.

**Enchaînement de phase II :** deux volées complètes → transition de 0,6 s → déchirure avec ses 1,4 s complètes de préparation. Celle-ci exige un joueur à plus de 2,4 m et au plus 11 m, même sol, ligne de vue et segment physique libre ; sinon elle est annulée. Pas d'éventail de cinq à bout portant : à 3,5 m ou moins, priorité au sol/balayage ; si le joueur s'approche pendant la première préparation, un nouveau geste rapproché est annoncé intégralement. Après la déchirure ou l'annulation, vraie récupération de 1,6 s ; le HUD distingue salves, transition et ouverture du masque.

**Peinture, toile et cadre :** lames en six poses animées et éclatements en quatre poses, complétés par fragments mats et gerbe latérale de transformation. Traînées courtes et sombres : l'ivoire identifie chaque lame et les intervalles restent visibles. Le HUD rappelle « DÉCALEZ-VOUS » à chaque salve ; esquive latérale après le verrouillage de visée. Les atlas sont partagés ; les effets préservent masque, visée et marquages, sans lumière ni ombre supplémentaire. Deux sons synthétisés de tension et rupture accompagnent la transformation. Budgets et cycle de vie dans `ARCHITECTURE.md`.

**Ravitaillement :** trois lots initiaux de vingt balles de pistolet, accessibles dès l'accalmie après P7 et initialisés une seule fois, départ direct/debug P8 compris. Pendant le duel vivant, le boss dépose toutes les 20 secondes actives vingt balles et quatre cartouches si les armes sont débloquées ; toutes les 40 secondes, un soin de 30 PV s'ajoute si la vie est à 70 ou moins. Objets ramassables près du boss, collision, hauteur et navigation vérifiées ; aucun gain direct dans l'inventaire. Plafond de quatre lots non consommés par arme et deux soins. Les drops continuent après deux minutes si nécessaire, sans rafale de rattrapage après pause/focus ; ils cessent à la mort/victoire. Les reliquats persistent pendant le duel ; les objets temporaires sont nettoyés à K/changement de palier/nouvelle tentative/destruction, sans réarmer les soins lâchés. Fusil facultatif ; aucune munition dépensée requise pour déclencher les drops.

**Présentation.** Jauge bordeaux biseautée en haut au centre pendant le duel. Nom, phase et alertes explicites, notamment transformation, enchaînement et masque exposé en récupération. La victoire attend la mort définitive et l'absence de menace résiduelle. Les projectiles hostiles sont supprimés et l’exploration et le bilan volontaire B restent accessibles.

## Mesures et critères de décision

La cible de 10–15 minutes reste ouverte. P1–P7 totalisent actuellement 59 ennemis ; sept accalmies ajoutent 70 s. Demande du 7 novembre : duel final d'au moins deux minutes, garanti par la résistance du cadre et alimenté en ressources. Le minimum porte sur la simulation active depuis l'apparition du boss, hors pause/focus ; une cadence faible peut prolonger la durée réelle. Mesurer la durée ressentie et l'économie en partie : la garantie logique ne prouve ni plaisir de combat ni équilibre. Conserver le rythme des autres paliers.

`TierDiagnostics` mesure maintenant le temps actif hors pause/focus, tirs et touches par arme, stocks entrée/sortie, gains de munitions et soins réels pendant le combat. Le « premier contact » reste le premier dégât donné ou reçu, pas la première menace vue. Les collectes partielles sont comptées comme collectes réussies et le diagnostic courant est accessible. Ne pas diviser les impacts de plombs par les tirs pour annoncer une précision.

- **Équité :** aucun dégât de Rampeuse/boss à travers porte fermée ou entre étages ; signal complet avant impact, pause/focus sans attaque surprise ; aucun dégât après mort ou victoire.
- **Rythme :** comparer découverte et joueur connaissant les circuits, avec temps actif par palier, temps sans menace accessible et plus longue attente. Tester une paire d'apparition bloquée au salon, au pied d'une rampe et à l'étage ; vérifier les quotas sans apparition forcée.
- **Armes et économie :** jouer P1 entièrement à la hache, mesurer geste, portée et récupération près des murs et après une relève ; vérifier stun et nouvelle préparation des quatre familles. Éprouver acquisitions, récompense oubliée et saut debug. Comparer fusil à 2/4/6 m, réactions/chutes devant mur et sur rampe et collectes partielles. Jouer P8 sans munition héritée, avec les lots initiaux puis les drops périodiques ; comparer tirs espacés, tirs soutenus, ratés et manque de soins. Aucune attaque n'exige une arme précise.
- **Boss :** reconnaître les trois gestes avant impact ; vérifier décalage contre l'éventail, sortie de bande et de secteur, couvert et poursuite entre niveaux. Comparer les silhouettes à 3/6/10 m ; vérifier qu'un mur derrière le joueur conserve un marquage devant lui et qu'un mur devant protège. Distinguer transition d’enchaînement et vraie récupération ; vérifier annulation du second geste au couvert, à un autre étage ou hors portée. Tester tirs dans chaque état, transformation vulnérable, seuil dépassé d’un coup, mort entre les gestes, expiration des lames, traînées arrêtées au contact, budget normal/debug et deux redémarrages. Évaluer les effets sans perte de lecture du masque ni des signaux, puis écouter le mix en partie.
- **Rampeuse :** vérifier fixation bornée, vraie occultation du regard, reprise hors champ, appuis sans glissement et sifflement avant saisie ; comparer lecture de la tête et confort de visée sous pression, lampe et autres ennemis présents.

Lots et critères de livraison dans `ROADMAP.md`. Aucune partie jouée n'est remplacée par les tests logiques ou les éliminations directes des outils de mesure.
