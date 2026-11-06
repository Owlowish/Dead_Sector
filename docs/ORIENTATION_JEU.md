# DEAD SECTOR — Direction du jeu

Consolidée le 6 novembre 2026. Direction et propositions de conception ici ; avancement réel dans `ETAT_PROJET.md`. Les valeurs proposées ci-dessous ne sont pas encore appliquées ni validées en partie.

## Direction retenue

- FPS rétro dans un même manoir victorien labyrinthique ouvert progressivement, avec circuits de fuite et accès anciens conservés.
- Progression par élimination des rencontres, sans extraction ni survie infinie.
- Tentative finie d'environ 10–15 minutes avec finale. Cible à mesurer, sans chronomètre punitif.
- Horreur psychologique par sons, silhouettes et événements du bâtiment ; vrais signaux de combat fiables.
- Style pixel art cohérent, obscurité jouable, performances légères et contrôles conservés.

## Boucle courante à préserver

La demande horde/précision du 3 novembre remplace les anciennes propositions de piédestaux et de départ manuel :

Combat → dernière menace définitivement éliminée → ouverture des accès nécessaires → dix secondes d'accalmie libre et ramassage → départ automatique de la rencontre suivante.

Munitions sur les ennemis avec budget minimal par palier ; soins et fusil ramassables. Les drops non consommés persistent entre paliers. Aucun achat ni choix d'amélioration actif ; ne pas réintroduire carillon ou piédestaux à partir d'un ancien plan.

Le prototype local enchaîne huit rencontres dont le Gardien en finale ; victoire avec exploration conservée et bilan volontaire. Cette réalisation reste à valider en partie ; la durée de 10–15 minutes est toujours une cible à mesurer. Avancement et limites dans `ETAT_PROJET.md`.

## Invariants

1. Finir une rencontre une seule fois, après toutes ses apparitions et menaces, y compris les relèves en attente.
2. Conserver déplacement, contrôle et pause explicite ; aucun menu automatique après la dernière élimination.
3. Suspendre décompte et combat hors contrôle ; garder les événements de dégâts, munitions et transition uniques.
4. Faire concorder navigation, altitude, portes et collisions ; ne pas apparaître dans une zone inaccessible ou immédiatement sous le regard.
5. Garder plafond actif borné et ressources suffisantes ; mesurer la difficulté en partie réelle avant de conclure à un équilibre.
6. Aucun dégât d'ambiance arbitraire, changement secret des trajets ou noir supprimant toute lecture du combat.
7. Partager les ressources graphiques utiles et nettoyer corps/effets sans supprimer les drops persistants.
8. Préserver le recul de deux secondes et les réglages expérimentés sauf correction justifiée ou demande.

## Gameplay global — proposition à prototyper

Faire évoluer les décisions demandées au joueur : reconnaître une menace, choisir son arme, dégager une sortie puis exploiter une récupération. La hausse actuelle repose surtout sur les spécialistes : P4–P6 ne gardent chacun qu'un standard ; P6–P7 autorisent trois Cracheurs simultanés. Les quotas seuls ne donnent pas une identité aux rencontres.

- **Pistolet : précision et économie.** Conserver 28 dégâts corps / 80 tête, cadence de 0,8 s et réserves actuelles. Standard : quatre corps ou deux têtes ; Coureur : trois corps ou une tête. Garder la tête comme moyen fiable d'empêcher une relève.
- **Fusil : dégagement rapproché.** Essayer 13 dégâts corps par plomb au lieu de 12, tête inchangée à 24 : huit plombs corps passent de 96 à 104 dégâts, permettant de tuer un standard de 100 PV si tous touchent. Garder dispersion, cadence, rechargement et recul de deux secondes ; comparer à 2/4/6 m avant adoption.
- **Circulation :** exploiter les circuits salon–vestibule–hall–galerie et les deux rampes vers l'étage. Conserver les accès ouverts, choisir des arrivées complémentaires et laisser une sortie praticable. Marche 5 m/s et sprint 9 m/s dépassent tous les poursuivants : vérifier les tours de piste en partie avant toute pénalité de mouvement ou d'ADS.
- **Signaux :** différencier préparation d'attaque, blessure et relève ; garder le décompte des menaces honnête pendant une relève. L'ambiance ne doit pas couvrir un vrai indice de combat. Pas de nouveau système d'endurance, d'achat ou d'objectif obligatoire pour ce lot.

### Rencontres proposées P1–P7

Totaux conservés pour isoler l'effet de la composition. S/C/T/R = Standard/Coureur/Cracheur/Rampeuse ; les escortes sont incluses dans C. « Ouverture » désigne une salve cadencée, pas des apparitions instantanées.

