# Tâche Luna — Corriger les défauts confirmés de F3/F4

La demande utilisateur autorise cette tâche de correction. Elle n'autorise ni F5, ni F6, ni une refonte générale.

## Contexte et méthode

Lis `AGENTS.md`, le début de `docs/ETAT_PROJET.md`, `docs/ARCHITECTURE.md`, les seuls ateliers F2/F3/F4 de la roadmap et `docs/AUDIT_F3_F4_2026-11-03.md`. Vérifie les signatures et le diff local. Les changements F4 sont déjà présents et non commitées ; préserve-les, ainsi que package-lock et tout changement utilisateur. Pas de commit/push demandé.

Réponds en français. Avant de modifier, explique brièvement le résultat, les responsabilités, les fichiers et la validation. Il s'agit de réparer des comportements existants ; réalise les corrections ci-dessous. Si une solution exige finalement une nouvelle mécanique importante, présente-la et attends l'accord, tout en terminant les réparations indépendantes autorisées.

## Résultat attendu, dans cet ordre

1. **Fin F4 sans interruption** : après P7, exploration libre terminale du prototype, `pendingTierStart=0`, aucun carillon/offre actif, message HUD discret « 7 rencontres purgées · finale F6 à venir ». Aucun overlay automatique ni libération de souris. Pas de P8 ni de boss. Conserver la défaite et prévoir un état terminal qui ne relance pas les récompenses à chaque frame/callback.
2. **Améliorations uniques et bornées** : corriger `drawTierUpgrades` pour ne proposer que des bonus non acquis, y compris avec un ou zéro bonus restant ; adapter Game aux offres absentes. Protéger `applyUpgrade` contre une application répétée. Les quatre bonus restent uniques ; ne pas créer des cumuls ni de nouveaux consommables. Ravitaillement minimal indépendant des choix conservé. Tester six accalmies.
3. **Premier choix accessible** : replacer les deux supports dans le secteur accessible après P1, sans gêner circulation, collisions et accès. Le carillon conserve son rôle de départ distinct. Vérifier les positions dans les données du manoir. Les deux supports ne doivent pas devenir des leviers sélectionnant un bonus et lançant le combat au même appui.
4. **Appel public de palier cohérent** : `startTier(n)` valide l'entrée et met à jour `currentTier` avant d'utiliser la configuration ; numéro invalide sans destruction de l'état courant. Couvrir le parcours normal et le raccourci de debug utilisé par les mesures.
5. **Tests reliés au code réel** : remplacer l'auto-simulation du timer audio F3 par un test du code effectivement appelé par la boucle ; couvrir silence initial, délai suivant, pause/reprise, arrêt et absence de double lecture. Pour F4, tester la transition terminale réelle plutôt qu'un faux `endGame`. Contrôler le hasard dans les essais de spawn et vérifier les filtres de sécurité sans prétendre que toute pièce permet quatre directions. Actualiser les suites existantes affectées par le nouveau contrat de fin du prototype.

Ne change pas les armes, dégâts, animations, recul à 2 s, sons de combat ni difficulté à l'aveugle. Le réglage des rythmes, l'écoute et l'équilibrage 10–15 min restent à observer. Pas de dépendance, ECS, bus ou moteur physique. Une petite méthode pour rendre la logique réellement testable est acceptable ; pas d'extraction de classes sans responsabilité concrète.

## Vérifications et livrables

- `npm.cmd run build` après chaque intervention sur le code.
- Suites F1/F2/F3/F4, paliers et suites de non-régression pertinentes. Un test doit échouer si le défaut qu'il vise est réintroduit.
- Vérification navigateur si disponible : première récompense réellement accessible, interaction E, P7 sans menu et déplacements conservés. Dire explicitement ce qui n'a pas été observé.
- Si tu relances les performances, vérifier d'abord que le numéro courant et les accès correspondent au scénario ; ne pas présenter un saut debug comme une tentative complète. Ne pas réaffirmer les anciennes mesures sans nouvelle preuve.
- Actualiser `docs/ETAT_PROJET.md` avec faits, build, tests réellement lancés, limites et prochain accord à obtenir. Ne pas recopier « totalement validé » pour une mécanique non testée en jeu.
- Débrief pédagogique : fichiers/rôles ; flux `Game → tirage → support → choix → Player/Weapon` et état de fin ; différence entre stub de périphérique et remplacement du comportement testé ; compromis de 0/1/2 offres. Un exercice et une question de prédiction, sans solution immédiate.

F5 est documenté dans `PROMPT_LUNA_F5.md` mais reste une proposition à soumettre. Ne l'implémente pas dans cette tâche.
