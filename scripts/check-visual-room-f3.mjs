import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

// Résolution automatique des imports sans extension .ts pour Node.js
registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? specifier + '.ts' : specifier, context);
  }
});

// Patch TextureLoader pour exécution Node headless
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData = { url };
  return texture;
};

class MockElement extends EventTarget {
  textContent = '';
  style = {};
  hidden = false;
  classList = {
    toggle() {},
  };
  addEventListener() {}
  removeEventListener() {}
  requestPointerLock() {}
}

globalThis.window = Object.assign(new EventTarget(), {
  innerWidth: 1920,
  innerHeight: 1080,
  location: { reload() {} },
  AudioContext: class {
    createGain() { return { connect() {} }; }
    createPanner() { return { connect() {}, setPosition() {}, setOrientation() {} }; }
  },
});

globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null,
  querySelector: () => new MockElement(),
  querySelectorAll: () => [new MockElement()],
  body: { appendChild() {} },
  createElement: () => new MockElement(),
  createElementNS: () => new MockElement(),
});

globalThis.Audio = class {
  volume = 1;
  play() { return Promise.resolve(); }
  catch() {}
};

import { Level } from '../src/Level.ts';
import { MANSION_BUDGET } from '../src/MansionConfig.ts';
import { UPGRADE_CONFIGS } from '../src/UpgradeConfig.ts';
import { visualColors } from '../src/VisualStyle.ts';
import { HorrorDirector } from '../src/HorrorDirector.ts';

console.log('=== SUITE DE TESTS COMPORTEMENTAUX : SALLE TÉMOIN VISUELLE & SONORE F3 ===\n');

// ============================================================================
// ÉPREUVE 1 : ARCHITECTURE ET DÉTAILS DU GRAND SALON (SALLE TÉMOIN)
// ============================================================================
console.log('1. Test de l\'architecture et des repères visuels du Grand Salon...');

const scene = new THREE.Scene();
const level = new Level(scene);

// A. Vérification de la cheminée monumentale du Grand Salon (X = -14, Z = 13)
const colliders = level['colliders'] || [];
const fireplaceCollider = colliders.find((box) => {
  const center = new THREE.Vector3();
  box.getCenter(center);
  return Math.abs(center.x - (-14)) < 0.1 && Math.abs(center.z - 13) < 0.1;
});
assert.ok(fireplaceCollider, 'Le collider physique de la cheminée du Grand Salon doit être présent en (-14, 13)');
const fireplaceSize = new THREE.Vector3();
fireplaceCollider.getSize(fireplaceSize);
assert.ok(Math.abs(fireplaceSize.x - 2.4) < 0.05, `Largeur du collider cheminée attendue: 2.4, reçue: ${fireplaceSize.x}`);
assert.ok(Math.abs(fireplaceSize.z - 4.0) < 0.05, `Profondeur du collider cheminée attendue: 4.0, reçue: ${fireplaceSize.z}`);
assert.ok(Math.abs(fireplaceSize.y - 3.0) < 0.05, `Hauteur du collider cheminée attendue: 3.0, reçue: ${fireplaceSize.y}`);

// Vérifier que la collision physique joueur/ennemi est bien active en plein cœur de la cheminée
assert.ok(level.isColliding(-14, 13, 0.45), 'La cheminée doit bloquer les déplacements du joueur et des zombies');

// B. Vérification des éléments sculptés de la cheminée (manteau, jambages, âtre, braises emissive)
let hasStoneMantle = false;
let hasStonePillars = false;
let hasHearthBack = false;
let hasEmbers = false;

scene.traverse((obj) => {
  if (obj instanceof THREE.Mesh) {
    const mat = obj.material;
    if (mat && 'color' in mat) {
      if (mat.map?.name === 'mansion-stone') {
        if (obj.geometry.parameters?.height < 0.5) {
          hasStoneMantle = true;
        } else if (obj.geometry.parameters?.height > 2.0) {
          hasStonePillars = true;
        }
      } else if (mat.map?.name === 'mansion-brick') {
        hasHearthBack = true;
      }
      if ('emissive' in mat && mat.emissive.getHex() === visualColors.ember) {
        hasEmbers = true;
      }
    }
  }
});

assert.ok(hasStoneMantle, 'Le manteau supérieur en pierre taillée doit être présent');
assert.ok(hasStonePillars, 'Les jambages/piliers latéraux en pierre taillée doivent être présents');
assert.ok(hasHearthBack, 'Le fond d\'âtre noirci en briques réfractaires doit être présent');
assert.ok(hasEmbers, 'Le lit de braises rougeoyantes avec matériau emissive doit être présent dans l\'âtre');

// C. Vérification du tapis damassé d'apparat au sol matérialisant la boucle de circulation
let hasCarpet = false;
let hasCarpetGoldBorder = false;

scene.traverse((obj) => {
  if (obj instanceof THREE.Mesh) {
    const mat = obj.material;
    if (mat && 'color' in mat) {
      if (mat.map?.name === 'mansion-carpet') {
        hasCarpet = true;
      } else if (mat.color.getHex() === visualColors.carpetGold) {
        hasCarpetGoldBorder = true;
      }
    }
  }
});

assert.ok(hasCarpet, 'Le tapis damassé victorien bordeaux doit être présent au sol du Grand Salon');
assert.ok(hasCarpetGoldBorder, 'La bordure or du tapis d\'apparat doit être présente');

