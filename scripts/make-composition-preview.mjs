import { mkdirSync, writeFileSync } from 'node:fs';

const directory = 'tmp/composition-preview';
mkdirSync(directory, { recursive: true });
writeFileSync(directory + '/index.html', `<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DEAD SECTOR · Composition des pièces</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#10131a;color:#d4c6a5;font:13px monospace}
header,footer{padding:12px 18px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
header{border-bottom:1px solid #665a40}nav{display:flex;gap:5px;flex-wrap:wrap}
button{background:#242526;color:#d4c6a5;border:1px solid #665a40;padding:9px;cursor:pointer;font:inherit}
button[aria-pressed="true"]{background:#514834}main{height:calc(100dvh - 185px);min-height:300px}
canvas{display:block;width:100%;height:100%;image-rendering:pixelated}p{margin:0 18px 8px;min-height:2em}
small{color:#b69a60}#stats{margin-right:auto}
</style>
<header><strong>Composition du manoir</strong><nav id="rooms" aria-label="Pièce"></nav><nav id="views" aria-label="Vue"><button data-view="overview">Ensemble</button><button data-view="focus">Point focal</button><button data-view="calm">Mur calme</button></nav><button id="lamp" aria-pressed="true">Lampe allumée</button><button id="animation" aria-pressed="true">Feu et poussière animés</button><button id="capture">Exporter la vue</button></header>
<p id="description"></p><main id="stage"></main><footer><span id="stats">Chargement…</span><small>Niveau réel · exposition 1,05 · sans combat ni déplacement. Les compteurs incluent les passes de rendu ; ils ne mesurent pas le temps GPU.</small></footer>
<script type="module">
import * as THREE from 'three';
import { Level } from '/src/Level.ts';
import { MANSION_ROOMS } from '/src/MansionConfig.ts';
import { roomCompositions } from '/src/MansionComposition.ts';

const stage=document.querySelector('#stage'), scene=new THREE.Scene();scene.background=new THREE.Color(0x10131a);
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;stage.append(renderer.domElement);
const level=new Level(scene);level.update(0);
const camera=new THREE.PerspectiveCamera(75,1,.1,100);scene.add(camera);
const lamp=new THREE.SpotLight(0xfffaec,22,28,Math.PI/5.2,.5,1.8),aim=new THREE.Object3D();lamp.position.set(.2,-.15,-.1);aim.position.set(.2,-.15,-5);camera.add(lamp,aim);lamp.target=aim;
const views={
  vestibule:{overview:{position:[7,1.7,12.6],look:[12,2.06,19.405]},focus:{position:[12,1.7,15],look:[12,2.06,19.405]}},
  salon:{overview:{position:[-4.6,1.7,16.5],look:[-14,1.5,13]},focus:{position:[-8.8,1.7,13],look:[-13.3,1,13]}},
  galerie:{overview:{position:[-5.5,1.7,4],look:[-18,1.8,0]},focus:{position:[-18,1.7,4.7],look:[-18,1.9,0]}},
  grand_hall:{overview:{position:[0,1.7,4],look:[8,3.6,0]},focus:{position:[8,1.7,4.2],look:[8,4,0]}},
  bibliotheque:{overview:{position:[-5.5,4.1,-9],look:[-13,4.4,-14]},focus:{position:[-6.5,4.1,-14],look:[-13,4.4,-14]}},
  atelier:{overview:{position:[18,4.1,-9.5],look:[12,3.7,-14]},focus:{position:[12,4.1,-10.7],look:[12,3.6,-14]}}
};
let roomId=MANSION_ROOMS[0].id,viewName='overview',animated=true;
function move(){
  const room=MANSION_ROOMS.find(item=>item.id===roomId),composition=roomCompositions.find(item=>item.roomId===roomId);
  if(viewName==='calm'){
    // La caméra regarde le milieu du segment réellement réservé dans les données du jeu.
    const wall=composition.calmWall,along=(wall.low+wall.high)/2;
    const x=wall.axis==='x'?wall.plane:along,z=wall.axis==='z'?wall.plane:along;
    const y=level.getFloorHeightAt(x,z)+1.7;
    camera.position.set(x,y,z);
    const middle=wall.axis==='x'?(room.bounds.minX+room.bounds.maxX)/2:(room.bounds.minZ+room.bounds.maxZ)/2;
    camera.position[wall.axis]+=Math.sign(middle-wall.plane)*3.2;
    camera.lookAt(x,y,z);
  }else{
    const view=views[roomId][viewName];camera.position.fromArray(view.position);camera.lookAt(...view.look);
  }
  for(const button of document.querySelectorAll('[data-room]'))button.setAttribute('aria-pressed',String(button.dataset.room===roomId));
  for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===viewName));
  document.querySelector('#description').textContent=room.name+' · '+composition.focus.label+' — '+composition.secondary+(viewName==='calm'?' Zone murale volontairement laissée sans tableau ni panneau.':'');
}
for(const room of MANSION_ROOMS){const button=document.createElement('button');button.textContent=room.name;button.dataset.room=room.id;button.onclick=()=>{roomId=room.id;move()};document.querySelector('#rooms').append(button)}
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{viewName=button.dataset.view;move()};
document.querySelector('#lamp').onclick=event=>{lamp.intensity=lamp.intensity?0:22;event.currentTarget.textContent=lamp.intensity?'Lampe allumée':'Lampe éteinte';event.currentTarget.setAttribute('aria-pressed',String(lamp.intensity>0))};
document.querySelector('#animation').onclick=event=>{animated=!animated;event.currentTarget.textContent=animated?'Feu et poussière animés':'Feu et poussière figés';event.currentTarget.setAttribute('aria-pressed',String(animated))};
document.querySelector('#capture').onclick=()=>{renderer.render(scene,camera);const link=document.createElement('a');link.download='composition-'+roomId+'-'+viewName+'-'+(lamp.intensity?'lampe':'sans-lampe')+'.png';link.href=renderer.domElement.toDataURL('image/png');link.click()};
function resize(){const width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight);renderer.setSize(Math.max(1,Math.floor(width/3)),Math.max(1,Math.floor(height/3)),false);camera.aspect=width/height;camera.updateProjectionMatrix()}
window.addEventListener('resize',resize);resize();move();
let previous=null,last=0;
renderer.setAnimationLoop(time=>{
  const delta=previous===null?0:Math.min(Math.max((time-previous)/1000,0),.05);previous=time;
  // Le premier delta reste nul : les lumières sont figées, seuls feu et poussière avancent.
  level.update(0,animated?delta:0);renderer.render(scene,camera);
  if(time-last>300){last=time;document.querySelector('#stats').textContent=renderer.info.render.calls+' appels · '+renderer.info.render.triangles+' triangles · '+renderer.info.memory.textures+' textures · '+renderer.domElement.width+'×'+renderer.domElement.height}
});
window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);level.disposeDecor();renderer.dispose()},{once:true});
</script></html>`);
console.log('Aperçu : /' + directory + '/index.html sur le serveur Vite.');
