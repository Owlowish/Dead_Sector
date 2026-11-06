import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const requestedTextures = [];
THREE.TextureLoader.prototype.load = function (url) {
  requestedTextures.push(url);
  return new THREE.Texture();
};

const { StormController } = await import('../src/StormController.ts');
const { Level } = await import('../src/Level.ts');
const { Game } = await import('../src/Game.ts');
const { MANSION_STORM_WINDOWS } = await import('../src/MansionConfig.ts');
const { createStormWindowVisuals } = await import('../src/StormWindow.ts');
const { createWindowRain } = await import('../src/WindowRain.ts');
const { mansionMaterial } = await import('../src/MansionMaterials.ts');

const rainState = rain => ({
  positions: Array.from(rain.geometry.getAttribute('position').array),
  colors: Array.from(rain.geometry.getAttribute('color').array),
});
const paneTriangles = new WeakMap();
function checkRainInsidePane(rain, pane) {
  const position = rain.geometry.getAttribute('position'), color = rain.geometry.getAttribute('color');
  assert.equal(color?.itemSize, 4, 'La pluie fournit une couleur RGBA par sommet');
  assert.equal(color.count, position.count);
  assert.equal(rain.material.vertexColors, true);
  assert.equal(rain.material.transparent, true, 'Les alpha pilotent réellement un matériau transparent');
  assert.ok(Array.from(position.array).every(Number.isFinite), 'Toutes les positions restent finies');
  assert.ok(Array.from(color.array).every(value => Number.isFinite(value) && value >= 0 && value <= 1),
    'Toutes les composantes RGBA restent finies dans [0, 1]');
  assert.ok(Array.from({ length:color.count }, (_, index) => color.getW(index)).some(alpha => alpha > 0),
    'Des gouttes sont effectivement visibles');
  let triangles = paneTriangles.get(pane.geometry);
  if (!triangles) {
    const vertices = pane.geometry.getAttribute('position'), indices = pane.geometry.index;
    triangles = [];
    for (let i = 0; i < (indices?.count ?? vertices.count); i += 3) triangles.push(new THREE.Triangle(
      ...[0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(vertices, indices ? indices.getX(i + offset) : i + offset)),
    ));
    pane.geometry.computeBoundingBox(); paneTriangles.set(pane.geometry, triangles);
  }
  const intoPane = new THREE.Matrix4().copy(pane.matrixWorld).invert().multiply(rain.matrixWorld);
  const point = new THREE.Vector3(), closest = new THREE.Vector3();
  const box = pane.geometry.boundingBox;
  const upperQuarter = box.max.y - (box.max.y - box.min.y) / 4;
  let rainInArch = false;
  for (let index = 0; index < position.count; index++) {
    const alpha = color.getW(index);
    if (alpha <= 0 && color.getW(index ^ 1) <= 0) continue;
    point.fromBufferAttribute(position, index).applyMatrix4(intoPane); point.z = 0;
    assert.ok(triangles.some(triangle => triangle.containsPoint(point)
      || triangle.closestPointToPoint(point, closest).distanceToSquared(point) < 1e-10),
    'Un sommet visible reste dans les vrais triangles du vitrage, arche comprise');
    if (alpha > 0 && point.y > upperQuarter) rainInArch = true;
  }
  assert.ok(rainInArch, 'La pluie couvre aussi le quart supérieur de l’arche');
}

class Source {
  isPlaying = false;
  position = new THREE.Vector3();
  playCount = 0;
  pauseCount = 0;
  stopCount = 0;
  setVolume() {}
  play() { this.playCount++; this.isPlaying = true; }
  pause() { this.pauseCount++; this.isPlaying = false; }
  stop() { this.stopCount++; this.isPlaying = false; }
  disconnect() {}
  removeFromParent() {}
}

