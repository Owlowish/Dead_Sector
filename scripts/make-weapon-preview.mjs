// Aperçu statique des vraies couches DOM/CSS, indépendant du combat et du Pointer Lock.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { reloadPoses } from '../src/WeaponAnimation.ts';
const html = readFileSync('index.html', 'utf8');
const markup = html.slice(html.indexOf('<div class="hud"'), html.indexOf('<div id="objective"'));
const cases = [
  { label: 'Hanche : repos', aim: 0, slide: 0 },
  { label: 'Hanche : culasse reculée', aim: 0, slide: 1 },
  { label: 'ADS : repos', aim: 1, slide: 0 },
  { label: 'ADS : culasse reculée', aim: 1, slide: 1 },
  ...reloadPoses.map(pose => ({ ...pose, label: pose.phase, aim: 0, slide: 0 })),
];
mkdirSync('tmp/weapon-preview', { recursive: true });
writeFileSync('tmp/weapon-preview/index.html', `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/src/style.css">
<style>
body{overflow:auto;background:#32363c;color:#d4c6a5;font:14px monospace;margin:16px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.card{height:420px;position:relative;border:1px solid #b69a60;overflow:hidden;background:repeating-linear-gradient(0deg,#34383e 0 39px,#41464d 39px 40px)}
.card header{position:relative;z-index:3;padding:8px;background:#181b1b}
.card .hud{position:absolute;--aim:inherit}
.card .weapon-hip{width:100%;bottom:0;left:20%;transform:none}
.card .weapon-ads{width:150%;top:34%}
.card .crosshair{top:34%}
.animation{width:min(600px,95vw);margin-bottom:20px}
button{padding:10px;cursor:pointer;font:inherit}
</style><h1>Vérification des couches de l'arme</h1>
<button id="play">Jouer un seul rechargement (1,6 s)</button>
<section class="card animation" id="animation"><header id="phase">Repos</header>${markup}</section>
<div class="grid">${cases.map(c => `<section class="card" style="--aim:${c.aim};--slide:${c.slide};--hand-x:${c.x ?? 0}%;--hand-y:${c.y ?? 0}%;--hand-opacity:${c.opacity ?? 0};--magazine-opacity:${c.magazine ?? 0}"><header>${c.label}</header>${markup.replace('class="hud"', `class="hud" style="--aim:${c.aim}"`)}</section>`).join('')}</div>
<script>
const poses = ${JSON.stringify(reloadPoses)};
const rig = document.querySelector('#animation #weapon-hip-sprite');
const button = document.querySelector('#play');
function show(pose) {
  rig.style.setProperty('--hand-x', (pose?.x ?? 0) + '%');
  rig.style.setProperty('--hand-y', (pose?.y ?? 0) + '%');
  rig.style.setProperty('--hand-opacity', pose?.opacity ?? 0);
  rig.style.setProperty('--magazine-opacity', pose?.magazine ?? 0);
  document.querySelector('#phase').textContent = pose?.phase ?? 'Repos — terminé';
}
button.onclick = () => {
  button.disabled = true;
  const start = performance.now();
  function tick(now) {
    let elapsed = (now - start) / 1000;
    let selected;
    for (const pose of poses) {
      if (elapsed < pose.duration) { selected = pose; break; }
      elapsed -= pose.duration;
    }
    show(selected);
    if (selected) requestAnimationFrame(tick);
    else button.disabled = false;
  }
  requestAnimationFrame(tick);
};
</script>`);
console.log('Aperçu : /tmp/weapon-preview/index.html');
const assets = pathToFileURL(resolve('public/assets')).href + '/';
const css = readFileSync('src/style.css', 'utf8').replaceAll('/assets/', assets);
const standalone = readFileSync('tmp/weapon-preview/index.html', 'utf8')
  .replaceAll('/assets/', assets)
  .replace('<link rel="stylesheet" href="/src/style.css">', `<style>${css}</style>`);
writeFileSync('tmp/weapon-preview/standalone.html', standalone);
