import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { MansionPortraits, PORTRAIT_DEPTH } from '../src/MansionPortraits.ts';
import { composedPortraits } from '../src/MansionComposition.ts';
import { MANSION_WALLS, getMansionFloorHeight } from '../src/MansionConfig.ts';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const loadedTextures = [];
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  loadedTextures.push(texture);
  return texture;
};
const { Level } = await import('../src/Level.ts');

const scene = new THREE.Scene();
const portraits = new MansionPortraits(scene);
const group = scene.getObjectByName('mansion-portraits');
assert.ok(group);
assert.equal(composedPortraits.length, 6);
assert.equal(group.children.length, 4, 'Fusion par pièce habitée, sans mesh vide');
assert.equal(loadedTextures.length, 1, 'Une seule texture pour les six tableaux');
assert.equal(new Set(group.children.map(mesh => mesh.material)).size, 1);
const material = group.children[0].material;
assert.equal(material.map, loadedTextures[0]);
assert.equal(material.map.userData.url, '/assets/textures/portrait_v2.png');
assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
assert.equal(material.map.magFilter, THREE.NearestFilter);
assert.equal(material.map.minFilter, THREE.NearestMipmapNearestFilter);
assert.equal(material.side, THREE.FrontSide, 'Les faces visibles doivent avoir le bon winding');
assert.equal(material.transparent, false);
assert.equal(scene.getObjectsByProperty('isLight', true).length, 0);
const image = readFileSync(`public${material.map.userData.url}`);
const imageRatio = image.readUInt32BE(16) / image.readUInt32BE(20);

const supportMaterial = new THREE.MeshBasicMaterial();
const supportMeshes = MANSION_WALLS.filter(wall => wall.materialType === 'wall').map(wall => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.width, wall.height, wall.depth), supportMaterial);
  mesh.position.set(wall.x, wall.y, wall.z);
  mesh.updateMatrixWorld(true);
  return mesh;
});
group.updateWorldMatrix(true, true);
let triangles = 0;
let geometryBytes = 0;
for (const mesh of group.children) {
  assert.equal(mesh.castShadow, false, 'Pas de nouvelle passe d’ombres');
  assert.equal(mesh.receiveShadow, true);
  assert.equal(mesh.matrixAutoUpdate, false);
  assert.equal(mesh.geometry.groups.length, 0, 'Un seul appel par pièce visible');
  assert.ok(mesh.geometry.boundingBox && mesh.geometry.boundingSphere, 'Culling disponible');
  triangles += mesh.geometry.index.count / 3;
  geometryBytes += mesh.geometry.index.array.byteLength;
  for (const attribute of Object.values(mesh.geometry.attributes)) geometryBytes += attribute.array.byteLength;
  const placements = composedPortraits.filter(item => mesh.name === `mansion-portraits-${item.roomId}`);
  const positions = mesh.geometry.getAttribute('position');
  const normals = mesh.geometry.getAttribute('normal');
  const uv = mesh.geometry.getAttribute('uv');
  assert.equal(positions.count, placements.length * 24);
  for (let partIndex = 0; partIndex < placements.length; partIndex++) {
    const item = placements[partIndex];
    assert.ok(Math.abs(item.width / item.height - imageRatio) < 1e-10,
      'L’image conserve son rapport 3:4 sur le mur');
    const center = new THREE.Vector3(item.x, getMansionFloorHeight(item.x, item.z) + item.centerY, item.z);
    const facing = new THREE.Vector3(Math.sin(item.rotationY), 0, Math.cos(item.rotationY));
    const localBounds = new THREE.Box3();
    const frontUV = new Set();
    let frontVertices = 0;
    for (let i = partIndex * 24; i < (partIndex + 1) * 24; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i).sub(center)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -item.rotationY);
      localBounds.expandByPoint(point);
      const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
      assert.ok(Math.abs(normal.length() - 1) < 1e-6);
      if (normal.dot(facing) > 0.99) {
        frontVertices++;
        assert.ok(Math.abs(point.z) < 1e-5, 'L’image est sur la face avant, sans translation parasite');
        frontUV.add(`${uv.getX(i)},${uv.getY(i)}`);
      } else {
        assert.ok(Math.abs(uv.getX(i) - 0.006) < 1e-8 && Math.abs(uv.getY(i) - 0.006) < 1e-8,
          'Les chants échantillonnent le coin sombre, sans étirer le portrait');
      }
    }
    assert.equal(frontVertices, 4);
    assert.deepEqual(frontUV, new Set(['0,0', '0,1', '1,0', '1,1']), 'Toute l’image originale couvre la face avant');
    const size = localBounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x - item.width) < 1e-5 && Math.abs(size.y - item.height) < 1e-5);
    assert.ok(Math.abs(size.z - 0.09) < 1e-5 && Math.abs(size.z - PORTRAIT_DEPTH) < 1e-5,
      'Épaisseur réelle de neuf centimètres');
    assert.ok(Math.abs(localBounds.max.z) < 1e-5 && Math.abs(localBounds.min.z + 0.09) < 1e-5);

    // Le rayon part de la pièce : le FrontSide suffit à voir le recto.
    const hits = new THREE.Raycaster(center.clone().add(facing), facing.clone().negate(), 0, 1.2).intersectObject(mesh);
    assert.ok(hits.length > 0, `${item.id} visible depuis la pièce`);
    assert.ok(Math.abs(hits[0].distance - 1) < 1e-5 && hits[0].face.normal.dot(facing) > 0.99);
    // Le dos ne pénètre pas la paroi ; quatre coins plus le centre ont un appui plein.
    for (const [x, y] of [[0, 0], [-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]]) {
      const back = new THREE.Vector3(item.width * x, item.height * y, -PORTRAIT_DEPTH)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), item.rotationY).add(center);
      const supportHits = new THREE.Raycaster(back, facing.clone().negate(), 0, 0.02).intersectObjects(supportMeshes);
      assert.ok(supportHits.length > 0, `${item.id} adossé à une paroi pleine`);
      assert.ok(Math.abs(supportHits[0].distance - 0.005) < 1e-5, 'Cinq millimètres entre dos et mur');
    }
  }
}
assert.equal(triangles, 72);
assert.equal(geometryBytes, 5040, 'Géométries fusionnées compactes');
for (const mesh of supportMeshes) mesh.geometry.dispose();
supportMaterial.dispose();

const levelScene = new THREE.Scene();
const level = new Level(levelScene);
assert.ok(levelScene.getObjectByName('mansion-portraits'), 'Level construit le composant');
level.disposeDecor();
assert.equal(levelScene.getObjectByName('mansion-portraits'), undefined, 'Level retire le composant lors du nettoyage');

let disposed = 0;
const resources = new Set(group.children.map(mesh => mesh.geometry));
resources.add(material); resources.add(material.map);
for (const resource of resources) resource.addEventListener('dispose', () => disposed++);
portraits.dispose(); portraits.dispose();
assert.equal(disposed, resources.size, 'Chaque ressource est libérée exactement une fois');
assert.equal(group.parent, null);
console.log(`PASS : six portraits, quatre batches/${triangles} triangles/${geometryBytes} octets ; UV recto, chants, épaisseur, supports, winding, intégration Level et nettoyage.`);