const playerPosition = new THREE.Vector3(2.5, 1.7, 16.7);
const tick = (controller, secs, active, positions) => {
  for (let i = 0; i < Math.ceil(secs / 0.05); i++) controller.update(0.05, active, playerPosition, positions);
};
const lights = [new THREE.PointLight(0xa9c9e8, 0, 13, 2)];
const randomValues = [0, 0.8, 0];
const controller = new StormController(lights, () => randomValues.shift() ?? 0);
const rain = new Source();
const thunder = new Source();
controller.setRain(rain);
controller.setThunder(thunder);
const positions = MANSION_STORM_WINDOWS.map(({ x, y, z }) => new THREE.Vector3(x, y, z));

tick(controller, 0.05, true, positions);
assert.equal(rain.playCount, 1, 'la pluie démarre après activation');
tick(controller, 12, true, positions);
assert.ok(lights.some((light) => light.intensity > 0), 'un flash allume une source réelle de la pièce');
const selectedIndex = Math.floor(0.8 * positions.length);
assert.ok(lights[0].position.distanceTo(positions[selectedIndex]) < 0.01, 'le tirage peut choisir une fenêtre éloignée avec une seule lumière');
assert.ok(thunder.position.distanceTo(positions[selectedIndex]) < 0.01, 'le tonnerre suit la fenêtre choisie');
tick(controller, 0.4, true, positions);
assert.ok(lights.every((light) => light.intensity === 0), 'les lumières reviennent à zéro');
assert.equal(thunder.playCount, 0, 'le tonnerre attend la fin du flash et son délai');
tick(controller, 0.9, true, positions);
assert.equal(thunder.playCount, 1, 'le tonnerre est déclenché après le flash');
tick(controller, 0.05, false, positions);
assert.ok(rain.pauseCount > 0, 'la pluie se met en pause quand le jeu est suspendu');
assert.ok(lights.every((light) => light.intensity === 0), 'la suspension coupe la lumière');

let audioReady = false;
const lateRain = new Source();
const lateController = new StormController([new THREE.PointLight()], () => 0, () => audioReady);
lateController.update(0.05, true, playerPosition, positions);
lateController.setRain(lateRain);
assert.equal(lateRain.playCount, 0, 'une source ne joue pas avant AudioContext running');
audioReady = true;
lateController.update(0.05, true, playerPosition, positions);
assert.equal(lateRain.playCount, 1, 'la pluie chargée en retard démarre dès que l’audio est actif');
playerPosition.set(-23.4, 3.7, -14);
lateController.update(0.05, true, playerPosition, positions);
assert.ok(lateRain.position.distanceTo(positions[4]) < 0.01, 'la pluie suit la fenêtre la plus proche');

globalThis.document = { pointerLockElement: null, hidden: false, hasFocus: () => true };
let gameSuspendedStorm = false;
const game = Object.create(Game.prototype);
Object.assign(game, {
  state: 'playing', renderer: { domElement: {} }, player: { audioListener: { context: {} } },
  ambianceAudio: null, horrorDirector: { suspend() {} }, zombies: [],
  stormController: { suspend() { gameSuspendedStorm = true; } },
});
game.syncAmbientAudio();
assert.ok(gameSuspendedStorm, 'Game suspend immédiatement l’orage à la perte du Pointer Lock');

// Le décor conserve une propriété claire de ses ressources, y compris celles partagées entre baies.
const windowScene = new THREE.Scene();
const sentinel = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), new THREE.MeshBasicMaterial());
windowScene.add(sentinel);
let foreignDisposals = 0;
sentinel.geometry.addEventListener('dispose', () => foreignDisposals++);
sentinel.material.addEventListener('dispose', () => foreignDisposals++);
const textureStart = requestedTextures.length;
const visuals = createStormWindowVisuals(windowScene, MANSION_STORM_WINDOWS);
const windowGroups = windowScene.getObjectsByProperty('name', 'storm-window');
assert.equal(windowGroups.length, MANSION_STORM_WINDOWS.length);
for (const [index, group] of windowGroups.entries()) {
  const spec = MANSION_STORM_WINDOWS[index];
  assert.deepEqual(group.position.toArray(), [spec.x, spec.y, spec.z], 'Les ancrages existants sont conservés');
  assert.equal(group.rotation.y, spec.rotationY);
  let meshes = 0;
  group.traverse(object => { if (object.isMesh) meshes++; });
  assert.ok(meshes <= 11, 'La baie reste fusionnée sous 11 meshes : ' + index + ' (' + meshes + ')');
}
assert.deepEqual(new Set(windowGroups.map(group => group.userData.variant)),
  new Set(['classic', 'damaged', 'stained', 'occult']), 'Les quatre aspects prévus sont présents');
