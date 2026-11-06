import { mkdirSync, writeFileSync } from 'node:fs';

if (process.argv.includes('--textures')) {
  throw new Error('Les murs utilisent désormais le lot commun papier/lambris. Pour inspecter ces surfaces, lancer node scripts/make-composition-preview.mjs ; cet aperçu compare uniquement les lumières du Salon.');
}
const outputDirectory = 'tmp/salon-preview';

// Référence figée avant la recomposition du 5 novembre ; aucun réglage du jeu n'est sauvegardé par cet aperçu.
const before = [
  { name: 'salon-hearth', position: [-14, 2.6, 13], intensity: 1.9, distance: 9, decay: 1.5, color: 0xff9d3b },
  { name: 'salon-window-fill', position: [-8.5, 2.3, 18.2], intensity: 1.2, distance: 7, decay: 2, color: 0x819fbd },
  { name: 'salon-passage-fill', position: [-5.2, 2.5, 9.5], intensity: .85, distance: 4.5, decay: 2, color: 0xe6bc81 },
];
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(outputDirectory + '/index.html', `<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DEAD SECTOR · Salon lumières avant / après</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#10131a;color:#d4c6a5;font:14px monospace}
header,footer{padding:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
button{background:#242526;color:#d4c6a5;border:1px solid #665a40;padding:9px;cursor:pointer;font:inherit}
button[aria-pressed=true]{background:#514834}main{height:calc(100dvh - 160px);min-height:280px}
canvas{display:block;width:100%;height:100%;image-rendering:pixelated}footer{font-size:12px}#measure{white-space:pre-wrap}
</style>
<header><strong>Salon · comparaison</strong><button data-view="entry">Entrée</button><button data-view="hearth">Cheminée</button><button data-view="passage">Passage</button><button data-view="window">Fenêtre</button><button data-view="neighbour">Vestibule</button><button id="mode">Après</button><button id="torch">Lampe allumée</button><button id="enemy">Ennemi visible</button><button id="benchmark">Mesurer A/B</button><button id="capture">Exporter la vue</button></header>
<main id="stage"></main><footer><span id="stats">Chargement…</span><span>Éclairage figé, même exposition 1,05 ; silhouette au repos, sans combat.</span><output id="measure"></output></footer>
<script type="module">
import * as THREE from 'three';
import { Level } from '/src/Level.ts';
import { Zombie } from '/src/Zombie.ts';
const baseline=${JSON.stringify(before)};
const stage=document.querySelector('#stage'),scene=new THREE.Scene();scene.background=new THREE.Color(0x10131a);
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;stage.append(renderer.domElement);
const level=new Level(scene);level.update(0);
const camera=new THREE.PerspectiveCamera(75,1,.1,100);scene.add(camera);
const lamp=new THREE.SpotLight(0xfffaec,22,28,Math.PI/5.2,.5,1.8),target=new THREE.Object3D();lamp.position.set(.2,-.15,-.1);target.position.set(.2,-.15,-5);camera.add(lamp,target);lamp.target=target;
const zombie=new Zombie(scene,level,-10,12),mesh=zombie.getMesh();
const lights=baseline.map(spec=>{const light=scene.getObjectByName(spec.name);if(!light)throw new Error('Source absente : '+spec.name);return light});
const revised=lights.map(light=>({position:light.position.toArray(),intensity:light.intensity,distance:light.distance,decay:light.decay,color:light.color.getHex()}));
// Même phase de scintillement que Level.update(0), phase du foyer = 1,5.
baseline[0].intensity*=1+Math.sin(1.5)*.08+Math.sin(3)*.05+Math.cos(1.5)*.03;
const views={entry:{position:[-4.6,1.7,16.5],look:[-12,1.4,12],enemy:[-9.8,1,13]},hearth:{position:[-8,1.7,14.5],look:[-13,1.5,13],enemy:[-11,1,11]},passage:{position:[-11,1.7,17.5],look:[-12,1.6,6],enemy:[-11.5,1,8.8]},window:{position:[-8.5,1.7,11],look:[-8.5,1.8,19],enemy:[-7,1,16]},neighbour:{position:[1,1.7,13],look:[-3,1.7,16.5],enemy:[-5,1,16.5]}};
let mode=true,view='entry',measuring=false;
function setMode(after){mode=after;lights.forEach((light,i)=>{const spec=(after?revised:baseline)[i];light.position.fromArray(spec.position);light.intensity=spec.intensity;light.distance=spec.distance;light.decay=spec.decay;light.color.setHex(spec.color)});document.querySelector('#mode').textContent='Lumières '+(after?'après':'avant');document.querySelector('#mode').setAttribute('aria-pressed',String(after));}
function setView(name){view=name;const spec=views[name];camera.position.fromArray(spec.position);camera.lookAt(...spec.look);mesh.position.fromArray(spec.enemy);mesh.lookAt(camera.position.x,mesh.position.y,camera.position.z);document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{if(!measuring)setView(button.dataset.view)});
document.querySelector('#mode').onclick=()=>{if(!measuring)setMode(!mode)};
document.querySelector('#torch').onclick=event=>{if(measuring)return;lamp.intensity=lamp.intensity?0:22;event.currentTarget.textContent=lamp.intensity?'Lampe allumée':'Lampe éteinte'};
document.querySelector('#enemy').onclick=event=>{if(measuring)return;mesh.visible=!mesh.visible;event.currentTarget.textContent=mesh.visible?'Ennemi visible':'Ennemi masqué'};
function resize(){renderer.setSize(Math.max(320,Math.floor(stage.clientWidth/3)),Math.max(240,Math.floor(stage.clientHeight/3)),false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix()}window.addEventListener('resize',resize);resize();setView('entry');setMode(true);
document.querySelector('#capture').onclick=()=>{renderer.render(scene,camera);const link=document.createElement('a');link.download='salon-'+view+'-'+(mode?'apres':'avant')+'-'+(lamp.intensity?'lampe':'sans-lampe')+'.png';link.href=renderer.domElement.toDataURL('image/png');link.click()};
let last=0,batch=null,results=[];
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)].toFixed(2);
document.querySelector('#benchmark').onclick=()=>{if(measuring)return;measuring=true;results=[];setMode(false);batch={warmup:120,frames:[],cpu:[],previous:0};document.querySelector('#measure').textContent='Mesure avant : préchauffage puis 240 images…'};
renderer.setAnimationLoop(time=>{
  const start=performance.now();renderer.render(scene,camera);const cpu=performance.now()-start;
  if(time-last>300){last=time;document.querySelector('#stats').textContent=renderer.info.render.calls+' appels · '+renderer.info.render.triangles+' triangles · '+renderer.info.memory.textures+' textures · '+renderer.domElement.width+'×'+renderer.domElement.height;}
  if(!batch)return;
  if(batch.warmup>0){batch.warmup--;batch.previous=time;return;}
  batch.frames.push(time-batch.previous);batch.cpu.push(cpu);batch.previous=time;
  if(batch.frames.length<240)return;
  results.push((mode?'Après':'Avant')+' : intervalle RAF médian/P95 '+percentile(batch.frames,.5)+' / '+percentile(batch.frames,.95)+' ms ; soumission CPU médiane '+percentile(batch.cpu,.5)+' ms');
  if(!mode){setMode(true);batch={warmup:120,frames:[],cpu:[],previous:0};document.querySelector('#measure').textContent=results[0]+' — mesure après…';}
  else{batch=null;measuring=false;document.querySelector('#measure').textContent=results.join(' | ')+' (scène statique, synchronisation écran ; ce ne sont pas des temps GPU ni un test de combat).';}
});
</script></html>`);
console.log('Aperçu : /' + outputDirectory + '/index.html');
