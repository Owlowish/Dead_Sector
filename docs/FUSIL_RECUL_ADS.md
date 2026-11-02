# Fusil : correction ADS et recul dessiné — 2 novembre 2026

Évolution après ce compte rendu : le rechargement a ensuite été animé avec les couches des assets existants. Voir `FUSIL_RECHARGEMENT_COUCHES.md` pour l'état actuel ; le refus de génération décrit ci-dessous est historique.

Atelier validé par l'utilisateur : correction des bords de manches ADS, poses de recul hanche/ADS, puis sprites de rechargement. **Résultat partiel : ADS et recul réalisés ; nouveaux sprites de rechargement non produits, car la génération a été refusée par le système de sécurité de l'outil (violence).** Ne pas présenter le rechargement comme terminé et ne pas contourner ce refus en reformulant pour le dissimuler.

## Réalisé

- Deux nouveaux PNG transparents générés via image_gen : `public/assets/weapons/shotgun/hip-kick-v2.png` et `ads-kick-v2.png`. Prompts exacts et résultat du refus : `output/shotgun-hip/ACTION_PROMPTS.json`.
- `ShotgunAnimation.ts` : pose de choc sur les premières 0,12 s, impulsion maximale à 0,025 s puis récupération jusqu'à 0,16 s. Les images montrent réellement un relèvement de l'arme et une réaction des mains.
- `Weapon.ts` : préchargement, sélection des poses et petite variation d'échelle (maximum +3,5 %), amortissement commun avec l'aperçu. Le sprite porte le relèvement du canon ; la translation reste descendante pour ne pas décoller les manches du bord inférieur. Recul global réglé à deux secondes conservé, avec faible queue visuelle pour le fusil. Balistique, recul de caméra, cadence, éjection à 0,19 s et logique des munitions conservés.
- `style.css` : ADS agrandi de 96 à 116 vh et ancré sur le guidon ; les bords rectangulaires des manches passent sous l'écran. Pose de choc ADS distincte, repère du flash adapté aux deux nouvelles poses. Ce cadrage montre une arme plus grande, compromis assumé pour masquer le découpage sans déformer l'image.
- `scripts/make-shotgun-preview.mjs` : aperçu repos/choc/pompe, ADS activable et lecture ralentie, fonctions de chronologie importées du jeu. Régénérer avec Node puis ouvrir `tmp/shotgun-preview/standalone.html`.

## Vérifications

`npm.cmd run build` réussi ; avertissement Vite sur bundle > 500 kB toujours présent. `check-shotgun.mjs` et `check-weapon.mjs` réussis. Deux assertions ajoutées au test fusil vérifient que la pose de choc laisse place à la pompe au moment de l'éjection.

Chrome headless : cinq images décodées, captures repos/choc/pompe en hanche et ADS aux largeurs 1920 et 390 px, cycle joué jusqu'au retour au repos. Revue des captures ADS et de recul : manches raccordées au bas de l'aire de jeu, pas de bord rectangulaire latéral flottant visible dans les cas inspectés. Aucun parcours ni combat réel dans le manoir ; sensation à vitesse réelle et transition ADS à confirmer par l'utilisateur.

## Rechargement restant

Le sprite fixe `reload_draft.png` reste actif. Aucun faux cycle ajouté et aucun déplacement du moment de transfert des cartouches : une cartouche toutes les 0,65 s, interruption existante. Une vraie séquence nécessitera des poses montrant une seule cartouche, son engagement, son insertion puis le retrait de la main vide. La perspective a été acceptée par l'utilisateur, mais le brouillon présente encore des problèmes d'orientation de cartouche et de port de chargement. L'accord sur l'atelier reste acquis ; le blocage actuel concerne la production des images, pas une autorisation utilisateur manquante.
