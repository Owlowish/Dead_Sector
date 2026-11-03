import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const label = process.argv[2] ?? 'mesure-1';
const port = 5182;
const chromePort = 9360;

console.log(`=== PROFILAGE ET MESURE COMPARATIVE (Tiers 4 à 7) — ${label} ===\n`);

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Vérifier si le serveur Vite tourne déjà
let viteProcess = null;
let serverReady = false;

try {
  const res = await fetch(`http://localhost:${port}/`);
  if (res.ok) serverReady = true;
} catch {}

if (!serverReady) {
  console.log(`Démarrage du serveur Vite sur le port ${port}...`);
  viteProcess = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', '--port', String(port), '--host', '127.0.0.1'], {
    stdio: 'ignore',
    windowsHide: true,
  });

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {}
    await pause(250);
  }
}

if (!serverReady) {
  console.error('Erreur : Impossible de contacter le serveur Vite.');
  viteProcess?.kill();
  process.exit(1);
}

console.log('Serveur Vite prêt. Démarrage de Chrome headless...');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chrome = spawn(chromePath, [
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${resolve('tmp', 'chrome-measure-' + label)}`,
  'about:blank'
], { windowsHide: true, stdio: 'ignore' });

let ws;
let target;
for (let i = 0; i < 60; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${chromePort}/json`)).json();
    target = targets.find((t) => t.type === 'page');
    if (target) break;
  } catch {}
  await pause(250);
}

if (!target) {
  console.error('Erreur : Impossible d\'accéder à Chrome via CDP.');
  chrome.kill();
  viteProcess?.kill();
  process.exit(1);
}

ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let msgId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(Error(JSON.stringify(m.error)));
    else p.resolve(m.result);
  }
};

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:${port}/` });

console.log('Attente du chargement initial du jeu...');
for (let i = 0; i < 60; i++) {
  const ready = await evaluate(`!!window.__DEAD_SECTOR_START_TIER && !!window.__DEAD_SECTOR_PERF`);
  if (ready) break;
  await pause(250);
}

// Activer le Pointer Lock virtuel pour simuler l'état de jeu actif
await evaluate(`(() => {
  const canvas = document.querySelector('canvas');
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    get: () => canvas
  });
  document.dispatchEvent(new Event('pointerlockchange'));
})()`);

await pause(1000);

console.log('\n--- DÉBUT DE LA MESURE SUR LES PALIERS 4 À 7 ---');

const tierReports = [];

for (const tier of [4, 5, 6, 7]) {
  console.log(`\nSimulation Palier ${tier}...`);
  await evaluate(`window.__DEAD_SECTOR_START_TIER(${tier})`);

  // Attendre l'apparition initiale de l'ouverture
  await pause(1500);

  let combatDone = false;
  const startSimTime = Date.now();

  // Progression de combat : éliminer un ennemi toutes les 1.2s jusqu'à la fin de la rencontre
  while (!combatDone && (Date.now() - startSimTime < 30000)) {
    // Vérifier l'état d'achèvement
    const waveState = await evaluate(`(() => {
      const perf = window.__DEAD_SECTOR_PERF();
      return {
        active: perf.activeZombies,
        queue: perf.spawnQueue,
        state: perf.state
      };
    })()`);

    if (waveState.queue === 0 && waveState.active === 0) {
      combatDone = true;
      break;
    }

    // Frapper un ennemi
    if (waveState.active > 0) {
      await evaluate(`window.__DEAD_SECTOR_DAMAGE_TARGET(120)`);
    }

    await pause(900);
  }

  // Laisser stabiliser les cadavres et enregistrer les métriques
  await pause(1000);

  const perf = await evaluate(`window.__DEAD_SECTOR_PERF()`);
  const diags = await evaluate(`window.__DEAD_SECTOR_DIAGNOSTICS()`);
  const latestDiag = diags.find((d) => d.tierNumber === tier) || diags.at(-1);

  tierReports.push({
    tier,
    perf,
    diagnostic: latestDiag,
  });

  console.log(`Palier ${tier} mesuré :`);
  console.log(`   - FPS / Frame time médian : ${perf.fps} FPS (${perf.medianFrameTimeMs} ms)`);
  console.log(`   - Percentile p95 / p99    : ${perf.p95FrameTimeMs} ms / ${perf.p99FrameTimeMs} ms`);
  console.log(`   - Max frame time / Saccades >33ms: ${perf.maxFrameTimeMs} ms (${perf.framesOver33Ms} frames > 33ms)`);
  console.log(`   - Draw calls / Triangles  : ${perf.drawCalls} calls / ${perf.triangles.toLocaleString('fr-FR')} tris`);
  console.log(`   - Textures GPU / Shaders  : ${perf.textures} textures / ${perf.shaders} shaders`);
  if (latestDiag) {
    console.log(`   - Durée combat mesurée   : ${latestDiag.durationSeconds} s`);
    console.log(`   - Menaces max simultanées: ${latestDiag.maxSimultaneousThreats}`);
    console.log(`   - Types apparus          : Standard: ${latestDiag.spawnedByType.standard}, Agile: ${latestDiag.spawnedByType.agile}, Spitter: ${latestDiag.spawnedByType.spitter}`);
    console.log(`   - Dégâts subis / Tirs    : ${latestDiag.damageTaken} PV / ${latestDiag.shotsFired} tirs`);
  }
}

ws.close();
chrome.kill();
viteProcess?.kill();

console.log('\n=============================================================');
console.log(`BILAN SYNTHÉTIQUE — ${label.toUpperCase()}`);
console.log('=============================================================');
for (const rep of tierReports) {
  const d = rep.diagnostic;
  const p = rep.perf;
  console.log(`Palier ${rep.tier} :`);
  console.log(`   * Durée: ${d?.durationSeconds ?? 0}s | Tirs: ${d?.shotsFired ?? 0} | Dégâts subis: ${d?.damageTaken ?? 0} PV`);
  console.log(`   * Menaces max: ${d?.maxSimultaneousThreats ?? 0} | Composition: [Std: ${d?.spawnedByType.standard ?? 0}, Agile: ${d?.spawnedByType.agile ?? 0}, Spit: ${d?.spawnedByType.spitter ?? 0}]`);
  console.log(`   * Rendu: ${p.fps} FPS (médiane: ${p.medianFrameTimeMs}ms, p95: ${p.p95FrameTimeMs}ms, max: ${p.maxFrameTimeMs}ms, saccades >33ms: ${p.framesOver33Ms})`);
  console.log(`   * Scène: ${p.drawCalls} draw calls, ${p.triangles.toLocaleString('fr-FR')} triangles, ${p.textures} textures`);
}
console.log('=============================================================\n');
