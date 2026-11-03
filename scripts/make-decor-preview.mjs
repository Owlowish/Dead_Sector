import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('tmp/decor-preview', { recursive: true });
writeFileSync('tmp/decor-preview/index.html', `<!doctype html><html lang="fr"><meta charset="utf-8">
<title>Manoir — revue du décor</title><style>
body{margin:0;background:#12151b;color:#d5c8ac;font:16px system-ui}header{padding:12px;display:flex;gap:20px;align-items:center}a{color:#dfb875}select{padding:8px}canvas{width:100%;height:calc(100vh - 65px);object-fit:contain;image-rendering:pixelated;display:block}
</style><header><select id="view" aria-label="Pièce"></select><label><input id="torch" type="checkbox" checked>Lampe</label><span>Revue du décor · caméras fixes</span><a href="/">Jouer</a></header>
<script type="module">
import * as THREE from 'three';
import { Level } from '/src/Level.ts';
import { Player } from '/src/Player.ts';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x10131a);
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(427,300,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
const level=new Level(scene),player=new Player(level,renderer.domElement,()=>false),camera=player.camera;camera.aspect=427/300;camera.updateProjectionMatrix();scene.add(camera);
const views={
 salon:[[-8,1.7,14.5],[-14,1.5,13]],
 porte:[[0,1.7,10],[0,1.75,6]],
 bibliotheque:[[-13,4.1,-9.2],[-13,4.3,-12]],
 atelier:[[14.5,4.1,-10],[12,3.8,-14]],
 escaliers:[[12.25,2.1,-2],[12.25,3.5,-6.7]],
 hall:[[1,1.7,2],[8,3.2,0]],
 lustre:[[11,1.7,3],[8,3.3,0]],
 plafond:[[8,1.7,13],[8,4,11]],
 tapis:[[-6.5,1.7,17.5],[-11,0,15.5]]
};
// Les portes restent fermées comme au chargement ; ces vues isolées ne simulent pas une progression.
function setView(name){const [p,t]=views[name];camera.position.set(...p);camera.lookAt(...t);document.querySelector('#view').value=name;}
for(const name of Object.keys(views)){const option=new Option(name,name);document.querySelector('#view').add(option);}
document.querySelector('#view').onchange=e=>setView(e.target.value);
document.querySelector('#torch').onchange=()=>player.toggleFlashlight();
setView('salon');level.update(0);
window.__decorPreview={scene,level,renderer,camera,player,views,setView};
renderer.setAnimationLoop(()=>renderer.render(scene,camera));
</script></html>`);
console.log('Aperçu : http://127.0.0.1:5173/tmp/decor-preview/index.html');
