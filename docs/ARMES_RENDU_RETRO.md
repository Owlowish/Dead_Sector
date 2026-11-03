# Armes : grain, transparence et intégration dans l'obscurité

Correction du 3 novembre 2026 après retour utilisateur : armes trop nettes par rapport aux autres sprites, cadre transparent pendant le rechargement du fusil et luminosité trop forte dans le manoir.

## Causes vérifiées et correction

- La scène Three.js est rendue à résolution réduite puis agrandie. Les armes sont des calques HTML/CSS à résolution écran. `image-rendering: pixelated` ne réduit pas à lui seul une grande image source : les armes pouvaient donc conserver bien plus de détail que la scène.
- Les PNG sources contiennent des pixels d'alpha très faible hors des silhouettes principales. Par exemple, `reload_draft.png` comporte 24 474 pixels avec alpha de 1 à 31 et `pistol_actions_v3.png` en comporte 103 095. Ces valeurs ne sont pas la silhouette utile de la main/arme et peuvent laisser apparaître un voile autour des calques. La découpe CSS et la transparence du PNG sont deux mécanismes distincts.
- La luminosité fournie par `Level` comportait un plancher élevé pour une image déjà éclairée dans son dessin, puis Game ajoutait encore 0,22 avec la lampe. L'image d'arme suivait cette valeur presque directement.

`WeaponPresentation.ts` prépare maintenant une représentation de rendu des dix images actives. Un canvas réduit chaque source avec filtrage nearest, en visant environ trois pixels écran par pixel d'image à partir des tailles CSS des perspectives. Les atlas gardent un nombre entier de cellules, leurs rapports d'aspect et leurs coordonnées normalisées. Après le dessin, un seuil alpha de 128 rend chaque pixel transparent ou opaque : les halos de faible opacité ne dessinent plus de cadre autour de la main ou du fusil.

Ces images sont maintenant des Blob URL courtes créées dans le navigateur (`toBlob`/`createObjectURL`), en remplacement des longues URL data initiales. Ce changement corrige le coût des recalculs CSS constaté lors du profilage de la lampe ; détails dans `PERFORMANCES_LAMPE_2026-11-03.md`. Les anciennes URL sont révoquées au remplacement et un numéro de génération protège les redimensionnements asynchrones. Aucun PNG source n'est remplacé ni régénéré. Les opérations restent faites au chargement puis après resize avec un délai de 120 ms, jamais à chaque frame. Le CSS garde les sources originales comme repli si le navigateur ne peut pas traiter un canvas. La version via Vite est celle vérifiée ici.

L'éclairage de présentation est désormais `clamp(0.12 + éclairage × 0.42, 0.18, 0.65)`. Le supplément de présentation de la lampe passe de 0,22 à 0,08 ; la vraie SpotLight du joueur n'est pas modifiée. L'arme commence à 0,35 et garde l'adaptation douce existante. Le bref éclair du tir conserve sa logique. La limite basse évite de rendre la main totalement invisible ; ces réglages sont à juger dans les conditions d'affichage réelles de l'utilisateur.

## Responsabilités et mécanismes conservés

- `main.ts` déclenche la préparation des représentations visuelles.
- `WeaponPresentation.ts` gère la résolution, le seuil alpha, les références CSS et la conversion de luminosité.
- `style.css` utilise ces références dans les calques existants ; les polygones de masquage et les poses ne sont pas redessinés.
- `Weapon.ts` sélectionne les mêmes images/poses et transmet la référence CSS correspondante. La simulation continue à décider du tir, du rechargement, des cartouches et de l'éjection.
- Les aperçus pistolet et fusil injectent les mêmes fonctions de présentation, en plus des données d'animation déjà partagées. Le fusil possède maintenant le même conteneur `.weapon-view` pour que le filtre d'éclairage soit réellement visible dans cet aperçu.

Les 18 fichiers sources d'armes, `WeaponAnimation.ts` et `ShotgunAnimation.ts` restent identiques à la référence relevée avant les interventions artistiques. Recul de deux secondes, pistolet à 1,6 s, fusil à 0,65 s/cartouche, engagement unique à 0,50 s et éjection à 0,19 s conservés.

## Vérifications réalisées

- `npm.cmd run build` réussi après chaque groupe de modifications ; avertissement Vite > 500 kB conservé.
- Les 16 suites `scripts/check-*.mjs` passent, notamment les tests du pistolet et du fusil : cadence, munitions, transferts uniques, interruptions, ADS, pompe et éjection. Le test pistolet vérifie aussi la réponse de luminosité en ambiance sombre, éclairée et à une valeur excessive.
- Chrome headless séparé : dix représentations préparées, nombre de cellules d'atlas conservé et **aucun pixel d'alpha intermédiaire** dans ces représentations. À 960 × 720 : atlas pistolet 390² (trois cellules de 130), pose de fusil hanche 192², atlas ADS 558 × 279, rechargement 173 × 130. Ce sont des tailles de rendu, pas des nouveaux fichiers d'assets.
- Captures inspectées : hanche, ADS et les six phases du rechargement du fusil, plus les poses du pistolet. Les captures examinées ne montrent plus de voile rectangulaire ; les contours et le détail sont plus grossiers et les armes plus sombres. Les deux cycles d'aperçu ont été joués jusqu'au retour au repos.
- Vérification du redimensionnement de l'atlas dans une fenêtre de 390 px et d'une capture réelle au point de départ de `Game` : présentation rétro active, luminosité CSS mesurée à 0,49 avec la lampe allumée lors du dernier contrôle (elle varie avec les bougies et l'adaptation). Le panneau de pause a été masqué uniquement pour la capture ; aucun combat au Pointer Lock n'a été réalisé.
- Captures et rapport locaux : `tmp/weapon-fix/`, dont `game-start.png`, `reload-0-04.png` jusqu'à `reload-0-6.png` et `report.json`. Ces fichiers temporaires ne constituent pas une validation artistique de l'utilisateur.

Pas de nouvelle tentative jouée à la souris, d'écoute ou de mesure de performance comparative pendant cette correction. La quantification rend volontairement les contours plus découpés ; la résolution mobile minimale du monde et les petites fenêtres peuvent produire un rapport légèrement différent du rendu habituel. Le rendu transparent/opaque convient aux armes et aux gants ; il ne doit pas être appliqué sans réflexion à du verre ou de la fumée.

## Vérifier et expérimenter

Avec Vite lancé, reconstruire les aperçus :

```text
node scripts/make-weapon-preview.mjs
node scripts/make-shotgun-preview.mjs
```

Ouvrir `/tmp/shotgun-preview/index.html`, cocher l'insertion et jouer un cycle lent, puis regarder l'arme dans le manoir avec et sans lampe. Pour une expérience locale, modifier seulement l'argument `pixelSize` de `installWeaponArt` dans `main.ts` et comparer le détail des gants à celui du décor. Question : pourquoi baisser la résolution peut-il améliorer la cohérence sans changer la précision du rayon de tir ?
