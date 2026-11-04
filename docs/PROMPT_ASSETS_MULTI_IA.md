# Prompt réutilisable — Lot d'assets DEAD SECTOR

Usage : copier le bloc ci-dessous dans Gemini ou un autre assistant. Remplacer seulement la description et le périmètre. Avec accès au dépôt, l'assistant retrouve le contexte ; sans accès, joindre les documents utiles et les images de référence indiquées dans `PIPELINE_ASSETS.md`. Écrire un chemin ne joint pas une image.

Ce prompt ne dépend d'aucune version de modèle ou API. Les anciens prompts nommés pour un lot précis décrivent un état historique ; ne pas les exécuter comme un nouveau chantier.

```text
Tu travailles sur DEAD SECTOR, un FPS rétro TypeScript / Three.js / Vite dans un manoir victorien hanté. Réponds en français.

NOUVEAU CONTENU : [ex. un nouvel ennemi massif en tenue de fossoyeur ; décrire l'identité et le rôle souhaités]
PÉRIMÈTRE : [préparer le pack / générer le pack ; ajouter « intégrer » seulement si demandé]
CONTRAINTES PARTICULIÈRES : [facultatif ; sinon reprendre les conventions du projet]

OBJECTIF
Prendre en charge le lot complet de ressources nécessaires à ce contenu, cohérent avec les assets du jeu. Ne me demander ni la liste des poses ni un accord pour chaque fichier. Fais l'inventaire d'après le rôle demandé et le code réel, réutilise ce qui convient et explicite les hypothèses. N'invente pas de nouvelle mécanique pour justifier des assets supplémentaires.

REPRISE DU CONTEXTE
1. Lire AGENTS.md, le début de docs/ETAT_PROJET.md, les responsabilités utiles de docs/ARCHITECTURE.md et docs/PIPELINE_ASSETS.md.
2. Vérifier les fichiers de code concernés et les chemins actuellement chargés. Si la direction ou le gameplay est touché, lire docs/ORIENTATION_JEU.md et le seul jalon utile de docs/ROADMAP.md. Ces plans ne valent pas autorisation.
3. Inspecter 2 à 4 images proches du contenu, pas seulement leurs noms. Le pipeline indique les références de départ. Distinguer référence de style, de cadrage et d'identité. Ne pas prendre un essai rejeté comme référence de production.
4. Si tu n'as pas accès au dépôt ou à une référence indispensable, indiquer précisément ce qui manque ; ne pas prétendre l'avoir lu ou vu. Avancer sur les parties indépendantes. Regrouper les informations vraiment nécessaires dans une seule demande.

STYLE À CONSERVER
FPS rétro, manoir victorien, ambiance d'horreur psychologique. Suivre les images jointes : formes lisibles, groupes de pixels visibles, contours en marches d'escalier, densité de détail cohérente à la taille de jeu. Bois usé, bordeaux sourd, ivoire vieilli, laiton patiné, fer sombre, gris bleuté selon le matériau. Pas de rendu photo, de lissage brillant, de cartoon arrondi ou de microdétails qui deviennent du bruit.
Pour les armes : conserver les gants noirs fermés et les manches gris bleuté du joueur. Pour un nouveau personnage : une silhouette propre dans le même langage graphique, sans recopier automatiquement un ennemi existant. Pas d'ombre de décor ou de lumière contradictoire peinte dans une surface éclairée par le jeu. Aucun texte, logo, filigrane ou décor de présentation non demandé.
Cette description complète les références réelles ; elle ne les remplace pas.

PROCÉDURE À SUIVRE DANS L'ORDRE
Respecter le périmètre à chaque étape : « préparer » fournit contrats, prompts et contrôles prévus sans lancer la génération ; « générer » produit les fichiers sans modifier le jeu ; « intégrer » permet aussi les modifications d'intégration autorisées. Les étapes de production ci-dessous deviennent des consignes à transmettre au générateur si le périmètre est limité à la préparation.
A. Présenter brièvement le résultat, les ressources, les fichiers concernés et les vérifications. Copier docs/asset-packs/MODELE_LOT_ASSETS.json vers docs/asset-packs/<identifiant>.json et le renseigner. Si la demande autorise la production du lot, poursuivre sans solliciter un accord déjà donné. Demander un accord seulement pour une décision importante hors périmètre ou une validation humaine explicitement exigée.
B. Établir la liste exhaustive : pour chaque besoin, noter « à produire », « réutilisé » ou « non applicable » avec raison. Examiner poses, calques, états, effets, icônes, ramassables et sons utiles. Un ennemi actuel utilise un billboard, pas automatiquement huit directions. Un rechargement comprend toutes ses phases ; un PNG de main ne suffit pas. Les sons et effets existants compatibles sont réutilisables.
C. Fixer le contrat : usage, taille affichée, dimensions source/export, alpha/opacité, marges, ordre des cellules, ancrages et espace de coordonnées, invariants d'identité, parties mobiles, phases/durées et événements uniques. Vérifier les conventions de l'animation et du rendu existants. Ne pas inventer les durées ou dégâts d'une mécanique encore indécise.
D. Produire UNE base en joignant les références. La comparer à l'existant à la taille de jeu. Corriger les défauts précis avant de produire les variantes. Conserver la base retenue comme référence d'identité dans toutes les demandes suivantes, avec le même bloc de style. Ne pas accumuler des variantes basées seulement sur la dernière variante.
E. Produire et observer UNE action représentative (ou un pavage pour une texture). Vérifier les poses, puis le cycle normal/lent et le retour au repos. Préférer des calques d'une même base pour une mécanique rigide ; ne pas masquer une perspective incohérente par une déformation CSS. Après contrôle, compléter le reste du lot sans demander un accord pour chaque image.
F. Mesurer les fichiers obtenus : dimensions, alpha réel, cellules, marges, ancrages et découpes. Un fond en damier dessiné n'est pas de l'alpha. Une demande de dimensions dans un prompt ne prouve pas les dimensions de sortie. Séparer sources et exports ; documenter toute retouche et la conversion des coordonnées après redimensionnement.
G. Livrer les fichiers et le manifeste, les prompts exacts et références utilisées, l'aperçu et les résultats des contrôles. Ne pas marquer une ressource manquante comme terminée. Si une animation ne peut pas être observée avec tes outils, noter sa continuité « non vérifiée ».
H. Si l'intégration est autorisée, faire le changement minimal dans les composants concernés. Le jeu et l'aperçu utilisent les mêmes données d'animation. Vérifier lumière/ombres, filtrage, masques de tir, pause/interruption, événements uniques et durée de vie des ressources. Compiler avec npm.cmd run build après modification de code et exécuter les contrôles ciblés ; distinguer ces résultats d'une observation du gameplay.
I. Mettre à jour docs/ETAT_PROJET.md avec réalisé, vérifications réelles, limites et accords restant à obtenir. Ne pas modifier la roadmap si la direction ne change pas.

SI TU N'AS PAS D'OUTIL DE GÉNÉRATION
Rester dans « préparer le pack ». Fournir pour chaque ressource le prompt prêt à envoyer, les références à joindre, la sortie attendue et les critères de contrôle. Marquer les images/sons non produits « manquant ». Ne pas fournir de faux chemins existants ni remplacer silencieusement une animation par une pose fixe. N'installe pas d'outil et ne change pas de modèle sans demande.

CONTENU DE CHAQUE PROMPT AU GÉNÉRATEUR
Usage → références jointes et leur rôle → sujet → identité/invariants → seule variation demandée → format/canevas/ancrages → exclusions → critères de contrôle.
Pour une variante, joindre la base retenue et préciser ce qui bouge, reste fixe, est visible ou caché. Répéter le contrat et le bloc de style. Ne pas demander une grande planche si ses cellules ne peuvent pas être contrôlées ; préférer alors des poses séparées.

LIVRAISON FINALE
- Liste des fichiers produits, réutilisés, rejetés et manquants.
- Chemin de la fiche du lot et de l'aperçu réellement disponible.
- Contrôles de fichiers, style, mouvement, intégration et jeu : résultats distincts, sans validation inventée.
- Explication courte des choix, des flux entre données et composants et des limites restantes.
Finir par le résultat. Pas de question, d'exercice ou de proposition de suite automatique.
```

Exemple d'entrée minimale : « Nouveau contenu : un ennemi fossoyeur, très reconnaissable, gardant les actions du zombie standard. Périmètre : générer le pack, sans intégration. » Le modèle déduit les ressources du standard actuel, prépare les références et signale les éventuelles capacités manquantes. Cet exemple n'autorise pas sa production tant qu'il n'est pas demandé.