| Palier | S / C / T / R | Plafond actif | Ouverture | Décision dominante |
| --- | --- | --- | --- | --- |
| P1 | 4 / 0 / 0 / 0 | 3 | 1 | Viser, recharger, identifier une relève possible. |
| P2 | 3 / 2 / 0 / 0 | 3 | 1 | Prioriser le Coureur et découvrir le fusil au hall. |
| P3 | 3 / 2 / 1 / 0 | 4 | 1 | Utiliser couvert et altitude contre le premier projectile. |
| P4 | 3 / 3 / 1 / 1 | 4 | 2 | Identifier une Rampeuse avant les mélanges de hauteurs. |
| P5 | 3 / 4 / 2 / 1 | 5 | 3 | Alterner tir précis et dégagement, changer de circuit. |
| P6 | 4 / 4 / 2 / 2 | 6 | 3 | Tenir deux poussées finies et profiter d'une récupération. |
| P7 | 5 / 5 / 2 / 2 | 7 | 4 | Synthèse des priorités et préparation du duel final. |

Plafonds par type : deux Coureurs simultanés P3–P6, trois P7 ; un Cracheur jusqu'à P6, deux P7 ; une Rampeuse P4–P5, deux ensuite. P2 conserve un seul Coureur simultané. Le plafond global de huit reste une borne technique.

Ordre explicite nécessaire : P3 commence par des standards, puis Cracheur et escorte après deux éliminations définitives ; P4 présente sa Rampeuse après le premier engagement. P6 sépare ses douze ennemis en deux groupes de six : 3/2/1/0 puis 1/2/1/2, avec trois secondes actives de récupération après élimination définitive du premier groupe. Cette attente appartient au combat ; la file restante empêche toute fin anticipée. Les autres cadences restent initialement à 0,4 s en ouverture puis 0,8 s.

Une paire Cracheur/escorte sans place ou sans deux points sûrs doit être différée au profit d'un autre type éligible, en réservant son quota d'escorte. Ne jamais contourner collision, chemin, distance minimale de 6 m ou protection contre l'apparition sous le regard pour remplir une salve.

### Ressources et équité

Corriger avant de durcir : l'attaque actuelle de la Rampeuse utilise la distance horizontale sans contrôle d'obstacle ni d'altitude à l'impact. Vérifier le volume du joueur, le sol et la ligne de vue au départ et à l'impact ; rallonger sa préparation de 0,18 à 0,35 s comme hypothèse de lisibilité, sans modifier ses 40 PV ni ses 12 dégâts.

Conserver d'abord les budgets de drops P1–P7 et les soins de 30 PV réarmés une seule fois par transition, sans soin automatique. Conserver les reliquats de munitions : une boîte de dix ramassée avec 59/60 doit laisser neuf balles au sol. Un ennemi initial compte une seule fois, à son élimination définitive : seule celle-ci peut consommer un droit au drop ; une mort provisoire n'en consomme aucun. Les drops persistent entre les paliers.

Repère économique du code actuel, fusil acquis avant P4 : départ et drops donnent au maximum 240 balles et 46 cartouches sur P1–P8, avant pertes de ramassage ; les 65 ennemis demanderaient 277 balles au corps ou 105 à la tête, sans ratés ni relèves, avec le pistolet seul. Ce n'est pas une preuve de pénurie globale : mesurer l'emploi du fusil, les stocks réellement collectés et les relèves avant de réduire les ressources. P8 n'émet actuellement aucune cartouche ; son budget doit être remplacé avec le duel proposé ci-dessous.

## Boss final proposé — Le Gardien, intendant du manoir

Un ancien intendant en livrée funéraire, visage cadavérique et lourd trousseau de clés. Silhouette étroite compatible avec les portes ; tintement de métal et posture différencient ses préparations. Le bâtiment s'apaise à sa mort, sans cinématique imposée. Prototype : un duel, aucun renfort ; il remplace la composition P8 actuelle, pas les sept rencontres précédentes.

Le joueur réemploie couvert, changement de trajectoire et précision. Le boss poursuit par les vrais chemins et rampes dans tout le manoir ; aucun accès déjà ouvert ne se referme. Pas de téléportation, de saut entre étages ni de dégâts traversant murs ou planchers.

### Attaques et contre-jeu

| Attaque | Préparation | Effet proposé | Réponse et ouverture |
| --- | --- | --- | --- |
| Balayage du trousseau | 1,1 s, bras ramené, grincement distinct | 24 dégâts, portée 2,4 m, un seul impact avec obstacle et altitude vérifiés. | Sortir de portée ou prendre couvert ; récupération immobile de 1,6 s. |
| Jet de clés | 1,1 s, trousseau levé ; direction verrouillée sur les 0,35 dernières secondes | Projectile à 16 m/s, 18 dégâts, non guidé ; premier obstacle ou durée de 3 s le détruit. Choisi hors portée du balayage avec ligne de vue ; garder la direction engagée même si le joueur se rapproche, sans conversion en coup immédiat. | Se décaler latéralement ou passer derrière un obstacle ; récupération de 2 s. À distance de combat, le recul rectiligne seul peut être rattrapé. |

