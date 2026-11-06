import { mkdirSync, writeFileSync } from 'node:fs';

const directory = 'tmp/portrait-preview';
mkdirSync(directory, { recursive: true });
writeFileSync(directory + '/index.html', `<!doctype html><html lang="fr"><meta charset="utf-8">
<title>DEAD SECTOR · Portrait et Rampeuse</title><link rel="icon" href="data:,">
<style>
*{box-sizing:border-box}body{margin:0;background:#101117;color:#d4c6a5;font:13px monospace}
header,footer{padding:12px 18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
button,select{background:#282322;color:inherit;border:1px solid #756347;padding:8px;font:inherit}
main{height:calc(100vh - 160px);min-height:300px}canvas{width:100%;height:100%;display:block;image-rendering:pixelated}
#state{margin:0;padding:8px 18px;background:#211a19}footer{font-size:12px}
</style>
<header><strong>Maître du Portrait / Rampeuse</strong>
<select id="scenario"><option value="idle">Portrait · repos</option><option value="blades">Préparation lames</option><option value="volley">Lames et traînées</option><option value="tear">Préparation déchirure</option><option value="rupture">Déchirure active</option><option value="transform">Transformation · tension</option><option value="transform-burst">Transformation · éclatement</option><option value="phase2">Phase II</option><option value="combo">Combo · transition</option><option value="combo-tear">Combo · déchirure</option><option value="combo-end">Combo · récupération</option><option value="pressure">Poursuite</option><option value="sweep">Balayage II</option><option value="sweep-impact">Balayage actif</option><option value="death">Mort</option><option value="crawler">Rampeuse · fixation</option><option value="stalk">Rampeuse · hors regard</option><option value="grab">Rampeuse · attaque</option></select>
<select id="distance"><option>3</option><option selected>6</option><option>10</option></select><span>mètres</span>
<select id="speed"><option value="1">Normal</option><option value="0.25">Ralenti ×0,25</option></select>
<button id="play">Jouer / pause</button><button id="lamp">Lampe</button><button id="room">Hall / Salon</button><button id="sound">Écouter la transformation</button></header>
<p id="state">Chargement…</p><main id="stage"></main><footer>Vrai Level et vrais acteurs, rendu au tiers · scène préparée sans Pointer Lock · aucune partie jouée. <span id="stats"></span></footer>
<script type="module">
import * as THREE from 'three';
import { Level } from '/src/Level.ts';
import { GuardianZombie } from '/src/GuardianZombie.ts';
import { GuardianProjectile } from '/src/GuardianProjectile.ts';
import { PortraitParticles } from '/src/PortraitParticles.ts';
import { PortraitProjectileImpacts } from '/src/PortraitProjectileImpacts.ts';
import { portraitProjectileAnimation } from '/src/PortraitProjectileAnimation.ts';
import { PortraitAudio } from '/src/PortraitAudio.ts';
import { guardianConfig } from '/src/FinaleConfig.ts';
import { CrawlerZombie } from '/src/CrawlerZombie.ts';
import { portraitAnimation } from '/src/PortraitAnimation.ts';
import { crawlerAnimation } from '/src/CrawlerAnimation.ts';

const stage=document.querySelector('#stage'),scene=new THREE.Scene();scene.background=new THREE.Color(0x10131a);
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;stage.append(renderer.domElement);
const manager=THREE.DefaultLoadingManager, missing=[];
manager.onError=url=>missing.push(url);
const level=new Level(scene),camera=new THREE.PerspectiveCamera(75,1,.1,100);scene.add(camera);
const particles=new PortraitParticles(scene);
const impacts=new PortraitProjectileImpacts(scene);
const effects={trail:(p,d)=>particles.trail(p,d),impact:(p,n)=>{particles.impact(p,n);impacts.impact(p,n)}};
let audio=null,listener=null;
const lamp=new THREE.SpotLight(0xfffaec,22,28,Math.PI/5.2,.5,1.8),aim=new THREE.Object3D();lamp.position.set(.2,-.15,-.1);aim.position.set(.2,-.15,-5);camera.add(lamp,aim);lamp.target=aim;
for(const door of level.getDoors())if(door.getType()!=='permanent_limit'){door.unlock();if(!door.isOpen())door.toggle()}
level.update(2,0);
let actor=null,projectiles=[],hits=[],events=[],spawned=0,running=false,speed=1,scenario='idle',room='hall',distance=6,elapsed=0;
function origin(){return room==='hall'?[8,-2]:[-8,8]}
function moveCamera(d=distance){const [x,z]=origin();const viewX=room==='hall'&&d>8?x+Math.sqrt(d*d-36):x,viewZ=room==='hall'&&d>8?z+6:z+d;camera.position.set(viewX,level.getFloorHeightAt(viewX,viewZ)+1.7,viewZ);camera.lookAt(x,level.getFloorHeightAt(x,z)+1.4,z)}
function cue(event){
  events.push({kind:event.kind,attack:event.attack,phase:event.phase,volleyIndex:event.volleyIndex,time:elapsed});
  if(event.kind==='cancel'){particles.clear();impacts.clear();audio?.stop()}
  else if(event.kind==='prepare'&&event.attack)particles.prepare(event.position,event.direction,event.attack);
  else if(event.kind==='transform-start'||event.kind==='transform-burst'){
    const stage=event.kind==='transform-start'?'gather':'burst';particles.transformation(event.position,stage);audio?.play(stage,event.position.clone().add(new THREE.Vector3(0,1.2,0)));
  }
}
function tick(delta){
  if(actor instanceof GuardianZombie){actor.update(delta,camera.position,[],d=>hits.push(d),(o,t)=>{spawned++;projectiles.push(new GuardianProjectile(scene,o,t,effects))});if(!actor.isAlive())actor.updateDeath(delta,camera.position)}
  else {const direction=camera.getWorldDirection(new THREE.Vector3());if(scenario==='stalk')direction.negate();actor?.update(delta,camera.position,[],(d,g)=>hits.push({damage:d,grab:g}),{isFlashlightOn:false,cameraDirection:direction})}
  projectiles=projectiles.filter(p=>p.update(delta,scene,level,camera.position,d=>hits.push(d)));
  particles.update(delta,camera);
  impacts.update(delta,camera);
  elapsed+=delta;
}
function simulate(seconds){for(let t=0;t<seconds-1e-8;t+=.01)tick(Math.min(.01,seconds-t))}
function until(test,limit=8){for(let t=0;t<limit&&!test();t+=.01)tick(.01);if(!test())throw Error('État absent : '+scenario+' '+JSON.stringify(data()))}
function reset(name='idle'){
  running=false;scenario=name;actor?.dispose(scene);for(const p of projectiles)p.dispose(scene);projectiles=[];particles.clear();impacts.clear();audio?.stop();hits=[];events=[];spawned=0;elapsed=0;
  const [x,z]=origin();moveCamera();actor=['crawler','stalk','grab'].includes(name)?new CrawlerZombie(scene,level,x,z):new GuardianZombie(scene,level,x,z,{cue});
  if(name==='blades'){tick(.01);simulate(.7)}
  if(name==='volley'||name==='volley2'){tick(.01);simulate(name==='volley'?1.24:1.72)}
  if(name==='tear'||name==='rupture'){until(()=>actor.getAttackKind()==='tear'&&actor.getState()==='ATTACK');simulate(name==='tear'?.8:1.43)}
  if(['transform','transform-burst','phase2','phase2-volley','phase2-volley2','sweep','sweep-impact','combo','combo-tear','combo-end'].includes(name)){
    // État préparé pour inspecter les poses ; ne simule pas la durée du duel.
    actor.guardianHealth=guardianConfig.health*.45;tick(.01);until(()=>actor.isTransforming());
    if(name==='transform')simulate(.25);
    else if(name==='transform-burst')simulate(guardianConfig.transformationDuration*.55+.035);
    else {
      simulate(guardianConfig.transformationDuration+.01);
      spawned=0;
      if(name.startsWith('phase2-volley')){const view=room==='hall'?[17,4]:[-20,8];camera.position.set(view[0],level.getFloorHeightAt(...view)+1.7,view[1]);camera.lookAt(x,level.getFloorHeightAt(x,z)+1.4,z);until(()=>actor.getState()==='ATTACK'&&actor.getAttackKind()==='blades');simulate(name==='phase2-volley'?1.2:1.65)}
      if(name==='sweep'||name==='sweep-impact'){moveCamera(1.8);until(()=>actor.getAttackKind()==='sweep'&&actor.getState()==='ATTACK');simulate(name==='sweep'?.75:1.12)}
      if(name.startsWith('combo')){
        const view=room==='hall'?[17,4]:[-20,8];
        camera.position.set(view[0],level.getFloorHeightAt(...view)+1.7,view[1]);camera.lookAt(x,level.getFloorHeightAt(x,z)+1.4,z);
        until(()=>actor.isComboTransition());
        if(name==='combo')simulate(.2);
        else{until(()=>actor.getState()==='ATTACK'&&actor.getAttackKind()==='tear');simulate(name==='combo-tear'?.7:guardianConfig.tearWindup+.2)}
      }
    }
  }
  if(name==='pressure'){tick(.01);until(()=>actor.getState()==='RECOVER');until(()=>actor.getState()==='CHASE');simulate(.55)}
  if(name==='death'){actor.damageAllowance=guardianConfig.health;actor.takeDamage(guardianConfig.health)}
  if(name==='crawler')tick(.01);
  if(name==='stalk')simulate(.3);
  if(name==='grab'){moveCamera(.9);tick(.01);simulate(.2)}
  draw();return data();
}
function data(){return {scenario,elapsed,hits,events,spawned,particles:particles.getStats(),impacts:impacts.getStats(),drawCalls:renderer.info.render.calls,programs:renderer.info.programs?.length,audioEnabled:!!audio,audioContext:listener?.context.state,position:actor?.getPosition().toArray(),phase:actor instanceof GuardianZombie?actor.getPhase():null,state:actor instanceof GuardianZombie?actor.getState():actor?.getPose(),attack:actor instanceof GuardianZombie?actor.getAttackKind():null,maskExposed:actor instanceof GuardianZombie?actor.isMaskExposed():null,volleyIndex:actor instanceof GuardianZombie?actor.getVolleyIndex():null,transforming:actor instanceof GuardianZombie?actor.isTransforming():false,comboTransition:actor instanceof GuardianZombie?actor.isComboTransition():false,pose:actor?.getMesh().material.map.image?.src,projectiles:projectiles.length,missing,canvas:[renderer.domElement.width,renderer.domElement.height]}}
function draw(){renderer.render(scene,camera);const d=data();document.querySelector('#state').textContent=scenario+' · '+(d.state??'')+' · '+(d.attack??'')+' · phase '+(d.phase??'—')+' · impacts '+hits.length;document.querySelector('#stats').textContent=renderer.info.render.calls+' appels · '+renderer.info.memory.textures+' textures'}
function resize(){renderer.setSize(Math.floor(stage.clientWidth/3),Math.floor(stage.clientHeight/3),false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();draw()}
window.addEventListener('resize',resize);
document.querySelector('#scenario').onchange=e=>reset(e.target.value);
document.querySelector('#distance').onchange=e=>{distance=Number(e.target.value);reset(scenario)};
document.querySelector('#speed').onchange=e=>speed=Number(e.target.value);
document.querySelector('#play').onclick=()=>{running=!running;if(!running)audio?.stop()};
document.querySelector('#lamp').onclick=()=>{lamp.intensity=lamp.intensity?0:22;draw()};
document.querySelector('#room').onclick=()=>{room=room==='hall'?'salon':'hall';reset(scenario)};
document.querySelector('#sound').onclick=async()=>{if(!listener){listener=new THREE.AudioListener();camera.add(listener);audio=new PortraitAudio(listener)}await listener.context.resume();reset('transform');running=true};
window.addEventListener('blur',()=>audio?.stop());
window.__ENEMY_REVIEW={reset,tick:(d)=>{tick(d);draw();return data()},simulate:(s)=>{simulate(s);draw();return data()},data,setRunning:v=>{running=v;if(!v)audio?.stop()},setDistance:d=>{distance=d;return reset(scenario)},setRoom:r=>{room=r;return reset(scenario)},setLamp:v=>{lamp.intensity=v?22:0;draw()},clearEffects:()=>{particles.clear();impacts.clear();draw();return data()}};
for(const [value,label] of [['volley2','Deuxième salve I'],['phase2-volley','Première salve II'],['phase2-volley2','Deuxième salve II']]){const option=document.createElement('option');option.value=value;option.textContent=label;document.querySelector('#scenario').append(option)}
await Promise.all([...portraitAnimation.poses.map(p=>'/assets/zombies/portrait/'+p+'.png'),...crawlerAnimation.poses.map(p=>'/assets/zombies/crawler/'+p+'.png'),portraitProjectileAnimation.flight.url,portraitProjectileAnimation.impact.url].map(url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=()=>reject(Error(url));i.src=url})));
reset();resize();let previous=performance.now();
renderer.setAnimationLoop(now=>{const delta=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;if(running)tick(delta*speed);level.update(0,running?delta*speed:0);draw()});
</script></html>`);
console.log('Aperçu : /tmp/portrait-preview/index.html');
