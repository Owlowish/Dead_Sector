# Prompt Gemini — progression d'une tentative finie, atelier F1

À transmettre après vérification de l'atelier performance F0. La direction et la roadmap sont validées comme travail de conception ; envoyer ce prompt comme demande d'action autorise l'atelier F1 décrit ci-dessous, pas tous les jalons.

```text
Tu reprends DEAD SECTOR comme développeur et mentor. Réponds en français.

Lis AGENTS.md, docs/ETAT_PROJET.md, docs/ORIENTATION_JEU.md, puis les ateliers F0/F1 et le contrat de transition de docs/ROADMAP.md. Lis l'architecture utile et le code concerné. Vérifie git status/diff et conserve les modifications en cours.

DIRECTION VALIDÉE
- Tentative finie de 10 à 15 minutes avec rencontre finale.
- Même manoir ouvert progressivement, puis réutilisé au-delà du palier 3.
- Deux armes et deux variantes suffisent au premier équilibrage.
- Améliorations gratuites, aucun menu surgissant après la dernière élimination.
- Horreur psychologique : sons, silhouettes, événements inquiétants ; signaux de combat fiables.
- Jeu léger et pixel art cohérent.

Les huit paliers, l'autel/dispositif de choix et les attaques finales sont des propositions, pas des détails déjà validés. Il n'est pas demandé de tout implémenter maintenant.

PRÉREQUIS
L'atelier performance F0 a été confié à Gemini et peut être en cours. Vérifie son état réel : delta brut, navigation/portes, caches entre paliers, mesures et non-régressions. Ne réécris pas un travail déjà réalisé et ne présente pas ses gains comme prouvés sans mesures. Signale une dépendance non résolue avant de superposer des changements qui la compliqueraient.

MISSION : IMPLÉMENTER UNIQUEMENT F1
Découpler la progression des rencontres de l'ouverture des secteurs. Montrer que le palier 4 peut fonctionner dans le manoir déjà ouvert, sans nouveau secteur ni victoire prématurée après le troisième palier.

Avant le code, explique brièvement résultat, concepts, fichiers et vérifications. L'envoi de ce prompt autorise F1 ; pas besoin de redemander l'accord sur ce périmètre précis.

Inspecte notamment Game.ts, MansionConfig.ts, Level.ts/Door.ts et les tests de paliers. Une table simple de rencontres, éventuellement dans EncounterConfig.ts, suffit. Pas de dépendance, ECS, bus général ou moteur de difficulté complexe.

DONNÉES ET FLUX
- Distinguer identifiant de rencontre, espaces accessibles, éventuel déverrouillage d'accès et condition de fin de prototype/tentative.
- Ne plus déduire la victoire du nombre de secteurs ou de pools d'apparition.
- Conserver les trois premières rencontres au plus proche du comportement actuel.
- Ajouter une quatrième rencontre courte de validation, avec ennemis et zones existants, quota actif conservé, trajets légaux et apparitions masquées.
- Rendre la fin des rencontres actuellement configurées explicite. Une fin provisoire doit être affichée comme fin de prototype ; ce quatrième test ne doit pas être présenté comme le vrai boss final.
- Le catalogue complet des rencontres 1–8 et la vraie finale appartiennent à F4/F6.
- Vérifier les valeurs 2/3 codées en dur : seuils de démarrage, sélection des pools, quotas d'agiles, texte de victoire, ouverture des portes et confirmation de progression.
- Pour les rencontres après ouverture complète, définir une activation volontaire claire dans le monde. Ne pas réutiliser un seuil de porte fictif ou inventer une quatrième aile.
- Appliquer une transition une seule fois ; E maintenu ne doit pas déclencher deux étapes.

FLUIDITÉ
Dernier ennemi → information discrète → accalmie avec déplacement/souris conservés → préparation → activation volontaire du combat suivant.
Pas de menu automatique, d'auto-départ immédiat, de compte à rebours imposé ou de reprise de souris forcée. La pause volontaire doit continuer à fonctionner. Ne pas supprimer la dernière animation de mort avec l'affichage de fin.

F1 ne crée pas encore le catalogue de bonus. Prévoir seulement un flux compatible avec F2 ; ne pas ajouter une fausse interface de choix ou des récompenses sans effet. Les choix dans le monde et le départ distinct seront prototypés en F2.

INVARIANTS
- Une rencontre ne se termine pas s'il reste des ennemis à faire apparaître.
- Les ennemis suivants sont bien des cibles pour les armes.
- Une porte ouverte ne se referme pas automatiquement au palier 4.
- Aucun spawn dans une aile fermée, un obstacle, au contact du joueur ou sans chemin praticable.
- Préserver les escaliers, l'altitude, les réactions de blessure et l'interruption du rechargement.
- Supprimer les corps au palier suivant en conservant les ressources communes prévues par F0.
- Ne pas introduire de pic de chargement ou de recherche de chemin pour cette quatrième rencontre.

VÉRIFICATION
Compiler avec npm.cmd run build. Exécuter les tests pertinents, dont check-tiers, check-split-level, check-zombie, check-zombie-agile, check-zombie-remains, check-weapon et check-shotgun.
Ajouter des contrôles de transition 3 → 4, conservation des accès, file d'apparition, démarrage unique et fin explicite indépendante du nombre de secteurs. Tester les comportements, pas seulement la forme d'une configuration.
Observer dans le navigateur le troisième dernier ennemi, l'accalmie, le départ et les premières apparitions du quatrième palier. Comparer les temps d'image avec F0. Signaler clairement ce qui n'a pas été observé.

LIVRAISON
Décrire fichiers/rôles, flux entre la configuration et Game/Level/Zombie, les deux concepts « rencontre versus secteur » et « transition déclenchée une seule fois », compromis, mesures et limites. Proposer un mini-exercice de compréhension sans donner immédiatement la réponse.
Actualiser ETAT_PROJET avec le réalisé et les validations réelles. Présenter ensuite F2 et attendre sa demande/validation avant de l'implémenter. Pas de commit/push demandé par cette mission.
```

## Contrat pour l'atelier F2 suivant

La nouvelle demande F2 devra préciser les deux offres du prototype et leur effet observable. Reprendre le contrat « Transition proposée sans rupture de contrôle » de ROADMAP : choix dans le monde, lecture à la demande, sélection unique, possibilité de passer explicitement, départ distinct, offres périmées après départ, bonus remis à zéro à la nouvelle tentative. Prototyper ces interactions avec les assets existants ; vérifier le flow avant de produire un autel détaillé.

## Contrat pour le premier atelier visuel/horreur F3

Auditer une salle témoin et son rendu réel, à quelques points de vue reproductibles. Proposer un avant/après cohérent : repères, textures, silhouette, palette et sons espacés. Les gestes et escaliers doivent rester lisibles. Préserver le budget d'ombres et mesurer le surcoût. La direction psychologique est validée ; un événement précis et une nouvelle série d'assets ne le sont pas encore. F5 ajoutera ensuite un premier événement conditionnel, sans le confondre avec un ennemi de combat.
