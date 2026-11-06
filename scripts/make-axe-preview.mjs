import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('tmp/axe-preview', { recursive: true });
writeFileSync('tmp/axe-preview/index.html', `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Hache — action verticale</title>
<style>
html,body{margin:0;height:100%;overflow:hidden;background:#252b2e;color:#d4c6a5;font:15px monospace}
.weapon-view{position:absolute;inset:0;pointer-events:none;background:linear-gradient(#1b2025,#333634)}
.target{position:absolute;left:50%;top:50%;width:4px;height:4px;background:#b69a60;border-radius:50%}
header{position:absolute;z-index:2;top:12px;left:12px;padding:12px;background:#111a;max-width:calc(100vw - 48px)}
button,input{font:inherit;accent-color:#8f2929}button{padding:7px;margin:3px;cursor:pointer}
#time{display:block;width:100%;margin-top:10px}p{margin:8px 0 0}
</style><div class="weapon-view"></div><div class="target"></div>
<header>HACHE RUSTIQUE · attaque verticale · mêmes poses et chronologie que le jeu
<p><button id="play">Frapper</button><button id="slow">Ralenti ×0,25</button><button id="pause">Pause</button><button id="rest">Repos</button></p>
<input id="time" type="range" min="0" max="1.45" step="0.005" value="0"><p id="phase">Repos</p></header>
<script type="module">
import { AxeView } from '/src/AxeView.ts';
import { axeAttack, sampleAxePose, axeAssets } from '/src/AxeAnimation.ts';
const view = new AxeView(document.querySelector('.weapon-view'));
view.setVisible(true);view.update(Infinity);
let elapsed=Infinity,speed=1,playing=false,previous=performance.now();
const slider=document.querySelector('#time');
function show(time){elapsed=time;view.update(time);slider.value=Number.isFinite(time)?time:0;
document.querySelector('#phase').textContent=Number.isFinite(time)?time.toFixed(3)+' s · '+sampleAxePose(time).phase:'Repos';}
document.querySelector('#play').onclick=()=>{show(0);speed=1;playing=true};
document.querySelector('#slow').onclick=()=>{show(0);speed=.25;playing=true};
document.querySelector('#pause').onclick=()=>{playing=!playing};
document.querySelector('#rest').onclick=()=>{playing=false;show(Infinity)};
slider.oninput=()=>{playing=false;show(Number(slider.value))};
function tick(now){const delta=Math.min(.05,(now-previous)/1000);previous=now;
if(playing){show(Math.min(axeAttack.duration,Number.isFinite(elapsed)?elapsed+delta*speed:0));if(elapsed>=axeAttack.duration)playing=false;}
requestAnimationFrame(tick)}requestAnimationFrame(tick);
window.__axePreview={show,view,assets:axeAssets};
</script></html>`);
console.log('Aperçu isolé : /tmp/axe-preview/index.html (via Vite).');
