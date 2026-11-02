import { writeFileSync } from 'node:fs';
import { readSpritePng, alphaBounds, alphaComponents } from './sprite-png-info.mjs';

const root='public/assets/';
const assets={};
const names=['weapons/shotgun/hip.png','weapons/shotgun/ads.png','weapons/shotgun/ads_v2.png','weapons/shotgun/hip_pump.png','weapons/shotgun/ads_pump.png','weapons/shotgun/ads_pump_v2.png','weapons/shotgun/shells.png','weapons/shotgun/flash.png','weapons/shotgun/ammo_pickup.png','weapons/shotgun/live_shell.png','weapons/shotgun/pickup.png',...['idle','run','attack','hurt','death'].map(name=>'zombies/agile/'+name+'.png')];
const images=new Map();
for(const name of names){const im=readSpritePng(root+name);images.set(name,im);assets[name]={file:root+name,url:'/assets/'+name,width:im.width,height:im.height,alphaBounds:alphaBounds(im),status:'candidate_inspected'};}
for(const [name,reason] of Object.entries({
  'hip.png':'Référence de création ; utiliser la cellule prête de hip_pump pour éviter un changement de cadrage.',
  'ads.png':'Essai rejeté : vue trop plongeante et canon trop long.',
  'ads_v2.png':'Référence ADS corrigée ; ne pas alterner avec la planche ads_pump_v2 dont le cadrage diffère.',
  'ads_pump.png':'Essai rejeté : pièce centrale ajoutée devant le boîtier.',
})){Object.assign(assets['weapons/shotgun/'+name],{status:'reference_or_rejected',reason});}
const pad=(r,im,p=4)=>({x:Math.max(0,r.x-p),y:Math.max(0,r.y-p),width:Math.min(im.width,r.x+r.width+p)-Math.max(0,r.x-p),height:Math.min(im.height,r.y+r.height+p)-Math.max(0,r.y-p)});
const make=(asset,rect,extra={})=>({asset,rect,...extra});
const shot='weapons/shotgun/';
const squareCell=(asset,index)=>{const im=images.get(asset);const width=im.width/2;return make(asset,{x:index*width,y:0,width,height:im.height});};
const hipBack=squareCell(shot+'hip_pump.png',0),hipReady=squareCell(shot+'hip_pump.png',1);
const adsBack=squareCell(shot+'ads_pump_v2.png',0),adsReady=squareCell(shot+'ads_pump_v2.png',1);
// Ancrages mesurés approximativement ; unité = pixel dans la cellule, pas dans l'atlas.
for(const f of [hipBack,hipReady]){f.anchors={muzzle:[202,110],ejection:[540,413],bottom:[443.5,887]};}
for(const f of [adsBack,adsReady]){f.anchors={frontSight:[444,353],rearSight:[444,411],muzzle:[444,353],ejection:[540,462],bottom:[443.5,887]};}
const shotCycle=(ready,back)=>({loop:false,frames:[{...ready,duration:.035,flash:0,kick:6},{...ready,duration:.035,flash:1,kick:10},{...ready,duration:.12,flash:null,kick:5},{...back,duration:.16,flash:null,kick:0},{...ready,duration:.15,flash:null,kick:0}],events:[{at:0,type:'shot_once'},{at:.19,type:'eject_spent_shell_once'}]});
const propFrames=(asset,count)=>{const im=images.get(asset);return alphaComponents(im,1000).slice(0,count).sort((a,b)=>a.x-b.x).map(r=>make(asset,pad(r,im,6)));};
const shellFrames=propFrames(shot+'shells.png',4);
const flashImage=images.get(shot+'flash.png');
const flashFrames=[0,1].map(index=>make(shot+'flash.png',{x:index*887,y:0,width:887,height:887},{anchor:[443.5,495]}));

