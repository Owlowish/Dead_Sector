import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { roomCompositions, composedPortraits } from '../src/MansionComposition.ts';
import { mansionDressingPlacements, dressingReliefParts } from '../src/MansionDressing.ts';
import { MANSION_ROOMS, MANSION_WALLS, MANSION_STORM_WINDOWS, getMansionFloorHeight } from '../src/MansionConfig.ts';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const { Level } = await import('../src/Level.ts');
const level = new Level(new THREE.Scene());
const panels = [
  ...mansionDressingPlacements.map((item, index) => ({ ...item, id: `dressing-${index}`, height: item.width * 2 })),
  ...composedPortraits,
];
const walls = MANSION_WALLS.filter(wall => wall.materialType !== 'obstacle').map(wall => new THREE.Box3().setFromCenterAndSize(
  new THREE.Vector3(wall.x, wall.y, wall.z), new THREE.Vector3(wall.width, wall.height, wall.depth),
));
const wallAxes = item => Math.abs(Math.sin(item.rotationY)) > 0.5 ? ['x', 'z'] : ['z', 'x'];
const normalOf = item => new THREE.Vector3(Math.sin(item.rotationY), 0, Math.cos(item.rotationY));
const floorOf = item => getMansionFloorHeight(item.x, item.z);
const overlaps = (aLow, aHigh, bLow, bHigh, margin = 0) => aHigh + margin > bLow && bHigh + margin > aLow;

assert.deepEqual(new Set(roomCompositions.map(item => item.roomId)), new Set(MANSION_ROOMS.map(room => room.id)));
assert.equal(new Set(roomCompositions.map(item => item.roomId)).size, roomCompositions.length, 'Une intention distincte par pièce');
assert.ok(mansionDressingPlacements.length < 24, 'Le remplissage systématique de quatre panneaux par pièce est retiré');
const clocks = mansionDressingPlacements.filter(item => item.asset === 'clock');
assert.equal(clocks.length, 1, 'La pendule reste un repère unique');
assert.equal(clocks[0].roomId, 'vestibule');
assert.ok(mansionDressingPlacements.filter(item => item.asset === 'tools').every(item => item.roomId === 'atelier'));
assert.ok(mansionDressingPlacements.filter(item => item.asset === 'curios').every(item => item.roomId === 'bibliotheque'));
assert.ok(composedPortraits.filter(item => item.roomId === 'galerie').length >= 3, 'Le rythme des tableaux identifie la Galerie');
assert.ok(composedPortraits.every(item => item.roomId !== 'atelier' && item.roomId !== 'bibliotheque'), 'Les livres et outils remplacent les portraits répétés');
const png = readFileSync('public/assets/textures/portrait_v2.png');
const portraitRatio = png.readUInt32BE(16) / png.readUInt32BE(20);

for (const composition of roomCompositions) {
  const room = MANSION_ROOMS.find(item => item.id === composition.roomId);
  const { focus, calmWall } = composition;
  assert.ok(focus.label.length > 0 && composition.secondary.length > 0);
  assert.ok(focus.x >= room.bounds.minX && focus.x <= room.bounds.maxX && focus.z >= room.bounds.minZ && focus.z <= room.bounds.maxZ);
  assert.ok(calmWall.high - calmWall.low >= 2.5, 'Le repos mural a une longueur réelle');
  const quietNormal = calmWall.axis;
  const quietAlong = quietNormal === 'x' ? 'z' : 'x';
  for (const panel of panels.filter(item => item.roomId === room.id)) {
    const [axis, along] = wallAxes(panel);
    if (axis !== quietNormal || Math.abs(panel[axis] - calmWall.plane) > 0.15) continue;
    assert.equal(along, quietAlong);
    assert.equal(overlaps(panel[along] - panel.width / 2, panel[along] + panel.width / 2, calmWall.low, calmWall.high, 0.15), false,
      `Le mur calme de ${room.id} reste libre : ${panel.id}`);
  }
  // Le segment calme doit aussi correspondre à un vrai support plein, pas à une ouverture.
  const inward = Math.abs(calmWall.plane - room.bounds[quietNormal === 'x' ? 'minX' : 'minZ']) < 1e-5 ? 1 : -1;
  const floor = getMansionFloorHeight(focus.x, focus.z);
  for (const along of [calmWall.low, (calmWall.low + calmWall.high) / 2, calmWall.high]) {
    const point = quietNormal === 'x'
      ? new THREE.Vector3(calmWall.plane - inward * 0.02, floor + 1.7, along)
      : new THREE.Vector3(along, floor + 1.7, calmWall.plane - inward * 0.02);
    assert.ok(walls.some(wall => wall.containsPoint(point)), `Support réel du repos mural : ${room.id}`);
  }
}

