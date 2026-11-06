import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Zombie, disposeAllZombieResources } from '../src/Zombie.ts';
import { ENCOUNTER_CONFIGS } from '../src/EncounterConfig.ts';
import { visualColors } from '../src/VisualStyle.ts';
import { zombieDeathAnimation } from '../src/ZombieAnimation.ts';
import { ZombieRemains } from '../src/ZombieRemains.ts';

THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData.url = url;
  return texture;
};

const fixtures = [];
function fixture({ elite = true, floor = 0, ramp = false } = {}) {
  const scene = new THREE.Scene();
  const level = {
    blockers: [], blocked: false,
    getFloorHeightAt(_x, z) { return floor + (ramp ? Math.max(0, z) * 0.2 : 0); },
    getSolidMeshes() { return this.blockers; },
    isColliding() { return this.blocked; },
    findNextWaypoint(_start, target) { return this.blocked ? null : target; },
  };
  // Même API que les ennemis existants ; random=0 déclencherait une relève normale.
  const zombie = new Zombie(scene, level, 0, 0, 'standard', () => 0, { elite });
  const hits = [];
  const target = new THREE.Vector3(0, floor + 1.7, 1.8);
  const f = { scene, level, zombie, hits, target,
    step(delta = 1 / 32, position = target, others = []) {
      zombie.update(delta, position, others, (damage) => hits.push(damage));
    },
    run(seconds, position = target, others = []) {
      assert.ok(Number.isInteger(seconds * 32), 'durée exacte en pas de 1/32 s');
      for (let i = 0; i < seconds * 32; i++) this.step(1 / 32, position, others);
    },
  };
  fixtures.push(f);
  return f;
}

const normal = fixture({ elite: false });
const charged = fixture();
assert.equal(normal.zombie.isElite(), false);
assert.equal(charged.zombie.isElite(), true);
assert.equal(charged.zombie.getKind(), 'standard', 'aucun nouveau type dans les quotas/masques');
assert.equal(charged.zombie.getMesh().geometry, normal.zombie.getMesh().geometry);
assert.equal(charged.zombie.getMesh().material.map, normal.zombie.getMesh().material.map, 'sprites et UV standards réutilisés');
assert.notEqual(charged.zombie.getMesh().material, normal.zombie.getMesh().material, 'la télégraphie ne recolore pas les standards');
assert.ok(charged.zombie.getMesh().scale.x > 1 && charged.zombie.getMesh().scale.x <= 1.2, 'silhouette agrandie modérément');
assert.equal(charged.zombie.getPosition().y - charged.zombie.getMesh().scale.y, 0, 'appui de la silhouette agrandie au sol');

// Préparation lente, deux poses lisibles, impact unique puis véritable récupération.
charged.step(0);
assert.equal(charged.zombie.getState(), 'ATTACK');
assert.equal(charged.zombie.getMesh().material.color.getHex(), visualColors.warning);
assert.ok(charged.zombie.getMesh().material.emissiveIntensity > 0, 'avertissement visible dans la pénombre');
const start = charged.zombie.getPosition().clone();
const neighbour = fixture();
neighbour.zombie.getPosition().x = 0.1;
charged.run(0.5, charged.target, [neighbour.zombie]);
assert.equal(charged.zombie.getMesh().geometry.getAttribute('uv').getX(2), 0.25, 'pose armée conservée avant le coup');
charged.run(0.5, charged.target, [neighbour.zombie]);
assert.equal(charged.hits.length, 0, 'aucun dégât avant la charge de 1,1 s');
assert.ok(charged.zombie.getPosition().equals(start), 'ni poursuite ni séparation pendant la charge');
charged.run(0.125);
assert.deepEqual(charged.hits, [24]);
assert.equal(charged.zombie.getState(), 'RECOVER');
assert.equal(charged.zombie.getMesh().geometry.getAttribute('uv').getX(2), 0.5, 'pose du coup synchronisée avec ses dégâts');
assert.equal(charged.zombie.getMesh().material.emissiveIntensity, 0);
charged.run(1.1875, charged.target, [neighbour.zombie]);
assert.equal(charged.zombie.getState(), 'RECOVER', 'au moins 1,2 s entre impact et nouvelle charge');
assert.ok(charged.zombie.getPosition().equals(start), 'récupération immobile malgré un voisin');
assert.equal(charged.hits.length, 1);
charged.run(0.25);
assert.equal(charged.zombie.getState(), 'ATTACK', 'la nouvelle charge démarre après récupération');
assert.equal(charged.hits.length, 1, 'une nouvelle préparation précède le deuxième coup');

// Esquiver ne relance pas immédiatement la poursuite : le coup manque et expose l'élite.
const dodge = fixture();
dodge.step(0);
const held = dodge.zombie.getPosition().clone();
dodge.run(1.125, new THREE.Vector3(0, 1.7, 5));
assert.equal(dodge.hits.length, 0, 'sortir de portée évite les dégâts');
assert.equal(dodge.zombie.getState(), 'RECOVER');
assert.ok(dodge.zombie.getPosition().equals(held), 'la charge ne suit pas le joueur qui recule');

const wall = fixture();
wall.step(0);
const blocker = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2));
blocker.position.set(0, 1.5, 0.9);
wall.level.blockers.push(blocker);
wall.run(1.125);
assert.equal(wall.hits.length, 0, 'un obstacle placé avant l’impact bloque les dégâts');
assert.equal(wall.zombie.getState(), 'RECOVER', 'un coup bloqué garde sa récupération');

