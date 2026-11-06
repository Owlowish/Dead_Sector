import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });

// DOM léger issu du vrai HTML : tester les événements et valeurs, sans WebGL ni dépendance.
class Element extends EventTarget {
  constructor(tagName = 'div', attributes = {}) {
    super();
    this.tagName = tagName.toUpperCase(); this.attributes = { ...attributes };
    this.children = []; this.parentElement = null; this.ownText = '';
    this.hidden = 'hidden' in attributes; this.dataset = {};
    for (const [name, value] of Object.entries(attributes)) {
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    this.style = { setProperty(name, value) { this[name] = value; }, getPropertyValue(name) { return this[name] ?? ''; } };
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      toggle: (name, enabled) => {
        const values = new Set(this.className.split(/\s+/).filter(Boolean));
        const present = enabled ?? !values.has(name);
        if (present) values.add(name); else values.delete(name);
        this.className = [...values].join(' '); return present;
      },
      add: (...names) => names.forEach((name) => this.classList.toggle(name, true)),
      remove: (...names) => names.forEach((name) => this.classList.toggle(name, false)),
    };
  }
  get className() { return this.attributes.class ?? ''; }
  set className(value) { this.attributes.class = value; }
  get textContent() { return this.ownText + this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.ownText = String(value); this.replaceChildren(); }
  get firstElementChild() { return this.children[0] ?? null; }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...children); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  focus() { document.activeElement = this; }
  matches(selector) {
    if (selector.startsWith('#')) return this.attributes.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    const attr = selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
    return attr ? attr[1] in this.attributes && (attr[2] === undefined || this.attributes[attr[1]] === attr[2])
      : this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [...(selector.split(',').some((part) => child.matches(part.trim())) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

function readDocument() {
  const root = new Element('document'); const stack = [root];
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) ?? []) {
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (token.startsWith('<')) {
      const tag = token.match(/^<([\w-]+)/)?.[1]; if (!tag) continue;
      const attributes = {};
      for (const match of token.slice(tag.length + 1, -1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
      const node = new Element(tag, attributes); stack.at(-1).append(node);
      if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
    } else stack.at(-1).ownText += token;
  }
  return Object.assign(root, {
    pointerLockElement: null, hidden: false, focused: true, activeElement: null,
    hasFocus() { return this.focused; },
    createElement: (tag) => new Element(tag),
    exitPointerLock() { this.pointerLockElement = null; },
  });
}

globalThis.HTMLElement = Element;
globalThis.document = readDocument();
globalThis.window = Object.assign(new EventTarget(), { innerWidth: 1280, innerHeight: 720 });
globalThis.Audio = class { volume = 1; currentTime = 0; play() { return Promise.resolve(); } pause() {} };
THREE.TextureLoader.prototype.load = () => new THREE.Texture();

const { GameHud } = await import('../src/GameHud.ts');
const { Game } = await import('../src/Game.ts');
const { Player } = await import('../src/Player.ts');
const { Weapon } = await import('../src/Weapon.ts');
const { Zombie } = await import('../src/Zombie.ts');
const { Medkit } = await import('../src/Medkit.ts');
const { AmmoBox } = await import('../src/AmmoBox.ts');
const { ShotgunPickup } = await import('../src/ShotgunPickup.ts');
const { TierDiagnosticsTracker } = await import('../src/TierDiagnostics.ts');
const { ENCOUNTER_CONFIGS } = await import('../src/EncounterConfig.ts');

const field = (name) => {
  const node = document.querySelector(`[data-hud-${name}]`);
  assert.ok(node, `Le vrai HTML fournit data-hud-${name}`); return node;
};
const notifications = () => document.querySelector('#hud-notifications').children;
const hud = new GameHud();

// Santé et disponibilité des actions : la couleur n'est jamais l'unique signal.
hud.setHealth(24, 100);
assert.equal(field('health-value').textContent, '24');
assert.equal(field('health-max').textContent, '100');
assert.match(field('health-state').textContent, /CRITIQUE/);
assert.equal(document.querySelector('#health').classList.contains('is-critical'), true);
assert.equal(field('health-bar').style.getPropertyValue('--fill'), '24%');
hud.setHealth(70, 120);
assert.equal(document.querySelector('#health').classList.contains('is-critical'), false);
assert.equal(field('health-max').textContent, '120');
hud.setFlashlight(false);
assert.equal(field('lamp-state').textContent, 'ÉTEINTE');
assert.equal(document.querySelector('#flashlight-status').classList.contains('off'), true);

const ammo = { weaponId: 'pistol', weaponName: 'Pistolet 9mm', magazine: 0, capacity: 15, reserve: 0, maxReserve: 60, isReloading: false };
hud.setBoss({ health: 800, maxHealth: 800, phase: 1, attack: 'throw' });
assert.equal(field('boss').hidden, false);
assert.equal(field('boss-bar').getAttribute('aria-valuenow'), '800');
assert.match(field('boss-attack').textContent, /JET DE CLÉS/);
hud.setBoss({ health: 360, maxHealth: 800, phase: 2, attack: null, recovering: true });
assert.equal(field('boss-bar').style.getPropertyValue('--fill'), '45%');
assert.match(field('boss-phase').textContent, /II/);
assert.match(field('boss-attack').textContent, /RÉCUPÉRATION/);
hud.clear();
assert.equal(field('boss').hidden, true, 'aucune jauge après victoire ou redémarrage');
hud.setAmmo(ammo, false);
assert.equal(field('magazine').textContent, '0');
assert.match(field('ammo-state').textContent, /ÉPUISÉES/);
assert.doesNotMatch(field('ammo-state').textContent, /\[R\]/, 'pas de commande de recharge impossible');
assert.equal(document.querySelector('[data-hud-slot="shotgun"]').hidden, true);
hud.setAmmo({ ...ammo, reserve: 4 }, false);
assert.match(field('ammo-state').textContent, /\[R\] RECHARGER/);
hud.setAmmo({ ...ammo, magazine: 2, isReloading: true }, true);
assert.match(field('ammo-state').textContent, /RECHARGEMENT/);
assert.equal(document.querySelector('#ammo').classList.contains('is-reloading'), true);
hud.setAmmo({ ...ammo, magazine: 2 }, true);
assert.match(field('ammo-state').textContent, /RÉSERVE ÉPUISÉE/);
assert.doesNotMatch(field('ammo-state').textContent, /\[R\]/);

// Le cœur suit le temps de contrôle ; aucune animation autonome pendant une pause.
const heartFrame = () => Number(document.querySelector('#health').style.getPropertyValue('--heart-frame'));
hud.setReducedMotion(false); hud.setHealth(100, 100); hud.clear();
assert.equal(heartFrame(), 0);
const observedFrames = [];
for (let step = 0; step < 140; step++) {
  hud.update(0.01, true); observedFrames.push(heartFrame());
}
assert.deepEqual([...new Set(observedFrames)].sort(), [0, 1, 2, 3], 'un cycle utilise les quatre poses de l’atlas');
assert.ok(observedFrames.filter((pose) => pose === 0).length > observedFrames.length / 2,
  'le cœur reste principalement au repos');
assert.equal(heartFrame(), 0, 'retour au repos après le cycle');
for (let step = 0; step < 140 && heartFrame() === 0; step++) hud.update(0.01, true);
assert.notEqual(heartFrame(), 0);
const pausedHeart = heartFrame();
hud.update(20, false);
assert.equal(heartFrame(), pausedHeart, 'la perte de contrôle fige la pose sans consommer le cycle');
hud.setReducedMotion(true);
assert.equal(heartFrame(), 0, 'réduire le mouvement remet immédiatement le cœur au repos');
hud.update(2, true); assert.equal(heartFrame(), 0);
hud.setReducedMotion(false); hud.setHealth(0, 100);
hud.update(2, true); assert.equal(heartFrame(), 0, 'aucun battement après la mort');
hud.setHealth(100, 100); hud.update(0.35, true); hud.clear();
assert.equal(heartFrame(), 0, 'un redémarrage remet le cycle au repos');

// Le secteur apparaît à l’entrée du palier, pas à chaque mise à jour du compteur.
const combat = { phase: 'combat', tier: 1, total: 8, sector: 'VESTIBULE', remaining: 4, respiteSeconds: 0 };
hud.setProgression(combat); hud.update(0, true);
assert.equal(field('sector').textContent, 'VESTIBULE');
assert.equal(field('sector').hidden, false);
hud.update(1, true); hud.update(20, false);
assert.equal(field('sector').hidden, false, 'la pause conserve la fenêtre du secteur sans la faire expirer');
hud.update(0, true);
assert.equal(field('sector').hidden, false, 'la pause ne consomme pas sa durée');
hud.setProgression({ ...combat, remaining: 3 }); hud.update(2.1, true);
assert.equal(field('sector').hidden, true, 'trois secondes actives suffisent malgré les mises à jour du combat');
hud.setProgression({ ...combat, remaining: 2 }); hud.update(0, true);
assert.equal(field('sector').hidden, true, 'une élimination ne réaffiche pas le secteur');
const nextCombat = { ...combat, tier: 2, sector: 'HALL' };
hud.setProgression(nextCombat); hud.update(0, true);
assert.equal(field('sector').hidden, false);
assert.equal(field('sector').textContent, 'HALL');
hud.update(2, true); hud.setProgression(nextCombat); hud.update(1.1, true);
assert.equal(field('sector').hidden, true, 'le nouveau palier réarme une seule fenêtre de visibilité');
assert.equal(field('sector').textContent, 'HALL', 'le nom réel reste disponible dans le DOM');
hud.clear();

// Deux avis au plus, fusion de gains de même type, durée en temps de contrôle.
for (const invalid of [0, -1, NaN, Infinity]) hud.notifyGain('health', invalid);
assert.equal(notifications().length, 0);
hud.notifyGain('health', 2); hud.notifyGain('health', 3);
assert.equal(notifications().length, 1);
assert.equal(notifications()[0].textContent, '+5 PV');
hud.notifyGain('pistol', 2);
assert.equal(notifications().length, 2);
hud.notifyGain('shotgun', 4);
assert.equal(notifications().length, 2, 'le troisième type remplace un avis au lieu de couvrir l’écran');
hud.notifyWeapon();
assert.equal(notifications().length, 2);
assert.ok(notifications().some((node) => /ACQUIS/.test(node.textContent)));
hud.announce('ACCÈS OUVERT'); hud.update(0, true);
assert.equal(field('announcement').hidden, false);
const heldNotices = notifications().map((node) => node.textContent);
hud.update(30, false);
assert.deepEqual(notifications().map((node) => node.textContent), heldNotices, 'la pause ne consomme pas les notifications');
assert.equal(document.querySelector('#hud-notifications').hidden, true);
hud.update(1, true);
assert.equal(notifications().length, 2);
assert.equal(field('announcement').hidden, false);
hud.update(3, true);
assert.equal(notifications().length, 0);
assert.equal(field('announcement').hidden, true);

hud.setPrompt({ key: 'E', action: 'OUVRIR', object: 'LA PORTE' });
assert.equal(document.querySelector('#prompt').hidden, false);
assert.equal(field('prompt-key').textContent, 'E');
hud.setPrompt({ action: 'VERROUILLÉE', object: 'AILE EST', locked: true });
assert.equal(field('prompt-key').hidden, true, 'pas de touche suggérée sur une action indisponible');
assert.equal(document.querySelector('#prompt').classList.contains('is-locked'), true);
hud.notifyGain('health', 4); hud.announce('FINALE'); hud.clear(); hud.update(0, true);
assert.equal(notifications().length, 0);
assert.equal(field('announcement').hidden, true);
assert.equal(document.querySelector('#prompt').hidden, true);

console.log('HUD : santé critique, états de munitions, invites, gains fusionnés/bornés et durée suspendue : OK');

const scene = new THREE.Scene();
const level = {
  getFloorHeightAt: () => 0, getDoors: () => [], isColliding: () => false,
  getLightingAt: () => ({ brightness: 0.5, warmth: 0 }), getStormWindowPositions: () => [], update() {},
};
const player = Object.create(Player.prototype);
Object.assign(player, {
  level, keys: new Set(), health: 98, maxHealth: 100, speedMultiplier: 1,
  camera: new THREE.PerspectiveCamera(75), eyeHeight: 1.7, normalFov: 75, aimedFov: 58,
  yaw: 0, pitch: 0, recoilPitch: 0, recoilYaw: 0, recoilRoll: 0,
  direction: new THREE.Vector3(), upAxis: new THREE.Vector3(0, 1, 0), walkSpeed: 5, runSpeed: 9,
  flashlight: { intensity: 22 }, flashlightIntensity: 22, flashlightOn: true,
});
player.camera.position.set(0, 1.7, 0);
const game = Object.create(Game.prototype);
const canvas = new Element('canvas');
const weapon = new Weapon(player.camera, canvas, [], [], () => {}, () => game.isSimulationActive(), (amount) => player.setAimAmount(amount));
weapon.reserveAmmo = 58;
weapon.setOnAmmoChange(() => game.updateAmmoDisplay());
let frame;
Object.assign(game, {
  scene, level, player, weapon, hud, encounterConfigs: ENCOUNTER_CONFIGS,
  renderer: { domElement: canvas, setAnimationLoop(callback) { frame = callback; }, render() {} },
  state: 'playing', currentTier: 1, spawnQueue: 2, pendingTierStart: 0, respiteTimer: 0,
  runElapsedSeconds: 0, completedTiers: new Set(), runResult: null, debugRun: false,
  debugMenuOpen: false, runSummaryOpen: false, disposed: false, damageEffectRemaining: 0,
  zombies: [], spitProjectiles: [], ammoBoxes: [], ammoDrops: [], medkits: [], shellCasings: [],
  shotgunPickup: new ShotgunPickup(scene, 40, 40), upgradePedestals: [], appliedUpgrades: [],
  encounterBell: { setActive() {}, canInteract: () => false, update() {} },
  tierDiagnostics: new TierDiagnosticsTracker(),
  horrorDirector: { resetRespite() {}, suspend() {} },
  stormController: { update() {}, resetForNewRun() {} },
  hitEffects: { update() {}, clear() {} },
  ambianceAudio: null, musicAudio: null,
  syncAmbientAudio() {}, updateAudioMix() {}, updateHorrorAudio() {}, logPerformanceMetrics() {},
});

// Le compteur traduit la vraie file et la vraie sémantique de relève de Zombie.
const revival = Object.assign(Object.create(Zombie.prototype), { alive: false, revivalPending: true });
game.zombies = [revival, { isAlive: () => true }];
game.updateObjectiveDisplay();
assert.match(field('phase').textContent, /1 \/ 8/);
assert.match(field('progress').textContent, /^4\b.*MENACES/i);
revival.revivalPending = false;
game.updateObjectiveDisplay();
assert.match(field('progress').textContent, /^3\b.*MENACES/i);
game.zombies = []; game.spawnQueue = 0;

// Les vrais soins et réserves plafonnés doivent produire le delta réellement appliqué.
game.medkits = [new Medkit(scene, 0, 0, 30)];
game.ammoDrops = [new AmmoBox(scene, 0, 0, 10, 'pistol')];
game.updatePickups(0.05, false);
assert.equal(player.getHealth(), 98);
assert.equal(weapon.getReserveAmmo(), 58);
assert.equal(game.medkits[0].isConsumed(), false);
assert.equal(game.ammoDrops[0].isConsumed(), false);
assert.equal(notifications().length, 0, 'aucun gain ni notification sans contrôle');
game.updatePickups(0.05, true);
assert.equal(player.getHealth(), 100);
assert.equal(weapon.getReserveAmmo(), 60);
assert.equal(game.ammoDrops.length, 1, 'le reliquat du ramassage partiel reste au sol');
assert.equal(game.ammoDrops[0].getRemainingAmmo(), 8);
assert.deepEqual(notifications().map((node) => node.textContent).sort(), ['+2 MUNITIONS · 9 MM', '+2 PV']);
assert.equal(field('health-value').textContent, '100');
assert.equal(field('reserve').textContent, '60');
hud.clear();
game.medkits.push(new Medkit(scene, 0, 0, 30));
game.ammoDrops.push(new AmmoBox(scene, 0, 0, 10, 'pistol'));
game.updatePickups(0.05, true);
assert.equal(notifications().length, 0, 'vie/réserve pleines sans faux gain');
assert.equal(game.ammoDrops[0].isConsumed(), false);

// Ramasser des cartouches d'une autre arme n'affiche pas le gain de l'arme active.
const otherAmmo = new AmmoBox(scene, 0, 0, 4, 'shotgun');
const pistolBefore = weapon.getReserveAmmoFor('pistol');
assert.equal(game.collectAmmoBox(otherAmmo), true);
assert.equal(weapon.getReserveAmmoFor('pistol'), pistolBefore);
assert.equal(weapon.getReserveAmmoFor('shotgun'), 19);
assert.equal(notifications()[0].textContent, '+4 CARTOUCHES · CAL. 12');
otherAmmo.dispose(); hud.clear();
game.shotgunPickup.x = 0; game.shotgunPickup.z = 0;
game.updatePickups(0.05, true);
assert.equal(weapon.isWeaponUnlocked('shotgun'), true);
assert.equal(weapon.getActiveWeaponId(), 'shotgun');
assert.equal(document.querySelector('[data-hud-slot="shotgun"]').hidden, false);
assert.equal(notifications().filter((node) => /ACQUIS/.test(node.textContent)).length, 1);
game.updatePickups(0.05, true);
assert.equal(notifications().filter((node) => /ACQUIS/.test(node.textContent)).length, 1, 'une acquisition unique');

// Le HUD suit le transfert de cartouche effectif, y compris une interruption.
document.pointerLockElement = canvas;
weapon.magazineAmmo = 0; weapon.reserveAmmo = 3;
assert.equal(weapon.reload(), true);
weapon.update(0.49);
assert.equal(field('magazine').textContent, '0', 'la main animée ne crédite pas une cartouche anticipée');
weapon.update(0.02);
assert.equal(field('magazine').textContent, '1');
assert.equal(field('reserve').textContent, '2');
weapon.cancelReload();
assert.equal(field('magazine').textContent, '1', 'interrompre après insertion conserve la cartouche engagée');
assert.equal(document.querySelector('#ammo').classList.contains('is-reloading'), false);
weapon.shoot();
assert.equal(field('magazine').textContent, '0', 'le tir consomme la cartouche engagée');
assert.equal(weapon.switchWeapon('pistol'), true);
assert.equal(field('capacity').textContent, '15');
assert.equal(field('magazine').textContent, String(weapon.getAmmo()));

// La boucle réelle, pas une recopie du garde, décide de suspendre l'accalmie.
game.state = 'exploration'; game.pendingTierStart = 2; game.respiteTimer = 9.4;
game.updateObjectiveDisplay();
assert.equal(document.querySelector('#objective').dataset.phase, 'respite');
assert.match(field('progress').textContent, /10 S/);
assert.equal(field('respite-bar').hidden, false);
game.start();
const tick = () => { game.lastFrameTime = performance.now() - 125; frame(); };
hud.clear();
for (let step = 0; step < 140 && heartFrame() === 0; step++) hud.update(0.01, true);
const heartBeforeFocusLoss = heartFrame();
assert.notEqual(heartBeforeFocusLoss, 0);
document.pointerLockElement = null; tick();
assert.equal(game.respiteTimer, 9.4, 'Échap suspend le décompte');
assert.equal(heartFrame(), heartBeforeFocusLoss, 'Échap suspend le cœur animé');
document.pointerLockElement = canvas; document.focused = false; tick();
assert.equal(game.respiteTimer, 9.4, 'le focus est requis même avec la souris capturée');
assert.equal(heartFrame(), heartBeforeFocusLoss, 'le cœur ne bat pas dans une application sans focus');
document.focused = true; document.hidden = true; tick();
assert.equal(game.respiteTimer, 9.4, 'un onglet masqué ne consomme pas le décompte');
assert.equal(heartFrame(), heartBeforeFocusLoss, 'le cœur reste figé dans un onglet masqué');
document.hidden = false; tick();
assert.ok(game.respiteTimer < 9.4 && game.respiteTimer > 9.3);
game.respiteTimer = 0.04; tick();
assert.equal(game.state, 'playing');
assert.equal(game.currentTier, 2);
assert.equal(game.pendingTierStart, 0);
assert.equal(game.spawnQueue, ENCOUNTER_CONFIGS[1].totalZombies);
assert.equal(field('respite-bar').hidden, true);

// Un dégât fatal au début d'une frame interdit aussi les collectes de cette frame.
game.spawnQueue = 0; player.health = 5;
weapon.switchWeapon('pistol'); weapon.reserveAmmo = 58;
game.shotgunPickup = new ShotgunPickup(scene, 0, 0);
const deathDrop = new AmmoBox(scene, 0, 0, 10, 'pistol');
game.ammoDrops = [deathDrop]; hud.clear();
game.spitProjectiles = [{
  update(_delta, _scene, _level, _position, onDamage) { onDamage(10); return false; },
  dispose() {},
}];
tick();
assert.equal(game.state, 'lost');
assert.equal(weapon.getReserveAmmo(), 58, 'la frame de mort ne ramasse pas de munitions');
assert.equal(deathDrop.isConsumed(), false);
assert.equal(game.shotgunPickup.isConsumed(), false);
assert.equal(notifications().length, 0);

// Le début d'une nouvelle tentative ne conserve aucune notification/annonce/invite.
for (let run = 0; run < 2; run++) {
  hud.notifyGain('health', 2); hud.announce('ANCIEN PALIER');
  hud.setPrompt({ key: 'E', action: 'OUVRIR', object: 'ANCIENNE PORTE' });
  game.restartRun(); hud.update(0, true);
  assert.equal(notifications().length, 0);
  assert.equal(field('announcement').hidden, true);
  assert.equal(document.querySelector('#prompt').hidden, true);
  assert.equal(field('health-value').textContent, '100');
  assert.equal(field('magazine').textContent, '10');
  assert.equal(field('reserve').textContent, '30');
  assert.equal(document.querySelector('[data-hud-slot="shotgun"]').hidden, true);
  assert.equal(document.querySelector('#objective').dataset.phase, 'combat');
  assert.match(field('phase').textContent, /1 \/ 8/);
}
console.log('Intégration HUD : file/relèves, vrais gains partiels, collectes sous contrôle, accalmie/focus et deux redémarrages : OK. DOM/audio simulés ; rendu et gameplay non validés.');

