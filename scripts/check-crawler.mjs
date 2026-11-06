import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readSpritePng, alphaBounds } from './sprite-png-info.mjs';
import { crawlerConfig, crawlerAnimation, crawlerSprite, crawlerGroundOffsetY } from '../src/CrawlerAnimation.ts';
import { CrawlerZombie } from '../src/CrawlerZombie.ts';
import * as THREE from 'three';
import { isHeadSpriteHit } from '../src/SpriteHitMask.ts';
import { ENCOUNTER_CONFIGS } from '../src/EncounterConfig.ts';

console.log('=== SUITE DE VALIDATION DU RAMPEUR (THE CRAWLER) ===\n');

// 1. Contrôle des 6 fichiers assets PNG
console.log('1. Vérification des assets PNG 512x512 transparents...');
const poses = ['idle', 'crawl-a', 'crawl-b', 'attack', 'hurt', 'death'];
for (const pose of poses) {
  const file = `public/assets/zombies/crawler/${pose}.png`;
  assert.ok(existsSync(file), `Le fichier ${file} doit exister.`);
  const img = readSpritePng(file);
  assert.equal(img.width, 512, `Largeur de ${pose}.png doit être 512`);
  assert.equal(img.height, 512, `Hauteur de ${pose}.png doit être 512`);
  const bounds = alphaBounds(img);
  assert.ok(bounds, `Les contours alpha de ${pose}.png doivent être détectés.`);
  assert.equal(bounds.y + bounds.height, crawlerSprite.groundY, `L'appui de ${pose} doit rester sur le repère sol commun.`);
  assert.ok(bounds.x > 0 && bounds.x + bounds.width < img.width, `Silhouette complète de ${pose} sans découpe latérale.`);
  for (const pixel of [0, 511, 511 * 512, 512 * 512 - 1]) assert.equal(img.data[pixel * 4 + 3], 0, 'Coins réellement transparents');
  const map = new THREE.Texture({ width: 512, height: 512, src: `/assets/zombies/crawler/${pose}.png` });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ map }));
  for (const [left, top, right, bottom] of crawlerSprite.heads[`${pose}.png`]) {
    const x = (left + right) / 2, y = (top + bottom) / 2;
    assert.ok(img.data[(Math.floor(y) * 512 + Math.floor(x)) * 4 + 3] > 102, 'Centre de tête sur un pixel visible');
    assert.equal(isHeadSpriteHit(mesh, new THREE.Vector2(x / 512, 1 - y / 512)), true, `Tête reconnue pour ${pose}`);
  }
  assert.equal(isHeadSpriteHit(mesh, new THREE.Vector2(0.5, 0.12)), false, 'Le bas du corps ne doit pas compter comme une tête');
  mesh.geometry.dispose(); mesh.material.dispose(); map.dispose();
  assert.ok(bounds.y > 100, `La créature doit être basse dans le cadre (y > 100), mesuré: y=${bounds.y}`);
  if (pose === 'death') {
    assert.ok(bounds.height < 250, `Le cadavre doit être aplati au sol (hauteur < 250px), mesuré: ${bounds.height}px`);
  }
}
console.log('   -> PASS : 6 assets PNG validés, dimensions 512x512 et silhouette rasant le sol confirmées.\n');

// 2. Contrôle des caractéristiques d'animation et de combat
console.log("2. Vérification des caractéristiques d'équilibrage du Rampeur...");
assert.equal(crawlerConfig.health, 40, 'Santé doit être de 40 PV (faible pour récompenser la précision au sol).');
assert.equal(crawlerConfig.speed, 3.5, 'Vitesse doit être de 3.5 m/s (rapide, menaçant).');
assert.equal(crawlerConfig.attackDamage, 12, 'Dégâts de morsure basse doivent être de 12.');
assert.equal(crawlerConfig.attackWindup, 0.35, 'Une préparation lisible précède les dégâts.');
assert.equal(crawlerAnimation.attackDuration, crawlerConfig.attackWindup + crawlerConfig.attackRecovery, 'Aperçu et jeu partagent toute la durée de l’attaque.');
assert.equal(crawlerConfig.width / crawlerConfig.height, crawlerSprite.width / crawlerSprite.height, 'Le support doit conserver le rapport du canevas.');
assert.deepEqual(crawlerAnimation.poses, ['idle', 'crawl-a', 'crawl-b', 'attack', 'hurt', 'death']);

