import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MansionAtmosphere, mansionDustVolumes, mansionAtmosphereBudget } from '../src/MansionAtmosphere.ts';
import { MANSION_ROOMS, MANSION_WALLS, getMansionFloorHeight } from '../src/MansionConfig.ts';

function make() {
  const scene = new THREE.Scene(), atmosphere = new MansionAtmosphere(scene);
  return { scene, atmosphere, clouds: [...scene.getObjectByName('mansion-atmosphere').children] };
}
const a = make(), b = make();
assert.equal(a.clouds.length, MANSION_ROOMS.length);
assert.equal(new Set(a.clouds.map(x => x.material)).size, 1, 'Un matériau pour tout le manoir');
assert.equal(a.clouds.reduce((sum, x) => sum + x.geometry.getAttribute('position').count, 0), 144);
assert.equal(a.clouds[0].material.map, null, 'Aucun sampler de texture ajouté');
assert.ok(a.clouds.every(x => !x.castShadow && !x.material.depthWrite));
const snapshot = a.clouds.map(x => [...x.geometry.getAttribute('position').array]);
for (const delta of [0, -1, NaN, Infinity]) a.atmosphere.update(delta);
a.clouds.forEach((x, i) => assert.deepEqual([...x.geometry.getAttribute('position').array], snapshot[i], 'Pause sans mouvement'));
for (let i = 0; i < 30 * 20; i++) a.atmosphere.update(1 / 30);
for (let i = 0; i < 144 * 20; i++) b.atmosphere.update(1 / 144);
for (let cloud = 0; cloud < a.clouds.length; cloud++) {
  const x = a.clouds[cloud], y = b.clouds[cloud], spec = mansionDustVolumes[cloud];
  const room = MANSION_ROOMS.find(room => room.id === spec.roomId);
  const positions = x.geometry.getAttribute('position');
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    assert.ok(x.geometry.boundingBox.containsPoint(point), 'Bornes de culling couvrent la dérive');
    assert.ok(point.distanceTo(new THREE.Vector3().fromBufferAttribute(y.geometry.getAttribute('position'), i)) < 1e-5, 'Mouvement indépendant de la fréquence d’image');
    point.add(x.position);
    assert.ok(point.x > room.bounds.minX && point.x < room.bounds.maxX && point.z > room.bounds.minZ && point.z < room.bounds.maxZ, 'Points confinés à leur pièce');
    const floor = getMansionFloorHeight(point.x, point.z), ceiling = point.z > 6 ? 4 : 6.4;
    assert.ok(point.y > floor && point.y < ceiling, 'Pas de points sous le sol ou dans le plafond');
    for (const wall of MANSION_WALLS) {
      assert.ok(!(Math.abs(point.x - wall.x) < wall.width / 2 && Math.abs(point.y - wall.y) < wall.height / 2 && Math.abs(point.z - wall.z) < wall.depth / 2), 'Point hors solides existants');
    }
  }
}
const geometryDisposals = a.clouds.map(() => 0); let materialDisposals = 0;
a.clouds.forEach((x, i) => x.geometry.addEventListener('dispose', () => geometryDisposals[i]++));
a.clouds[0].material.addEventListener('dispose', () => materialDisposals++);
a.atmosphere.dispose(); a.atmosphere.dispose(); a.atmosphere.update(1 / 30);
assert.equal(a.scene.children.length, 0);
assert.ok(geometryDisposals.every(n => n === 1)); assert.equal(materialDisposals, 1);
assert.equal(mansionAtmosphereBudget.maxDrawCalls, 6);
b.atmosphere.dispose();
console.log('PASS : poussières144points/6pièces, volumes libres, bornes, delta30/144Hz, pause, zéro texture/lumière, libération unique.');
