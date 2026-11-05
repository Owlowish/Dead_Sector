import { mkdirSync, writeFileSync } from 'node:fs';

const relief = process.argv.includes('--relief');
const directory = relief ? 'tmp/mansion-relief-preview' : 'tmp/dressing-preview';
mkdirSync(directory, { recursive: true });
writeFileSync(directory + '/index.html', `<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DEAD SECTOR · ${relief ? 'Relief et ambiance' : 'Décor du manoir'}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#10131a;color:#d4c6a5;font:13px monospace}
header{padding:12px 18px;border-bottom:1px solid #b69a60;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
button{background:#242526;color:#d4c6a5;border:1px solid #665a40;padding:9px;cursor:pointer;font:inherit}button[aria-pressed="true"]{background:#514834}
main{height:calc(100dvh - 112px);min-height:300px}canvas{display:block;width:100%;height:100%;image-rendering:pixelated}
footer{padding:10px 18px;color:#b69a60}output{margin-left:auto}small{opacity:.75}
</style>
<header><strong>${relief ? 'Relief et ambiance' : 'Habillage du manoir'}</strong><nav id="rooms"></nav><button id="mode" aria-pressed="true">Après · décor actif</button><button id="next">Objet suivant</button><button id="lamp">Lampe allumée</button><output id="label"></output>${relief ? '<span>Écouter les pas :</span><button data-sound="wood">Bois</button><button data-sound="carpet">Tapis</button><button data-sound="stairs">Escaliers</button>' : ''}</header>
<main id="stage"></main><footer><span id="stats">Chargement…</span> · <small>Scène témoin avec éclairage réel du niveau et lampe du joueur, sans combat ni HUD. Comparaison à caméra fixe.</small></footer>
<script type="module">
import * as THREE from 'three';
import { Level } from '/src/Level.ts';
import { MANSION_ROOMS } from '/src/MansionConfig.ts';
import { mansionDressingPlacements } from '/src/MansionDressing.ts';
import { createFootstepSamples, FOOTSTEP_BASE_GAIN } from '/src/FootstepAudio.ts';
const relief=${relief};
const stage=document.querySelector('#stage'), scene=new THREE.Scene();scene.background=new THREE.Color(0x10131a);
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;stage.appendChild(renderer.domElement);
const level=new Level(scene);level.update(0);
const camera=new THREE.PerspectiveCamera(75,1,.1,100);scene.add(camera);
const lamp=new THREE.SpotLight(0xfffaec,22,28,Math.PI/5.2,.5,1.8);lamp.position.set(.2,-.15,-.1);const aim=new THREE.Object3D();aim.position.set(.2,-.15,-5);camera.add(aim,lamp);lamp.target=aim;
const dressing=scene.getObjectByName(relief?'mansion-furnishings':'mansion-dressing'),dust=scene.getObjectByName('mansion-atmosphere');let currentRoom=MANSION_ROOMS[0].id, currentItem=0;
const views={vestibule:{position:[16,1.7,14],look:[23.3,3.3,14.7]},salon:{position:[-8.8,1.7,14.5],look:[-14,2.7,13]},galerie:{position:[-18,1.7,4.7],look:[-18,2.6,0]},grand_hall:{position:[0,1.7,1],look:[5,3.7,0]},bibliotheque:{position:[-19,4.1,-9],look:[-13,5.5,-12]},atelier:{position:[17,4.1,-10.5],look:[12,3.7,-14]}};
function move(){if(relief){const view=views[currentRoom];camera.position.fromArray(view.position);camera.lookAt(...view.look);document.querySelector('#label').textContent='Formes et reliefs';}else{const items=mansionDressingPlacements.filter(item=>item.roomId===currentRoom), item=items[currentItem%items.length];const floor=level.getFloorHeightAt(item.x,item.z), target=new THREE.Vector3(item.x,floor+item.centerY,item.z);camera.position.copy(target).add(new THREE.Vector3(Math.sin(item.rotationY),0,Math.cos(item.rotationY)).multiplyScalar(4));camera.position.y=floor+1.7;camera.lookAt(target);document.querySelector('#label').textContent=item.asset+' · '+(currentItem%items.length+1)+' / '+items.length;}for(const button of document.querySelectorAll('[data-room]'))button.setAttribute('aria-pressed',String(button.dataset.room===currentRoom));}
for(const room of MANSION_ROOMS){const button=document.createElement('button');button.textContent=room.name;button.dataset.room=room.id;button.onclick=()=>{currentRoom=room.id;currentItem=0;move()};document.querySelector('#rooms').appendChild(button)}
document.querySelector('#next').hidden=relief;document.querySelector('#next').onclick=()=>{currentItem++;move()};document.querySelector('#mode').onclick=(event)=>{dressing.visible=!dressing.visible;if(relief)dust.visible=dressing.visible;event.currentTarget.textContent=dressing.visible?'Après · décor actif':'Avant · sans ce lot';event.currentTarget.setAttribute('aria-pressed',String(dressing.visible))};
document.querySelector('#lamp').onclick=event=>{lamp.intensity=lamp.intensity?0:22;event.currentTarget.textContent=lamp.intensity?'Lampe allumée':'Lampe éteinte'};
// Une lecture seulement après clic ; les échantillons sont les mêmes que ceux du jeu.
let audioContext=null,audioSource=null;
for(const button of document.querySelectorAll('[data-sound]'))button.onclick=async()=>{audioContext??=new AudioContext();await audioContext.resume();if(audioSource){audioSource.source.onended=null;audioSource.source.stop();audioSource.source.disconnect();audioSource.gain.disconnect();}const samples=createFootstepSamples(button.dataset.sound,audioContext.sampleRate),buffer=audioContext.createBuffer(1,samples.length,audioContext.sampleRate);buffer.getChannelData(0).set(samples);const source=audioContext.createBufferSource(),gain=audioContext.createGain();gain.gain.value=FOOTSTEP_BASE_GAIN;source.buffer=buffer;source.connect(gain);gain.connect(audioContext.destination);const voice={source,gain};audioSource=voice;source.onended=()=>{source.disconnect();gain.disconnect();if(audioSource===voice)audioSource=null;};source.start();};
function resize(){renderer.setSize(Math.max(1,Math.floor(stage.clientWidth/3)),Math.max(1,Math.floor(stage.clientHeight/3)),false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix()}window.addEventListener('resize',resize);resize();move();
let last=0,previous=0;renderer.setAnimationLoop(time=>{if(relief)level.update(0,Math.min((time-previous)/1000,.05));previous=time;renderer.render(scene,camera);if(time-last>300){last=time;document.querySelector('#stats').textContent=renderer.info.render.calls+' appels de dessin · '+renderer.info.render.triangles+' triangles · '+renderer.info.memory.textures+' textures'}});
</script></html>`);
console.log('Aperçu : /' + directory + '/index.html sur le serveur Vite.');
