import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readSpritePng, alphaBounds } from './sprite-png-info.mjs';
import { crawlerConfig, crawlerAnimation } from '../src/CrawlerAnimation.ts';
import { crawlerSprite, crawlerGroundOffsetY } from '../src/CrawlerAnimation.ts';
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
  for (const pixel of [0,511,511*512,512*512-1]) assert.equal(img.data[pixel*4+3],0,'Coins réellement transparents');
  const map=new THREE.Texture({width:512,height:512,src:`/assets/zombies/crawler/${pose}.png`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshStandardMaterial({map}));
  for(const [left,top,right,bottom] of crawlerSprite.heads[`${pose}.png`]){
    const x=(left+right)/2,y=(top+bottom)/2;
    assert.ok(img.data[(Math.floor(y)*512+Math.floor(x))*4+3]>102,'Centre de tête sur un pixel visible');
    assert.equal(isHeadSpriteHit(mesh,new THREE.Vector2(x/512,1-y/512)),true,`Tête reconnue pour ${pose}`);
  }
  assert.equal(isHeadSpriteHit(mesh,new THREE.Vector2(0.5,0.12)),false,'Le bas du corps ne doit pas compter comme une tête');
  mesh.geometry.dispose();mesh.material.dispose();map.dispose();
  // Vérifier que le haut de l'image est bien transparent (silhouette basse au sol)
  assert.ok(bounds.y > 100, `La créature doit être basse dans le cadre (y > 100), mesuré: y=${bounds.y}`);
  // Vérifier que la pose de mort est encore plus basse et aplatie
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
console.log('   -> PASS : Paramètres de combat et chronologie conformes.\n');

// Exercer la vraie géométrie sans chargement d'images navigateur dans Node.
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
  };
  const scene = new THREE.Scene();
  const crawler = new CrawlerZombie(scene, level, 0, 0);
  const mesh = crawler.getMesh();
  const { width, height } = mesh.geometry.parameters;
  assert.equal(width / height, 1, 'Aucun étirement horizontal de la géométrie réelle');
  const checkGround = () => {
    for (const pose of poses) {
      const image = readSpritePng(`public/assets/zombies/crawler/${pose}.png`);
      const bounds = alphaBounds(image);
      const contactY = mesh.position.y + (0.5 - (bounds.y + bounds.height) / image.height) * height;
      assert.ok(Math.abs(contactY - floorY) < 1e-6, `Appui au sol réel de ${pose}, même sur une plateforme`);
    }
    assert.ok(Math.abs(mesh.position.y - floorY - crawlerGroundOffsetY) < 1e-6);
  };
  checkGround();
  floorY = 0.8;
  crawler.update(0.1, new THREE.Vector3(0, 1.7, 6), [crawler]);
  checkGround();
  assert.equal(mesh.rotation.x, 0, 'Le billboard reste vertical');
  mesh.updateMatrixWorld(true);
  const [left, top, right, bottom] = crawlerSprite.heads['idle.png'][0];
  const localHead = new THREE.Vector3(((left + right) / 2 / 512 - 0.5) * width, (0.5 - (top + bottom) / 2 / 512) * height, 0);
  const head = localHead.applyMatrix4(mesh.matrixWorld);
  const ray = new THREE.Raycaster(head.clone().add(new THREE.Vector3(0, 0, 2)), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(mesh)[0];
  assert.ok(hit, 'Rayon sur la vraie géométrie corrigée');
  assert.equal(isHeadSpriteHit(mesh, hit.uv), true, 'La tête reste reconnue après changement de dimensions');
  crawler.takeDamage(1);
  assert.equal(crawler.getPose(), 'hurt');
  checkGround();
  crawler.takeDamage(100);
  crawler.updateDeath(0.1, new THREE.Vector3(0, 1.7, 6));
  assert.equal(crawler.getPose(), 'death');
  checkGround();
  crawler.dispose(scene);
  console.log('   -> PASS : proportions, appuis au sol, déplacement en altitude et vrai rayon tête.\n');
} finally {
  THREE.TextureLoader.prototype.load = originalLoad;
}

// 3. Contrôle de l'intégration dans les rencontres P1 à P7
console.log('3. Vérification des quotas de rencontres (Apparition exclusive P4-P7)...');
// Paliers 1 à 3 : zéro Rampeur
for (let t = 0; t < 3; t++) {
  const cfg = ENCOUNTER_CONFIGS[t];
  assert.ok(!cfg.maxCrawler || cfg.maxCrawler === 0, `Palier ${t + 1} ne doit pas avoir de Rampeur.`);
}
console.log('   -> Paliers 1 à 3 : 0 Rampeur (conforme).');

// Paliers 4 à 7 : présence et quotas exacts
const expectedCrawlers = [2, 2, 2, 2];
for (let t = 3; t < 7; t++) {
  const cfg = ENCOUNTER_CONFIGS[t];
  const expected = expectedCrawlers[t - 3];
  assert.equal(cfg.maxCrawler, expected, `Palier ${t + 1} doit avoir exactement ${expected} Rampeurs.`);
  assert.ok((cfg.maxSimultaneousCrawler ?? 0) >= 2, `Palier ${t + 1} doit autoriser au moins 2 Rampeurs simultanés.`);
  // Vérifier cohérence de la somme des quotas
  const std = cfg.totalZombies - cfg.maxAgile - cfg.maxSpitter - (cfg.maxCrawler ?? 0);
  assert.ok(std >= 0, `Le quota standard du palier ${t + 1} ne doit pas être négatif.`);
}
console.log('   -> Paliers 4 à 7 : quotas de Rampeurs [2, 2, 2, 2] rigoureusement respectés.\n');

const finale = ENCOUNTER_CONFIGS[7];
assert.equal(finale.finalEncounter, true, 'P8 porte bien le contrat de finale');
assert.equal(finale.maxCrawler ?? 0, 0, 'La finale garde son groupe dédié sans Rampeuse ajoutée implicitement');

console.log('========================================================');
console.log('CONTRÔLES FICHIERS, GÉOMÉTRIE ET CONFIGURATION RÉUSSIS. Gameplay non validé par ce script.');
console.log('========================================================');