const variantOverlays = [
  ['damaged', 'storm-window-cracks'], ['stained', 'storm-window-stained-glass'], ['occult', 'storm-window-occult-etching'],
].map(([variant, name]) => {
  const overlay = windowGroups.find(group => group.userData.variant === variant)?.getObjectByName(name);
  assert.ok(overlay && overlay.visible && overlay.geometry?.getAttribute('position').count > 0,
    'La variante possède une vraie géométrie visible : ' + variant);
  return overlay;
});
const overlaySnapshot = () => variantOverlays.map(overlay => Array.from(overlay.geometry.getAttribute('position').array));
const staticOverlays = overlaySnapshot();
assert.ok(requestedTextures.slice(textureStart).includes('/assets/textures/mansion/storm-exterior-v1.png'),
  'Le lot réemploie le paysage extérieur existant');
for (const url of requestedTextures.slice(textureStart)) assert.ok(existsSync('public' + url), 'Chaque image réutilisée existe : ' + url);
const sharedStone = mansionMaterial('stone');
const sharedResources = new Set([sharedStone, sharedStone.map]);
let sharedDisposals = 0;
for (const resource of sharedResources) resource?.addEventListener('dispose', () => sharedDisposals++);
const owned = new Set();
let visualTriangles = 0;
const rains = windowScene.getObjectsByProperty('name', 'storm-window-rain');
assert.equal(rains.length, MANSION_STORM_WINDOWS.length, 'Chaque baie reçoit sa pluie');
for (const rain of rains) {
  assert.ok(rain.isLineSegments, 'La pluie reste un lot de traits');
  assert.equal(rain.geometry.getAttribute('position').count % 2, 0, 'Chaque segment garde deux sommets');
  assert.ok(rain.geometry.getAttribute('position').count > 0 && rain.geometry.getAttribute('position').count <= 320,
    'La pluie reste bornée au budget de 160 segments par baie');
}
for (const object of windowScene.children.filter(object => object !== sentinel)) object.traverse(child => {
  assert.ok(!child.isLight, 'Les nouvelles fenêtres ne créent aucune lumière');
  assert.equal(child.castShadow, false, 'Le lot ne crée aucune ombre projetée');
  if (child.geometry) {
    owned.add(child.geometry);
    for (const attribute of Object.values(child.geometry.attributes)) for (const value of attribute.array)
      assert.ok(Number.isFinite(value), 'Les données géométriques sont finies');
  }
  if (child.isMesh) visualTriangles += (child.geometry.index?.count ?? child.geometry.getAttribute('position').count) / 3
    * (child.isInstancedMesh ? child.count : 1);
  for (const material of child.material ? [].concat(child.material) : []) {
    if (!sharedResources.has(material)) owned.add(material);
    for (const value of Object.values(material)) if (value instanceof THREE.Texture && !sharedResources.has(value)) owned.add(value);
  }
});
assert.ok(visualTriangles <= 30_000, 'Les six fenêtres et projections restent sous 30 000 triangles : ' + visualTriangles);
windowScene.updateMatrixWorld(true);
const checkRain = () => {
  for (const [index, rain] of rains.entries()) checkRainInsidePane(rain, windowGroups[index].getObjectByName('storm-window-glass'));
};
const rainSnapshot = () => rains.map(rainState);
const rainBuffers = rains.map(rain => ['position', 'color'].map(name => rain.geometry.getAttribute(name).array));
// Le helper reçoit la vraie Shape du vitrage ; un retour au temps zéro doit reproduire la même pluie.
for (const [index, rain] of rains.entries()) {
  const pane = windowGroups[index].getObjectByName('storm-window-glass');
  const shapes = pane.geometry.parameters.shapes;
  const replay = createWindowRain(index, MANSION_STORM_WINDOWS[index], Array.isArray(shapes) ? shapes[0] : shapes, rain.material);
  replay.mesh.matrixWorld.copy(rain.matrixWorld);
  replay.update(0);
  const seed = rainState(replay.mesh);
  for (const time of [.125, 5.5, 3600.01, 86400]) {
    replay.update(time); checkRainInsidePane(replay.mesh, pane);
    replay.update(0);
    assert.deepEqual(rainState(replay.mesh), seed, 'Le temps zéro restaure positions et alpha, sans dépendre du temps précédent');
  }
  replay.mesh.geometry.dispose();
}
const stillRain = rainSnapshot();
checkRain();
visuals.update(0);
assert.deepEqual(rainSnapshot(), stillRain, 'Un delta nul fige la pluie');
visuals.update(.05);
const movingRain = rainSnapshot();
checkRain();
assert.deepEqual(overlaySnapshot(), staticOverlays, 'Les variantes restent un habillage fixe pendant l’animation de pluie');
for (let index = 0; index < movingRain.length; index++) {
  assert.notDeepEqual(movingRain[index], stillRain[index], 'La pluie de chaque fenêtre avance réellement');
}
visuals.update(0);
assert.deepEqual(rainSnapshot(), movingRain, 'La pause conserve positions et transparence après un mouvement');
visuals.update(.01);
assert.notDeepEqual(rainSnapshot(), movingRain, 'La reprise fait avancer la pluie sans recréer le lot');
for (const [index, rain] of rains.entries()) for (const [attribute, name] of ['position', 'color'].entries())
  assert.equal(rain.geometry.getAttribute(name).array, rainBuffers[index][attribute], 'Les mises à jour réemploient les buffers existants');
