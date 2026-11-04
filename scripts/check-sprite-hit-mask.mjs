import assert from 'node:assert/strict';
import * as THREE from 'three';
import { prepareSpriteHitMask, isOpaqueSpriteHit, isHeadSpriteHit } from '../src/SpriteHitMask.ts';

let reads = 0;
globalThis.document = {
  createElement() {
    return {
      width: 0, height: 0,
      getContext() {
        return {
          drawImage() {},
          getImageData() {
            reads++;
            // Ligne du haut : opaque, transparente. Ligne du bas : transparente, opaque.
            return { data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255]) };
          },
        };
      },
    };
  },
};
const texture = new THREE.Texture({ width: 2, height: 2 });
const material = new THREE.MeshStandardMaterial({ map: texture, alphaTest: 0.4 });
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
prepareSpriteHitMask(texture);
prepareSpriteHitMask(texture);
assert.equal(reads, 1, 'le masque est préparé une seule fois');
assert.equal(isOpaqueSpriteHit(mesh, new THREE.Vector2(0.25, 0.75)), true);
assert.equal(isOpaqueSpriteHit(mesh, new THREE.Vector2(0.75, 0.75)), false);
assert.equal(isOpaqueSpriteHit(mesh, new THREE.Vector2(0.25, 0.25)), false);
assert.equal(isOpaqueSpriteHit(mesh, new THREE.Vector2(0.75, 0.25)), true);
const portrait = new THREE.Texture({ width: 230, height: 403, src: '/assets/zombies/zombie_idle.png' });
const portraitMesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ map: portrait }));
assert.equal(isHeadSpriteHit(portraitMesh, new THREE.Vector2(150 / 230, 1 - 60 / 403)), true);
assert.equal(isHeadSpriteHit(portraitMesh, new THREE.Vector2(150 / 230, 1 - 220 / 403)), false);
console.log('Masque alpha partagé et inversion verticale des UV : OK');
