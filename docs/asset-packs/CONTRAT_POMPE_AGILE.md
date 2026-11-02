# Contrat artistique — fusil à pompe et zombie agile

Demande du 2 novembre 2026 : générer les sprites et préparer la reprise par Gemini, sans intégrer les nouvelles mécaniques au jeu. Les seuls ajouts autorisés ici sont images, données de découpage/chronologie, aperçus isolés et documentation.

## Références et invariants

- Mains : `public/assets/weapons/pistol_actions_v3.png` et `modern_ads.png`, réellement utilisés par le jeu. Gants tactiques NOIRS FERMÉS, doigts couverts, poignets et manches gris bleuté. Les anciennes images `pistol_frame_0.png` avec doigts nus ne sont PAS la référence courante.
- Arme : fusil à pompe moderne générique, acier graphite mat, garnitures polymère anthracite, magasin tubulaire, viseur mécanique simple. Pas de marque, optique, chargeur amovible, bois clair ou futurisme. Cartouche rouge sombre et culot laiton, douille éjectée ouverte et usagée.
- Style : pixels et contours nets, palette désaturée cohérente avec le manoir ; ombres dessinées modérées pour permettre une adaptation lumineuse en jeu. Alpha réel, pas de damier peint. Aucun fond, texte, grille ou recadrage variable des manches.
- HUD : vue hanche en bas à droite et légèrement de trois quarts ; ADS centré et droit. Bras prolongés jusqu'au bord inférieur du canevas, silhouette contenue latéralement. Les ancrages bouche/guidon seront mesurés dans les images finales, pas supposés.
- Les pièces rigides gardent longueur, orientation et perspective pendant une action. La main secondaire se déplace avec la pompe. Le rechargement présente et insère UNE cartouche par boucle, puis retire la main vide. Pas de second chargeur ni de deuxième transfert caché.

## Pack fusil à pompe prévu

1. Base hanche et base ADS, vérifiées avant les variantes.
2. Cycle après tir dans les deux vues : impulsion de recul, pompe arrière (événement éjection), pompe avant et retour à la base. Flash séparé, aucune cartouche éjectée déjà dessinée dans ces poses.
3. Pose de préparation du rechargement et boucle d'insertion : présentation d'une cartouche, insertion partielle, insertion complète/main vide, retrait. Retour à la base existante pour sortir du rechargement. En cas de chargement à vide, le cycle de pompe est disponible ; règle exacte à confirmer à l'implémentation.
4. Douille usagée sous plusieurs orientations ; cartouches vivantes/ramassage et silhouette de l'arme pour interface ou ramassage. Flash de bouche séparé.

Les images seules n'implémentent pas les règles : les temps et événements proposés devront être consommés par le code de Gemini et validés séparément. Les planches ne garantissent pas une géométrie mécanique identique au pixel près ; rejeter les dérives manifestes et signaler les limites.

## Pack zombie agile prévu

- Adulte maigre, posture ramassée et penchée, bras prêts à bondir, cheveux noirs courts en mèches, gilet ocre déchiré, chemise bleu pétrole sombre et pantalon charbon. Pas une simple recoloration du zombie lent chauve en chemise ivoire.
- Même univers et densité de pixels que `zombie_idle.png`. Pas d'arme, d'armure, de lueur surnaturelle, de nouveau gore ou de démembrement.
- Repos, course en six poses, attaque en quatre poses (préparation lisible puis coup unique et retour), blessure en deux poses, mort en quatre poses. Dernière pose morte conservée en billboard VERTICAL, jamais un tapis horizontal.
- Personnage complet, ancrage des appuis et échelle cohérents. Les positions de course restent sur place ; le code applique la vitesse réelle avec delta-time. Les sprites d'attaque ne sont pas la source des dégâts : un événement de simulation unique doit l'être.
- Avant d'accélérer l'ennemi, préserver une préparation d'attaque visible, la navigation et les annulations existantes. Vitesse/vie/dégâts proposés dans la remise à Gemini, pas implémentés ici.

## Validation

Mesurer dimensions réelles des PNG, régions et ancrages ; inspecter silhouettes à taille utile puis cycle isolé. Aperçus et manifestes doivent partager les mêmes données. Distinguer cadrage inspecté, continuité des poses et gameplay non intégré. Ne pas modifier les armes, le zombie initial, les spawns ou la carte pendant cette préparation.
