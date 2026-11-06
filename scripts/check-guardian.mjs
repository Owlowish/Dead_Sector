import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GuardianZombie } from '../src/GuardianZombie.ts';
import { GuardianProjectile } from '../src/GuardianProjectile.ts';
import { Zombie, disposeAllZombieResources } from '../src/Zombie.ts';
import { guardianConfig } from '../src/FinaleConfig.ts';
import { zombieDeathAnimation } from '../src/ZombieAnimation.ts';

THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};

const fixtures = [];
function fixture() {
  const scene = new THREE.Scene();
  const level = {
    blockers: [], blocked: false, highPlayer: false, ramp: false,
    getFloorHeightAt(_x, z) { return this.highPlayer && z > 1 ? 2.4 : this.ramp ? Math.max(0, z * 0.1) : 0; },
    getSolidMeshes() { return this.blockers; },
    isColliding() { return this.blocked; },
    findNextWaypoint(_start, target) { return this.blocked ? null : target; },
    hasLineOfSight(start, target) {
      const direction = target.clone().sub(start);
      const ray = new THREE.Raycaster(start, direction.clone().normalize(), 0, direction.length());
      for (const blocker of this.blockers) blocker.updateWorldMatrix(true, false);
      return ray.intersectObjects(this.blockers, false).length === 0;
    },
  };
  const boss = new GuardianZombie(scene, level, 0, 0);
  const hits = [];
  const throws = [];
  const f = { scene, level, boss, hits, throws,
    step(delta = 1 / 100, target = new THREE.Vector3(0, 1.7, 2)) {
      boss.update(delta, target, [], (damage) => hits.push(damage), (origin, locked) => throws.push({ origin, target: locked }));
    },
    run(seconds, target = new THREE.Vector3(0, 1.7, 2)) {
      for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 0.01) this.step(Math.min(0.01, seconds - elapsed), target);
    },
  };
  fixtures.push(f);
  return f;
}

const sweep = fixture();
assert.ok(sweep.boss instanceof Zombie, 'compatible avec les menaces et le nettoyage existants');
assert.equal(sweep.boss.getHealth(), 800);
assert.equal(sweep.boss.getPosition().y, guardianConfig.scale);
sweep.step();
assert.equal(sweep.boss.getAttackKind(), 'sweep');
const held = sweep.boss.getPosition().clone();
sweep.run(0.6);
sweep.boss.takeDamage(28);
assert.equal(sweep.boss.getState(), 'ATTACK', 'un tir ne neutralise pas la préparation');
sweep.run(0.49);
assert.deepEqual(sweep.hits, [], 'aucun dégât avant le signal complet');
sweep.run(0.02);
assert.deepEqual(sweep.hits, [24]);
assert.equal(sweep.boss.getState(), 'RECOVER');
assert.ok(sweep.boss.getPosition().equals(held), 'coup et récupération immobiles');
sweep.run(1.5);
assert.equal(sweep.boss.getState(), 'RECOVER');
assert.deepEqual(sweep.hits, [24], 'impact unique');

const dodge = fixture();
dodge.step();
dodge.run(1.2, new THREE.Vector3(3, 1.7, 2));
assert.deepEqual(dodge.hits, [], 'sortir de portée évite le balayage');
assert.equal(dodge.boss.getState(), 'RECOVER');

const wall = fixture();
wall.step();
const blocker = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2));
blocker.position.set(0, 1.5, 1);
wall.level.blockers.push(blocker);
wall.run(1.2);
assert.deepEqual(wall.hits, [], 'une porte refermée pendant le signal bloque le coup');

const altitude = fixture();
altitude.step();
altitude.level.highPlayer = true;
altitude.run(1.2, new THREE.Vector3(0, 4.1, 2));
assert.deepEqual(altitude.hits, [], 'pas de balayage entre les niveaux');

for (const distance of [2.5, 4, 6, 12]) {
  const middle = fixture();
  middle.step(0.01, new THREE.Vector3(0, 1.7, distance));
  assert.equal(middle.boss.getAttackKind(), 'throw', `pas d'anneau sûr à ${distance} m`);
}

const shot = fixture();
const first = new THREE.Vector3(0, 1.7, 8);
const locked = new THREE.Vector3(2, 1.7, 8);
const late = new THREE.Vector3(-4, 1.7, 8);
shot.step(0.01, first);
shot.run(0.74, first);
shot.step(0.02, locked);
shot.boss.takeDamage(440);
assert.equal(shot.boss.getPhase(), 1, 'seuil différé jusqu’à sortie de récupération');
shot.run(0.36, late);
assert.equal(shot.throws.length, 1);
assert.ok(shot.throws[0].target.equals(locked), 'cible fixée pendant les 0,35 dernières secondes');
assert.equal(shot.boss.getState(), 'RECOVER');
shot.run(1.8, late);
assert.equal(shot.boss.getPhase(), 1, 'récupération phase 1 de deux secondes conservée');
shot.run(0.25, late);
assert.equal(shot.boss.getPhase(), 2);
shot.run(1.12, late);
assert.equal(shot.throws.length, 2);
shot.run(1.5, late);
assert.equal(shot.boss.getState(), 'RECOVER', 'phase 2 laisse une ouverture de 1,6 s');
shot.run(0.15, late);
assert.notEqual(shot.boss.getState(), 'RECOVER', 'la récupération phase 2 ne garde pas les deux secondes');
const health = shot.boss.getHealth();
shot.boss.takeDamage(health + 50);
assert.equal(shot.boss.getHealth(), 0, 'aucun dégât perdu au seuil');
assert.equal(shot.boss.isThreat(), false);
shot.run(4, late);
for (let i = 0; i < 400; i++) shot.boss.updateDeath(0.01, late);
assert.equal(shot.boss.isAlive(), false, 'aucune relève');
assert.equal(shot.throws.length, 2, 'aucun projectile après mort');

