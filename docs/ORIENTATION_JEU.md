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

La hache est équipée au départ. Les purges de P1 et P3 débloquent immédiatement les armes 2 et 3 dans l'inventaire, avec notification et dotation. Le joueur choisit quand changer d'arme. Soins et munitions restent des objets à ramasser. Pendant l'accalmie, un repère ambre indique l'accès nouvellement débloqué le plus proche. Un soin visible, accessible et à moins de 10 m prime si la vie est à 55 % ou moins. Les drops non consommés persistent entre paliers. L'accalmie reste libre et le prochain combat part automatiquement.

Le prototype local enchaîne huit rencontres dont le Maître du Portrait en finale. L'exploration continue après la victoire. Le bilan volontaire par B indique en cas de défaite le geste fatal, le palier et un éventuel rechargement en cours. La durée de 10–15 minutes reste une cible à mesurer en partie. Avancement et limites dans `ETAT_PROJET.md`.

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

- **Hache rustique · arme 1, équipée de base.** 55 dégâts sans bonus tête, portée de 2,05 m, préparation de 0,48 s, contact à 0,62 s et cycle de 1,45 s. Le point devient ambre quand la hache est prête et qu'une cible est atteignable. Le coup évalue une seule cible à l'instant du contact et tient compte du décor. Les quatre familles ordinaires survivantes sont étourdies 0,85 s et doivent reprendre leur préparation. Le Maître résiste. Deux coups provoquent la première mort d'un Standard. Une relève éventuelle reste une menace. Le changement d'arme attend la fin du geste. Fer usé, manche droit et ligatures. Garde basse diagonale avec la main gauche en bas, redressement à la levée, frappe verticale et retour lent.
- **Pistolet · arme 2.** Précision et économie. Conserver 28 dégâts corps / 80 tête, cadence de 0,8 s et réserves actuelles. Un Standard tombe en quatre tirs au corps ou deux à la tête. Un Coureur tombe en trois au corps ou un à la tête. Un tir fatal à la tête empêche la relève.
- **Fusil · arme 3.** Dégagement rapproché. 13 dégâts corps / 24 tête par plomb. Huit plombs corps totalisent 104 dégâts, de quoi tuer un Standard de 100 PV. La puissance d'impact dépend des plombs reçus et de la proximité, forte jusqu'à 3 m puis atténuée. Poussée du Standard jusqu'à 0,72 m en 0,26 s, Coureur plus sensible, Cracheur et Rampeuse plus résistants. Murs, portes et ruptures de sol arrêtent la poussée. Les rampes conservent l'appui. Le boss réagit visuellement et poursuit ses préparations. Sur forte mort des quatre familles ordinaires, 80 ms de pose de choc précèdent la chute emportée et le cadavre stable, avec relève éventuelle au nouvel appui. Gerbe courte graduée, sang sombre ou toile/peinture du Portrait. Dégâts, dispersion, cadence, rechargement et recul de deux secondes conservés. Comparer à 2/4/6 m pour le calage en partie.
- **Circulation :** exploiter les circuits salon–vestibule–hall–galerie et les deux rampes vers l'étage. Conserver les accès ouverts, choisir des arrivées complémentaires et laisser une sortie praticable. Marche 5 m/s et sprint 9 m/s dépassent tous les poursuivants : vérifier les tours de piste en partie avant toute pénalité de mouvement ou d'ADS.
- **Signaux :** différencier préparation d'attaque, blessure et relève ; garder le décompte des menaces honnête pendant une relève. L'ambiance ne doit pas couvrir un vrai indice de combat. Pas de nouveau système d'endurance, d'achat ou d'objectif obligatoire pour ce lot.

### Rencontres actuelles P1–P7

Totaux conservés pour isoler l'effet de la composition. S/C/T/R = Standard/Coureur/Cracheur/Rampeuse ; les escortes sont incluses dans C. « Ouverture » désigne une salve cadencée, pas des apparitions instantanées.

| Palier | S / C / T / R | Plafond actif | Ouverture | Décision dominante |
| --- | --- | --- | --- | --- |
| P1 | 4 / 0 / 0 / 0 | 1 puis 3 | 1 | Isoler le premier Standard jusqu'à sa mort définitive, apprendre la portée et reconnaître une relève. |
| P2 | 3 / 2 / 0 / 0 | 3 | 1 | Apprendre tir précis/recharge au pistolet et prioriser le Coureur. |
| P3 | 3 / 2 / 1 / 0 | 4 | 1 | Utiliser couvert et altitude contre le premier projectile ; gagner le fusil. |
| P4 | 3 / 3 / 1 / 1 | 4 | 2 | Exploiter le fusil et identifier la Rampeuse avant les mélanges de hauteurs. |
| P5 | 3 / 4 / 2 / 1 | 5 | 3 | Lire le premier Coureur sur un flanc bas et choisir un trajet face au Cracheur près d'une rampe. |
| P6 | 4 / 4 / 2 / 2 | 6 | 3 | Tenir la première poussée autour du Hall puis lire les Rampeuses arrivant des pièces hautes après la pause. |
| P7 | 5 / 5 / 2 / 2 | 7 | 4 | Choisir entre Cracheurs au fond de l'étage, Coureurs dans les ailes basses et Rampeuses dans le Hall. |

