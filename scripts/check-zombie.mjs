import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Zombie } from '../src/Zombie.ts';

// Sans DOM/WebGL : seules les règles, textures choisies et coordonnées UV sont testées.
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};
function fixture() {
  const scene = new THREE.Scene();
  const level = {
    blockers: [], blocked: false,
    isColliding() { return this.blocked; },
    getSolidMeshes() { return this.blockers; },
    findNextWaypoint(_start, target) { return this.blocked ? null : target; },
  };
  const zombie = new Zombie(scene, level, 0, 0);
  const hits = [];
  return { scene, level, zombie, hits, step(delta, z = 1.2) {
    zombie.update(delta, new THREE.Vector3(0, 1.7, z), [], damage => hits.push(damage));
  } };
}
const attack = fixture();
attack.step(0);
assert.match(attack.zombie.getMesh().material.map.userData.url, /attack/);
for (let i = 0; i < 11; i++) attack.step(0.05);
assert.equal(attack.hits.length, 0, 'Préparation sans dégâts');
attack.step(0.06);
assert.deepEqual(attack.hits, [10]);
const attackUv1 = attack.zombie.getMesh().geometry.getAttribute('uv');
assert.equal(attackUv1.getX(2), 0.5, 'Pose du coup au moment des dégâts via UV de géométrie');
attack.step(0.15);
const attackUv2 = attack.zombie.getMesh().geometry.getAttribute('uv');
assert.equal(attackUv2.getX(2), 0.75, 'Pose de récupération via UV de géométrie');
attack.step(0.2);
assert.equal(attack.hits.length, 1, 'Un seul coup pour une animation');

const escape = fixture();
escape.step(0);
escape.step(0.2);
escape.step(0.05, 4);
for (let i = 0; i < 10; i++) escape.step(0.05, 4);
assert.equal(escape.hits.length, 0, 'Sortie de portée annule le coup');
assert.doesNotMatch(escape.zombie.getMesh().material.map.userData.url, /attack/);

const wall = fixture();
wall.step(0);
wall.level.blockers.push(new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.2)));
wall.level.blockers[0].position.set(0, 1, 0.6);
for (let i = 0; i < 15; i++) wall.step(0.05);
assert.equal(wall.hits.length, 0, 'Obstacle ajouté pendant la préparation annule le coup');

const dead = fixture();
dead.step(0);
dead.zombie.takeDamage(100);
for (let i = 0; i < 20; i++) dead.step(0.05);
assert.equal(dead.hits.length, 0, 'Mort pendant préparation : aucun coup tardif');

const walk = fixture();
for (let i = 0; i < 10; i++) walk.step(0.05, 6);
const mesh = walk.zombie.getMesh();
assert.match(mesh.material.map.userData.url, /walk_v2/);
const walkUv = mesh.geometry.getAttribute('uv');
assert(Math.abs(walkUv.getY(2) - 0.02) < 1e-6, 'Deuxième ligne de marche, UV inversés');
assert.equal(mesh.customDepthMaterial.map, mesh.material.map, 'Ombre directionnelle synchronisée');
assert.equal(mesh.customDistanceMaterial.map, mesh.material.map, 'Ombre ponctuelle synchronisée');
walk.level.blocked = true;
walk.step(0.05, 6);
assert.match(mesh.material.map.userData.url, /idle/);
const other = fixture();
assert.equal(other.zombie.getMesh().material.map, mesh.material.map, 'Textures partagées en cache réutilisable');
assert.notEqual(other.zombie.getMesh().material, mesh.material, 'Matériaux et couleurs propres à chaque instance');

const hurt = fixture();
hurt.step(0);
hurt.step(0.5);
hurt.zombie.takeDamage(40);
assert.match(hurt.zombie.getMesh().material.map.userData.url, /hurt/);
const heldPosition = hurt.zombie.getPosition().clone();
// Inclure un voisin superposé : même la séparation doit être suspendue.
const neighbour = fixture();
for (let i = 0; i < 4; i++) {
  hurt.zombie.update(0.05, new THREE.Vector3(0, 1.7, 6), [neighbour.zombie], damage => hurt.hits.push(damage));
  assert(hurt.zombie.getPosition().equals(heldPosition), 'Aucun déplacement pendant la blessure');
}
assert.equal(hurt.hits.length, 0, 'Ancienne attaque annulée par la blessure');
const hurtUv = hurt.zombie.getMesh().geometry.getAttribute('uv');
assert.equal(hurtUv.getX(2), 0.5, 'Deuxième pose de blessure via UV');
assert.equal(hurt.zombie.getMesh().customDistanceMaterial.map, hurt.zombie.getMesh().material.map);
hurt.step(0.05, 6);
assert(hurt.zombie.getPosition().distanceTo(heldPosition) > 0, 'Reprise de la poursuite après arrêt');

const interrupted = fixture();
interrupted.step(0);
interrupted.step(0.5);
interrupted.zombie.takeDamage(40);
for (let i = 0; i < 5; i++) interrupted.step(0.05);
interrupted.step(0); // Nouvelle préparation, sans reprendre les 0,5 s précédentes.
for (let i = 0; i < 10; i++) interrupted.step(0.05);
assert.equal(interrupted.hits.length, 0, 'Nouvelle préparation complète exigée');
for (let i = 0; i < 3; i++) interrupted.step(0.05);
assert.deepEqual(interrupted.hits, [10]);

for (const f of [attack, escape, wall, dead, walk, other, hurt, neighbour, interrupted]) f.zombie.dispose(f.scene);
console.log('OK : marche, UV, ombres, préparation, impact unique, récupération, annulation portée/mur/mort et indépendance.');
console.log('OK : blessure à deux poses, arrêt incluant séparation, interruption et reprise sans coup tardif.');
