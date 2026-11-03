# Lampe et audit du rendu — 3 novembre 2026

Demande : examiner la saccade à l'extinction et d'autres risques de performance. Corrections ciblées réalisées, sans changement des mécaniques ou réduction des images.

## Causes corrigées

1. **Structure des lumières.** `Player.toggleFlashlight` changeait `SpotLight.visible`. Le `WebGLRenderer.projectObject` installé exclut une lumière invisible ; `WebGLPrograms` utilise le nombre de SpotLight dans la clé de programme. Le premier arrêt créait donc cinq programmes supplémentaires. `Player` garde désormais la lumière dans l'arbre et commute son intensité **22 → 0 → 22**. Angle, portée, atténuation et callback HUD conservés. Le coût du SpotLight reste présent à zéro : compromis pour éviter de changer la structure des shaders. Le clic est aussi préchargé/réutilisé ; aucun gain chiffré ne lui est attribué.
2. **Styles des armes.** Les dix images préparées étaient des URL data longues dans les variables CSS héritées. Les changements de luminosité/recul/poses invalidaient des styles dépendants. `WeaponPresentation` conserve le même traitement nearest/alpha mais utilise `toBlob` et de courtes URL blob. Les anciennes URL sont révoquées au remplacement ; un numéro de génération empêche un résultat asynchrone ancien d'écraser un resize plus récent.
3. **Réglage obsolète.** `PCFSoftShadowMap` est supprimé dans le Three.js installé : le moteur avertissait puis utilisait PCF et invalidait les matériaux au changement de type. `Game` et l'aperçu décor demandent directement `PCFShadowMap`. Le rendu effectif reste celui du secours antérieur ; aucun gain continu n'est déduit de ce nettoyage.
4. **Compteur incomplet.** `Game` et `PerfTracker` assimilaient toute image > 1 s à une reprise d'onglet, masquant les gros blocages. Seuls les événements d'inactivité transmis excluent maintenant une mesure. Les valeurs invalides sont filtrées. Le delta de simulation reste plafonné à 0,05 s ; le temps brut mesuré reste distinct. Test : blocage de 2 500 ms au premier plan conservé, vraie reprise d'onglet exclue.

## Mesures avant/après

Chrome headless accéléré, ANGLE / AMD Radeon / D3D11, vrai Game, viewport 1280 × 900, rendu interne 427 × 300, caméra fixe. Mesures du premier arrêt après préparation :

| Mesure | Avant | Après |
| --- | --- | --- |
| Nouveaux programmes Three.js | 5 (8 → 13) | 0 (8 → 8) |
| Appels compileShader / linkProgram | 10 / 5 | 0 / 0 |
| Première soumission renderer.render après arrêt | 3 660 ms | 6,5 ms dans le dernier essai |

Après la correction des lumières, deux traces comparables de 90 images isolent les URL CSS :

| UpdateLayoutTree | URL data | URL blob |
| --- | --- | --- |
| Maximum | 33,369 ms | 1,491 ms |
| p95 | 31,064 ms | 0,912 ms |
| Événements > 10 ms | 10 | 0 |

Durées CPU de soumission/style, **pas des temps GPU**. Les PNG, atlas, cadrages, seuil alpha 128, chronologies, rechargements et recul à deux secondes restent inchangés.

Un intervalle brut à froid d'environ **115–123 ms reste observé** pendant la première séquence, alors que la soumission Three.js reste sous environ 10–17 ms, sans nouvelle compilation de lampe. Son origine hors soumission n'est pas isolée : ne pas annoncer « zéro saccade ». La trace comporte aussi du travail de navigateur et des documents SVG, ce qui ne suffit pas à attribuer le pic au son ou au favicon. Les basculements suivants du dernier essai ont des maxima bruts d'environ 23 et 26 ms.

## Autres coûts, par priorité

