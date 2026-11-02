# Assets du manoir — première amélioration

## Audit ciblé

Le code réel a évolué vers un manoir victorien : parquet, damas rouge, lambris, tapis, portraits, éclairage chaud/froid et rendu interne réduit. Cette direction est conservée, sans revenir implicitement à l'ancienne arène industrielle.

Les textures originales de mur, parquet et portrait sont très schématiques ; le zombie est nettement plus détaillé. Première passe : améliorer ces trois textures statiques, sans modifier la disposition, l'éclairage, les règles de jeu ou les sprites animés. Le tapis reste à revoir si son contraste paraît insuffisant. Les images de démarrage Vite/TypeScript sous src/assets ne servent pas au décor du niveau.

## Livrables et intégration

Images créées avec le tool intégré imagegen, puis copiées dans le projet, sans redimensionnement ou retouche externe :

- `public/assets/textures/mansion_wall_v2.png` : papier peint rouge et lambris brun.
- `public/assets/textures/wood_floor_v2.png` : planches de parquet vieillies.
- `public/assets/textures/portrait_v2.png` : portrait ancestral encadré.

Les originaux restent en place. Level.ts charge les variantes v2. Pour revenir aux anciennes textures, rétablir les trois chemins originaux dans ce fichier. Les filtres d'agrandissement restent Nearest ; les nouvelles textures utilisent NearestMipmapNearest à distance. Les mipmaps sont des versions réduites générées par Three.js, utilisées pour limiter les détails instables lorsqu'une texture occupe peu de pixels. Les répétitions et les dimensions des meshes sont conservées.

Les images ont une définition plus élevée que les anciennes : elles coûtent davantage en chargement et mémoire. Ce sont des premières sources artistiques utilisables, pas un atlas basse résolution optimisé. La demande de raccords dans les prompts ne garantit pas un pavage parfait ; examiner les répétitions en jeu avant de considérer ces textures définitives.

## Prompts exacts (mode intégré)

### Mur

Use case: stylized-concept. Asset type: game wall albedo texture for DEAD SECTOR, retro FPS Victorian haunted mansion. Create ONE production-ready flat texture image, portrait 1:2 aspect, ideally 256x512 or 512x1024. Upper 65 percent: faded deep oxblood red damask wallpaper with elegant restrained gold and burgundy motifs. Lower 35 percent: aged dark walnut wainscoting, recessed rectangular panels and narrow horizontal molding. Medium value contrast, readable warm wood grain, dusty subtle wear, muted warm palette. Hand-pixelled late 1990s PC horror aesthetic, clearly stepped pixel clusters, limited palette, details must survive low resolution. Strictly orthographic flat surface filling entire image edge to edge, no perspective, no room scene, no floor, no frame, no captions. Left and right edges must tile seamlessly: matching wallpaper pattern and horizontal panel molding, no vertical border at outer edges, uniform diffuse illumination, no baked directional highlights or cast shadows. Vertical tiling not required. This is a new replacement asset, not a screenshot.

### Parquet

Use case: stylized-concept. Asset: square seamless parquet floor albedo tile for a retro first person Victorian haunted mansion game. Flat top down surface only, no perspective, no room. Aged warm medium brown oak narrow long planks, staggered joints, restrained grain, worn bevel edges, no huge cracks. Distinct late 1990s hand painted pixel art, chunky pixel clusters and limited palette, enough medium value wood detail to read under dim candlelight. Planks run vertically top to bottom, 6 planks across with varied staggered ends. Fill image edge to edge, repeatable seamlessly on BOTH axes, no border, no black seams at tile boundary, uniform diffuse color only, no baked light or shadows. No text, no props, no frame. Output square.

### Portrait

Use case: stylized-concept. Game asset: one framed Victorian ancestral oil portrait as a flat texture for a retro haunted mansion FPS. Portrait aspect ratio 3:4. Front facing severe elderly Victorian gentleman in a dark formal coat and ivory cravat, pale face lit gently, subtle unsettling expression, bust portrait, dark muted teal brown background. Ornate aged brass and gold rectangular carved frame contained entirely inside image, frame fills outer edges, painting fills inner frame. Pixel art like a carefully hand-painted late 1990s PC horror texture, strong large readable clusters rather than noisy tiny details. Harmonious desaturated ochre, dark brown and faded green palette with face as focal point. Flat orthographic full image, no room, no easel, no cast wall shadows, no exterior background, no perspective. Single portrait only, no text, no signature, no watermark.

## Validation

Images générées inspectées visuellement, fichiers copiés et chemins intégrés. `npm.cmd run build` réussi après intégration ; rendu navigateur non vérifié. En jeu : observer le sol en mouvement, les raccords de murs, les portraits sous l'éclairage réel et la visibilité des ennemis. Une belle texture seule ne garantit pas un décor lisible.
