// Scénarios préparés reproductibles ; aucun accès au profil personnel ni écriture dans le gameplay.
// Usage : node scripts/measure-loading.mjs before|after [cpuRate] [sourcePrefix] [--profile]
// Démarre son serveur Vite sans HMR ; DEAD_SECTOR_REVIEW_URL permet un serveur externe.
// Le préfixe permet une copie Git temporaire de référence.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const args = process.argv.slice(2).filter(arg => arg !== '--profile');
const profileCPU = process.argv.includes('--profile');
const label = args[0] ?? 'after';
assert.match(label, /^[a-z0-9-]+$/i);
const cpu = Number(args[1] ?? 1);
const prefix = (args[2] ?? '').replace(/^\/+|\/+$/g, '');
const root = prefix ? `/${prefix}` : '';
const dir = `tmp/loading-review/${label}-${cpu}`;
mkdirSync(dir, { recursive: true });
const html = readFileSync(`${prefix ? prefix + '/' : ''}index.html`, 'utf8').replace(
  '<script type="module" src="/src/main.ts"></script>', `<script type="module">
import { Game } from '${root}/src/Game.ts';
const start=Game.prototype.start;Game.prototype.start=function(){window.__testGame=this;window.__startedAt=performance.now();return start.call(this)};
await import('${root}/src/main.ts');
</script>`);
writeFileSync(`${dir}/index.html`, html);
const vite = process.env.DEAD_SECTOR_REVIEW_URL ? null : await (await import('vite')).createServer({
  configFile: false, cacheDir: 'node_modules/.vite-loading-review',
  server: { host: '127.0.0.1', port: 5174, hmr: false, watch: null },
});
await vite?.listen();
const origin = process.env.DEAD_SECTOR_REVIEW_URL ?? vite.resolvedUrls.local[0].replace(/\/$/, '');
const port=9373, sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding',
  `--remote-debugging-port=${port}`,`--user-data-dir=${mkdtempSync(join(tmpdir(),'dead-sector-loading-'))}`,'about:blank',
],{windowsHide:true,stdio:'ignore'});
let ws;const report={label,cpu,profileCPU,errors:[],missing:[],warnings:[],phases:{}};
try {
  let target;
  for(let n=0;n<100&&!target;n++){try{target=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');}catch{}if(!target)await sleep(100);}
  assert.ok(target,'Chrome joignable');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);}
    if(m.method==='Runtime.exceptionThrown')report.errors.push(m.params.exceptionDetails);
    if(m.method==='Network.responseReceived'&&m.params.response.status>=400)report.missing.push(m.params.response.url);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='warning')report.warnings.push(m.params.args.map(a=>a.value??a.description).join(' '));
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{for(let i=0;i<400;i++){if(await ev(expression))return;await sleep(150);}throw Error(`Attente : ${expression}`);};
  const click=async selector=>{
    const pos=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...pos,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...pos,button:'left',clickCount:1});
  };
  const screenshot=async name=>writeFileSync(`${dir}/${name}.png`,Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setCPUThrottlingRate',{rate:cpu});
  await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
window.__audit={frames:[],tasks:[],compile:0,link:0,decodes:[],mediaStarts:[]};
new PerformanceObserver(l=>__audit.tasks.push(...l.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
for(const key of ['compileShader','linkProgram']){const fn=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...a){__audit[key==='compileShader'?'compile':'link']++;return fn.apply(this,a)}}
const decode=AudioContext.prototype.decodeAudioData;AudioContext.prototype.decodeAudioData=function(...a){const t=performance.now();const p=decode.apply(this,a);p.then(b=>__audit.decodes.push({t,ms:performance.now()-t,seconds:b.duration,pcm:b.length*b.numberOfChannels*4}));return p};
const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const t=performance.now();const p=play.call(this);p.then(()=>__audit.mediaStarts.push({url:this.src,t,ms:performance.now()-t}),()=>{});return p};
let last;function frame(t){if(last)__audit.frames.push({t,ms:t-last});last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame);
`});
  await send('Page.navigate',{url:`${origin}/${dir}/index.html`});
  await wait(`!!window.__testGame || !!document.querySelector('#loading-action:not([hidden])')`);
  report.preparedAt=await ev('performance.now()');
  if(await ev(`!!document.querySelector('#loading-action:not([hidden])')`)){
    assert.equal(await ev(`document.querySelector('#loading-action').textContent`),'Continuer');
    await screenshot('chargement');await click('#loading-action');
    await wait('!!window.__testGame');
  }
  await screenshot('accueil');
  await send('Page.bringToFront');
  if(profileCPU) {
    await ev(`(()=>{
      const g=__testGame;window.__spawnCPU={rows:[],current:null};
      for(const key of ['hasLineOfSight','findNextWaypoint']) {
        const original=g.level[key];g.level[key]=function(...args){if(__spawnCPU.current)__spawnCPU.current[key]++;return original.apply(this,args)};
      }
      const spawn=g.trySpawnZombie;g.trySpawnZombie=function(...args){
        const row={t:performance.now(),hasLineOfSight:0,findNextWaypoint:0};__spawnCPU.current=row;
        try{row.success=spawn.apply(this,args);return row.success}finally{row.ms=performance.now()-row.t;__spawnCPU.rows.push(row);__spawnCPU.current=null}
      };
    })()`);
    await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:1000});await send('Profiler.start');
  }
  const entry=await ev('({t:performance.now(),compile:__audit.compile,link:__audit.link})');
  await click('#title-play');
  await sleep(300);
  report.nativePointerLock=await ev('document.pointerLockElement===__testGame.renderer.domElement');
  if(!report.nativePointerLock)await ev(`Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>__testGame.renderer.domElement});document.dispatchEvent(new Event('pointerlockchange'));`);
  await wait('document.pointerLockElement===__testGame.renderer.domElement && !__testGame.titleScene');
  await ev(`__testGame.player.takeDamage=()=>{};`);
  const summarize=rows=>{const sorted=rows.map(r=>r.ms).sort((a,b)=>a-b);return{count:sorted.length,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...sorted),over33:sorted.filter(v=>v>33).length,over50:sorted.filter(v=>v>50).length};};
  const sample=async(name,count,action='')=>{
    const r=await ev(`(async()=>{const t=performance.now(),c=__audit.compile,l=__audit.link;${action};for(let i=0;i<${count};i++)await new Promise(r=>requestAnimationFrame(r));return{frames:__audit.frames.filter(f=>f.t>=t),compile:__audit.compile-c,link:__audit.link-l,active:__testGame.zombies.filter(z=>z.isAlive()).length,state:__testGame.state,combat:__testGame.getDetailedPerformanceReport().combatMetrics,programs:__testGame.renderer.info.programs.length};})()`);
    report.phases[name]={...r,frames:summarize(r.frames)};console.log(name,JSON.stringify(report.phases[name]));
  };
  await sample('p1-first',180);
  const entryFrames=await ev(`__audit.frames.filter(f=>f.t>=${entry.t})`);
  report.entry={frames:summarize(entryFrames),...await ev(`({compile:__audit.compile-${entry.compile},link:__audit.link-${entry.link}})`)};
  await sample('sounds-first',100,`for(const sound of Object.values(__testGame.weapon.sounds)){__testGame.weapon.playSound(sound);await new Promise(r=>setTimeout(r,70))}__testGame.player.toggleFlashlight();__testGame.player.toggleFlashlight()`);
  await sample('p7-first',480,`__testGame.startTier(7)`);
  await sample('p7-warm',180);
  await sample('p8-first',240,`__testGame.startTier(8)`);
  if(profileCPU) {
    writeFileSync(`${dir}/cpu.cpuprofile`,JSON.stringify((await send('Profiler.stop')).profile));
    report.spawns=await ev('__spawnCPU.rows');
  }
  await screenshot('p8');
  report.final=await ev(`({startedAt:__startedAt,audioState:__testGame.player.audioListener.context.state,decodes:__audit.decodes,mediaStarts:__audit.mediaStarts,startupTasks:__audit.tasks.filter(t=>t.start<__startedAt),programs:__testGame.renderer.info.programs.length,resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).map(r=>({url:r.name,bytes:r.encodedBodySize})),music:[...__testGame.music.playback].map(([id,p])=>({id,pcm:p.buffer?p.buffer.length*p.buffer.numberOfChannels*4:0,media:!!p.media})),heap:performance.memory?.usedJSHeapSize})`);
  assert.equal(report.errors.length,0,'aucune exception navigateur');
  assert.ok(Object.values(report.phases).every(p=>p.combat.count>0),'combat effectivement mesuré');
  writeFileSync(`${dir}/results.json`,JSON.stringify(report,null,2));
  console.log('Rapport',`${dir}/results.json`);
}catch(error){writeFileSync(`${dir}/failed.json`,JSON.stringify({...report,error:String(error)},null,2));throw error;}
finally{ws?.close();chrome.kill();await vite?.close();}
