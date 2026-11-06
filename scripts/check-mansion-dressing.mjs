import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { readSpritePng, alphaBounds } from './sprite-png-info.mjs';
import { MansionDressing, dressingAtlas, mansionDressingPlacements, dressingReliefParts } from '../src/MansionDressing.ts';
import { MANSION_ROOMS, MANSION_WALLS, getMansionFloorHeight } from '../src/MansionConfig.ts';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};
const { Level } = await import('../src/Level.ts');
const pack = JSON.parse(readFileSync('docs/asset-packs/DECOR_MANOIR_2026-11-05.json', 'utf8').replace(/^\uFEFF/, ''));
const atlas = readSpritePng(`public${dressingAtlas.url}`);
assert.deepEqual([atlas.width, atlas.height], [1024, 1024]);
assert.ok(statSync(`public${dressingAtlas.url}`).size < 1024 * 1024, 'Atlas sous 1 Mio sur disque');
assert.equal(atlas.data.length, 4 * 1024 * 1024, '4 Mio RGBA, sans mipmaps');
for (const asset of pack.assets) {
  const image = readSpritePng(asset.exportFile);
  assert.deepEqual([image.width, image.height], [256, 512]);
  const bounds = alphaBounds(image);
  assert.ok(bounds.x >= 8 && bounds.y >= 8 && bounds.x + bounds.width <= 248 && bounds.y + bounds.height <= 504, 'Silhouette entière et marges');
  let visible = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const offset = (y * image.width + x) * 4;
      assert.ok(image.data[offset + 3] === 0 || image.data[offset + 3] === 255, 'Alpha réellement découpé');
      if (image.data[offset + 3]) visible++;
      const atlasOffset = ((y + asset.atlasCell.y) * atlas.width + x + asset.atlasCell.x) * 4;
      assert.equal(image.data.readUInt32LE(offset), atlas.data.readUInt32LE(atlasOffset), 'Cellule identique à son export');
    }
  }
  assert.ok(visible > 15000, 'Une silhouette lisible existe dans chaque cellule');
  const index = dressingAtlas.cells[asset.id];
  assert.deepEqual([asset.atlasCell.x, asset.atlasCell.y], [(index % 4) * 256, Math.floor(index / 4) * 512]);
}

const scene = new THREE.Scene();
const dressing = new MansionDressing(scene);
const root = scene.getObjectByName('mansion-dressing');
assert.ok(root.children.length <= 9, 'Six plans fusionnés et au plus trois groupes de relief');
assert.ok(mansionDressingPlacements.length >= 12 && mansionDressingPlacements.length <= 18, 'Lot allégé, sans quota identique par pièce');
assert.equal(new Set(root.children.map(mesh => mesh.material)).size, 2, 'Atlas partagé et matériau mat vertexColors partagé');
const triangleCount = root.children.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0);
assert.equal(triangleCount, mansionDressingPlacements.length * 2 + dressingReliefParts.length * 12);
assert.ok(triangleCount <= 256, 'Relief statique limité à quelques boîtes');
const material = root.children[0].material;
assert.equal(material.transparent, false, 'Pas de tri ni de fusion alpha');
assert.equal(material.alphaTest, 0.5);
assert.equal(material.map.generateMipmaps, false);
assert.equal(material.map.minFilter, THREE.NearestFilter);
assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
assert.ok(root.children.every(mesh => !mesh.castShadow && !mesh.matrixAutoUpdate && mesh.geometry.groups.length === 0));