// D. Vérification des linteaux en relief au-dessus des passages
let trimCount = 0;
scene.traverse((obj) => {
  if (obj instanceof THREE.Mesh && obj.position.y > 3.5 && obj.geometry.parameters?.height === 0.35) {
    trimCount++;
  }
});
assert.ok(trimCount >= 3, `Au moins 3 linteaux sculptés de passage doivent être présents (détectés: ${trimCount})`);

console.log('   -> PASS : Architecture, cheminée sculptée, tapis de circulation et linteaux validés.\n');

// ============================================================================
// ÉPREUVE 2 : RESPECT DU BUDGET D'OMBRES ET D'ÉCLAIRAGE DU MANOIR
// ============================================================================
console.log('2. Test de préservation stricte du budget d\'ombres et lumières...');

let shadowCastingLightsCount = 0;
scene.traverse((obj) => {
  if (obj instanceof THREE.Light && obj.castShadow) {
    shadowCastingLightsCount++;
  }
});

assert.equal(
  shadowCastingLightsCount,
  MANSION_BUDGET.maxShadowCastingLights,
  `Strictement ${MANSION_BUDGET.maxShadowCastingLights} lumières projetant des ombres autorisées, trouvé: ${shadowCastingLightsCount}`
);

// Vérifier que la cheminée n'émet pas une ombre supplémentaire masquée
const fireplaceLightsWithShadow = [];
scene.traverse((obj) => {
  if (obj instanceof THREE.Light && obj.castShadow && Math.abs(obj.position.x - (-14)) < 3 && Math.abs(obj.position.z - 13) < 3) {
    fireplaceLightsWithShadow.push(obj);
  }
});
assert.equal(
  fireplaceLightsWithShadow.length,
  0,
  'La cheminée ne doit pas ajouter de lumière à ombre au budget existant'
);

console.log('   -> PASS : Budget nominal de 2 lumières à ombre respecté (pas de mesure GPU).\n');

// ============================================================================
// ÉPREUVE 3 : AMBIANCE SONORE ESPACÉE & HORREUR PSYCHOLOGIQUE
// ============================================================================
console.log('3. Test de la conception sonore espacée (craquements feutrés)...');

const creakSoundPath = path.resolve('public/assets/sounds/creak-soft.wav');
assert.ok(fs.existsSync(creakSoundPath), `Le fichier sonore ${creakSoundPath} doit exister sur le disque`);

const soundStats = fs.statSync(creakSoundPath);
assert.ok(soundStats.size > 1000 && soundStats.size < 200000, `Taille du fichier sonore appropriée pour un micro-asset (<200Ko) : ${soundStats.size} octets`);

// Vérification du header RIFF WAV
const fd = fs.openSync(creakSoundPath, 'r');
const headerBuffer = Buffer.alloc(12);
fs.readSync(fd, headerBuffer, 0, 12, 0);
fs.closeSync(fd);

const riffTag = headerBuffer.toString('ascii', 0, 4);
const waveTag = headerBuffer.toString('ascii', 8, 12);
assert.equal(riffTag, 'RIFF', 'Le fichier doit avoir un en-tête RIFF valide');
assert.equal(waveTag, 'WAVE', 'Le format audio doit être du WAV');

// Vérifier le nouveau directeur, qui remplace l'ancien timer local de Game.
const source = {
  isPlaying: false,
  playCount: 0,
  position: new THREE.Vector3(),
  setVolume() {},
  play() { this.isPlaying = true; this.playCount++; },
  stop() { this.isPlaying = false; },
  disconnect() {},
};
const director = new HorrorDirector(() => 0);
director.setSource(source);
const backPoint = [{ x: 0, y: 1.3, z: 10 }];
for (let i = 0; i < 359; i++) director.update(0.05, true, new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 0, -1), backPoint);
assert.equal(source.playCount, 0, 'Aucun craquement avant 18 secondes de temps éligible');
director.update(0.05, true, new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 0, -1), backPoint);
assert.equal(source.playCount, 1, 'Le craquement démarre après le délai hors regard');
director.update(0.05, true, new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 0, -1), backPoint);
assert.equal(source.playCount, 1, 'Une seule lecture est autorisée par accalmie');
director.suspend();
director.dispose();

console.log('   -> PASS : Audio WAV valide et ordonnanceur F5 unique, temporisé et sans répétition vérifiés.\n');

// ============================================================================
// ÉPREUVE 4 : DOCUMENTATION DES SPRITES MANQUANTS POUR LA PASSE GRAPHIQUE
// ============================================================================
console.log('4. Test de documentation des assets graphiques manquants (F2/F3)...');

for (const up of UPGRADE_CONFIGS) {
  assert.ok(up.spriteAssetId, `L'amélioration ${up.id} doit déclarer un identifiant de sprite cible (spriteAssetId)`);
  assert.ok(
    up.spriteAssetId.endsWith('.png') || up.spriteAssetId.endsWith('.svg'),
    `L'identifiant ${up.spriteAssetId} doit spécifier une extension d'image`
  );
}

console.log('   -> PASS : Tous les sprites manquants sont documentés avec identifiant d\'asset cible.\n');

console.log('================================================================');
console.log('TOUTES LES VALIDATIONS DE LA SALLE TÉMOIN F3 SONT 100% RÉUSSIES !');
console.log('================================================================');