**Départ de prototype :** 800 PV, poursuite à 2,6 m/s, rayon de collision proche de 0,4 m ; silhouette autour de 2,1 m, à vérifier sous les linteaux. Corps et tête toujours vulnérables, dégâts des armes conservés. Une blessure montre l'impact sans annuler la préparation ; aucun verrouillage possible par les balles espacées de 0,8 s. Ne pas ajouter d'interruption lourde avant d'avoir validé ce comportement simple.

**Deux phases :** jusqu'à 50 % des PV, apprentissage des deux attaques ; ensuite livrée déchirée, tintement plus sec et récupération du jet abaissée à 1,6 s. Les préparations restent de 1,1 s et aucune attaque ne se superpose. Appliquer le changement à la prochaine sortie de récupération ; aucun soin, invulnérabilité, dégât excédentaire perdu ou impact immédiat au seuil. Mort prioritaire dans tous les états ; le Gardien ne se relève pas.

**Ressources finies :** trois lots de vingt balles de pistolet, accessibles dès l'accalmie après P7 sur des points du circuit vérifiés et conservés pendant P8. Créer ce budget une seule fois par tentative ; l'initialiser aussi en départ direct/debug P8, sans duplication à la reprise ou au lancement normal. Il remplace les drops de la composition P8 supprimée et reste propre à la finale. Ni fusil obligatoire, ni drop conditionné à des dégâts, ni ravitaillement infini. Avec zéro munition héritée, 800 PV demandent 29 touches corps : soixante balles autorisent 31 ratés si tout est collecté et sans perte de reliquat. Un gaspillage total peut toujours épuiser ce budget ; aucun soin supplémentaire au changement de phase.

**Présentation :** annonce brève, jauge compacte du Gardien uniquement pendant P8 et changement de phase visible ; aucune barre sur les ennemis ordinaires. Cette proposition fait évoluer la préférence UI3 précédente sans barre de boss. La victoire attend la mort définitive et l'absence de menace résiduelle ; supprimer les projectiles hostiles, conserver déplacement et bilan volontaire B.

**Production :** commencer avec le Gardien provisoire et des signaux temporaires distincts. Après validation du duel, suivre `PIPELINE_ASSETS.md` : base et action pilote, puis marche, deux préparations/impacts, récupération et mort avec ancrages et zones de tête partagés entre aperçu et jeu. Ne pas générer un lot complet avant ce pilote.

## Mesures et critères de décision

La cible de 10–15 minutes reste ouverte. P1–P7 totalisent actuellement 59 ennemis ; sept accalmies ajoutent 70 s. Mesurer d'abord la tentative avec le duel : ne pas allonger les attentes ou les PV pour atteindre artificiellement un chronomètre. Hypothèse pour une première découverte du boss : 45–90 s ; une victoire experte plus rapide est acceptable. Ses 800 PV permettent théoriquement dix têtes au pistolet en 7,2 s entre premier et dernier tir, ou cinq tirs de fusil intégralement tête ; les deux phases ne garantissent pas une durée minimale.

Avant comparaison, faire compter aux diagnostics le temps sous contrôle actif. Actuellement `TierDiagnostics` inclut les pauses et appelle « premier contact » le premier dégât donné ou reçu, pas la première menace vue. Séparer tirs et touches par arme, noter stocks entrée/sortie, gains réels, reliquats et soins nets ; les drops ramassés ne passent actuellement pas dans `recordAmmoBox`. Ne pas diviser les impacts de plombs par les tirs pour annoncer une précision.

- **Équité :** aucun dégât de Rampeuse/boss à travers porte fermée ou entre étages ; signal complet avant impact, pause/focus sans attaque surprise ; aucun dégât après mort ou victoire.
- **Rythme :** comparer découverte et joueur connaissant les circuits, avec temps actif par palier, temps sans menace accessible et plus longue attente. Tester une paire d'apparition bloquée au salon, au pied d'une rampe et à l'étage ; vérifier les quotas sans apparition forcée.
- **Armes et économie :** comparer fusil à 12 puis 13 dégâts corps/plomb aux mêmes distances ; tracer chaque collecte partielle. Jouer P8 avec zéro munition héritée, fusil non acquis et les soixante balles accessibles ; aucune attaque n'exige une arme précise.
- **Boss :** distinguer le jet et le balayage avant impact ; esquive latérale/couvert reproductibles, poursuite effective entre niveaux. En terrain libre, à 6–10 m au début de préparation, le sprint arrière rectiligne doit être rattrapé par le jet ; vérifier aussi le combat entre 2,4 et 6 m et l'expiration à longue distance. Tester tir pendant chaque état, seuil dépassé d'un coup, mort avant transition, budget en départ normal/debug et deux redémarrages.

Lots et critères de livraison dans `ROADMAP.md`. Aucune partie jouée n'est remplacée par les tests logiques ou les éliminations directes des outils de mesure.