const actor={};
const specs={idle:{count:1,ppu:1552/1.8,durations:[1]},run:{count:6,ppu:615/1.8,durations:Array(6).fill(.09)},attack:{count:4,ppu:711/1.8,durations:[.2,.25,.1,.2]},hurt:{count:2,ppu:1119/1.8,durations:[.09,.09]},death:{count:4,ppu:639/1.8,durations:[.12,.14,.14,.16]}};
for(const [kind,spec] of Object.entries(specs)){
 const asset='zombies/agile/'+kind+'.png',im=images.get(asset);
 let regions=alphaComponents(im,1000).slice(0,spec.count);
 if(kind==='run'||kind==='death')regions.sort((a,b)=>(a.y<im.height/2?0:1)-(b.y<im.height/2?0:1)||a.x-b.x);else regions.sort((a,b)=>a.x-b.x);
 actor[kind]={pixelsPerUnit:spec.ppu,loop:kind==='run'||kind==='idle',frames:regions.map((r,index)=>{
  const rect=pad(r,im),groundY=kind==='run'?(index<3?693:1383):r.y+r.height;
  let anchorX=r.x+r.width/2;
  if(kind==='run')anchorX=(index%3+.5)*im.width/3;
  const frame=make(asset,rect,{duration:spec.durations[index],anchor:[anchorX,groundY],floorHeight:.025});
  if(kind==='attack'&&index===0)frame.clipPolygon=[[rect.x,rect.y],[513,rect.y],[513,470],[523,470],[523,650],[513,650],[513,rect.y+rect.height],[rect.x,rect.y+rect.height]];
  if(kind==='attack'&&index===1)frame.clipPolygon=[[513,rect.y],[rect.x+rect.width,rect.y],[rect.x+rect.width,rect.y+rect.height],[513,rect.y+rect.height],[513,650],[523,650],[523,470],[513,470]];
  return frame;
 })};
}
actor.attack.events=[{at:.45,type:'melee_damage_once'}];
actor.death.keepLastFrameAsVerticalBillboard=true;
const manifest={schemaVersion:1,preparedAt:'2026-11-02',scope:'Assets et chronologies proposés ; aucune mécanique intégrée au jeu.',status:'partial_missing_reload_art',assets,
 shotgun:{ready:{hip:hipReady,ads:adsReady},fire:{hip:shotCycle(hipReady,hipBack),ads:shotCycle(adsReady,adsBack)},spentShells:shellFrames,muzzleFlash:flashFrames,
  liveShell:make(shot+'live_shell.png',pad(alphaBounds(images.get(shot+'live_shell.png')),images.get(shot+'live_shell.png'),6)),
  ammoPickup:make(shot+'ammo_pickup.png',pad(alphaBounds(images.get(shot+'ammo_pickup.png')),images.get(shot+'ammo_pickup.png'),6)),
  weaponPickup:make(shot+'pickup.png',pad(alphaBounds(images.get(shot+'pickup.png')),images.get(shot+'pickup.png'),6)),
  reload:{status:'missing_art_tool_rejected',asset:null,expectedPhases:['empty_hand_ready','present_one_live_shell','insert_one_shell','withdraw_empty_hand'],proposedTimings:{enter:.25,insertLoop:.65,transferEventInLoop:.45,exit:.2},note:'Deux demandes refusées par le système de sécurité imagegen. Aucun fichier reload.png ni fausse animation livrée. Obtenir et valider ces poses avant de déclarer le rechargement visuel terminé.'},
  proposedGameplay:{capacity:5,reserve:20,pellets:8,damagePerPellet:12,range:18,hipConeHalfAngleDegrees:5,adsConeHalfAngleDegrees:3,cooldownSeconds:.9,ammoType:'shell',note:'Valeurs de départ à approuver/tester. ADS resserre la gerbe, sans transformer le fusil en tir monoprojectile.'}},
 agile:{visualIdentity:'Cheveux noirs, gilet ocre, chemise bleu pétrole, silhouette basse de coureur.',billboard:'vertical_yaw_only',animations:actor,proposedGameplay:{speed:2.7,health:80,collisionRadius:.4,attackWindup:.45,attackDamage:10,attackRange:1.4,hurtStopSeconds:.18,note:'Paramètres proposés, non intégrés. Préserver la lisibilité de préparation et les annulations.'}},
 notes:['Ne pas déduire les cellules par width/columns pour les zombies : utiliser les régions mesurées.','Les clipPolygon sont en pixels ABSOLUS de l’atlas ; ils excluent deux minuscules débordements voisins dans attack.','anchor zombie est aussi en pixels ABSOLUS de l’atlas ; les ancrages arme sont locaux à la cellule.','Les mains/clothes sont cohérentes de style, mais ces dessins IA ne garantissent pas une continuité mécanique au pixel près.','Enregistrer événements et état de gameplay séparément des images.']};
writeFileSync('docs/asset-packs/pompe-agile.manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Manifeste : 16 PNG, 12 candidats utilisés, 4 références/essais ; rechargement explicitement manquant.');