for (const panel of panels) {
  const floor = floorOf(panel);
  const normal = normalOf(panel);
  const tangent = new THREE.Vector3(Math.cos(panel.rotationY), 0, -Math.sin(panel.rotationY));
  const center = new THREE.Vector3(panel.x, floor + panel.centerY, panel.z);
  const room = MANSION_ROOMS.find(item => item.id === panel.roomId);
  assert.ok(panel.centerY - panel.height / 2 >= 1.15 - 1e-6, `Cadre au-dessus du lambris : ${panel.id}`);
  if (composedPortraits.includes(panel)) assert.ok(Math.abs(panel.width / panel.height - portraitRatio) < 1e-6, 'Portrait sans étirement du PNG');
  for (const side of [-1, 1]) for (const up of [-1, 1]) {
    const corner = center.clone().addScaledVector(tangent, side * panel.width / 2);
    corner.y += up * panel.height / 2;
    assert.ok(corner.x >= room.bounds.minX - 1e-5 && corner.x <= room.bounds.maxX + 1e-5 && corner.z >= room.bounds.minZ - 1e-5 && corner.z <= room.bounds.maxZ + 1e-5);
    assert.ok(corner.y < level.getCeilingHeightAt(corner.x, corner.z) - 0.05);
    assert.ok(walls.some(wall => wall.containsPoint(corner.clone().addScaledVector(normal, -0.13))), `Chaque angle du cadre est soutenu : ${panel.id}`);
  }
  const approach = center.clone().addScaledVector(normal, 1.2);
  approach.y = floor + 1.7;
  assert.equal(level.isColliding(approach.x, approach.z, 0.35), false, `Approche libre : ${panel.id}`);
  assert.ok(level.hasLineOfSight(approach, center), `Vue dégagée : ${panel.id}`);
  const [axis, along] = wallAxes(panel);
  for (const window of MANSION_STORM_WINDOWS) {
    const [windowAxis] = wallAxes(window);
    if (axis !== windowAxis || Math.abs(panel[axis] - window[axis]) > 0.15) continue;
    assert.equal(overlaps(panel[along] - panel.width / 2, panel[along] + panel.width / 2, window[along] - window.width / 2, window[along] + window.width / 2, 0.15)
      && overlaps(center.y - panel.height / 2, center.y + panel.height / 2, window.y - window.height / 2, window.y + window.height / 2, 0.15), false,
    `Fenêtre et marge dégagées : ${panel.id}`);
  }
  for (const other of panels) {
    if (other === panel || other.roomId !== panel.roomId) continue;
    const [otherAxis] = wallAxes(other);
    if (axis !== otherAxis || Math.abs(panel[axis] - other[axis]) > 0.15) continue;
    const otherY = floorOf(other) + other.centerY;
    assert.equal(overlaps(panel[along] - panel.width / 2, panel[along] + panel.width / 2, other[along] - other.width / 2, other[along] + other.width / 2, 0.15)
      && overlaps(center.y - panel.height / 2, center.y + panel.height / 2, otherY - other.height / 2, otherY + other.height / 2, 0.15), false,
    `Panneaux et marges séparés : ${panel.id} / ${other.id}`);
  }
}

