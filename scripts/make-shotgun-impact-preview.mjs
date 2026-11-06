import { mkdirSync, writeFileSync } from 'node:fs';

const directory = 'tmp/shotgun-impact-preview';
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/index.html`, `<!doctype html><html lang="fr"><meta charset="utf-8">
<title>DEAD SECTOR · Impact du fusil</title><link rel="icon" href="data:,">
<style>
*{box-sizing:border-box}body{margin:0;background:#101117;color:#d4c6a5;font:13px monospace}
header,footer{padding:12px 18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
button,select{background:#282322;color:inherit;border:1px solid #756347;padding:8px;font:inherit}
main{height:calc(100vh - 175px);min-height:300px;position:relative}canvas{width:100%;height:100%;display:block;image-rendering:pixelated}
#state{margin:0;padding:8px 18px;background:#211a19}footer{font-size:12px}.crosshair{position:absolute;inset:50% auto auto 50%;width:3px;height:3px;background:#d4c6a5;pointer-events:none}
</style>
<header><strong>Fusil · recul et réactions</strong>
<select id="kind"><option value="standard">Standard</option><option value="agile">Coureur</option><option value="spitter">Cracheur</option><option value="crawler">Rampeuse</option><option value="guardian">Maître du Portrait</option></select>
<select id="distance"><option>2</option><option selected>4</option><option>6</option><option>10</option></select><span>mètres</span>
<select id="shot"><option value="partial">Impact partiel préparé</option><option value="full">Impact fatal préparé</option><option value="weapon">Vrai tir Weapon</option><option value="pistol">Pistolet témoin</option></select>
<button id="reset">Recommencer</button><button id="fire">Tirer</button><button id="play">Jouer / pause</button>
<select id="speed"><option value="1">Normal</option><option value="0.25">Ralenti ×0,25</option></select>
<button id="lamp">Lampe</button><button id="room">Hall / Salon</button></header>
<p id="state">Chargement…</p><main id="stage"><i class="crosshair"></i></main><footer>Vrai Level, acteurs et effets · tirs pilotés sans Pointer Lock · aucune partie jouée. <span id="stats"></span></footer>
<script type="module">
import * as THREE from 'three';
import { Level } from '/src/Level.ts';
import { Zombie } from '/src/Zombie.ts';
import { SpitterZombie } from '/src/SpitterZombie.ts';
import { CrawlerZombie } from '/src/CrawlerZombie.ts';
import { GuardianZombie } from '/src/GuardianZombie.ts';
import { HitEffects } from '/src/HitEffects.ts';
import { Weapon } from '/src/Weapon.ts';

const stage=document.querySelector('#stage'),scene=new THREE.Scene();scene.background=new THREE.Color(0x10131a);
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;stage.append(renderer.domElement);
const missing=[];THREE.DefaultLoadingManager.onError=url=>missing.push(url);
const level=new Level(scene),camera=new THREE.PerspectiveCamera(75,1,.1,100);scene.add(camera);
const effects=new HitEffects(scene),lamp=new THREE.SpotLight(0xfffaec,22,28,Math.PI/5.2,.5,1.8),aim=new THREE.Object3D();lamp.position.set(.2,-.15,-.1);aim.position.set(.2,-.15,-5);camera.add(lamp,aim);lamp.target=aim;
for(const door of level.getDoors())if(door.getType()!=='permanent_limit'){door.unlock();if(!door.isOpen())door.toggle()}
level.update(2,0);
let actor=null,running=false,speed=1,kind='standard',shot='partial',room='hall',distance=4,elapsed=0,shots=[],fired=false,initialPosition=null;
const weapon=new Weapon(camera,renderer.domElement,[],level.getSolidMeshes(),(target,damage,event)=>{
  shots.push({damage,headHits:event.headHits,bodyHits:event.bodyHits,weaponId:event.weaponId,power:event.impact?.power});
  if(actor?.getMesh()===target)actor.takeDamage(damage,event.headHits>0,event.impactForce,event.impact);
},()=>true,()=>{});
weapon.setEffectsVolume(0);weapon.unlockWeapon('shotgun');weapon.aimAmount=1;weapon.setOnImpact(impact=>effects.emit(impact));
function origin(){return room==='hall'?[8,-2]:[-8,8]}
function moveCamera(){const [x,z]=origin(),y=level.getFloorHeightAt(x,z);camera.position.set(x,level.getFloorHeightAt(x,z+distance)+1.7,z+distance);camera.lookAt(x,y+(kind==='crawler'?.45:kind==='guardian'?1.4:1.05),z)}
function tick(delta){
  if(actor?.isAlive()){
    if(actor instanceof CrawlerZombie)actor.update(delta,camera.position,[],()=>{},{isFlashlightOn:false,cameraDirection:camera.getWorldDirection(new THREE.Vector3())});
    else actor.update(delta,camera.position,[],()=>{},()=>{});
  }else actor?.updateDeath(delta,camera.position);
  effects.update(delta,camera);weapon.update(delta);elapsed+=delta;
}
function simulate(seconds){for(let t=0;t<seconds-1e-8;t+=.01)tick(Math.min(.01,seconds-t))}
function reset(options={}){
  if(options.kind)kind=options.kind;if(options.shot)shot=options.shot;if(options.distance)distance=options.distance;if(options.room)room=options.room;
  running=false;actor?.dispose(scene);effects.clear();shots=[];elapsed=0;fired=false;
  const [x,z]=origin();actor=kind==='spitter'?new SpitterZombie(scene,level,x,z):kind==='crawler'?new CrawlerZombie(scene,level,x,z):kind==='guardian'?new GuardianZombie(scene,level,x,z):new Zombie(scene,level,x,z,kind,()=>1);
  moveCamera();actor.getMesh().rotation.y=0;initialPosition=actor.getPosition().clone();weapon.setTargets([actor.getMesh()]);weapon.magazineAmmo=5;weapon.lastShot=-Infinity;weapon.aimAmount=1;
  document.querySelector('#kind').value=kind;document.querySelector('#shot').value=shot;document.querySelector('#distance').value=String(distance);draw();return data();
}
function fire(mode=shot){
  if(fired)return data();fired=true;
  if(mode==='weapon'||mode==='pistol'){
    weapon.switchWeapon(mode==='pistol'?'pistol':'shotgun');weapon.aimAmount=1;weapon.lastShot=-Infinity;weapon.shoot();
  }else{
    const count=mode==='partial'?2:8,power=mode==='partial'?.32:.9;
    const direction=actor.getPosition().clone().sub(camera.position).normalize();
    const point=actor.getPosition().clone();point.y=level.getFloorHeightAt(point.x,point.z)+(kind==='crawler'?.4:kind==='guardian'?1.4:1.1);
    effects.emit({kind:'zombie',object:actor.getMesh(),point,normal:direction.clone().negate(),direction,weaponId:'shotgun',power});
    const damage=mode==='partial'?26:(kind==='spitter'?260:kind==='guardian'?900:104);
    actor.takeDamage(damage,false,15*count,{direction,power});shots.push({damage,bodyHits:count,weaponId:'shotgun',power,prepared:true});
  }
  draw();return data();
}
function data(){const mesh=actor?.getMesh();let texturesPending=0;scene.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(material?.map&&!material.map.image?.width)texturesPending++});return {kind,shot,distance,room,elapsed,fired,running,alive:actor?.isAlive(),position:actor?.getPosition().toArray(),movement:actor&&initialPosition?Math.hypot(actor.getPosition().x-initialPosition.x,actor.getPosition().z-initialPosition.z):0,state:actor?.getPose?.()??actor?.getState?.(),pose:mesh?.material.map?.image?.src,geometry:mesh?.geometry.uuid,shots,missing,texturesPending,drawCalls:renderer.info.render.calls,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,canvas:[renderer.domElement.width,renderer.domElement.height]}}
function draw(){renderer.render(scene,camera);const d=data();document.querySelector('#state').textContent=kind+' · '+(d.alive?'vivant':'mort')+' · '+(d.state??'')+' · '+d.movement.toFixed(2)+' m · '+elapsed.toFixed(2)+' s';document.querySelector('#stats').textContent=d.drawCalls+' appels · '+d.textures+' textures'}
function resize(){renderer.setSize(Math.floor(stage.clientWidth/3),Math.floor(stage.clientHeight/3),false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();draw()}
window.addEventListener('resize',resize);
document.querySelector('#kind').onchange=e=>reset({kind:e.target.value});document.querySelector('#shot').onchange=e=>reset({shot:e.target.value});document.querySelector('#distance').onchange=e=>reset({distance:Number(e.target.value)});
document.querySelector('#reset').onclick=()=>reset();document.querySelector('#fire').onclick=()=>{fire();running=true};document.querySelector('#play').onclick=()=>running=!running;document.querySelector('#speed').onchange=e=>speed=Number(e.target.value);
document.querySelector('#lamp').onclick=()=>{lamp.intensity=lamp.intensity?0:22;draw()};document.querySelector('#room').onclick=()=>reset({room:room==='hall'?'salon':'hall'});
window.__SHOTGUN_REVIEW={reset,fire,tick:d=>{tick(d);draw();return data()},simulate:s=>{simulate(s);draw();return data()},data,setRunning:v=>running=v,setLamp:v=>{lamp.intensity=v?22:0;draw()},setSpeed:v=>speed=v,clearEffects:()=>{effects.clear();draw();return data()}};
reset();resize();let previous=performance.now();renderer.setAnimationLoop(now=>{const delta=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;if(running)tick(delta*speed);level.update(0,running?delta*speed:0);draw()});
</script></html>`);
console.log('Aperçu : /tmp/shotgun-impact-preview/index.html');