checkRain();
const beforeDisposalRain = rainSnapshot();
const disposalCounts = new Map();
for (const resource of owned) resource.addEventListener('dispose', () =>
  disposalCounts.set(resource, (disposalCounts.get(resource) ?? 0) + 1));
visuals.dispose(); visuals.dispose(); visuals.update(1);
assert.deepEqual(windowScene.children, [sentinel], 'Le nettoyage retire fenêtres, éclairs et projections sans toucher un objet étranger');
for (const resource of owned) assert.equal(disposalCounts.get(resource), 1, 'Chaque ressource possédée est libérée une seule fois');
assert.equal(foreignDisposals, 0);
assert.equal(sharedDisposals, 0, 'La pierre partagée par les autres pièces reste utilisable');
assert.deepEqual(rainSnapshot(), beforeDisposalRain, 'Aucune animation ne modifie une géométrie détruite');
sentinel.geometry.dispose(); sentinel.material.dispose();

const scene = new THREE.Scene();
const level = new Level(scene);
assert.equal(level.getStormLights().length, 1);
assert.equal(level.getStormWindowPositions().length, 6);
assert.equal(scene.getObjectsByProperty('name', 'storm-window').length, 6, 'six baies gothiques placées');
assert.equal(scene.getObjectsByProperty('name', 'storm-window-floor-light').length, 6, 'six projections au sol');
for (const spec of MANSION_STORM_WINDOWS) {
  const floor = level.getFloorHeightAt(spec.x, spec.z);
  assert.ok(spec.y - spec.height / 2 - floor >= 0.7 - 1e-6, 'appui de fenêtre au-dessus du sol');
}
assert.equal(level.getStormLights().filter((light) => light.castShadow).length, 0);
assert.equal(MANSION_STORM_WINDOWS.filter((window) => level.getFloorHeightAt(window.x, window.z) > 2).length, 2, 'deux fenêtres sont sur le plateau haut');
scene.updateMatrixWorld(true);
for (const [index, group] of scene.getObjectsByProperty('name', 'storm-window').entries()) {
  const spec = MANSION_STORM_WINDOWS[index];
  assert.ok(new THREE.Box3().setFromObject(group).max.y <= level.getCeilingHeightAt(spec.x, spec.z) + 1e-5,
    'L’habillage réel reste sous le plafond : baie ' + index);
}
const levelRains = scene.getObjectsByProperty('name', 'storm-window-rain');
const levelRainSnapshot = () => levelRains.map(rainState);
const initialRain = levelRainSnapshot();
level.update(.05, 0);
assert.deepEqual(levelRainSnapshot(), initialRain, 'Level gèle la pluie avec le delta d’ambiance nul');
level.update(.05, .05);
assert.notDeepEqual(levelRainSnapshot(), initialRain, 'Level transmet le vrai delta d’ambiance aux fenêtres');

