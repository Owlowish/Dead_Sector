import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { readSpritePng, alphaBounds } from './sprite-png-info.mjs';
import { getHearthFireFrame, hearthFireAnimation as animation } from '../src/HearthFireAnimation.ts';

const loadCallbacks = [];
THREE.TextureLoader.prototype.load = function (url, onLoad) {
  assert.equal(url, animation.url);
  const texture = new THREE.Texture();
  loadCallbacks.push(() => onLoad?.(texture));
  return texture;
};
const { HearthFire } = await import('../src/HearthFire.ts');
assert.equal(animation.duration, animation.frames / animation.fps);
assert.equal(animation.frameWidth * animation.columns, animation.atlasWidth);
assert.equal(animation.frameHeight * animation.rows, animation.atlasHeight);
assert.equal(animation.frames, animation.columns * animation.rows);
assert.equal(getHearthFireFrame(0), 0);
assert.equal(getHearthFireFrame(0.099), 0);
assert.equal(getHearthFireFrame(0.1), 1);
assert.equal(getHearthFireFrame(0.7), 7);
assert.equal(getHearthFireFrame(animation.duration - 1e-6), 7);
assert.equal(getHearthFireFrame(animation.duration), 0);
for (const time of [NaN, Infinity, -1]) assert.equal(getHearthFireFrame(time), 0);
for (let i = 0; i < 3000; i++) {
  const frame = getHearthFireFrame(i / 144);
  assert.ok(Number.isInteger(frame) && frame >= 0 && frame < animation.frames);
}

function make() {
  const scene = new THREE.Scene();
  const fire = new HearthFire(scene, new THREE.Vector3(-13.1, 0.72, 13));
  const mesh = scene.getObjectByName('hearth-fire');
  return { scene, fire, mesh, texture: mesh.material.map };
}
const a = make(), b = make();
assert.equal(a.scene.children.length, 1);
assert.ok(a.mesh.isMesh);
assert.equal(a.mesh.geometry.index.count / 3, 2, 'Deux triangles, une seule surface');
assert.equal(a.mesh.geometry.groups.length, 0, 'Un appel principal au plus');
assert.ok(!a.mesh.castShadow && !a.mesh.receiveShadow);
assert.ok(a.mesh.material.isMeshBasicMaterial && a.mesh.material.transparent && !a.mesh.material.depthWrite);
assert.equal(a.mesh.material.toneMapped, false);
assert.equal(a.mesh.material.side, THREE.DoubleSide);
assert.equal(a.mesh.material.forceSinglePass, true, 'Le plan transparent recto-verso reste en une seule passe');
assert.equal(a.texture.generateMipmaps, false);
assert.equal(a.texture.magFilter, THREE.NearestFilter);
assert.equal(a.texture.minFilter, THREE.NearestFilter);
assert.equal(a.texture.colorSpace, THREE.SRGBColorSpace);
assert.equal(a.mesh.visible, false, 'Pas de rectangle opaque avant le chargement');
loadCallbacks[0]();
assert.equal(a.mesh.visible, true);
assert.ok(Math.abs(a.mesh.rotation.y - Math.PI / 2) < 1e-8, 'Face orientée vers +X, dans l’ouverture');
const geometry = a.mesh.geometry, textureVersion = a.texture.version;
const before = a.texture.offset.clone();
for (const delta of [0, NaN, Infinity, -1]) a.fire.update(delta);
assert.ok(a.texture.offset.equals(before), 'Pause et entrées invalides figent la pose');

for (let i = 0; i < 8; i++) {
  const frame = a.fire.frame;
  const column = frame % animation.columns, row = Math.floor(frame / animation.columns);
  const bottom = 1 - (row + 1) / animation.rows;
  assert.ok(a.texture.offset.x > column / animation.columns);
  assert.ok(a.texture.offset.x + a.texture.repeat.x < (column + 1) / animation.columns);
  assert.ok(a.texture.offset.y > bottom);
  assert.ok(a.texture.offset.y + a.texture.repeat.y < bottom + 1 / animation.rows);
  a.fire.update(0.1);
}
assert.equal(a.fire.frame, 0, 'Retour à la première cellule après un cycle');
assert.equal(a.mesh.geometry, geometry, 'Aucune nouvelle géométrie par image');
assert.equal(a.texture.version, textureVersion, 'Changer les UV ne redemande pas un upload');
for (let i = 0; i < 30 * 11; i++) a.fire.update(1 / 30);
for (let i = 0; i < 144 * 11; i++) b.fire.update(1 / 144);
assert.equal(a.fire.frame, b.fire.frame, 'Cadence identique à 30 et 144 Hz');
assert.ok(a.texture.offset.distanceTo(b.texture.offset) < 1e-10);

