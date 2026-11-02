import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import { zombieDeathAnimation as config } from '../src/ZombieAnimation.ts';

const directory = resolve('tmp/zombie-death-preview');
await mkdir(directory, { recursive: true });
const urls = {};
for (const path of ['zombies/zombie_idle.png', 'zombies/zombie_death.png', 'textures/wood_floor_v2.png']) {
  urls['/assets/' + path] = 'data:image/png;base64,' + (await readFile(resolve('public/assets', path))).toString('base64');
}
const entry = `
import * as THREE from 'three';
import { ZombieRemains } from '../../src/ZombieRemains.ts';
import { zombieDeathAnimation, zombieDeathDuration, deathFrame } from '../../src/ZombieAnimation.ts';
const urls=${JSON.stringify(urls)};
const pending=[];
const originalLoad=THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load=function(url,onLoad,onProgress,onError){
 let done,fail;pending.push(new Promise((resolve,reject)=>{done=resolve;fail=reject}));
 return originalLoad.call(this,urls[url]??url,texture=>{onLoad?.(texture);done();},onProgress,error=>{onError?.(error);fail(error)});
};
const scene=new THREE.Scene();scene.background=new THREE.Color(0x25242a);
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
renderer.setSize(480,260,false);document.querySelector('#view').appendChild(renderer.domElement);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
scene.add(new THREE.AmbientLight(0xc5cbd9,1.2));const lamp=new THREE.DirectionalLight(0xffd9a0,2);lamp.position.set(2,5,2);scene.add(lamp);
const camera=new THREE.PerspectiveCamera(55,480/260,.1,30);let angle=0;
function orbit(a){angle=a;camera.position.set(Math.sin(a)*4.4,1.7,Math.cos(a)*4.4);camera.lookAt(0,.7,0);}
orbit(0);
const loader=new THREE.TextureLoader();const wood=loader.load('/assets/textures/wood_floor_v2.png');wood.colorSpace=THREE.SRGBColorSpace;wood.wrapS=wood.wrapT=THREE.RepeatWrapping;wood.repeat.set(4,4);wood.magFilter=THREE.NearestFilter;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(9,9),new THREE.MeshStandardMaterial({map:wood,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
const idleTexture=loader.load('/assets/zombies/zombie_idle.png');idleTexture.colorSpace=THREE.SRGBColorSpace;idleTexture.magFilter=idleTexture.minFilter=THREE.NearestFilter;
const idle=new THREE.Mesh(new THREE.PlaneGeometry(1,2),new THREE.MeshStandardMaterial({map:idleTexture,alphaTest:.4,side:THREE.DoubleSide}));idle.position.y=1;scene.add(idle);
let remains=new ZombieRemains(scene),time=null,manual=false,previous=performance.now();
const phase=document.querySelector('#phase');
function reset(){const previous=remains;remains=new ZombieRemains(scene);previous.dispose();time=null;idle.visible=true;phase.textContent='Vivant';}
function start(){if(time!==null)return;idle.visible=false;time=0;remains.start(new THREE.Vector3(0,1,0),0);phase.textContent='Chute';}
function step(dt){if(time!==null){time+=dt;remains.update(dt,camera.position);phase.textContent=time>=zombieDeathDuration?'Cadavre — billboard vertical':'Pose '+(deathFrame(time)+1)+' / 4';}renderer.render(scene,camera);}
document.querySelector('#play').onclick=()=>{manual=false;reset();start();};
document.querySelector('#reset').onclick=reset;
document.querySelector('#angle').oninput=event=>orbit(Number(event.target.value));
window.deathPreview={start(){manual=true;reset();start();step(0);},step(dt){manual=true;step(dt);},orbit(a){orbit(a);step(0);},reset(){manual=true;reset();step(0);},state(){return {time,angle,phase:phase.textContent};}};
function tick(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(!manual)step(dt*(document.querySelector('#slow').checked?.25:1));requestAnimationFrame(tick);}
Promise.all(pending).then(()=>{renderer.render(scene,camera);window.previewReady=true;document.querySelector('#status').textContent='Textures chargées ; rendu Three.js prêt.';requestAnimationFrame(tick);}).catch(error=>{document.querySelector('#status').textContent=String(error);window.previewError=String(error)});
`;
await writeFile(resolve(directory, 'entry.ts'), entry);
const result = await build({ configFile: false, publicDir: false, logLevel: 'error', build: {
  write: false, minify: false, lib: { entry: resolve(directory, 'entry.ts'), name: 'DeathPreview', formats: ['iife'] },
} });
const output = Array.isArray(result) ? result[0].output : result.output;
const code = output.find(item => item.type === 'chunk').code.replace(/<\/script/gi, '<\\/script');
const scale = 0.32;
const poses = config.frames.map((pose, i) => `<div class="card"><div class="pose" style="width:${pose.width * scale}px;height:${pose.height * scale}px;background-image:url('${urls['/assets/zombies/zombie_death.png']}');background-size:${config.atlasWidth * scale}px ${config.atlasHeight * scale}px;background-position:-${pose.x * scale}px -${pose.y * scale}px"></div><p>Pose ${i + 1} — ${pose.duration}s</p></div>`).join('');
await writeFile(resolve(directory, 'index.html'), `<!doctype html><html lang="fr"><meta charset="utf-8"><title>DEAD SECTOR — Chute et cadavre</title><style>
body{margin:24px;background:#202023;color:#d4c6a5;font:16px monospace}h1{font-size:22px}h2{font-size:17px}p{line-height:1.5}.row{display:flex;gap:25px;align-items:end;flex-wrap:wrap}.card{border-bottom:1px solid #927c58}.pose{background-repeat:no-repeat;image-rendering:pixelated}#view{max-width:960px;border:1px solid #927c58}canvas{width:100%;aspect-ratio:480/260;image-rendering:pixelated;display:block}button{padding:10px;background:#333;color:#d4c6a5;border:1px solid #927c58;font:inherit;margin:10px 5px 10px 0}label{margin-right:20px}#status{color:#a7b09a;font-size:13px}
</style><h1>DEAD SECTOR — Une chute, puis un corps couché en billboard</h1><p>Aperçu isolé avec le vrai ZombieRemains et sa chronologie. Le support vertical reste face à la caméra ; le dessin représente le corps couché.</p>
<div id="view"></div><p id="phase">Vivant</p><button id="play">Une chute</button><button id="reset">Réinitialiser</button><label><input id="slow" type="checkbox"> Lecture lente ×4</label><label>Tourner autour <input id="angle" type="range" min="-3.14" max="3.14" step=".05" value="0"></label>
<h2>Poses et appuis au sol</h2><div class="row">${poses}</div><p id="status">Chargement…</p><script>${code}</script></html>`);
console.log(resolve(directory, 'index.html'));