const levelVisuals = level.stormWindowVisuals;
assert.equal(levelVisuals.panes.length, MANSION_STORM_WINDOWS.length);
assert.equal(new Set(levelVisuals.panes.map(pane => pane.material)).size, MANSION_STORM_WINDOWS.length,
  'Chaque vitre possède sa couleur sans dupliquer la texture extérieure');
assert.equal(new Set(levelVisuals.panes.map(pane => pane.material.map)).size, 1,
  'Les six matériaux de vitre gardent une texture extérieure partagée');
const darkPaneColors = levelVisuals.panes.map(pane => pane.material.color.toArray());
for (let selected = 0; selected < MANSION_STORM_WINDOWS.length; selected++) {
  for (const light of level.getStormLights()) {
    light.position.copy(level.getStormWindowPositions()[selected]); light.intensity = 18;
  }
  level.update(0, 0);
  assert.deepEqual(levelVisuals.bolts.map(bolt => bolt.mesh.visible),
    MANSION_STORM_WINDOWS.map((_, index) => index === selected), 'L’éclair visible reste limité à la baie choisie');
  assert.deepEqual(levelVisuals.projections.map(projection => projection.material.opacity > 0),
    MANSION_STORM_WINDOWS.map((_, index) => index === selected), 'La projection suit la même baie que la lumière réelle');
  for (const [index, pane] of levelVisuals.panes.entries()) {
    if (index === selected) assert.notDeepEqual(pane.material.color.toArray(), darkPaneColors[index], 'La vitre choisie réagit à son éclair');
    else assert.deepEqual(pane.material.color.toArray(), darkPaneColors[index], 'Une vitre voisine ne s’éclaircit pas à distance');
  }
  for (const light of level.getStormLights()) light.intensity = 0;
  level.update(0, 0);
  assert.ok(levelVisuals.bolts.every(bolt => !bolt.mesh.visible));
  assert.ok(levelVisuals.projections.every(projection => projection.material.opacity === 0));
  assert.deepEqual(levelVisuals.panes.map(pane => pane.material.color.toArray()), darkPaneColors,
    'Toutes les vitres retrouvent leur teinte initiale après le flash');
}
level.disposeDecor(); level.disposeDecor();
assert.equal(scene.getObjectsByProperty('name', 'storm-window').length, 0, 'Level détruit le décor complet des fenêtres');
assert.equal(scene.getObjectsByProperty('name', 'storm-window-floor-light').length, 0);
console.log('Orage : pluie RGBA bornée dans les vraies arches, temps0/1h/1j, pause/reprise, buffers réutilisés, flash local et destruction vérifiés. DOM/textures simulés ; rendu non validé.');
