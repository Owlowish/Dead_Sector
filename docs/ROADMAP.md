# DEAD SECTOR — Roadmap d'une tentative complète

Mise à jour du 2 novembre 2026. Direction validée : tentative de 10 à 15 minutes avec rencontre finale, progression au-delà du palier 3, améliorations sans menu automatique et horreur psychologique. Ce plan ne décrit pas des fonctionnalités déjà livrées et n'autorise pas tous les ateliers en une seule intervention.

Évolution demandée le 4 novembre : le palier 8 est désormais une rencontre exclusivement Rampeuses (huit au total, quatre actives maximum), implémentée après les sept rencontres existantes. Elle remplace l'hypothèse de finale à cet emplacement ; la finale F6 reste à concevoir et son placement reste ouvert. Voir ETAT_PROJET pour les validations réelles.

## Destination et décisions

Même manoir victorien ouvert progressivement, circuits de fuite et demi-niveau existants conservés. Après ouverture complète, la variété vient des rencontres et des décisions, sans nouvelle aile à chaque palier. Deux armes et deux variantes suffisent au premier équilibrage.

**Validé :** format fini 10–15 minutes avec finale ; récompenses gratuites ; aucun menu surgissant après la dernière élimination ; horreur psychologique par sons, silhouettes et événements inquiétants ; jeu léger et style pixel art cohérent.

**Proposé, à tester :** huit paliers, dispositifs de choix dans le monde, rythme des accalmies, catalogue de bonus et identité de la finale. La durée est une cible observée, pas un chronomètre imposant la victoire. Aucune survie infinie ou méta-progression implicitement validée.

## Socle constaté

Trois paliers, apparitions différées, portes/raccourcis, manoir 48 × 40 avec demi-niveau +2,4 m et plafonds, pistolet/fusil, ADS/rechargement, lampe, standards/agiles et cadavres nettoyés au palier suivant. Voir le code et ETAT_PROJET pour les limites réelles.

`enterRespite` réapprovisionne et passe directement à l'exploration : le choix d'amélioration n'est plus actif dans ce flux. L'atelier performance F0 est confié à Gemini, avec changements locaux en cours ; vérifier ses résultats sans présumer ses gains.

Les roadmaps à trois paliers et linéaires sont archivées dans `docs/archives`. Elles ne sont plus la liste des prochaines tâches.

## Transition proposée sans rupture de contrôle

1. Dernière élimination : signal discret, chute du dernier ennemi conservée, déplacement et souris conservés. Aucun menu automatique.
2. Accalmie : recharger, se soigner, explorer et rejoindre un dispositif clairement signalé. Pas de nouveaux ennemis pendant le choix.
3. Deux objets/panneaux présentent les offres gratuites. Viser révèle l'effet ; une pression fraîche sur E choisit une offre, une seule fois pour ce palier.
4. Un objet de départ distinct lance le combat suivant après préparation. La même pression de touche ne choisit pas et ne démarre pas simultanément.
5. Possibilité proposée de passer explicitement le choix ; l'offre du palier est alors fermée. Pas de récompense différée récupérable après le départ, ni compte à rebours obligatoire au premier prototype.

Activer des supports préplacés près de la progression, plutôt que forcer un retour au vestibule après chaque combat. Tester le placement pour que les décisions restent brèves. Présentation détaillée possible à la demande, sans imposer une capture de souris. Le dispositif exact reste une proposition à valider sur un prototype.

## Structure proposée : huit rencontres

| Palier | Intention | Espaces/pression |
| --- | --- | --- |
| 1 | Apprendre le tir et une boucle | Secteur initial, ennemis lents |
| 2 | Lire deux menaces | Grand Hall, premiers agiles |
| 3 | Apprendre la verticalité | Plateau et escaliers |
| 4 | Réutiliser le manoir ouvert | Attaques depuis plusieurs ailes accessibles |
| 5 | Alterner précision et mobilité | Mélanges lents/agiles |
| 6 | Anticiper les renforts | Arrivées annoncées et accalmies locales |
| 7 | Maîtriser les itinéraires | Pression multidirectionnelle avec voie de fuite |
| 8 | Rencontre thématique | Rampeuses uniquement, implémenté le 4 novembre ; équilibre à tester |

Budgets indicatifs : environ 6–9 minutes de combats ordinaires, 2–4 minutes de préparation/exploration et 1–2 minutes de finale. Ajuster par des tentatives complètes pour atteindre réellement 10–15 minutes ; le nombre définitif de paliers reste négociable.

Conserver d'abord le quota actuel de quatre ennemis actifs. Varier composition, directions et rythme avant d'allonger les vagues. Garder des occasions de recharger. Éviter l'inflation simultanée santé/vitesse/quantité et les ennemis artificiellement supprimés par un délai de fin.

## Ateliers ordonnés

### F0 — Transitions fluides (déjà autorisé, confié à Gemini)

- Résultat : temps d'image brut, navigation réutilisée avec portes mobiles, ressources conservées entre paliers. Lire AUDIT_PERFORMANCES_PALIERS et inspecter les changements en cours.
- Concepts : budget d'image, graphe, durée de vie des ressources.
- Fichiers : Game, Level/Door, Zombie, AgileZombieAnimation, ZombieRemains, PerfTracker si présent.
- Validation : mesures avant/après comparables, p95/p99/max, premières apparitions standard/agile, portes/escaliers et corps nettoyés. Build seul insuffisant.

### F1 — Séparer rencontres et secteurs