// Exercer la vraie géométrie et les comportements horrifiques (stutter, lampe, grab)
const originalLoad = THREE.TextureLoader.prototype.load;
const originalRandom = Math.random;
THREE.TextureLoader.prototype.load = function (url) {
  return new THREE.Texture({ width: 512, height: 512, src: url });
};
try {
  let floorY = 2.4;
  let blockers = [];
  let collision = () => false;
  const level = {
    getFloorHeightAt: () => floorY,
    findNextWaypoint: (_from, to) => to.clone(),
    isColliding: (...args) => collision(...args),
    getSolidMeshes: () => blockers,
  };
  const scene = new THREE.Scene();

  // Conserver les contrôles locaux d'ancrage et de ciblage sur la vraie géométrie.
  const groundCrawler = new CrawlerZombie(scene, level, 0, 0);
  const groundMesh = groundCrawler.getMesh();
  const groundSize = groundMesh.geometry.parameters;
  const checkGround = () => {
    for (const pose of poses) {
      const image = readSpritePng(`public/assets/zombies/crawler/${pose}.png`);
      const bounds = alphaBounds(image);
      const contactY = groundMesh.position.y + (0.5 - (bounds.y + bounds.height) / image.height) * groundSize.height;
      assert.ok(Math.abs(contactY - floorY) < 1e-6, `Appui au sol réel de ${pose}, même sur une plateforme`);
    }
    assert.ok(Math.abs(groundMesh.position.y - floorY - crawlerGroundOffsetY) < 1e-6);
  };
  checkGround();
  floorY = 0.8;
  groundCrawler.update(0.1, new THREE.Vector3(0, 1.7, 6), [groundCrawler]);
  checkGround();
  assert.equal(groundMesh.rotation.x, 0, 'Le billboard reste vertical');
  groundMesh.updateMatrixWorld(true);
  const [left, top, right, bottom] = crawlerSprite.heads['idle.png'][0];
  const localHead = new THREE.Vector3(((left + right) / 2 / 512 - 0.5) * groundSize.width, (0.5 - (top + bottom) / 2 / 512) * groundSize.height, 0);
  const head = localHead.applyMatrix4(groundMesh.matrixWorld);
  const ray = new THREE.Raycaster(head.clone().add(new THREE.Vector3(0, 0, 2)), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(groundMesh)[0];
  assert.ok(hit, 'Rayon sur la vraie géométrie corrigée');
  assert.equal(isHeadSpriteHit(groundMesh, hit.uv), true, 'La tête reste reconnue après changement de dimensions');
  groundCrawler.takeDamage(1);
  assert.equal(groundCrawler.getPose(), 'hurt');
  checkGround();
  groundCrawler.takeDamage(100);
  groundCrawler.updateDeath(0.1, new THREE.Vector3(0, 1.7, 6));
  assert.equal(groundCrawler.getPose(), 'death');
  checkGround();
  groundCrawler.dispose(scene);

  floorY = 0;
  const crawler = new CrawlerZombie(scene, level, 0, 0);
  const mesh = crawler.getMesh();
  const { width, height } = mesh.geometry.parameters;
  assert.equal(width / height, 1, 'Aucun étirement horizontal de la géométrie réelle');

  // Test 2.1 : Ghostly Stutter (mouvement saccadé)
  crawler.update(0.1, new THREE.Vector3(0, 1.7, 5), [crawler]);
  assert.ok(['crawl-a', 'crawl-b'].includes(crawler.getPose()), 'Phase de propulsion en rampe');
  crawler.update(0.1, new THREE.Vector3(0, 1.7, 5), [crawler]);
  assert.equal(crawler.getPose(), 'idle', 'Phase de convulsion / pause saccadée');

  // Test 2.2 : Réaction à la lampe torche (50% Furie, 50% Fuite)
  const origRandom = Math.random;
  try {
    // Cas A : Furie (random < 0.5)
    Math.random = () => 0.2;
    crawler.update(
      0.05,
      new THREE.Vector3(0, 1.7, 5),
      [crawler],
      undefined,
      { isFlashlightOn: true, cameraDirection: new THREE.Vector3(0, 0, -1) }
    );
    assert.equal(crawler.getPose(), 'hurt', 'La lampe torche provoque un spasme d’éblouissement');
    assert.equal(crawler.isFrenzyState(), true, 'Tirage 50% Furie activé');
    assert.equal(crawler.isFleeingState(), false, 'Pas en fuite si furie');

    // Cas B : Fuite (random >= 0.5)
    Math.random = () => 0.8;
    const fleeCrawler = new CrawlerZombie(scene, level, 0, 5);
    fleeCrawler.update(
      0.05,
      new THREE.Vector3(0, 1.7, 10),
      [fleeCrawler],
      undefined,
      { isFlashlightOn: true, cameraDirection: new THREE.Vector3(0, 0, -1) }
    );
    assert.equal(fleeCrawler.getPose(), 'hurt', 'Éblouissement initial avant fuite');
    assert.equal(fleeCrawler.isFleeingState(), true, 'Tirage 50% Fuite activé');
    assert.equal(fleeCrawler.isFrenzyState(), false, 'Pas en furie si fuite');
    // Passer le flinch et tester que le mouvement s'éloigne du joueur
    const startZ = fleeCrawler.getPosition().z;
    fleeCrawler.update(0.3, new THREE.Vector3(0, 1.7, 10), [fleeCrawler]);
    assert.ok(fleeCrawler.getPosition().z < startZ, 'La Rampeuse recule en fuyant à l’opposé du joueur');
    fleeCrawler.dispose(scene);
  } finally {
    Math.random = origRandom;
  }

  // Test 2.3 : Attaque au corps-à-corps avec agrippement aux chevilles (Ankle Grab)
  crawler.dispose(scene);
  const attackCrawler = new CrawlerZombie(scene, level, 0, 0);
  let grabbed = false;
  let attackDmg = 0;
  const closePlayerPos = new THREE.Vector3(0, 1.7, 0.8);
  // 1ère frame : déclenche l'attaque (distance 0.8 <= attackRange 1.1)
  attackCrawler.update(0.01, closePlayerPos, [attackCrawler], (dmg, isGrab) => {
    attackDmg = dmg;
    grabbed = Boolean(isGrab);
  });
  assert.equal(attackCrawler.getPose(), 'attack', 'Enclenchement de la pose d’attaque');
  // 2ème frame : franchit le windup et applique la morsure + grab
  attackCrawler.update(crawlerConfig.attackWindup + 0.02, closePlayerPos, [attackCrawler], (dmg, isGrab) => {
    attackDmg = dmg;
    grabbed = Boolean(isGrab);
  });
  assert.equal(attackDmg, crawlerConfig.attackDamage, 'Dégâts de morsure conformes');
  assert.equal(grabbed, true, 'L’attaque transmet l’agrippement aux chevilles (isAnkleGrab = true)');

  attackCrawler.dispose(scene);
  // Un coup préparé peut rater : porte fermée, changement d'étage ou sortie de portée.
  const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.1), new THREE.MeshBasicMaterial());
  door.position.set(0, 1.5, 0.4);
  const startAttack = () => {
    const enemy = new CrawlerZombie(scene, level, 0, 0);
    enemy.update(0.01, closePlayerPos, [enemy]);
    assert.equal(enemy.getPose(), 'attack');
    return enemy;
  };
  const assertMiss = (enemy, position, label) => {
    let hits = 0;
    enemy.update(crawlerConfig.attackWindup + 0.01, position, [enemy], () => hits++);
    assert.equal(hits, 0, label);
    enemy.dispose(scene);
  };
  const doorDuringWindup = startAttack();
  blockers = [door];
  assertMiss(doorDuringWindup, closePlayerPos, 'Une porte refermée pendant la préparation bloque dégâts et agrippement');
  const blockedAtStart = new CrawlerZombie(scene, level, 0, 0);
  blockedAtStart.update(0.01, closePlayerPos, [blockedAtStart]);
  assert.notEqual(blockedAtStart.getPose(), 'attack', 'Aucune préparation engagée à travers une porte');
  blockedAtStart.dispose(scene);
  blockers = [];
  const colliderDuringWindup = startAttack();
  collision = (_x, z) => z > 0.3 && z < 0.5;
  assertMiss(colliderDuringWindup, closePlayerPos, 'Un obstacle physique bloque aussi un ajour graphiquement transparent');
  collision = () => false;
  assertMiss(startAttack(), new THREE.Vector3(0, 4.1, 0.8), 'Le volume du joueur à un autre étage échappe au coup');
  assertMiss(startAttack(), new THREE.Vector3(0, 1.7, 2), 'Le joueur sorti de portée évite le coup');
  const changedFloor = startAttack();
  level.getFloorHeightAt = (_x, z) => z > 0.5 ? 2.4 : 0;
  assertMiss(changedFloor, closePlayerPos, 'Le sol réel bloque un changement d’étage même si la caméra est encore amortie');
  const floorBlocked = new CrawlerZombie(scene, level, 0, 0);
  floorBlocked.update(0.01, new THREE.Vector3(0, 4.1, 0.8), [floorBlocked]);
  assert.notEqual(floorBlocked.getPose(), 'attack', 'Aucun début de saisie entre deux sols superposés');
  floorBlocked.dispose(scene);
  level.getFloorHeightAt = (_x, z) => z * 0.4;
  const rampCrawler = new CrawlerZombie(scene, level, 0, 0);
  const rampPlayer = new THREE.Vector3(0, 1.7 + 0.8 * 0.4, 0.8);
  let rampHits = 0;
  rampCrawler.update(0.01, rampPlayer, [rampCrawler]);
  rampCrawler.update(crawlerConfig.attackWindup - 0.01, rampPlayer, [rampCrawler], () => rampHits++);
  assert.equal(rampHits, 0, 'Les dégâts attendent la préparation complète même à courte distance');
  rampCrawler.update(0.02, rampPlayer, [rampCrawler], () => rampHits++);
  rampCrawler.update(0.05, rampPlayer, [rampCrawler], () => rampHits++);
  assert.equal(rampHits, 1, 'Une pente praticable autorise un seul impact');
  rampCrawler.dispose(scene);
  level.getFloorHeightAt = () => floorY;

  const blockedLanding = new CrawlerZombie(scene, level, 0, 0, true);
  let landingHits = 0;
  blockers = [door];
  blockedLanding.update(0.01, closePlayerPos, [blockedLanding], () => landingHits++);
  for (let i = 0; i < 20 && blockedLanding.isDroppingState(); i++) {
    blockedLanding.update(0.05, closePlayerPos, [blockedLanding], () => landingHits++);
  }
  assert.equal(blockedLanding.isDroppingState(), false, 'Le plafond debug conserve son atterrissage');
  assert.equal(landingHits, 0, 'L’atterrissage ne saisit pas à travers une porte');
  blockedLanding.dispose(scene);
  blockers = [];
  door.geometry.dispose();
  door.material.dispose();

  // Test 2.4 : Esquive latérale de visée réservée à la fuite (pas d'esquive en charge)
  const chargeCrawler = new CrawlerZombie(scene, level, 0, 5);
  chargeCrawler.update(
    0.15,
    new THREE.Vector3(0, 1.7, 10),
    [chargeCrawler],
    undefined,
    { isFlashlightOn: false, cameraDirection: new THREE.Vector3(0, 0, -1) }
  );
  assert.equal(chargeCrawler.isEvadingAimState(), false, 'Mode charge normale : aucune esquive');

  // En mode Rage/Furie : AUCUNE esquive (charge tête baissée)
  Math.random = () => 0.1; // active la Furie
  chargeCrawler.update(
    0.05,
    new THREE.Vector3(0, 1.7, 10),
    [chargeCrawler],
    undefined,
    { isFlashlightOn: true, cameraDirection: new THREE.Vector3(0, 0, -1) }
  );
  chargeCrawler.update(
    0.25,
    new THREE.Vector3(0, 1.7, 10),
    [chargeCrawler],
    undefined,
    { isFlashlightOn: false, cameraDirection: new THREE.Vector3(0, 0, -1) }
  );
  assert.equal(chargeCrawler.isFrenzyState(), true, 'En mode furie');
  assert.equal(chargeCrawler.isEvadingAimState(), false, 'Mode furie : aucune esquive');
  chargeCrawler.dispose(scene);

  // En mode Fuite (recul) : esquive active si ciblée
  Math.random = () => 0.9; // active la Fuite
  const fleeDodgeCrawler = new CrawlerZombie(scene, level, 0, 5);
  fleeDodgeCrawler.update(
    0.05,
    new THREE.Vector3(0, 1.7, 10),
    [fleeDodgeCrawler],
    undefined,
    { isFlashlightOn: true, cameraDirection: new THREE.Vector3(0, 0, -1) }
  );
  fleeDodgeCrawler.update(
    0.25,
    new THREE.Vector3(0, 1.7, 10),
    [fleeDodgeCrawler],
    undefined,
    { isFlashlightOn: false, cameraDirection: new THREE.Vector3(0, 0, -1) }
  );
  assert.equal(fleeDodgeCrawler.isFleeingState(), true, 'En mode fuite');
  assert.equal(fleeDodgeCrawler.isEvadingAimState(), true, 'Mode fuite : esquive latérale active en reculant');
  fleeDodgeCrawler.dispose(scene);
  // Test 2.5 : Embuscade au plafond et chute (Ceiling Ambush & Drop)
  const ceilingCrawler = new CrawlerZombie(scene, level, 0, 5, true);
  assert.equal(ceilingCrawler.isCeilingAmbushState(), true, 'La Rampeuse démarre accrochée au plafond');
  assert.equal(ceilingCrawler.getMesh().scale.y, -1, 'Sprite inversé la tête en bas sous le plafond');
  assert.ok(ceilingCrawler.getPosition().y > 3.0, 'Position Y élevée au ras du plafond');

  // Si le joueur est loin (10m), elle reste au plafond
  ceilingCrawler.update(0.1, new THREE.Vector3(0, 1.7, 15), [ceilingCrawler]);
  assert.equal(ceilingCrawler.isCeilingAmbushState(), true, 'Reste au plafond tant que le joueur est loin');

  // Si le joueur s'approche en dessous (< 3.2m), elle se décroche et chute
  ceilingCrawler.update(0.1, new THREE.Vector3(0, 1.7, 6), [ceilingCrawler]);
  assert.equal(ceilingCrawler.isCeilingAmbushState(), false, 'Décrochage enclenché');
  assert.equal(ceilingCrawler.isDroppingState(), true, 'Chute verticale active');

  // Elle chute jusqu'à atterrir au sol et se remettre à l'endroit
  for (let step = 0; step < 10 && ceilingCrawler.isDroppingState(); step++) {
    ceilingCrawler.update(0.1, new THREE.Vector3(0, 1.7, 6), [ceilingCrawler]);
  }
  assert.equal(ceilingCrawler.isDroppingState(), false, 'Atterrissage au sol réussi');
  assert.equal(ceilingCrawler.getMesh().scale.y, 1, 'Sprite remis à l’endroit au sol');
  ceilingCrawler.dispose(scene);


  console.log('   -> PASS : proportions, Stutter, réaction lampe, grab, esquive visée et embuscade plafond validés.\n');
} finally {
  THREE.TextureLoader.prototype.load = originalLoad;
  Math.random = originalRandom;
}

