import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(s, c, next) {
  return next(s.startsWith('.') && !/\.[a-z0-9]+$/i.test(s) ? s + '.ts' : s, c);
} });
THREE.TextureLoader.prototype.load = function(url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};
const { Level } = await import('../src/Level.ts');
const { mansionMaterial, mansionSurfaceAssets } = await import('../src/MansionMaterials.ts');
const scene = new THREE.Scene(), level = new Level(scene);
scene.updateMatrixWorld(true);
const meshes = [];
scene.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
const materials = mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material];

// Chaque source doit être un PNG valide et être réellement utilisée dans Level/Door.
for (const [surface, file] of Object.entries(mansionSurfaceAssets)) {
  const bytes = readFileSync(`public/assets/textures/mansion/${file}`);
  assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.ok(bytes.readUInt32BE(16) >= 512 && bytes.readUInt32BE(20) >= 512);
  assert.ok(meshes.some(mesh => materials(mesh).some(mat => mat.map?.name === `mansion-${surface}`)), `${surface} utilisé`);
  assert.equal(mansionMaterial(surface), mansionMaterial(surface), 'Matériau partagé');
}

// Les livres ne doivent pas recouvrir les plateaux ni se répéter en hauteur.
const shelves = meshes.filter(mesh => materials(mesh).some(mat => mat.map?.name === 'mansion-books'));
assert.equal(shelves.length, 2);
for (const shelf of shelves) {
  assert.equal(shelf.material[0].map.name, 'mansion-wood');
  assert.deepEqual(shelf.geometry.groups.map(g => [g.start, g.count, g.materialIndex]), [[0, 24, 0], [24, 12, 1]]);
  const uv = shelf.geometry.getAttribute('uv');
  assert.equal(Math.max(...Array.from({ length: 8 }, (_, i) => uv.getY(i + 16))), 1);
}
const bench = meshes.find(mesh => materials(mesh).some(mat => mat.map?.name === 'mansion-workbench'));
assert.deepEqual(bench.geometry.groups.map(g => [g.start, g.count, g.materialIndex]), [[0, 24, 0], [24, 6, 1], [30, 6, 0]]);

// Les jonctions des tapis utilisent le même repère mondial, sans étirer le motif.
const carpets = meshes.filter(mesh => mesh.material.map?.name === 'mansion-carpet');
assert.equal(carpets.length, 3);
for (const mesh of carpets) {
  const position = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const world = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(position, i));
    assert.ok(Math.abs(uv.getX(i) - world.x / 2.4) < 1e-6);
    assert.ok(Math.abs(uv.getY(i) - world.z / 2.4) < 1e-6);
  }
}

// Les lanternes n'ajoutent ni obstacle au tir ni projecteur d'ombre.
const fixtures = meshes.filter(mesh => mesh.name.startsWith('mansion-light-fixture') || mesh.name === 'mansion-chandelier');
assert.equal(fixtures.length, 6);
assert.ok(fixtures.every(mesh => !mesh.castShadow && !level.getSolidMeshes().includes(mesh)));
let lights = 0, shadows = 0;
scene.traverse(obj => { if (obj.isLight) { lights++; if (obj.castShadow) shadows++; } });
assert.equal(lights, 10); // Neuf lumières existantes + une lumière d'orage sans ombre.
assert.equal(shadows, 2);
console.log('PASS : 8 surfaces utilisées, façades séparées, tapis raccordés, ressources partagées et une lumière d’orage sans ombre.');