Plafonds par type : deux Coureurs simultanés P3–P6, trois P7 ; un Cracheur jusqu'à P6, deux P7 ; une Rampeuse P4–P5, deux ensuite. P2 conserve un seul Coureur simultané. Le plafond global de huit reste une borne technique.

Ordre explicite : P3 commence par des standards, puis Cracheur et escorte après deux éliminations définitives ; P4 autorise la Rampeuse après deux éliminations. P6 sépare ses douze ennemis en deux groupes de six : 3/2/1/0 puis 1/2/1/2, avec trois secondes actives de récupération après élimination définitive du premier groupe. Cette attente appartient au combat ; la file restante empêche toute fin anticipée. Les autres cadences restent à 0,4 s en ouverture puis 0,8 s.

Une paire Cracheur/escorte sans place ou sans deux points sûrs est différée au profit d'un autre type éligible, avec quota d'escorte réservé. Au P3, des points de repli à l'étage couvrent les angles morts du pool initial. Si le dernier duo ne trouve toujours aucune paire sûre, le Cracheur entre d'abord et son escorte au premier placement sûr après deux secondes actives. Les zones de P5–P7 sont des préférences. Secteur, collision, chemin, distance minimale de 6 m et protection contre l'apparition sous le regard restent obligatoires.

Les Cracheurs s'écartent les uns des autres pendant l'approche, avec contrôle du sol et des collisions. Leurs poses d'attaque restent fixes. Au P6, la consigne de la courte pause suit l'état de l'arme active et indique quand recharger ou se repositionner.

### Ressources et équité

La Rampeuse V3 garde 40 PV, 12 dégâts et une préparation de 0,35 s avec sifflement dès son début. Dos cassé haut, tête basse inclinée et appuis alternés renforcent la silhouette ; six poses et provenance dans le [lot Rampeuse](asset-packs/RAMPEUSE_V2_2026-11-04.json). La saisie vérifie volume bas du joueur, sols et obstacles au départ et à l'impact, y compris à l'atterrissage debug.

À distance, le regard visible provoque une fixation de 0,55 s, répétable au plus toutes les 2,1 s et seulement au-delà de 3 m. Détourner le regard relance immédiatement une traction plus rapide. La lampe déclenche une anticipation de 0,42 s immobile. Posture d'attaque, sifflement aigu et éclat ambre large sur les épaules annoncent la charge. Posture de recul, sifflement grave et éclat froid resserré annoncent la fuite. Le tirage reste équiprobable et interrompt la saisie en préparation.

P1 ne produit aucun drop de munitions. Les budgets P2–P7 sont conservés et les soins de 30 PV sont réarmés une fois par transition. Un départ direct ou debug reçoit les armes prévues pour le palier. Une boîte de dix ramassée à 59/60 laisse neuf balles au sol. Un ennemi compte une fois, à son élimination définitive, et seule celle-ci peut consommer un droit au drop.

Repère économique, fusil acquis avant P4 : hors ravitaillements périodiques du boss, stocks d'acquisition, drops et lots initiaux de finale fournissent au maximum 260 balles et 46 cartouches sur P1–P8. Les apports supplémentaires pendant le duel sont décrits dans la section boss. Ces bornes ne démontrent pas un équilibre : plafonds de réserve, collecte, ratés et emploi des trois armes comptent. Les reliquats restent au sol ; munitions et soins comparent les hauteurs réelles de ramassage sur les rampes.

## Boss final — Maître du Portrait

Ancien propriétaire cadavérique au masque ivoire fissuré, toile bordeaux et laiton : en phase I, le corps reste entièrement prisonnier du cadre ; en phase II, il en sort avec bras déployés et cadre éclaté. Vingt-huit poses couvrent marche, anticipation en deux dessins, libération/suivi, récupération, trois étapes de transformation et mort. PNG carrés de 384 px sur un support de 2,6 × 2,6 m, appui commun au bord exclusif y=360 ; têtes mesurées par pose, alpha et ancrage partagés avec l'aperçu. Sources et transformations dans le [lot Maître du Portrait](asset-packs/MAITRE_PORTRAIT_2026-11-06.json).

P8 reste un duel sans renfort dans tout le manoir. Le joueur réemploie couvert, changement de trajectoire et précision ; le boss emprunte chemins et rampes réels, sans refermer les accès ouverts. Pas de téléportation, de saut entre étages ni de dégâts traversant murs ou planchers.

### Attaques et contre-jeu

