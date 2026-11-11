import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readSpritePng } from './sprite-png-info.mjs';
import { installWeaponArt, weaponArtCss } from '../src/WeaponPresentation.ts';

const pack = JSON.parse(readFileSync('docs/asset-packs/PROVENANCE_ASSETS.json', 'utf8')).runtimeWeaponExports;
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(pack.assets.length, 10);
for (const asset of pack.assets) {
  assert.equal(hash(asset.source), asset.sourceSha256, 'Source originale conservée');
  assert.equal(hash(asset.export), asset.exportSha256, 'Export reproductible référencé');
  const source = readSpritePng(asset.source), output = readSpritePng(asset.export);
  assert.deepEqual([output.width, output.height], asset.exportSize);
  assert.equal(output.width % asset.columns, 0, 'Pas de cellule coupée horizontalement');
  assert.equal(output.height % asset.rows, 0, 'Pas de cellule coupée verticalement');
  for (let i = 3; i < output.data.length; i += 4) assert(output.data[i] === 0 || output.data[i] === 255);
  for (let row = 0; row < asset.rows; row++) for (let column = 0; column < asset.columns; column++) {
    const silhouette = image => {
      let count = 0, sumX = 0, sumY = 0;
      for (let y = row * image.height / asset.rows; y < (row + 1) * image.height / asset.rows; y++) {
        for (let x = column * image.width / asset.columns; x < (column + 1) * image.width / asset.columns; x++) {
          if (image.data[(y * image.width + x) * 4 + 3] < 128) continue;
          count++; sumX += (x + 0.5) / image.width; sumY += (y + 0.5) / image.height;
        }
      }
      return { count, x: sumX / count, y: sumY / count, area: count / (image.width * image.height) };
    };
    const a = silhouette(source), b = silhouette(output);
    assert(a.count && b.count, `Silhouette présente dans chaque cellule : ${asset.export}`);
    // Le centre de masse ignore les points isolés des sources que la réduction élimine.
    assert(Math.abs(a.x - b.x) <= 2 / output.width && Math.abs(a.y - b.y) <= 2 / output.height,
      `Ancrage de silhouette conservé ${asset.export} cellule ${column},${row}`);
    assert(Math.abs(a.area - b.area) / a.area < 0.08, `Volume apparent conservé ${asset.export}`);
  }
}
assert(pack.totals.exportBytes < 800000);
assert(pack.totals.exportRgba8Bytes < 6 * 1024 * 1024);

const styles = new Map();
globalThis.document = {
  documentElement: { style: { setProperty: (name, value) => styles.set(name, value) } },
  createElement() { throw new Error('Aucun traitement canvas à l’exécution'); },
};
globalThis.window = { addEventListener() { throw new Error('Aucun retraitement au resize'); } };
let releaseDecode;
const heldDecode = new Promise(resolve => { releaseDecode = resolve; });
let held = true, failure = false, loads = 0;
globalThis.Image = class {
  set src(value) {
    this.url = value; loads++;
    queueMicrotask(() => {
      if (failure && value.endsWith('/flash.png')) this.onerror?.();
      else this.onload?.();
    });
  }
  decode() { return held && this.url.endsWith('/pistol_actions_v3.png') ? heldDecode : Promise.resolve(); }
};
let ready = false;
const loading = installWeaponArt('/preview/assets/').then(() => { ready = true; });
await Promise.resolve(); await Promise.resolve();
assert.equal(ready, false, 'La disponibilité attend le décodage réel');
releaseDecode(); await loading;
assert.equal(loads, 10);
assert.equal(styles.size, 10);
for (const value of styles.values()) assert(value.startsWith('url("/preview/assets/weapons/retro/'));
assert.equal(weaponArtCss('/assets/weapons/shotgun/hip-rest-v2.png'), 'var(--weapon-art-hip-rest-v2, url("/assets/weapons/retro/hip-rest-v2.png"))');
held = false; failure = true;
await assert.rejects(installWeaponArt(), /Image d'arme indisponible.*flash/);
console.log('PASS : dix dérivés, sources/SHA, alpha/cellules/cadrage, budgets, attente décodage et erreur de chargement ; aucun canvas/resize runtime.');
