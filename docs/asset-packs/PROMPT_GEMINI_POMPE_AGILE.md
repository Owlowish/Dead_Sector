# Prompt de reprise Gemini — Fusil à pompe et zombie agile

Tu reprends DEAD SECTOR, TypeScript/Three.js/Vite, sans React ni moteur physique. Lis AGENTS.md, la section prioritaire de docs/ETAT_PROJET.md, docs/ARCHITECTURE.md et docs/PIPELINE_ASSETS.md, puis :

- docs/asset-packs/POMPE_AGILE_LIVRAISON.md
- docs/asset-packs/pompe-agile.manifest.json
- docs/asset-packs/CONTRAT_POMPE_AGILE.md

Vérifie le code réel avant de changer quoi que ce soit. La carte, les paliers, les cadavres verticaux et les effets ont déjà évolué : ne les réécris pas d'après un ancien résumé.

## Résultat voulu et état des ressources

Je veux une seconde arme, un fusil à pompe à cartouches individuelles, et un second ennemi plus rapide et visuellement identifiable, le Coureur. Préserve le pistolet, ses gants noirs fermés et manches gris bleuté, le style pixel art, l'ADS, les effets et la progression du manoir.

Les images sont déjà dans public/assets/weapons/shotgun et public/assets/zombies/agile. Utilise les fichiers et découpes recommandés par le manifeste, pas les essais rejetés. Pour l'arme, le repos et le cycle doivent provenir de la même planche : hip_pump.png cellule droite/gauche et ads_pump_v2.png cellule droite/gauche. Ne mélange pas les cadrages de hip.png ou ads_v2.png dans les cycles retenus.

ATTENTION : la planche complète de rechargement n'existe PAS. Deux demandes ont été refusées par l'outil d'images. Le manifeste a reload.asset=null. Signale-le tout de suite et ne prétends pas avoir les poses ou une animation complète. Ne crée pas un faux chemin reload.png, ne réutilise pas un chargeur de pistolet et ne remplace pas la demande par l'arme qui descend simplement. Avant de terminer le lot de rechargement visuel, obtenir une ressource conforme et faire valider un cycle isolé. Tu peux avancer les autres lots autorisés indépendants.

Commence par présenter un plan court, les responsabilités et les choix à confirmer ; attends mon accord pour l'intégration importante conformément à AGENTS. Si cet accord a déjà été donné dans notre échange, ne le redemande pas. Utilise des lots observables et des paramètres de départ explicitement proposés, pas un immense chantier opaque.

## Lot A — Variante Coureur

Inspecte Zombie.ts, ZombieAnimation.ts, ZombieRemains.ts, Level.ts et la création des zombies dans Game/MansionConfig. Ajoute un type de données simple (ancien type par défaut, nouveau type agile) ; réutilise poursuite, navigation, états et annulations. Pas de nouvelle IA complète, saut, téléportation ou esquive automatique.

Le Coureur : cheveux noirs, gilet ocre, chemise bleu pétrole, posture basse. Charger ses cinq ressources : idle, run, attack, hurt, death. Ne pas remplacer les textures du zombie initial. Paramètres de départ proposés : vitesse 2,7, 80 PV, rayon 0,4, préparation d'attaque 0,45 s, dégâts 10 et arrêt sur blessure 0,18 s. Conserver une anticipation lisible ; plus rapide ne signifie pas un coup instantané.

Les régions sont irrégulières : utilise rect/anchor/pixelsPerUnit et les deux clipPolygon, pas une grille supposée. L'origine des pixels et l'inversion V sont expliquées dans la livraison. Les géométries doivent être préparées/mises en cache, pas reconstruites à chaque image. Animation sur place et déplacement en delta-time sont distincts. Préserver l'origine de simulation et les rayons de vision en adaptant le décalage visuel.

Une attaque ne cause qu'un seul impact synchronisé à 0,45 s, annulé si portée/vue perdues ou blessure/mort. Le dernier dessin de death reste en billboard VERTICAL face au joueur après la chute, comme le zombie initial corrigé. Le nettoyage au démarrage du palier supprime les deux types et libère correctement leurs ressources.

IMPORTANT : ZombieRemains possède actuellement un cache commun unique pour le type initial. Rends les ressources communes propres à chaque définition/type, avec libération au dernier utilisateur. Sinon le Coureur peut mourir en affichant l'ancien zombie ou casser les cadavres d'un autre type. Vérifie aussi les ombres : mêmes UV et même texture que le sprite visible.

## Lot B — Deux armes, une seule entrée de tir

Inspecte Weapon.ts, WeaponSpread.ts, Game.ts, AmmoBox.ts, ShellCasing.ts et le HUD. Préfère deux définitions et états d'armes simples à une usine pour vingt armes. Le pistolet conserve ses réglages, notamment son recul utilisateur de deux secondes.

Un clic ne doit piloter QUE l'arme active : construire deux Weapon ayant tous deux des écouteurs souris actifs ferait tirer les deux. Centralise les entrées ou filtre explicitement par arme active. Les touches de sélection d'arme ne doivent pas intercepter les choix de récompense 1/2 pendant le répit. Pour tester, propose un accès explicite aux deux armes avant de modifier les récompenses de progression.

