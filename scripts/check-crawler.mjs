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
assert.equal(crawlerConfig.width / crawlerConfig.height, crawlerSprite.width / crawlerSprite.height, 'Le support doit conserver le rapport du canevas.');
assert.deepEqual(crawlerAnimation.poses, ['idle', 'crawl-a', 'crawl-b', 'attack', 'hurt', 'death']);

// Exercer la vraie géométrie et les comportements horrifiques (stutter, lampe, grab)
const originalLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function (url) {
  return new THREE.Texture({ width: 512, height: 512, src: url });
};
try {
  let floorY = 2.4;
  const level = {
    getFloorHeightAt: () => floorY,
    findNextWaypoint: (_from, to) => to.clone(),
    isColliding: () => false,
    getSolidMeshes: () => [],
  };
  const scene = new THREE.Scene();
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
  // Test 2.4 : Esquive latérale de la ligne de visée (Aim Evasion)
  const evadeCrawler = new CrawlerZombie(scene, level, 0, 5);
  evadeCrawler.update(
    0.15,
    new THREE.Vector3(0, 1.7, 10),
    [evadeCrawler],
    undefined,
    { isFlashlightOn: false, cameraDirection: new THREE.Vector3(0, 0, -1) }
  );
  assert.equal(evadeCrawler.isEvadingAimState(), true, 'La Rampeuse détecte qu’elle est ciblée par le réticule');
  assert.ok(Math.abs(evadeCrawler.getPosition().x) > 0.01, 'La Rampeuse effectue un décrochage latéral');

  // Si le joueur vise ailleurs, l'esquive s'arrête
  evadeCrawler.update(
    0.1,
    new THREE.Vector3(0, 1.7, 10),
    [evadeCrawler],
    undefined,
    { isFlashlightOn: false, cameraDirection: new THREE.Vector3(1, 0, 0) }
  );
  assert.equal(evadeCrawler.isEvadingAimState(), false, 'L’esquive cesse quand le joueur ne vise plus');

  // En mode Rage/Furie : AUCUNE esquive (charge tête baissée en ligne droite)
  Math.random = () => 0.1; // active la Furie
  evadeCrawler.update(
    0.05,
    new THREE.Vector3(0, 1.7, 10),
    [evadeCrawler],
    undefined,
    { isFlashlightOn: true, cameraDirection: new THREE.Vector3(0, 0, -1) }
  );
  evadeCrawler.update(
    0.25,
    new THREE.Vector3(0, 1.7, 10),
    [evadeCrawler],
    undefined,
    { isFlashlightOn: false, cameraDirection: new THREE.Vector3(0, 0, -1) }
  );
  assert.equal(evadeCrawler.isFrenzyState(), true, 'En mode furie');
  assert.equal(evadeCrawler.isEvadingAimState(), false, 'Aucune esquive de visée en mode rage (charge directe)');
  evadeCrawler.dispose(scene);

  console.log('   -> PASS : proportions, Stutter paranormal, réaction lampe, grab et esquive visée validés.\n');
} finally {
  THREE.TextureLoader.prototype.load = originalLoad;
}

// 3. Contrôle des quotas de rencontres P1-P8
console.log('3. Vérification des quotas de rencontres (Rampeuses à partir de P4)...');
for (let t = 0; t < 3; t++) {
  const cfg = ENCOUNTER_CONFIGS[t];
  assert.ok(!cfg.maxCrawler || cfg.maxCrawler === 0, `Palier ${t + 1} ne doit pas avoir de Rampeur.`);
}
console.log('   -> Paliers 1 à 3 : 0 Rampeur (conforme).');

const expectedCrawlers = [2, 2, 2, 2];
for (let t = 3; t < 7; t++) {
  const cfg = ENCOUNTER_CONFIGS[t];
  const expected = expectedCrawlers[t - 3];
  assert.equal(cfg.maxCrawler, expected, `Palier ${t + 1} doit avoir exactement ${expected} Rampeurs.`);
  assert.ok((cfg.maxSimultaneousCrawler ?? 0) >= 2, `Palier ${t + 1} doit autoriser au moins 2 Rampeurs simultanés.`);
}
console.log('   -> Paliers 4 à 7 : quotas de Rampeurs [2, 2, 2, 2] rigoureusement respectés.\n');

const crawlerTier = ENCOUNTER_CONFIGS[7];
assert.equal(crawlerTier.totalZombies, 14);
assert.equal(crawlerTier.maxCrawler, 14);
assert.equal(crawlerTier.maxAgile + crawlerTier.maxSpitter, 0);
assert.equal(crawlerTier.maxSimultaneousCrawler, 5);
assert.equal(crawlerTier.maxActiveZombies, 5);
assert.equal(crawlerTier.openingSpawns, 3);
console.log('   -> Palier 8 : exclusivement 14 Rampeuses, cinq simultanées, 3 en ouverture.');

console.log('========================================================');
console.log('CONTRÔLES COMPLETS DU RAMPEUR 100% SUCCÈS !');
console.log('========================================================');