const falling = fixture();
falling.level.ramp = true;
falling.boss.getPosition().set(0, 1.2 + guardianConfig.scale, 12);
falling.boss.takeDamage(1000);
const corpse = falling.scene.children.find((object) => object !== falling.boss.getMesh());
assert.equal(corpse.scale.x, guardianConfig.scale, 'la chute garde la taille du Gardien');
let elapsedDeath = 0;
let poseStart = 0;
for (const pose of zombieDeathAnimation.frames) {
  const at = poseStart + pose.duration / 2;
  falling.boss.updateDeath(at - elapsedDeath, late);
  elapsedDeath = at;
  const localGroundY = (pose.y + pose.height / 2 - pose.groundY) / zombieDeathAnimation.pixelsPerUnit;
  const ground = corpse.localToWorld(new THREE.Vector3(0, localGroundY, 0));
  assert.ok(Math.abs(ground.y - 1.2 - zombieDeathAnimation.floorHeight) < 1e-8, 'appui stable pendant la chute surélevée');
  poseStart += pose.duration;
}

const killedInWindup = fixture();
killedInWindup.step(0.01, first);
killedInWindup.boss.takeDamage(1000);
killedInWindup.run(2, first);
assert.deepEqual(killedInWindup.throws, [], 'mort prioritaire pendant la préparation');

const frozen = fixture();
frozen.step(0.01, first);
frozen.run(0.5, first);
for (let i = 0; i < 100; i++) frozen.step(0, late);
assert.deepEqual(frozen.throws, [], 'delta nul ne consomme pas le signal');
frozen.run(0.61, first);
assert.equal(frozen.throws.length, 1);

const route = fixture();
route.level.ramp = true;
route.level.blocked = true;
const far = new THREE.Vector3(0, 4, 25);
const before = route.boss.getPosition().clone();
route.run(1, far);
assert.ok(route.boss.getPosition().equals(before), 'collision conservée');
route.level.blocked = false;
route.run(0.5, far);
assert.ok(route.boss.getPosition().z > before.z, 'poursuite hors portée de jet');
assert.ok(Math.abs(route.boss.getPosition().y - guardianConfig.scale
  - route.level.getFloorHeightAt(route.boss.getPosition().x, route.boss.getPosition().z)) < 1e-9, 'appui commun sur les rampes');

function projectileTest({ target, player, wallZ, delta = 0.5 }) {
  const scene = new THREE.Scene();
  const projectile = new GuardianProjectile(scene, new THREE.Vector3(0, 1.7, 0), target);
  const blockers = [];
  if (wallZ !== undefined) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.2));
    wall.position.set(0, 1.7, wallZ);
    blockers.push(wall);
  }
  const hits = [];
  const alive = projectile.update(delta, scene, { getSolidMeshes: () => blockers }, player, (damage) => hits.push(damage));
  projectile.dispose(scene);
  assert.equal(scene.children.length, 0);
  for (const wall of blockers) { wall.geometry.dispose(); wall.material.dispose(); }
  return { hits, alive };
}
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(0, 1.7, 6) }).hits, [18], 'segment balayé sans traverser le joueur');
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(0, 1.7, 6), wallZ: 3 }).hits, [], 'premier obstacle avant joueur');
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(3, 1.7, 6) }).hits, [], 'esquive latérale');
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(0, 4.1, 6) }).hits, [], 'aucune extension verticale du volume');
assert.deepEqual(projectileTest({ target: first, player: new THREE.Vector3(0, 1.7, 49), delta: 10 }).hits, [], 'aucun trajet après trois secondes');
assert.equal(projectileTest({ target: first, player: first, delta: 0 }).alive, true, 'projectile suspendu hors simulation');

const sprintScene = new THREE.Scene();
const chaseKey = new GuardianProjectile(sprintScene, new THREE.Vector3(0, 1.7, 0), first);
const sprintHits = [];
for (let time = 0.01; time < 3; time += 0.01) {
  if (!chaseKey.update(0.01, sprintScene, { getSolidMeshes: () => [] },
    new THREE.Vector3(0, 1.7, 8 + 9 * time), (damage) => sprintHits.push(damage))) break;
}
assert.deepEqual(sprintHits, [18], 'le sprint arrière à 9 m/s ne suffit pas contre un jet aligné');
assert.equal(chaseKey.update(1, sprintScene, { getSolidMeshes: () => [] }, first, () => assert.fail('impact tardif')), false);
chaseKey.dispose(sprintScene);
assert.equal(sprintScene.children.length, 0);

for (const f of fixtures) {
  f.boss.dispose(f.scene);
  f.boss.dispose(f.scene);
  assert.equal(f.scene.children.length, 0, 'nettoyage idempotent du boss et du cadavre');
}
blocker.geometry.dispose();
blocker.material.dispose();
disposeAllZombieResources();
console.log('Gardien : deux attaques, signal complet, cible verrouillée, phase différée, décès, obstacles, altitude, pauses et nettoyage : OK');