// 3. Contrôle des quotas de rencontres P1-P8
console.log('3. Vérification des quotas de rencontres (Rampeuses à partir de P4)...');
for (let t = 0; t < 3; t++) {
  const cfg = ENCOUNTER_CONFIGS[t];
  assert.ok(!cfg.maxCrawler || cfg.maxCrawler === 0, `Palier ${t + 1} ne doit pas avoir de Rampeur.`);
}
console.log('   -> Paliers 1 à 3 : 0 Rampeur (conforme).');

const expectedCrawlers = [1, 1, 2, 2];
for (let t = 3; t < 7; t++) {
  const cfg = ENCOUNTER_CONFIGS[t];
  const expected = expectedCrawlers[t - 3];
  assert.equal(cfg.maxCrawler, expected, `Palier ${t + 1} doit avoir exactement ${expected} Rampeurs.`);
  assert.equal(cfg.maxSimultaneousCrawler, expected, `Palier ${t + 1} respecte le plafond de Rampeuses prévu.`);
  const std = cfg.totalZombies - cfg.maxAgile - cfg.maxSpitter - (cfg.maxCrawler ?? 0);
  assert.ok(std >= 0, `Le quota standard du palier ${t + 1} ne doit pas être négatif.`);
}
console.log('   -> Paliers 4 à 7 : quotas de Rampeuses [1, 1, 2, 2] respectés.\n');

const finale = ENCOUNTER_CONFIGS[7];
assert.equal(finale.finalEncounter, true, 'P8 porte bien le contrat de finale');
assert.equal(finale.maxCrawler ?? 0, 0, 'La finale garde son groupe dédié sans Rampeuse ajoutée implicitement');

console.log('========================================================');
console.log('CONTRÔLES FICHIERS, GÉOMÉTRIE, COMPORTEMENTS ET CONFIGURATION RÉUSSIS. Gameplay non validé par ce script.');
console.log('========================================================');