| Attaque | Préparation | Effet | Réponse et ouverture |
| --- | --- | --- | --- |
| Éventail de lames | Première préparation de 1,1 s ; seconde volée annoncée séparément. Chaque cible est nouvelle puis verrouillée 0,35 s avant départ. | Phase I : deux volées de trois, espacées de 0,55 s, demi-angle 0,28 rad. Phase II : deux de cinq, espacées de 0,5 s, demi-angle 0,5 rad. Lames animées non guidées à 16 m/s, 18 dégâts chacune ; ligne de vue jusqu'à 18 m, arrêt au premier obstacle ou après 3 s. | Changer d'esquive entre volées ou prendre couvert. Seconde volée annulée si couvert, étage ou portée deviennent invalides ; après la dernière, récupération de 2 s en phase I, transition d’enchaînement en phase II. |
| Déchirure | 1,4 s, main abaissée et bande de fissures brun/bordeaux à liserés ambre. Direction fixée au début du geste. | Un impact de 22 dégâts dans une bande de 11 m maximum et de demi-largeur 0,65 m ; tracé arrêté par le sol et les obstacles, rupture brève à l'impact. | Quitter latéralement la bande ou passer derrière un obstacle ; récupération immobile de 2 s en phase I, 1,6 s en phase II. |
| Balayage de la main — phase II | 1,1 s, bras tiré en arrière, secteur au sol et liseré ambre relevé. Une alerte au-dessus du viseur signale le danger réel, y compris en ADS. | Un impact de 24 dégâts à 2,4 m maximum. Les secteurs sont tronqués aux obstacles. | Sortir du secteur, de portée ou prendre couvert. L'alerte s'éteint hors danger. Récupération immobile de 1,6 s. |

**Corps et déplacement :** 2 400 PV et rayon de collision de 0,4 m. Le cadre limite les dégâts cumulés à 20 PV par seconde active depuis l'apparition : réserve initialement vide, rechargée au temps de simulation et plafonnée à 160 PV. Chaque impact consomme au plus cette réserve, commune aux trois armes ; attendre au couvert ne permet pas de stocker toute sa vulnérabilité. Mort impossible avant 120 secondes actives, sans plancher final à 1 PV ; le boss continue ses attaques. Les coups absorbés produisent une teinte laiton et le HUD « LE CADRE ABSORBE LES COUPS ». Les blessures n'annulent pas les gestes ; stun de hache sans effet. Poursuite à 3/3,5 m/s selon phase, approche entre attaques de 0,9/1,2 s et arrêt à 1,2 m sur le même sol. Navigation conservée entre étages ; aucun déplacement pendant préparation, combo, récupération ou transformation.

**Masque.** Protégé hors vraie récupération finale. Dégâts tête à 40 au pistolet et 12 par plomb, contre 80/24 une fois exposée. Le corps reçoit 28/13 avant résistance. Le cadre s'éclaire quand la réserve atteint 80 PV ou les PV restants s'ils sont inférieurs. « TIREZ » s'affiche avec une ligne dégagée vers le masque, « MASQUE EXPOSÉ » derrière un couvert et « CADRE RÉSISTANT » si la réserve est insuffisante. Les décharges mixtes réduisent uniquement leur composante tête avant la résistance commune. Espacer les tirs et exploiter les ouvertures économise les munitions.

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
- **Armes et économie.** Jouer P1 entièrement à la hache et mesurer geste, portée et récupération après une relève. Éprouver les acquisitions directes et le saut debug. Comparer le fusil à 2/4/6 m, les chutes devant un mur et les collectes sur rampe. Jouer P8 avec les lots initiaux puis les drops périodiques en partant à sec. Comparer tirs espacés et tirs soutenus.
- **Boss :** reconnaître les trois gestes avant impact ; vérifier décalage contre l'éventail, sortie de bande et de secteur, couvert et poursuite entre niveaux. Comparer les silhouettes à 3/6/10 m ; vérifier qu'un mur derrière le joueur conserve un marquage devant lui et qu'un mur devant protège. Distinguer transition d’enchaînement et vraie récupération ; vérifier annulation du second geste au couvert, à un autre étage ou hors portée. Tester tirs dans chaque état, transformation vulnérable, seuil dépassé d’un coup, mort entre les gestes, expiration des lames, traînées arrêtées au contact, budget normal/debug et deux redémarrages. Évaluer les effets sans perte de lecture du masque ni des signaux, puis écouter le mix en partie.
- **Rampeuse :** vérifier fixation bornée, vraie occultation du regard, reprise hors champ, appuis sans glissement et sifflement avant saisie ; comparer lecture de la tête et confort de visée sous pression, lampe et autres ennemis présents.

Lots et critères de livraison dans `ROADMAP.md`. Aucune partie jouée n'est remplacée par les tests logiques ou les éliminations directes des outils de mesure.
