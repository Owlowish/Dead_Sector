import { spawn } from 'node:child_process';

console.log('=== MESURE DES PERFORMANCES RÉELLES — DEAD SECTOR ===\n');
console.log('Démarrage de Chrome headless pour profilage en direct...');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  'http://localhost:5173/'
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBenchmark() {
  // Attendre 2 secondes que Chrome initialise le port de débogage
  let wsUrl = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find((t) => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {
      // Chrome démarre encore...
    }
    await sleep(250);
  }

  if (!wsUrl) {
    console.error('Impossible de se connecter au port de débogage de Chrome.');
    chrome.kill();
    process.exit(1);
  }

  console.log('Connecté au moteur Chrome via DevTools Protocol.');
  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const pending = new Map();
  // Capture des logs de console PERF
  let lastGamePerf = null;
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      const msg = data.params.args.map((a) => a.value ?? a.description).join(' ');
      if (msg.includes('[PERF]')) {
        lastGamePerf = msg;
      }
    }
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };

  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  await send('Runtime.enable');
  await send('Performance.enable');

  console.log('Attente du chargement complet de l\'application...');
  for (let i = 0; i < 30; i++) {
    const ready = await send('Runtime.evaluate', {
      expression: 'document.readyState === "complete" && typeof window.__DEAD_SECTOR_PERF === "function"',
      returnByValue: true,
    });
    if (ready?.result?.value === true) break;
    await sleep(200);
  }

  console.log('Simulation active en cours (rendu Three.js, shaders, boucle de jeu)...');
  // Laisser tourner le jeu pendant 3 secondes pour que WebGL accumule des frames
  await sleep(3000);

  // 1. Récupération des métriques du jeu exposées par Game.ts
  const evalResult = await send('Runtime.evaluate', {
    expression: 'window.__DEAD_SECTOR_PERF ? window.__DEAD_SECTOR_PERF() : null',
    returnByValue: true,
  });

  // 2. Récupération des métriques bas-niveau du moteur Chromium
  const cdpMetrics = await send('Performance.getMetrics');

  chrome.kill();
  ws.close();

  console.log('\n=============================================================');
  console.log('RAPPORT TECHNIQUE DÉTAILLÉ : RESSOURCES, RENDU ET CPU');
  console.log('=============================================================\n');

  const gameStats = evalResult?.result?.value;
  if (lastGamePerf) {
    console.log('1. FLUIDITÉ & RENDU WEBGL (Moteur de jeu Three.js) :');
    console.log(`   ${lastGamePerf}`);
  } else if (gameStats) {
    console.log('1. FLUIDITÉ & RENDU WEBGL (Three.js) :');
    console.log(`   - Framerate cible / mesuré : ${gameStats.fps} FPS`);
    console.log(`   - Temps de frame moyen     : ${gameStats.frameTimeMs} ms (budget 60 FPS = 16.6 ms)`);
    console.log(`   - Draw calls par frame     : ${gameStats.drawCalls}`);
    console.log(`   - Triangles par frame      : ${gameStats.triangles.toLocaleString('fr-FR')}`);
    console.log(`   - Géométries en mémoire    : ${gameStats.geometries}`);
    console.log(`   - Textures chargées GPU    : ${gameStats.textures}`);
    console.log(`   - Shaders compilés         : ${gameStats.shaders}`);
    console.log(`   - Résolution interne rétro : ${gameStats.internalResolution} (sur écran ${gameStats.viewportResolution})`);
    console.log(`   - Entités actives          : ${gameStats.activeZombies} zombie(s), file: ${gameStats.spawnQueue}`);

    console.log('\n2. CONSOMMATION MÉMOIRE (RAM JS / HEAP) :');
    if (gameStats.jsHeapUsedMB !== null) {
      console.log(`   - RAM JavaScript utilisée  : ${gameStats.jsHeapUsedMB} Mo`);
      console.log(`   - RAM JavaScript allouée   : ${gameStats.jsHeapTotalMB} Mo`);
    }
  } else {
    console.log('Avertissement : Les métriques de jeu n\'ont pas pu être lues (valeur null).');
  }

  if (cdpMetrics?.result?.metrics) {
    const m = new Map(cdpMetrics.result.metrics.map((x) => [x.name, x.value]));
    console.log('\n3. MÉTRIQUES MOTEUR BROWSER (Chromium Performance API) :');
    const jsHeapUsed = (m.get('JSHeapUsedSize') || 0) / (1024 * 1024);
    const jsHeapTotal = (m.get('JSHeapTotalSize') || 0) / (1024 * 1024);
    const nodes = m.get('Nodes') || 0;
    const taskDuration = (m.get('TaskDuration') || 0) * 1000;
    const layoutDuration = (m.get('LayoutDuration') || 0) * 1000;
    const scriptDuration = (m.get('ScriptDuration') || 0) * 1000;

    console.log(`   - Tas JS Chrome effectif   : ${jsHeapUsed.toFixed(2)} Mo / ${jsHeapTotal.toFixed(2)} Mo`);
    console.log(`   - Nœuds DOM du document    : ${nodes}`);
    console.log(`   - Temps CPU cumulé scripts : ${scriptDuration.toFixed(1)} ms`);
    console.log(`   - Temps CPU cumulé layout  : ${layoutDuration.toFixed(1)} ms`);
    console.log(`   - Temps CPU cumulé total   : ${taskDuration.toFixed(1)} ms`);
  }

  console.log('\n=============================================================\n');
}

runBenchmark().catch((err) => {
  console.error('Erreur benchmark :', err);
  chrome.kill();
  process.exit(1);
});