const levelScene = new THREE.Scene();
const level = new Level(levelScene);
const fixedWalls = MANSION_WALLS.filter(wall => wall.materialType !== 'obstacle').map(wall => new THREE.Box3().setFromCenterAndSize(
  new THREE.Vector3(wall.x, wall.y, wall.z), new THREE.Vector3(wall.width, wall.height, wall.depth),
));
for (const room of MANSION_ROOMS) {
  const placements = mansionDressingPlacements.filter(item => item.roomId === room.id);
  assert.ok(placements.length > 0, `La pièce ${room.id} reçoit son habillage spécifique`);
  const mesh = root.getObjectByName(`mansion-dressing-${room.id}`);
  const positions = mesh.geometry.getAttribute('position');
  const uv = mesh.geometry.getAttribute('uv');
  placements.forEach((item, partIndex) => {
    assert.ok(item.x >= room.bounds.minX && item.x <= room.bounds.maxX && item.z >= room.bounds.minZ && item.z <= room.bounds.maxZ);
    const floorY = getMansionFloorHeight(item.x, item.z);
    const target = new THREE.Vector3(item.x, floorY + item.centerY, item.z);
    const normal = new THREE.Vector3(Math.sin(item.rotationY), 0, Math.cos(item.rotationY));
    const approach = target.clone().addScaledVector(normal, 1.2);
    approach.y = floorY + 1.7;
    assert.equal(level.isColliding(approach.x, approach.z, 0.35), false, 'Approche libre devant chaque objet');
    assert.ok(level.hasLineOfSight(approach, target), 'Objet visible depuis son approche');
    const corners = [];
    for (let vertex = 0; vertex < 4; vertex++) {
      const index = partIndex * 4 + vertex;
      const point = new THREE.Vector3().fromBufferAttribute(positions, index);
      assert.ok(point.y >= floorY + 1.15 && point.y < level.getCeilingHeightAt(point.x, point.z) - 0.05, 'Décor au-dessus du lambris et sous le plafond');
      corners.push(point);
      const cell = dressingAtlas.cells[item.asset], left = (cell % 4) * 256, top = Math.floor(cell / 4) * 512;
      const pixelX = uv.getX(index) * 1024, pixelY = (1 - uv.getY(index)) * 1024;
      assert.ok(pixelX >= left && pixelX < left + 256 && pixelY >= top && pixelY < top + 512, 'UV dans la bonne cellule');
    }
    assert.ok(Math.abs(corners[0].distanceTo(corners[1]) - item.width) < 1e-5, 'Rapport des images conservé');
    assert.ok(Math.abs(corners[0].distanceTo(corners[2]) - item.width * 2) < 1e-5);
    for (const point of [...corners, target]) {
      assert.ok(fixedWalls.some(wall => wall.containsPoint(point.clone().addScaledVector(normal, -0.13))), 'Support mural plein derrière le cadre, hors ouverture');
    }
  });
}
const blockerArray = level.getSolidMeshes();
const blockersBefore = blockerArray.filter(mesh => mesh.name !== 'mansion-furnishings-galerie').map(mesh => mesh.uuid);
const navBefore = level.findNextWaypoint(new THREE.Vector3(8, 1, 16), new THREE.Vector3(-14, 1, 17), 0.4);
const lightsBefore = levelScene.getObjectsByProperty('isLight', true).length;
level.disposeDecor();
assert.equal(level.getSolidMeshes(), blockerArray, 'La liste partagée avec Weapon est conservée');
assert.deepEqual(level.getSolidMeshes().map(mesh => mesh.uuid), blockersBefore, 'Seul le buste solide du mobilier détruit est retiré');
assert.deepEqual(level.findNextWaypoint(new THREE.Vector3(8, 1, 16), new THREE.Vector3(-14, 1, 17), 0.4), navBefore, 'Navigation inchangée avec ou sans habillage');
assert.equal(levelScene.getObjectsByProperty('isLight', true).length, lightsBefore, 'Aucune lumière ajoutée');
let disposed = 0;
const resources = new Set(root.children.flatMap(mesh => [mesh.geometry, mesh.material]));
resources.add(material.map);
for (const resource of resources) resource.addEventListener('dispose', () => disposed++);
dressing.dispose();
dressing.dispose();
assert.equal(disposed, resources.size, 'Géométries, deux matériaux et texture libérés une seule fois');
assert.equal(root.parent, null);
console.log(`PASS : cinq PNG/atlas, ${mansionDressingPlacements.length} placements, ${root.children.length} meshes/${triangleCount} triangles, UV/proportions, approches, navigation et nettoyage.`);
