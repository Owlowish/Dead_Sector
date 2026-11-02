# Préparer et valider un asset animé avec une IA

## Pourquoi les itérations précédentes ont échoué

Une planche pouvait sembler correcte image par image tout en changeant la forme du pistolet entre les poses. Ensuite, les tests de munitions passaient, sans vérifier si le geste de rechargement se lisait bien. Enfin, le même masque affichait un chargeur dans une main censée approcher vide : le mouvement suggérait deux opérations. Génération d'image, animation et règle de gameplay sont trois problèmes à valider séparément.

## 1. Écrire le contrat avant de générer

Définir en une courte fiche :

- **Usage et composition** : vue FPS, objet d'interface ou personnage dans le monde ; position à l'écran et taille réelle d'affichage. Une référence de cadrage ne doit pas devenir une consigne de copier tout son style.
- **Style** : palette, taille des pixels, ombres, densité de détail et éclairage déjà dessiné dans l'image.
- **Invariants** : proportions et identité, perspective, canevas identique, points d'ancrage, transparence et marges. Donner les coordonnées des ancrages dans le canevas, pas dans une silhouette recadrée différemment à chaque pose.
- **Éléments mobiles** : préciser quelles pièces bougent et lesquelles restent identiques. Exemple : culasse, chargeur et main secondaire, tandis que la carcasse reste stable.
- **Scénario de l'action** : une phrase par phase, indiquant le mouvement ET ce qui doit être visible ou caché. Exemple : approche main vide → extraction → échange → insertion → retrait main vide.
- **Règle de gameplay associée** : quand se produit le résultat, et que se passe-t-il si l'action est interrompue ? L'affichage ne doit pas déclencher implicitement un second transfert de balles.

## 2. Choisir une technique adaptée à la précision

- Pose de repos : un sprite unique peut suffire.
- Pièces rigides en mouvement : préférer des couches issues de la même base plutôt que plusieurs redessins indépendants. Si leur perspective change vraiment, une simple rotation 2D ne suffit pas.
- Déformation organique (marche, visage) : utiliser de vraies poses dessinées, avec silhouette et points d'ancrage vérifiés.
- Perspective mécanique complexe : envisager de produire les sprites à partir d'un modèle 3D de référence cohérent, même si le jeu les affiche ensuite uniquement en 2D. C'est une possibilité future, pas une refonte automatique du projet.

La génération IA donne une matière visuelle ; elle ne garantit ni les proportions exactes ni une animation mécaniquement cohérente. Accepter de retoucher, de séparer les pièces ou de rejeter une planche au lieu d'essayer de tout compenser en CSS.

## 3. Trois validations avant d'étendre l'intégration

1. **Base** : afficher une seule pose à sa taille de jeu. Vérifier orientation, silhouette, raccords et lisibilité. Ne pas produire vingt poses autour d'une base incorrecte.
2. **Action hors gameplay** : regarder une planche puis jouer un seul cycle, avec lecture lente si nécessaire. Vérifier début, milieu, fin, nombre d'actions, ordre des pièces et absence de saut d'échelle. Un aperçu en boucle automatique peut masquer un retour au repos incorrect.
3. **Intégration** : vérifier l'état de départ, l'annulation et la fin, les effets, les données et l'interface ; puis observer l'action dans le vrai décor, à différentes résolutions et conditions d'éclairage.

Après ces contrôles, conserver l'asset accepté, sa fiche et la liste des limites. Les variantes rejetées restent identifiables, sans ambiguïté sur celle que le jeu charge.

## Application actuelle : pistolet

`src/WeaponAnimation.ts` est la chronologie commune du jeu et de l'aperçu. Elle nomme les phases et indique la visibilité indépendante de la main et du chargeur. `scripts/make-weapon-preview.mjs` utilise ces mêmes données ; il ne maintient plus une copie des poses.

Exécuter `node scripts/make-weapon-preview.mjs`, puis ouvrir `tmp/weapon-preview/standalone.html`. Le bouton joue un cycle sans simulation de combat. Observer d'abord sans lire le titre des phases : le geste doit se comprendre par lui-même. Les tests de `scripts/check-weapon.mjs` vérifient la chronologie et les munitions, pas la qualité artistique.

## Fiche de demande réutilisable

> Asset à créer : [objet / personnage / interface]. Usage et cadrage : […]. Référence de style : […]. Invariants : [dimensions, palette, perspective, proportions et ancrages]. Parties fixes : […]. Parties mobiles : […]. Action à raconter une seule fois : […]. Pour chaque phase, préciser ce qui est visible, ce qui bouge et sa durée. Produire d'abord une base et une courte prévisualisation à la taille cible ; valider ces éléments avant de généraliser. Vérifier séparément qualité visuelle, continuité d'animation et règles d'intégration. Signaler les limites de l'outil au lieu de remplacer silencieusement une exigence par une approximation.

Ce protocole s'applique aussi à un ennemi (silhouette et appuis des pieds), une porte (charnières et collision) ou une interaction d'interface (état initial, action unique, résultat). Il réduit les ambiguïtés ; il ne supprime pas le besoin d'observer le résultat.
