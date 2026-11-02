# DEAD SECTOR — Collaboration et pédagogie

Répondre en français. L'utilisateur apprend le développement de jeux : l'objectif est de comprendre les mécanismes et les décisions, autant que de produire du code fonctionnel.

Avant toute nouvelle fonctionnalité, expliquer brièvement ce qui sera construit, les concepts abordés, les fichiers et classes concernés, et le choix de solution. Pour une fonctionnalité importante, présenter ce plan et attendre l'accord de l'utilisateur avant de modifier le code. Les corrections triviales peuvent être faites directement.

Privilégier des changements simples, lisibles, ciblés et modulaires, sans abstraction prématurée ni suppression injustifiée de fonctionnalités. Commenter seulement les logiques non évidentes. Le projet utilise TypeScript, Three.js et Vite, sans React ni moteur physique externe ; `erasableSyntaxOnly` interdit les propriétés déclarées dans les paramètres de constructeur. Vérifier la compilation avec `npm.cmd run build` après chaque intervention sur le code.

Après chaque implémentation, fournir un débrief pédagogique : fichiers modifiés et leur rôle ; deux ou trois concepts essentiels illustrés par le code réel et la communication entre classes ; justification des choix, compromis et limites ; un mini-exercice simple avec une manière de vérifier son effet, sans en donner immédiatement la solution. Ne pas détailler chaque ligne. Expliquer en particulier, selon le sujet, la boucle de jeu, le delta-time, le raycasting, les collisions, les billboards, les textures, les animations et les états des ennemis. Distinguer compilation et validation du gameplay, et signaler les vérifications non effectuées.

Ces consignes s'appliquent jusqu'à instruction contraire de l'utilisateur.

Direction de jeu validée le 2 novembre 2026 : même manoir-arène labyrinthique ouvert progressivement, ennemis à éliminer par palier, récompense gratuite à choisir entre les paliers ; pas d'objectif d'extraction dans la nouvelle cible. Lire `docs/ORIENTATION_JEU.md` pour les détails validés et ceux encore proposés. Ne pas confondre cette cible avec le code existant : la migration n'est pas encore implémentée et le plan seul ne l'autorise pas.

## Reprise du projet par un autre modèle

1. Lire ce fichier, puis `docs/ETAT_PROJET.md` (faits et prochaine étape). Lire `docs/ARCHITECTURE.md` pour comprendre les responsabilités. Consulter seulement le jalon pertinent de `docs/ROADMAP.md`, puis les fichiers de code concernés. Ne pas relire tout le dépôt à chaque petit changement.
2. Le code réel fait foi. Vérifier les signatures avant toute modification. Les documents décrivent un état daté et peuvent devenir périmés.
3. Identifier la dernière demande et l'accord éventuel de l'utilisateur. Une proposition de la roadmap n'est pas une autorisation d'implémenter tous les jalons. Pour « la suite ? », recommander un seul atelier, en expliquer l'apport macroscopique et attendre l'accord pour une fonctionnalité importante. Ne pas redemander un accord déjà donné.
4. Viser un atelier court et cohérent : un comportement observable, un ou deux concepts, un résultat testable. Ne pas découper artificiellement la progression en une longue série de retouches cosmétiques.
5. L'utilisateur veut comprendre les responsabilités, les données et les flux entre systèmes, pas mémoriser des noms de variables. Relier chaque exercice local à la mécanique globale. Poser une question de compréhension (prédire, expliquer ou comparer) en complément des expériences de paramètres. Corriger les idées sans présumer qu'il connaît le vocabulaire.
6. Avant de modifier : expliquer résultat, concepts, fichiers, justification et vérification prévue en quelques paragraphes. Pendant : faire les changements autorisés et compiler. Après : résumer changements, flux réel entre classes, deux ou trois concepts, compromis, vérifications effectuées et mini-exercice sans solution immédiate. Donner un indice progressif si l'utilisateur bloque.
7. Après une étape, actualiser `docs/ETAT_PROJET.md` : réalisé, compilation, tests navigateur réellement effectués, limites, prochaine étape proposée et accord restant à obtenir. Mettre à jour architecture/roadmap seulement si elles changent. Ne jamais transformer « implémenté » en « validé en jeu » sans preuve.
8. Conserver les réglages expérimentés par l'utilisateur (par exemple le recul à 2 secondes) sauf demande ou justification explicite. Ne pas ajouter de dépendance, ECS, bus d'événements, moteur physique ou refonte générale pour anticiper des besoins hypothétiques. Extraire une classe seulement quand une responsabilité concrète devient difficile à suivre.
9. Pas de changement de modèle, configuration d'agent ou délégation implicite. Ce fichier est le guide du dépôt ; il ne garantit pas que chaque outil ou chaque nouvelle conversation lira automatiquement les documents. Le prompt de reprise dans `docs/ETAT_PROJET.md` indique comment retrouver le contexte.

10. Pour un asset animé, consulter `docs/PIPELINE_ASSETS.md`. Définir composition, invariants, éléments mobiles et phases avant la génération. Valider une base puis un cycle isolé à taille réelle avant d'étendre l'intégration. Partager les données d'animation entre aperçu et jeu ; distinguer validation artistique, continuité et logique. Une compilation ou une planche d'images ne prouve pas la lisibilité d'un mouvement.