| Priorité | Constat | Proposition non implémentée |
| --- | --- | --- |
| Haute : premiers ennemis | Deux programmes supplémentaires apparaissent pendant le combat synthétique ; soumissions ponctuelles d'environ 48–84 ms selon les essais. `Zombie.warmup` prépare des ressources sans rendre tous les matériaux. | Préparer programmes et uploads avant la première apparition ; comparer premier usage et suivants. Images chargées ne signifie pas GPU prêt. |
| Haute : ombres | Vue fixe : 480 draw calls contre 155 si l'on garde temporairement les cartes d'ombre calculées. Soumission médiane normale environ 6,7–8,7 ms, contre 4,2–5,6 ms dans ce contrôle. Le lustre PointLight rend six faces, en plus du clair de lune. | Mettre en cache seulement quand aucun objet projetant d'ombre ne bouge, ou séparer statique/dynamique. Le gel est uniquement diagnostique : permanent, il casserait les ombres des portes/ennemis. |
| Moyenne : apparitions CPU | Dernière apparition autour de 24–25 ms ; dernier chemin 0,6–1,2 ms. Ce dernier chiffre n'inclut pas tous les candidats. | Profiler filtres, candidats et rayons avant de modifier le graphe déjà optimisé. |
| Moyenne : mémoire | Huit textures décor ≈ 64 Mio estimés RGBA8 + mipmaps, contre 13,96 Mio de PNG. Environ 138 Mio estimés pour les sources uniques présentes dans la scène échantillonnée. | Variantes de diffusion plus petites à comparer visuellement, originaux conservés. Ce n'est pas une lecture de VRAM ; caches inutilisés, render targets et calques CSS ne sont pas tous inclus. |
| Piste CPU non isolée | Les rayons de vue de `Zombie` et `Level` actualisent les matrices de tous les solides ; vecteurs et tableaux recréés dans la boucle. | Mesurer leur part puis actualiser les objets mobiles au bon endroit, sans supprimer les tests de visibilité. |

## Reproduction et validation

Avec Vite sur 5173 : `node scripts/profile-rendering.mjs current`. Pour une trace : `node scripts/profile-rendering.mjs current-trace --trace-toggle`.

Le script crée une page isolée depuis le vrai HTML et instancie Game. Phases de 90 images après préparation ; combat P4 lancé directement, Pointer Lock simulé et dégâts neutralisés dans le diagnostic. Profil Chrome temporaire distinct du profil personnel. Sorties dans `tmp/render-profile/`, résumé conservé dans `asset-packs/PERF_LAMPE_2026-11-03.json`. Instrumentation des API WebGL et de la soumission CPU, sans timer query GPU.

- Build réussi, avertissement habituel du bundle > 500 kB.
- 17 suites Node passent ; tests lampe/intensité/structure stable et blocage long actualisés.
- Chrome : dix cartes d'armes décodées, atlas intacts, alpha uniquement 0/255 ; poses du fusil et cycles de rechargement pistolet/insertion vérifiés. Resize : atlas pistolet de 390 à 291 pixels, cellules entières, dix anciennes URL révoquées. Aucun asset HTTP manquant ni exception. Captures hanche/insertion et vrai Game au départ inspectées.
- Événements F synthétiques sur le vrai Player : intensité 22/0/22, lumière conservée et HUD correct.

Limites : Vite et headless accéléré, courtes phases, hasard d'apparition non figé, cache pilote non purgé. Un essai intermédiaire avec tests Node concurrents n'est pas utilisé pour conclure à la fluidité globale. Aucun benchmark de production sans HMR, longue tentative à la souris physique ou écoute. La médiane proche de 16,7 ms ne prouve pas l'absence de pics.

Prochain atelier proposé : préparation GPU des ennemis avant le combat. L'optimisation des ombres demande une validation visuelle distincte des objets mobiles.

Mini-exercice : relever médiane et maximum, puis faire trois cycles F dans le manoir. Pourquoi une médiane proche de 60 FPS peut-elle coexister avec un blocage très perceptible ?