Chaque arme possède ses propres munitions, capacité, réserve et cadence. Changer d'arme ne crée ni ne transfère de munitions, et n'efface pas une cadence ou un cycle de pompe encore requis. Le HUD affiche l'état de l'arme active, pas une copie indépendante. Les ramassages doivent ravitailler le bon type de réserve ; une boîte de cartouches ne doit pas devenir des balles de pistolet selon l'arme tenue.

Actualise les cibles dynamiques des DEUX armes après apparition/nettoyage, ou fournis une source de cibles commune à jour. Préserve la pause, le blur, la fin de partie et le Pointer Lock.

## Lot C — Tir du fusil, ADS, pompe et douilles

Proposition initiale : capacité abstraite 5, réserve 20, huit plombs hitscan, portée 18, cadence minimale 0,9 s ; cône de demi-angle 5° hanche et 3° ADS. Dégâts/plomb : discuter 12 (maximum 96) ou 15 (maximum 120) selon l'effet rapproché voulu. Ces paramètres sont proposés, pas déjà validés.

Un tir accepté consomme UNE cartouche, joue UN son, UN flash et UNE impulsion lumineuse de scène, puis résout les huit rayons. La gerbe reste dispersée en ADS, mais plus resserrée ; le viseur doit représenter le vrai cône projeté avec le FOV courant. Réutilise le principe de WeaponSpread sans modifier la précision du pistolet. Le rayon part de la caméra avant le recul ; le sprite ne doit pas être tordu pour le faire viser.

Pour chaque plomb, garder la première intersection parmi solides et cibles vivantes. Résoudre tous les rayons sur un même instantané avant d'appliquer la fin de combat. Additionner les dégâts par zombie puis les appliquer une fois par zombie, avec un retour de blessure cohérent. Vérifier la fin du palier une fois la décharge résolue : ne pas ouvrir le répit ou changer les cibles au milieu des huit rayons. Ne pas traverser murs/portes pour toucher une cible derrière.

Consommer la chronologie du manifeste : flash/recul, pompe arrière, retour. Éjecter UNE douille vide à l'événement de pompe arrière (environ 0,19 s), pas huit au départ des rayons et pas à chaque image. Les douilles usagées utilisent shells.png ; live_shell.png représente une cartouche intacte. Limiter nombre et durée de vie des douilles, partager leurs textures et nettoyer les objets expirés. Pas d'éjection fantôme pendant un chargement sans douille usagée à extraire.

Utilise les ancrages bouche/guidon pour placer les effets et calibrer l'ADS. Arme et mains doivent rester cohérentes avec les deux vues retenues. Pas de cisaillement ni d'écrasement non uniforme pour masquer une perspective incorrecte. Préserve l'adaptation lumineuse de l'arme HTML et les impacts/sang existants, avec leurs plafonds.

## Lot D — Rechargement, après disponibilité des poses

Le modèle proposé reste simple, cinq cartouches dans une réserve chargée abstraite, sans simuler en plus une chambre indépendante. Une boucle raconte UNE insertion : main vide → présentation d'une cartouche → insertion → retrait main vide. Sortie ADS pendant le rechargement. Pas de chargeur amovible.

Transférer min(1, place disponible, réserve) exactement une fois au point d'insertion de chaque boucle. Un appui R répété ne recommence pas une boucle déjà en cours. Une interruption garde les cartouches déjà insérées ; elle ne transfère pas une cartouche dont le point d'insertion n'a pas été atteint. Permettre l'interruption par tir entre insertions si au moins une cartouche est disponible ; empêcher l'exploitation par changement d'arme. Pause/blur/fin doivent avoir une règle explicite, testée.

L'animation et la logique doivent partager la même chronologie. Une animation d'insertion complète doit être visionnée en cycle isolé normal/lent avant de déclarer ce lot terminé. Ne pas faire disparaître ce critère à cause de la ressource actuellement manquante.

## Lot E — Mélange des paliers et validation

Après validation indépendante, propose un Coureur à partir du deuxième palier, au départ au plus un parmi les quatre vivants simultanés. Ne pas augmenter simultanément tous les effectifs. Préserve distances de sécurité, masquage, navigation, secteur autorisé, file d'apparition et exploration sécurisée. Ne touche pas à la carte pour cacher un bug de type ennemi.

Tests requis sur les vrais comportements et données :

- Deux types ensemble, textures/ombres propres, attaque interrompue, mort et cadavre du bon type ; nettoyage réel au changement de palier sans ressource partagée détruite trop tôt.
- Un clic = une seule arme, une cartouche, une décharge ; plusieurs rayons correctement bloqués, somme des dégâts par cible, une seule transition de palier.
- Cadence/pompe/éjection uniques en hip et ADS, aucun gain de munitions en changeant d'arme.
- Transfert unitaire et interruptions avant/après insertion, réserve vide/pleine, annulation sur pause/blur/fin, HUD exact.
- Apparitions et poursuites du Coureur dans le vrai niveau ; pas de déplacement dépendant du framerate ni d'attaque inévitable.
- Douilles/effets bornés et cadavres supprimés entre paliers.

Compiler avec npm.cmd run build après chaque lot et conserver les suites existantes. Distinguer compilation, contrôles de données/assets, tests de logique et gameplay effectivement joué. Les aperçus livrés ne constituent pas une validation du nouveau gameplay. Actualise docs/ETAT_PROJET.md après chaque étape, explique les flux entre classes et propose un mini-exercice de compréhension.
