# DEAD SECTOR

Petit FPS d'horreur rétro, développé dans le navigateur avec TypeScript, Three.js et Vite. Projet d'apprentissage de la conception de jeux avec l'aide d'une IA.

Le prototype propose un manoir-arène qui s'ouvre progressivement, des paliers d'ennemis et une récompense gratuite à choisir entre les combats. Il comporte un pistolet, un fusil à pompe, une lampe torche et deux variantes de zombies. Voir l'état du projet pour les limites et les validations effectuées.

## Lancer le prototype

Prérequis : Node.js/npm compatibles avec les dépendances du projet.

```powershell
npm.cmd ci
npm.cmd run dev
```

Build de production : `npm.cmd run build`. Vérification locale de ce build : `npm.cmd run preview`.

Cliquer dans le jeu pour verrouiller la souris ; ZQSD/WASD pour se déplacer, Shift pour sprinter, souris pour regarder, clic gauche pour tirer, clic droit maintenu pour viser, R pour recharger, F pour la lampe, E pour interagir, 1/2 ou molette pour changer d'arme débloquée, Échap pour mettre en pause. Éliminer les ennemis du palier pour choisir une récompense et poursuivre dans une nouvelle aile ; défaite à zéro PV.

## Comprendre et poursuivre

- [Consignes de collaboration](AGENTS.md) : méthode pédagogique et contrat de reprise pour les assistants.
- [Nouvelle orientation](docs/ORIENTATION_JEU.md) : décisions validées, propositions et règles de la future boucle.
- [État du projet](docs/ETAT_PROJET.md) : fonctionnalités réelles, limites, vérifications et prompt de reprise.
- [Architecture](docs/ARCHITECTURE.md) : responsabilités et flux entre les systèmes.
- [Roadmap pédagogique](docs/ROADMAP.md) : parcours complet vers une première démo terminée, atelier par atelier.

La compilation ne vaut pas validation du gameplay. La documentation d'état précise ce qui reste à tester et les prochaines propositions ; celles-ci ne sont pas automatiquement autorisées.
