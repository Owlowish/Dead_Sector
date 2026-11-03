# Proposition pour Luna — F5, premier événement d'horreur contrôlée

**Statut : proposition, pas accord d'implémentation.** Présenter cet atelier et attendre l'accord de l'utilisateur avant de modifier le gameplay F5. Les réparations F3/F4 ont leur propre tâche et doivent être prises en compte avant intégration.

## Intention et idées

Le manoir doit sembler habité même quand le combat est terminé, tout en conservant des signaux d'attaque fiables. Trois idées classées dans l'ordre conseillé :

1. **Un craquement provenant d'une aile hors du regard** : silence, bref bruit de bois, puis silence. Première étape recommandée : aucun asset graphique à produire et réemploi possible de `creak-soft.wav`.
2. **Une présence qui se retire** : silhouette décorative très brève derrière une ouverture, sans grognement d'attaque, points de vie, collision ni intégration aux cibles. Extension ultérieure, à valider visuellement séparément.
3. **Le portrait a changé au retour** : altération discrète d'un seul tableau quand il n'est pas regardé. Extension ultérieure, après validation de deux images fixes ; aucun changement pendant l'observation directe.

Cet atelier n'implémente que l'idée 1. Aucun catalogue de trois événements d'un coup, jump scare, dégât scripté, porte déplacée, noir total ou prise de caméra.

## Ce que l'utilisateur apprendra

- **Événement conditionnel** : un timer écoulé autorise à chercher une occasion ; il ne force pas un effet dans une mauvaise situation.
- **Audio spatial** : l'AudioListener de Player représente l'écoute, un PositionalAudio placé dans Level représente la source. Distance et direction changent la perception ; les murs n'atténuent pas automatiquement le son dans Three.js.
- **Responsabilités** : Game connaît la phase de partie ; un petit `HorrorDirector` gère délai, éligibilité et lecture ; Level fournit quelques points valides. Aucun zombie fictif à ajouter.

## Proposition concrète à faire approuver

- Un seul événement sonore, au plus **une fois par accalmie non terminale**, après un délai aléatoire initial de **18 à 30 secondes de temps éligible**. Ces valeurs sont des hypothèses d'essai, pas des réglages artistiques définitifs.
- Phase éligible : `exploration` avec prochaine rencontre en attente, aucun zombie vivant, aucune apparition en attente, souris verrouillée, document visible et application au premier plan. Le combat et la fin du prototype ne produisent aucun nouvel événement.
- Une source parmi **3 à 5 points fixes** dans les secteurs réellement ouverts, à **6–16 m** du joueur, hors du cône de regard. Chaque point décrit sa zone et son altitude via `getFloorHeightAt` ; ne pas tirer des coordonnées aléatoires dans les murs. Vérifier les points dans le vrai manoir et leurs conditions d'accès.
- Aucun point éligible : attendre et réévaluer à basse fréquence (par exemple 0,5 s). Ne pas jouer au centre de la tête du joueur comme solution de secours. Ne pas relancer du pathfinding à chaque image.
- Une seule source audio réutilisée, buffer préchargé. Aucun `new Audio` à chaque événement ; aucun mesh, ombre ou ennemi ajouté pour le son.
- Si la pause, le flou ou l'onglet masqué intervient : arrêter le son courant, figer le délai, aucune file de sons à rattraper. Réintroduire au moins quelques secondes de silence à la reprise. Au départ du combat : interrompre l'effet et réinitialiser les données de l'accalmie sans interrompre la nappe d'ambiance générale ni les sons d'ennemis.
- Volume de cet effet réglable de 0 à 1 dans un contrôle simple du panneau de pause ; 0 désactive ces événements. Garder une valeur initiale faible, à écouter. Ne pas réduire les vrais signaux d'attaque avec ce réglage. La persistance complète des réglages reste F7.

## Fichiers et flux conseillés

- `src/HorrorDirector.ts` : responsabilité concrète nouvelle : temporisation, sélection conditionnelle d'un point, source audio unique, volume, arrêt/réinitialisation/libération. Champs explicites ; pas de propriétés dans les paramètres du constructeur (`erasableSyntaxOnly`). Méthodes simples, sans framework d'événements générique.
- `src/Game.ts` : charge le buffer, construit le directeur, transmet le contexte et le delta, signale pause/reprise et transitions. **Remplacer la responsabilité du craquement actuel** (`creakAudio`, `creakTimer` et bloc de boucle), afin d'éviter deux déclencheurs concurrents. Préserver la nappe et les grognements.
- `src/MansionConfig.ts` : quelques données de sources réelles avec condition d'ouverture ; `Level.ts` seulement si une petite requête publique d'accès est nécessaire. Vérifier l'état réel des portes : « déverrouillé » n'est pas forcément « ouvert ».
- `index.html` / `src/style.css` : contrôle de volume discret dans la pause, sans menu automatique ajouté au jeu.
- `scripts/check-horror-f5.mjs` : tests de la vraie logique, hasard et audio simulés aux frontières ; ne pas recopier l'algorithme dans le test.

Flux : `Game (phase + focus + position + regard + secteurs ouverts) → HorrorDirector.update(delta, contexte) → choisit une source admissible → positionne un PositionalAudio → joue une fois → marque l'accalmie consommée`. Le directeur ne décide ni de la victoire, ni des spawns, ni des trajets.

Réutiliser le craquement F3 pour la première preuve de fonctionnement. Si son timbre ne convient pas à distance, proposer ensuite une variante et la faire écouter ; ne pas régénérer tous les sons existants. Pour une future silhouette animée, lire PIPELINE_ASSETS et valider une base puis un cycle isolé à taille réelle avant intégration.

## Critères d'acceptation

1. Aucune lecture avant le délai initial, en combat, en pause, hors focus, onglet caché ou après la fin du prototype.
2. Une seule lecture maximum par accalmie ; aucun doublon après changement de porte ou multiplication des frames. Aucun rattrapage au retour d'onglet.
3. Un point admissible respecte distance, regard, altitude et accès ; aucun point ne signifie silence. Ne pas confondre test de cône et occlusion par un mur.
4. À la pause et au lancement de rencontre, le son est arrêté immédiatement. La reprise ne le rejoue pas depuis son début. Les sons d'attaque fonctionnent toujours.
5. Volume 0 silencieux ; modification du volume active sans multiplication des sources. Ressources nettoyées, callbacks de chargement tardifs inoffensifs après destruction.
6. Les compteurs d'ennemis, cibles du raycast, collisions et navigation sont identiques avant/après l'effet.
7. Build réussi et tests comportementaux. Dans le navigateur : écouter au casque à volume modéré depuis deux orientations, une fois au rez-de-chaussée et une fois en hauteur, tester pause/reprise et départ immédiat de combat. Décrire les observations réelles et les essais absents.
8. Comparer temps d'image brut avant/après dans le même scénario et vérifier qu'aucune ressource ou source audio ne s'accumule. Un test Node ne prouve ni la spatialisation perçue ni l'effet inquiétant.

## Débrief et exercice

Présenter les fichiers, le flux réel entre Game/Level/Player/directeur, la différence entre temps réel et temps éligible, les limites du son sans occlusion et le compromis de rareté. Actualiser ETAT_PROJET sans transformer une compilation en validation artistique.

Mini-exercice : modifier seulement le délai d'attente, puis chronométrer une accalmie avec une pause au milieu. Question de compréhension : si aucun point admissible n'existe quand le délai expire, pourquoi vaut-il mieux garder le silence que jouer le bruit près du joueur ? Ne pas fournir immédiatement la solution.
