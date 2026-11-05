import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';

THREE.TextureLoader.prototype.load = function(url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};
const { mansionWallMaterial } = await import('../src/MansionWallMaterial.ts');
const { MANSION_BUDGET, MANSION_WALLS } = await import('../src/MansionConfig.ts');
const { Level } = await import('../src/Level.ts');

const scene = new THREE.Scene(), level = new Level(scene);
let walls = 0, trims = 0, points = 0, shadows = 0;
scene.traverse(object => {
  if (object.isPointLight) points++;
  if (object.isLight && object.castShadow) shadows++;
  if (!object.isMesh) return;
  for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
    if (material.name === 'mansion-wall-bands') {
      walls++;
      assert.equal(material, mansionWallMaterial(), 'Les pièces partagent le matériau mural');
      assert.ok(!Array.isArray(object.material), 'Un seul matériau sur chaque mur');
      assert.equal(object.geometry.groups.length, 0, 'Aucun groupe additionnel');
      assert.ok(level.getSolidMeshes().includes(object), 'Le mur conserve sa responsabilité physique');
    }
    if (!material.name.startsWith('salon-')) continue;
    assert.equal(material.name, 'salon-wood', 'Le damas du Salon est remplacé par l’atlas commun');
    const original = material.userData.salonOriginalMap;
    assert.ok(original?.isTexture, 'Texture originale disponible pour A/B');
    assert.deepEqual(material.map.repeat.toArray(), original.repeat.toArray());
    trims++;
  }
});
assert.equal(walls, MANSION_WALLS.filter(wall => wall.materialType === 'wall' && !wall.surface).length);
assert.equal(walls, 14); assert.equal(trims, 3);
assert.ok(points <= MANSION_BUDGET.maxPointLights); assert.ok(shadows <= MANSION_BUDGET.maxShadowCastingLights);
for (const [file, width, height] of [['wall-bands-v1.png', 256, 512], ['salon-wood-v1.png', 512, 512]]) {
  const path = `public/assets/textures/mansion/${file}`;
  assert.ok(existsSync(path), `Asset présent : ${path}`);
  const png = readFileSync(path);
  assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), height);
}
console.log('PASS : 14 murs à matériau partagé, 3 encadrements Salon conservés, aucun groupe supplémentaire, bloqueurs de tirs et budget lumineux préservés.');