let geometryDisposals = 0, materialDisposals = 0, textureDisposals = 0;
a.mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
a.mesh.material.addEventListener('dispose', () => materialDisposals++);
a.texture.addEventListener('dispose', () => textureDisposals++);
a.fire.dispose(); a.fire.dispose(); a.fire.update(0.1);
loadCallbacks[0]();
assert.equal(a.scene.children.length, 0, 'Un chargement tardif ne replace pas le feu');
assert.deepEqual([geometryDisposals, materialDisposals, textureDisposals], [1, 1, 1]);
b.fire.dispose();

const pending = make();
pending.fire.dispose();
loadCallbacks[2]();
assert.equal(pending.mesh.visible, false, 'Un chargement reçu après destruction ne rend jamais la surface visible');
assert.equal(pending.scene.children.length, 0);

const path = `public${animation.url}`;
assert.ok(existsSync(path), 'Atlas du feu présent pour son intégration');
{
  const png = readFileSync(path);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), animation.atlasWidth);
  assert.equal(png.readUInt32BE(20), animation.atlasHeight);
  const image = readSpritePng(path), poses = new Set();
  for (let frame = 0; frame < animation.frames; frame++) {
    const left = frame % animation.columns * animation.frameWidth, top = Math.floor(frame / animation.columns) * animation.frameHeight;
    const bounds = alphaBounds(image, {x:left,y:top,width:128,height:128});
    assert.ok(bounds.x > left && bounds.x + bounds.width < left + 128, 'Marge transparente entre les poses');
    assert.equal(bounds.y - top + bounds.height - 1, 114, 'Racine stable sur les huit poses');
    const pixels = [];
    for (let y = top; y < top + 128; y++) pixels.push(image.data.subarray((y * image.width + left) * 4, (y * image.width + left + 128) * 4));
    poses.add(Buffer.concat(pixels).toString('base64'));
  }
  assert.equal(poses.size, 8, 'Les huit poses sont réellement différentes');
}

// Contrôle dans la géométrie réelle de l'âtre, sans lancer un navigateur.
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
const { Level } = await import('../src/Level.ts');
const levelScene = new THREE.Scene(), level = new Level(levelScene);
levelScene.updateMatrixWorld(true);
const integrated = levelScene.getObjectByName('hearth-fire');
assert.ok(integrated && !level.getSolidMeshes().includes(integrated), 'Le feu ne devient pas un obstacle');
const fireBounds = new THREE.Box3().setFromObject(integrated);
assert.ok(integrated.position.x > -13.35 && integrated.position.x < -13.25, 'Devant la brique et au-dessus des braises');
assert.ok(fireBounds.min.z > 11.65 && fireBounds.max.z < 14.35, 'Feu contenu entre les deux jambages');
const rootY = integrated.position.y + 1.28 / 2 - 114.5 / 128 * 1.28;
assert.ok(Math.abs(rootY - 0.14) < 1e-6, 'Racine sur le haut du lit de braises');
const frozenOffset = integrated.material.map.offset.clone();
level.update(0.1, 0);
assert.ok(integrated.material.map.offset.equals(frozenOffset), 'Pause du feu reçue depuis Level');
level.update(0.1, 0.1);
assert.ok(!integrated.material.map.offset.equals(frozenOffset));
level.disposeDecor();
assert.equal(integrated.parent, null, 'Nettoyage relié au niveau');
console.log('PASS : feu8poses/10Hz, UV isolés, pause et delta30/144Hz, deux triangles, zéro lumière/ombre et nettoyage unique.');
