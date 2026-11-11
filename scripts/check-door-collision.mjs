import assert from 'node:assert/strict';
import * as THREE from 'three';

THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const { Door } = await import('../src/Door.ts');

// Calcul précédent conservé comme oracle d'équivalence, indépendant du rejet rapide.
function previousCollision(door, x, z, radius) {
  let qx = x - door.x, qz = z - door.z;
  if (door.axis === 'Z') [qx, qz] = [qz, -qx];
  const angle = door.openProgress * (Math.PI / 2);
  const distance = (ax, az, bx, bz) => {
    const vx = bx - ax, vz = bz - az;
    const lenSq = vx * vx + vz * vz;
    if (lenSq < 0.0001) return Math.hypot(qx - ax, qz - az);
    const t = THREE.MathUtils.clamp(((qx - ax) * vx + (qz - az) * vz) / lenSq, 0, 1);
    return Math.hypot(qx - (ax + t * vx), qz - (az + t * vz));
  };
  const left = -door.passageWidth / 2 + 0.03, right = -left;
  if (distance(left, 0, left + door.leafWidth * Math.cos(angle), -door.leafWidth * Math.sin(angle)) < radius + 0.06) return true;
  if (distance(right, 0, right - door.leafWidth * Math.cos(angle), -door.leafWidth * Math.sin(angle)) < radius + 0.06) return true;
  for (const postX of [-door.passageWidth / 2 - 0.09, door.passageWidth / 2 + 0.09]) {
    const cx = THREE.MathUtils.clamp(qx, postX - 0.09, postX + 0.09);
    const cz = THREE.MathUtils.clamp(qz, -0.2, 0.2);
    if ((qx - cx) ** 2 + (qz - cz) ** 2 < radius * radius) return true;
  }
  return false;
}

let seed = 1907, checked = 0;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
for (const axis of ['X', 'Z']) for (const width of [1.2, 2.6, 4, 7.5]) {
  const door = new Door(new THREE.Scene(), { x: 8.25, y: 2.4, z: -4.75,
    name: 'Équivalence', type: 'interior', axis, passageWidth: width });
  const compare = (x, z, radius) => {
    assert.equal(door.isColliding(x, z, radius), previousCollision(door, x, z, radius),
      `axis=${axis}, width=${width}, progress=${door.openProgress}, x=${x}, z=${z}, radius=${radius}`);
    checked++;
  };
  const world = (x, z) => axis === 'X' ? [door.x + x, door.z + z] : [door.x - z, door.z + x];
  for (const progress of [0, .001, .05, .2, .49, .72, .85, .99, 1]) {
    // Exerce aussi l'invalidation du cache sans appel à applyRotation.
    door.openProgress = progress;
    for (let i = 0; i < 3000; i++) {
      compare(door.x + (random() - .5) * 40, door.z + (random() - .5) * 40, random() * 1.5);
    }
    for (const radius of [0, .03, .3, .45, 1.2]) for (const epsilon of [-1e-9, 0, 1e-9]) {
      // Frontières du volume large et des montants, tangentes incluses.
      for (const [x, z] of [
        [width / 2 + .18 + radius + epsilon, 0],
        [0, .2 + radius + epsilon], [0, -door.leafWidth - .2 - radius - epsilon],
        [-width / 2 - .09, .2 + radius + epsilon],
      ]) compare(...world(x, z), radius);
      const angle = progress * (Math.PI / 2), offset = radius + .06 + epsilon;
      compare(...world(-width / 2 + .03 + door.leafWidth / 2 * Math.cos(angle) + offset * Math.sin(angle),
        -door.leafWidth / 2 * Math.sin(angle) + offset * Math.cos(angle)), radius);
    }
  }
  door.lock();
  compare(...world(0, 0), .3);
  door.unlock(); door.toggle(); door.update(.4, []);
  assert.equal(door.getState(), 'OPENING'); compare(...world(-width / 2 + .4, -.2), .3);
  door.update(2, []); assert.equal(door.getState(), 'OPEN');
  door.toggle();
  door.update(.01, [{ x: door.x, z: door.z, radius: .3 }]);
  assert.equal(door.getState(), 'OPENING', 'Anti-pincement conservé');
  door.resetForNewRun(); assert.equal(door.getState(), 'CLOSED'); compare(...world(0, 0), .3);
}
console.log(`PASS : ${checked} collisions équivalentes, deux axes/altitudes, neuf angles, rayons/tangentes, cache, mouvement et anti-pincement.`);