// Déplacement ordinaire : collisions et altitude commune, sans déplacement hors simulation.
const ramp = fixture({ floor: 2.4, ramp: true });
const far = new THREE.Vector3(0, 4.1, 6);
const before = ramp.zombie.getPosition().clone();
ramp.level.blocked = true;
ramp.run(1, far);
assert.ok(ramp.zombie.getPosition().equals(before), 'les collisions empêchent de traverser le décor');
ramp.level.blocked = false;
ramp.run(0.5, far);
assert.ok(ramp.zombie.getPosition().z > before.z, 'la poursuite reprend sur terrain libre');
assert.ok(Math.abs(ramp.zombie.getPosition().y - ramp.zombie.getMesh().scale.y
  - ramp.level.getFloorHeightAt(ramp.zombie.getPosition().x, ramp.zombie.getPosition().z)) < 1e-9, 'le pied suit le sol surélevé et les rampes');
const paused = ramp.zombie.getPosition().clone();
ramp.step(0, far);
assert.ok(ramp.zombie.getPosition().equals(paused), 'un delta nul ne déplace pas l’élite');

const interrupted = fixture();
interrupted.step(0);
interrupted.run(0.5);
interrupted.zombie.takeDamage(28);
assert.equal(interrupted.zombie.getMesh().material.emissiveIntensity, 0, 'une blessure coupe la télégraphie du coup annulé');
interrupted.run(0.25);
assert.equal(interrupted.hits.length, 0, 'la blessure annule le coup en cours');
interrupted.run(0.75);
assert.equal(interrupted.hits.length, 0, 'une nouvelle charge complète reste nécessaire');
interrupted.zombie.takeDamage(1000);
interrupted.run(3);
assert.equal(interrupted.hits.length, 0, 'la mort interdit un impact tardif');
assert.equal(interrupted.zombie.isThreat(), false, 'l’élite ne se relève pas même avec un tirage nul');
for (let i = 0; i < 320; i++) interrupted.zombie.updateDeath(1 / 32, far);
assert.equal(interrupted.zombie.isAlive(), false);

const durable = fixture();
durable.zombie.takeDamage(100);
assert.equal(durable.zombie.isAlive(), true, 'l’élite résiste davantage qu’un standard');
durable.zombie.takeDamage(220);
assert.equal(durable.zombie.isAlive(), false, 'les 320 PV restent un budget fini raisonnable');
assert.equal(durable.zombie.isThreat(), false);

// L'agrandissement est conservé pendant toute la chute, autour de l'appui dessiné.
for (const floor of [0, 1.2, 2.4]) {
  for (const elite of [false, true]) {
    const falling = fixture({ floor, elite });
    const aliveScale = falling.zombie.getMesh().scale.clone();
    falling.zombie.takeDamage(1000, true);
    const corpse = falling.zombie.remains.mesh;
    assert.ok(corpse.scale.equals(aliveScale), 'le cadavre garde l’échelle du vivant');
    let elapsed = 0;
    let poseStart = 0;
    for (const pose of zombieDeathAnimation.frames) {
      const at = poseStart + pose.duration / 2;
      falling.zombie.updateDeath(at - elapsed, far);
      elapsed = at;
      const groundLocalY = (pose.y + pose.height / 2 - pose.groundY) / zombieDeathAnimation.pixelsPerUnit;
      const groundWorld = corpse.localToWorld(new THREE.Vector3(0, groundLocalY, 0));
      assert.ok(Math.abs(groundWorld.y - floor - zombieDeathAnimation.floorHeight) < 1e-8,
        `appui stable à l'altitude ${floor} pendant chaque pose, élite=${elite}`);
      poseStart += pose.duration;
    }
    falling.zombie.updateDeath(10, far);
    assert.ok(corpse.scale.equals(aliveScale), 'le corps final conserve aussi l’échelle');
  }
}

// L'appel historique à deux arguments conserve son échelle et son appui.
const directScene = new THREE.Scene();
const directRemains = new ZombieRemains(directScene);
directRemains.start(new THREE.Vector3(0, 1, 0), 0);
directRemains.update(10, far);
assert.ok(directRemains.mesh.scale.equals(new THREE.Vector3(1, 1, 1)));
const lastPose = zombieDeathAnimation.frames.at(-1);
const localGround = (lastPose.y + lastPose.height / 2 - lastPose.groundY) / zombieDeathAnimation.pixelsPerUnit;
assert.ok(Math.abs(directRemains.mesh.localToWorld(new THREE.Vector3(0, localGround, 0)).y - zombieDeathAnimation.floorHeight) < 1e-8);
directRemains.dispose();
assert.equal(directScene.children.length, 0);

const finale = ENCOUNTER_CONFIGS.at(-1);
assert.equal(finale.tierNumber, 8);
assert.equal(finale.finalEncounter, true);
assert.equal(ENCOUNTER_CONFIGS.filter((config) => config.finalEncounter).length, 1);
assert.equal(finale.totalZombies - finale.maxAgile - finale.maxSpitter - (finale.maxCrawler ?? 0), 2,
  'la finale réserve un standard pour l’élite et un standard ordinaire');
assert.ok(finale.maxActiveZombies <= 4, 'renforts et élite partagent le plafond actif');

for (const f of fixtures) {
  f.zombie.dispose(f.scene);
  assert.equal(f.scene.children.length, 0, 'mesh et cadavre retirés au nettoyage');
}
blocker.geometry.dispose();
blocker.material.dispose();
disposeAllZombieResources();
console.log('Élite finale : télégraphie, impact unique, esquive, récupération, obstacle, altitude, interruption, mort définitive et quotas P8 : OK');