const clockFocus = roomCompositions.find(item => item.roomId === 'vestibule').focus;
assert.deepEqual([clockFocus.x, clockFocus.z, clockFocus.y], [clocks[0].x, clocks[0].z, clocks[0].centerY]);
for (const part of dressingReliefParts) {
  const item = mansionDressingPlacements[part.placementIndex];
  assert.ok(['clock', 'mirror', 'curios'].includes(item.asset), 'Draperies et outils restent des plans');
  const normal = normalOf(item);
  const plane = new THREE.Vector3(item.x, floorOf(item) + item.centerY, item.z);
  const box = new THREE.BoxGeometry(...part.size);
  box.rotateY(part.rotationY);
  box.translate(...part.center);
  const positions = box.getAttribute('position');
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, vertex);
    const setback = plane.clone().sub(point).dot(normal);
    assert.ok(setback >= 0.001 && setback < 0.095, 'Relief entièrement derrière la face et devant le mur');
    assert.ok(0.095 - setback <= 0.12, 'Saillie inférieure à12cm, sans nouvelle collision');
    assert.ok(walls.some(wall => wall.containsPoint(point.clone().addScaledVector(normal, -0.13))), 'Relief soutenu hors des portes');
  }
  box.dispose();
}

const paths = [
  [new THREE.Vector3(8, 1, 16), new THREE.Vector3(-14, 1, 17)],
  [new THREE.Vector3(-20, 1, 13), new THREE.Vector3(-18, 1, 2)],
  [new THREE.Vector3(9, 1, 2.5), new THREE.Vector3(17, 1, 0)],
  [new THREE.Vector3(-19, 3.4, -14), new THREE.Vector3(-7, 3.4, -14)],
  [new THREE.Vector3(6, 3.4, -14), new THREE.Vector3(18, 3.4, -14)],
];
const before = paths.map(([from, to]) => level.findNextWaypoint(from, to, 0.4));
// Le socle abaissé révèle le buste : les deux côtés de sa vraie surface arrêtent les tirs.
const blockerArray = level.getSolidMeshes();
const galleryBlocker = blockerArray.find(mesh => mesh.name === 'mansion-furnishings-galerie');
assert.ok(galleryBlocker);
for (const [start, end] of [[-16, -20], [-20, -16]]) {
  const from = new THREE.Vector3(start, 1.7, 0), to = new THREE.Vector3(end, 1.7, 0);
  assert.equal(level.hasLineOfSight(from, to), false, 'Les épaules visibles bloquent les tirs des deux côtés');
  assert.equal(level.hasLineOfSight(new THREE.Vector3(start, 1.7, 0.8), new THREE.Vector3(end, 1.7, 0.8)), true,
    'Le vide à côté du buste ne devient pas un bloqueur invisible');
}
assert.equal(level.isColliding(-18, 0, 0.35), true, 'Le socle garde une emprise physique');
assert.equal(level.isColliding(-18, 1.2, 0.35), false, 'Le passage longeant le socle reste libre');
const bench = MANSION_WALLS.find(wall => wall.materialType === 'obstacle' && wall.x === 12 && wall.z === -14);
assert.ok(bench.depth < bench.width / 2 && bench.height === 1, 'L’établi garde une profondeur de meuble et la hauteur corrigée');
assert.equal(level.hasLineOfSight(new THREE.Vector3(12, 4.1, -12), new THREE.Vector3(12, 4.1, -16)), true,
  'Le plateau reste sous le regard');
assert.equal(level.hasLineOfSight(new THREE.Vector3(12, 3, -12), new THREE.Vector3(12, 3, -16)), false,
  'La géométrie de l’établi bloque toujours les tirs bas');
const blockers = blockerArray.filter(mesh => mesh !== galleryBlocker).map(mesh => mesh.uuid);
level.disposeDecor();
assert.equal(level.getSolidMeshes(), blockerArray, 'Weapon conserve sa référence vers le tableau de solides');
assert.deepEqual(level.getSolidMeshes().map(mesh => mesh.uuid), blockers, 'Seul le batch solide détruit de la Galerie est retiré');
assert.deepEqual(paths.map(([from, to]) => level.findNextWaypoint(from, to, 0.4)), before, 'Les itinéraires restent identiques sans habillage');
console.log(`PASS : six intentions, six murs calmes, ${panels.length} panneaux/portraits, supports/fenêtres/marges/approches, relief limité et cinq itinéraires.`);
