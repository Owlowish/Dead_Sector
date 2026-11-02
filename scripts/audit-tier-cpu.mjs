import * as THREE from 'three';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Level } from '../src/Level.ts';
import { Zombie } from '../src/Zombie.ts';
import { MANSION_SPAWNS, MANSION_WAYPOINTS } from '../src/MansionConfig.ts';
let loads=[];
THREE.TextureLoader.prototype.load=function(url){loads.push(url);return new THREE.Texture();};
const scene=new THREE.Scene(),level=new Level(scene);
for(const door of level.getDoors()){if(door.getType()!=='permanent_limit'){door.unlock();door.toggle();door.update(10,[]);}}
scene.updateMatrixWorld(true);
let collisionChecks=0,segments=0;
const collision=level.isColliding.bind(level),pathClear=level.isPathClear.bind(level);
level.isColliding=(...args)=>{collisionChecks++;return collision(...args);};
level.isPathClear=(...args)=>{segments++;return pathClear(...args);};
const report={notice:'CPU Node, TextureLoader simulé : aucun décodage ni upload GPU. Portes non permanentes entièrement ouvertes. Ne représente pas des FPS de gameplay.',waypoints:MANSION_WAYPOINTS.length,solidMeshes:level.getSolidMeshes().length,navigation:[],resources:[]};
for(const [tier,target] of [[1,[8,1.7,16]],[2,[8,1.7,4]],[3,[-12.25,4.1,-9]]]){
 const times=[];let checks=0,edges=0,paths=0;
 for(let run=0;run<15;run++){
  collisionChecks=0;segments=0;let found=0;const t0=performance.now();
  for(const c of MANSION_SPAWNS[tier-1].pool){
   if(level.isColliding(c.x,c.z,0.45)||Math.hypot(c.x-target[0],c.z-target[2])<6)continue;
   if(level.findNextWaypoint(new THREE.Vector3(c.x,level.getFloorHeightAt(c.x,c.z)+1,c.z),new THREE.Vector3(...target),0.4))found++;
  }
  times.push(performance.now()-t0);checks=collisionChecks;edges=segments;paths=found;
 }
 times.sort((a,b)=>a-b);
 report.navigation.push({tier,pool:MANSION_SPAWNS[tier-1].pool.length,reachable:paths,medianMs:+times[7].toFixed(3),maxMs:+times.at(-1).toFixed(3),collisionChecks:checks,segmentChecks:edges});
}
for(const kind of ['standard','agile']){
 loads=[];let t=performance.now();const a=new Zombie(scene,level,8,16,kind);const cold=performance.now()-t,coldLoads=loads.length;
 loads=[];t=performance.now();const b=new Zombie(scene,level,0,16,kind);const warm=performance.now()-t,warmLoads=loads.length;
 a.dispose(scene);b.dispose(scene);
 loads=[];t=performance.now();const c=new Zombie(scene,level,8,16,kind);const recreated=performance.now()-t;
 report.resources.push({kind,coldMs:+cold.toFixed(3),secondMs:+warm.toFixed(3),afterDisposalMs:+recreated.toFixed(3),coldLoads,secondLoads:warmLoads,afterDisposalLoads:loads.length});
 c.dispose(scene);
}
mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/audit-tier-perf.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