- Résultat : passer au palier 4 sans quatrième secteur ni victoire prématurée. Conserver les trois premières rencontres et ajouter un quatrième cas court pour valider la structure ; la finale complète vient plus tard.
- Concepts : données de configuration et transitions d'état.
- Fichiers : Game, MansionConfig, éventuellement EncounterConfig, HUD et tests de paliers.
- Validation : accès déjà ouverts conservés ; apparitions dans les zones autorisées ; compteurs incluant la file d'attente ; fin d'une tentative indépendante du nombre de secteurs.
- Exercice : expliquer pourquoi la longueur de la liste des secteurs ne doit plus décider de la victoire.

### F2 — Choisir une amélioration sans menu imposé

- Résultat : prototype des deux offres dans le monde et du départ distinct selon le contrat ci-dessus, avec les assets existants.
- Concepts : options éligibles et consommation unique d'une décision.
- Fichiers : Game, Weapon/Player, interaction et HUD ; extraire une classe seulement si la responsabilité devient concrète.
- Commencer avec quelques bonus bornés : réserve, précision à la hanche, mobilité ADS, rechargement. Si la vitesse de rechargement change, adapter toute sa chronologie et son instant de transfert ensemble.
- Validation : aucune capture de souris automatique ; un seul bonus ; E maintenu ne double rien ; offre passée fermée ; pas de bonus récupérable après départ ; remise à zéro à la nouvelle tentative ; aucune offre inutile ou pour une arme absente.
- Prévoir un ravitaillement minimal indépendant du choix pour éviter une tentative impossible faute de munitions.
- Exercice : distinguer « offre disponible » et « avantage appliqué ».

### F3 — Salle témoin visuelle et sonore

- Résultat : une salle existante, par exemple le Grand Salon, devient la référence avant d'étendre le style au manoir. Auditer le rendu réel et comparer les mêmes points de vue avant/après.
- Concepts : hiérarchie visuelle, contraste utile et son spatial.
- Fichiers : Level, VisualStyle, audio Game/Zombie/Player et assets concernés. Appliquer PIPELINE_ASSETS pour tout asset animé.
- Améliorer repères de passage, usure, silhouettes des objets et cohérence des textures/pixels. Garder une attaque, un escalier et une poignée lisibles dans l'obscurité. Quelques sons de bâtiment avec intervalles de silence ; éviter les boucles courtes agressives.
- Budget : matériaux/textures réutilisés, décor statique hors des trajets, pas de nouvelle ombre pour chaque bougie ni miroir temps réel ou post-traitement lourd nécessaire au résultat.
- Validation : lecture des ennemis/escaliers, arme cohérente avec la lumière, temps d'image comparable et écoute à volume modéré.
- Exercice : identifier le repère qui attire le regard et vérifier qu'il aide à se déplacer.

### F4 — Construire et équilibrer la progression complète

- Résultat : première version des paliers 1–7 de la table, avec ennemis existants et quota actif borné. Une intention et une occasion de récupération par rencontre.
- Concepts : budget de menace et rythme.
- Données : quotas, types, zones et rythme d'arrivée. Pas d'adaptation automatique à la performance du joueur dans ce premier essai.
- Validation : relever durées de combat/accalmie, munitions et causes de mort ; varier une dimension à la fois ; garantir le ravitaillement minimal.
- Exercice : comparer la pression de deux groupes de même taille mais de compositions différentes.

### F5 — Horreur psychologique contrôlée

- Résultat : un premier événement rare, puis un petit catalogue : bruit dans une aile, silhouette qui se retire, portrait ou décor différent au retour. Déclencher surtout pendant exploration et accalmies.
- Concepts : événements conditionnels et rythme audio/visuel.
- Séparer ambiance et vraies entités. Une silhouette d'ambiance n'est pas une cible bloquant les tirs ou un ennemi restant ; elle ne doit pas imiter une attaque immédiatement dangereuse.
- Contraintes : silence, volume réglable, ressources bornées/préchargées, pas de répétition à chaque porte, dégâts scriptés, contrôles arrachés au joueur, changement secret de navigation ou noir total supprimant toute lecture du combat.
- Validation : déclenchement unique, retour propre, surcoût mesuré ; ne pas perturber une action qui exige une information précise.
- Exercice : distinguer une incertitude inquiétante d'un signal de combat trompeur.

### F6 — Rencontre finale et bilan

- Résultat : finale avec anticipation, attaque et récupération, puis bilan et nouvelle tentative propre. Prototyper une élite avec les moyens actuels avant de produire un nouveau boss animé.
- Concepts : états de combat et télégraphie.
- Identité, attaques, renforts et placement à valider séparément. P8 accueille désormais la rencontre Rampeuses ; aucun autre emplacement de finale n'est autorisé implicitement. Éviter une simple hausse massive de PV.
- Validation : dégâts évitables, voie de fuite, ressources suffisantes, renforts comptabilisés, victoire unique, bilan durée/choix/paliers et réinitialisation complète.

### F7 — Variantes, confort et démo

- Résultat : variantes de rencontres avec graine, réglages persistants volume/sensibilité/luminosité, démo reproductible.
- Concepts : hasard déterministe et séparation réglages/état de tentative.
- Garder le squelette de circulation ; aucune génération libre des murs/escaliers prévue. Options d'ombres guidées par mesures.
- Validation : plusieurs graines et combinaisons, tentatives chronométrées, crédits des ressources et limites documentés. Publication/hébergement à demander explicitement.

## Reprise et méthode

Lire AGENTS, ETAT_PROJET puis le seul atelier pertinent ici. Vérifier le code et les changements locaux. Expliquer résultat/concepts/fichiers, implémenter l'atelier autorisé, compiler, observer puis débriefer avec un exercice et actualiser l'état.

F0 doit être suffisamment vérifié avant F1. Le prompt `PROMPT_GEMINI_TENTATIVE_FINIE.md` lance uniquement F1, pas toute cette roadmap. Un résultat implémenté n'est pas nécessairement observé en combat.
