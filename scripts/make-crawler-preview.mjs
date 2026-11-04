import { mkdirSync, writeFileSync } from 'node:fs';

const assetBase = process.argv.includes('--candidate') ? '/tmp/rampeuse-v2/' : '/assets/zombies/crawler/';
mkdirSync('tmp/crawler-preview', { recursive: true });
writeFileSync('tmp/crawler-preview/index.html', `<!doctype html><html lang="fr"><meta charset="utf-8">
<title>Rampeur (Crawler) — cycle isolé</title>
<style>
body{margin:0;background:#171316;color:#e3d7c6;font:16px system-ui;padding:20px}
button{padding:8px 16px;margin:0 8px 16px 0;background:#3c4634;color:white;border:1px solid #88916d;cursor:pointer}
.stages{display:flex;gap:24px;align-items:end}.stage{width:280px;height:200px;background:linear-gradient(#28232b 65%,#322822 65%);display:grid;place-items:end center;border:1px solid #665b54}
.stage img{image-rendering:pixelated}.small img{height:60px}.large img{height:140px}
.comparison{max-width:900px;margin-top:24px}.comparison-labels{display:grid;grid-template-columns:1fr 1fr;text-align:center;gap:12px}
#comparison-view{width:100%;height:340px;margin-top:12px}#comparison-view canvas{width:100%;height:100%;image-rendering:pixelated}
small{display:block;margin-top:12px;color:#bbb}
</style>
<h1>Rampeur (The Crawler) — animations isolées</h1><p id="phase">repos</p>
<label>Vitesse <select id="speed"><option value="1">Normale</option><option value="0.25">Lente (×0,25)</option></select></label>
<button id="crawl">Jouer la rampe</button>
<button id="attack">Jouer l'attaque</button>
<button id="die">Jouer la mort</button>
<button id="stop">Revenir au repos</button>
<button data-pose="idle">Repos</button>
<button data-pose="crawl-a">Rampe A</button>
<button data-pose="crawl-b">Rampe B</button>
<button data-pose="attack">Attaque</button>
<button data-pose="hurt">Blessure</button>
<button data-pose="death">Mort</button>

<div class="stages">
  <div class="stage small"><img id="small" alt="Rampeur à 60 pixels"></div>
  <div class="stage large"><img id="large" alt="Rampeur à 140 pixels"></div>
</div>
<small>La petite taille simule la silhouette rasant le sol à distance dans un couloir sombre.</small>
<section class="comparison">
  <h2>Comparaison 3D depuis les yeux du joueur</h2>
  <p>Caméra à 1,70 m ; même image et même largeur. Éclairage neutre, sans inclinaison du billboard.</p>
  <label>Distance <select id="distance"><option value="1.8">Proche · 1,8 m</option><option value="3.5" selected>Moyenne · 3,5 m</option><option value="6">Loin · 6 m</option></select></label>
  <div class="comparison-labels"><span>Avant · image écrasée (1,6 × 1 m)</span><span>Corrigé · proportions préservées</span></div>
  <div id="comparison-view"></div>
</section>

<script type="module">
import * as THREE from 'three';
import { crawlerAnimation, crawlerConfig, crawlerGroundOffsetY } from '/src/CrawlerAnimation.ts';

for (const [id, height] of [['small', 60], ['large', 140]]) {
  document.getElementById(id).style.width = String(height * crawlerConfig.width / crawlerConfig.height) + 'px';
}

const container = document.querySelector('#comparison-view');
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
container.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 30);
const poseMaterials = {};
const views = [];
const loader = new THREE.TextureLoader();
for (const pose of crawlerAnimation.poses) {
  const map = loader.load(${JSON.stringify(assetBase)} + pose + '.png', () => renderComparison());
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  poseMaterials[pose] = new THREE.MeshStandardMaterial({ map, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
}
// Le cas « avant » est un témoin fixe ; le cas corrigé lit les données du jeu.
for (const [width, height, offset] of [[1.6, 1, 0.5], [crawlerConfig.width, crawlerConfig.height, crawlerGroundOffsetY]]) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202127);
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const light = new THREE.DirectionalLight(0xffebcf, 2);
  light.position.set(2, 5, 3);
  scene.add(light);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), new THREE.MeshStandardMaterial({ color: 0x514437, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.GridHelper(10, 10, 0x87745c, 0x645545));
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(width, height), poseMaterials.idle);
  sprite.position.y = offset;
  scene.add(sprite);
  views.push({ scene, sprite });
}
function renderComparison() {
  const width = Math.max(2, container.clientWidth), height = 340;
  renderer.setSize(width, height, false);
  const half = Math.floor(width / 2);
  camera.aspect = half / height;
  camera.position.set(0, 1.7, Number(document.querySelector('#distance').value));
  camera.lookAt(0, 0.45, 0);
  camera.updateProjectionMatrix();
  renderer.setScissorTest(true);
  views.forEach(({ scene }, index) => {
    const viewportWidth = index === 0 ? half : width - half;
    renderer.setViewport(index * half, 0, viewportWidth, height);
    renderer.setScissor(index * half, 0, viewportWidth, height);
    renderer.render(scene, camera);
  });
}
document.querySelector('#distance').onchange = renderComparison;
window.addEventListener('resize', renderComparison);

const crawlCycle = [
  ['rampe A', 'crawl-a', crawlerAnimation.crawlPoseDuration * 1000],
  ['rampe B', 'crawl-b', crawlerAnimation.crawlPoseDuration * 1000],
  ['rampe A', 'crawl-a', crawlerAnimation.crawlPoseDuration * 1000],
  ['rampe B', 'crawl-b', crawlerAnimation.crawlPoseDuration * 1000],
  ['repos', 'idle', 400]
];
const attackCycle = [
  ['préparation / attaque', 'attack', (crawlerConfig.attackWindup + crawlerConfig.attackRecovery) * 1000],
  ['repos', 'idle', 400]
];
const deathCycle = [
  ['affaissement', 'death', crawlerAnimation.deathDuration * 1000]
];

let timer;
function show(name, file) {
  document.querySelector('#phase').textContent = name;
  for (const id of ['small', 'large']) {
    document.getElementById(id).src = ${JSON.stringify(assetBase)} + file + '.png';
  }
  for (const { sprite } of views) sprite.material = poseMaterials[file];
  renderComparison();
}
function stop() { clearTimeout(timer); show('repos', 'idle'); }
function step(sequence, i) {
  const [name, file, duration] = sequence[i];
  show(name, file);
  if (i + 1 < sequence.length) timer = setTimeout(() => step(sequence, i + 1), duration / Number(document.querySelector('#speed').value));
}

document.querySelector('#crawl').onclick = () => { clearTimeout(timer); step(crawlCycle, 0); };
document.querySelector('#attack').onclick = () => { clearTimeout(timer); step(attackCycle, 0); };
document.querySelector('#die').onclick = () => { clearTimeout(timer); step(deathCycle, 0); };
document.querySelector('#stop').onclick = stop;
document.querySelectorAll('[data-pose]').forEach(b => b.onclick = () => { clearTimeout(timer); show(b.textContent.toLowerCase(), b.dataset.pose); });

stop();
</script>`);
console.log('Aperçu Rampeur prêt : http://localhost:5173/tmp/crawler-preview/index.html');
