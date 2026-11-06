# DEAD SECTOR

FPS d'horreur rétro dans le navigateur, développé en TypeScript avec Three.js et Vite.

Manoir-arène ouvert progressivement, pistolet, fusil à pompe et lampe. Quatre types d'ennemis : standard, Coureur, Cracheur et Rampeuse. Sept rencontres aux compositions progressives, puis duel contre le Gardien : deux attaques et deux phases. Les munitions tombent sur les éliminations définitives ; trois lots finis préparent la finale et les collectes partielles conservent leur reliquat. Dix secondes d'accalmie libre entre paliers ; après victoire, exploration conservée et bilan volontaire avec B. Apparence du boss provisoire ; équilibrage et durée complète restent à valider en partie.

## Lancer le prototype

Prérequis : Node.js/npm compatibles avec les dépendances du projet.

```powershell
npm.cmd ci
npm.cmd run dev
```

Build : `npm.cmd run build`. Aperçu du build : `npm.cmd run preview`.

Cliquer pour verrouiller la souris ; ZQSD/WASD pour se déplacer, Shift pour sprinter, souris pour regarder, clic gauche pour tirer, clic droit maintenu pour viser, R pour recharger, F pour la lampe, E pour interagir, 1/2 ou molette pour changer d'arme débloquée, Échap pour la pause. K ouvre le menu debug des paliers. Défaite à zéro PV.

## Documentation

- [Consignes de l'agent](AGENTS.md) : autonomie, vérification et entretien documentaire.
- [État du projet](docs/ETAT_PROJET.md) : fonctionnalités réelles, limites et contrôles récents.
- [Architecture](docs/ARCHITECTURE.md) : responsabilités et flux actuels.
- [Direction du jeu](docs/ORIENTATION_JEU.md) : décisions et invariants.
- [Travaux restants](docs/ROADMAP.md) : priorités vers une tentative complète.
- [Pipeline d'assets](docs/PIPELINE_ASSETS.md) et [prompt réutilisable](docs/PROMPT_ASSETS_MULTI_IA.md).

La compilation et les tests logiques ne valent pas validation du gameplay. Les limites observées sont dans l'état du projet ; l'historique des changements est dans Git.
