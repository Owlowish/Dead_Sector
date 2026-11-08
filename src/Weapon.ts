import * as THREE from 'three';
import { reloadPoses } from './WeaponAnimation.ts';
import { weaponArtCss, weaponAmbientBrightness } from './WeaponPresentation.ts';
import { shotgunPump, isShotgunPumpBack, isShotgunKick, shotgunKickAmount, shotgunReload, getShotgunReloadPose } from './ShotgunAnimation.ts';
import {
  sampleShotDirection,
  spreadRadiusPixels,
  pistolHipSpreadDegrees,
  pistolAdsSpreadDegrees,
  shotgunHipSpreadDegrees,
  shotgunAdsSpreadDegrees,
} from './WeaponSpread.ts';
import type { ShotImpact } from './HitEffects.ts';
import type { CasingType } from './ShellCasing.ts';
import { isHeadSpriteHit, isOpaqueSpriteHit } from './SpriteHitMask.ts';
import { getImpactSurface, type ImpactSurface } from './ImpactSurface.ts';
import { WeaponMechanicalAudio } from './WeaponMechanicalAudio.ts';
import { crossedWeaponSoundEvents, pistolReloadSoundEvents, shotgunPumpSoundEvents } from './WeaponSoundEvents.ts';
import type { WeaponMechanicalSoundId } from './WeaponSoundEvents.ts';
import { shotgunImpactPower, type EnemyShotImpact } from './EnemyImpact.ts';
import { axeAttack } from './AxeAnimation.ts';
import { AxeView } from './AxeView.ts';

export type FirearmId = 'pistol' | 'shotgun';
export type WeaponId = 'axe' | FirearmId;
export interface ShotDamage { headHits: number; bodyHits: number; headDamage?: number; impactForce: number; weaponId: WeaponId; impact?: EnemyShotImpact; stunSeconds?: number }

export type AmmoStocks = Record<WeaponId, { magazine: number; reserve: number; unlocked: boolean }>;

export interface WeaponState {
  id: WeaponId;
  name: string;
  unlocked: boolean;
  magazine: number;
  capacity: number;
  reserve: number;
  maxReserve: number;
  cooldownMs: number;
  range: number;
  pellets: number;
  damagePerPellet: number;
  hipSpreadDeg: number;
  adsSpreadDeg: number;
}

function createInitialWeapons(): Record<WeaponId, WeaponState> {
  return {
    axe: {
      id: 'axe', name: 'HACHE RUSTIQUE', unlocked: true,
      magazine: 0, capacity: 0, reserve: 0, maxReserve: 0,
      cooldownMs: axeAttack.duration * 1000, range: axeAttack.range,
      pellets: 1, damagePerPellet: axeAttack.damage, hipSpreadDeg: 0, adsSpreadDeg: 0,
    },
    pistol: {
      id: 'pistol',
      name: 'PISTOLET 9MM',
      unlocked: false,
      magazine: 10,
      capacity: 15,
      reserve: 30,
      maxReserve: 60,
      cooldownMs: 800,
      range: 30,
      pellets: 1,
      damagePerPellet: 40,
      hipSpreadDeg: pistolHipSpreadDegrees,
      adsSpreadDeg: pistolAdsSpreadDegrees,
    },
    shotgun: {
      id: 'shotgun',
      name: 'FUSIL À POMPE',
      unlocked: false,
      magazine: 5,
      capacity: 5,
      reserve: 15,
      maxReserve: 30,
      cooldownMs: 900,
      range: 18,
      pellets: 8,
      damagePerPellet: 15,
      hipSpreadDeg: shotgunHipSpreadDegrees,
      adsSpreadDeg: shotgunAdsSpreadDegrees,
    },
  };
}

interface WeaponSound {
  clips: HTMLAudioElement[];
  gain: number;
  nextClip: number;
}

function createWeaponSound(file: string, gain: number, count = 1): WeaponSound {
  const clips = Array.from({ length: count }, (_, index) => {
    const suffix = index === 0 ? '' : `-${index + 1}`;
    return new Audio(`/assets/sounds/${file}${suffix}.wav`);
  });
  return { clips, gain, nextClip: 0 };
}

export class Weapon {
  private readonly raycaster = new THREE.Raycaster();
  private weapons = createInitialWeapons();

  private activeWeaponId: WeaponId = 'axe';
  private lastShot = -Infinity;
  private readonly recoilDuration = 2; // Réglage utilisateur conservé

  // Rechargement pistolet par poses
  private readonly reloadPoses = reloadPoses;
  private readonly reloadDuration = this.reloadPoses.reduce((total, pose) => total + pose.duration, 0);
  private isReloading = false;
  private reloadTimer = 0;
  private shotgunShellCommitted = false;
  private currentFrameIndex = -1;

  // Effets sonores
  private readonly sounds = {
    empty: createWeaponSound('empty-soft', 0.3),
    pistol: createWeaponSound('shot-soft', 0.5, 3),
    shotgun: createWeaponSound('shotgun-shot', 0.42, 2),
    metal: createWeaponSound('impact-metal-soft', 0.3, 3),
    wood: createWeaponSound('impact-wood-soft', 0.3, 3),
    stone: createWeaponSound('impact-stone-soft', 0.27, 3),
    enemy: createWeaponSound('impact-zombie-soft', 0.35, 3),
    axeFlesh: createWeaponSound('axe-flesh', 0.28),
  };
  private mechanicalAudio: WeaponMechanicalAudio | null = null;
  private mechanicalContext: AudioContext | null = null;
  private effectsVolume = 1;
  private pumpSoundActive = false;
  private reloadSoundActive = false;
  private disposed = false;
  private readonly removeInputListeners: (() => void)[] = [];
  private readonly crosshair = document.querySelector<HTMLElement>('.crosshair');
  private headMarkerTimer: ReturnType<typeof setTimeout> | null = null;

  private shotAnimationTime = Infinity;
  private spentShellScheduled = false;
  private axeAttackTime = Infinity;
  private axeContactResolved = false;
  private axeSwingSoundPlayed = false;

  // Éléments DOM du HUD
  private readonly weaponView = document.querySelector<HTMLElement>('.weapon-view');
  private readonly axeView: AxeView;
  private readonly hud = document.querySelector<HTMLElement>('.hud');
  private readonly pistolRig = document.querySelector<HTMLElement>('#pistol-rig');
  private readonly shotgunRig = document.querySelector<HTMLElement>('#shotgun-rig');
  private readonly hipSprite = document.querySelector<HTMLElement>('#weapon-hip-sprite');
  private readonly muzzleFlashes = document.querySelectorAll<HTMLElement>('.muzzle-flash');

  private aimHeld = false;
  public aimAmount = 0;
  private readonly aimTransitionDuration = 0.18;
  private canPlay: () => boolean;
  private onAimChange: (amount: number) => void;

  private camera: THREE.Camera;
  public get magazineAmmo(): number {
    return this.getActiveWeapon().magazine;
  }
  public set magazineAmmo(v: number) {
    this.getActiveWeapon().magazine = v;
  }
  public get reserveAmmo(): number {
    return this.getActiveWeapon().reserve;
  }
  public set reserveAmmo(v: number) {
    this.getActiveWeapon().reserve = v;
  }

  private targets: THREE.Mesh[];
  private blockers: THREE.Mesh[];
  private onHit: (target: THREE.Mesh, damage: number, shot: ShotDamage) => void;
  private onAmmoChange:
    | ((magazine: number, capacity: number, reserve: number, isReloading: boolean, weaponName: string, weaponId: WeaponId) => void)
    | null = null;
  private onShoot: ((aimAmount: number, weaponId: WeaponId) => void) | null = null;
  private onCasingEject: ((aimAmount: number, casingType: CasingType) => void) | null = null;
  private onImpact: ((impact: ShotImpact) => void) | null = null;
  private readonly muzzleLight = new THREE.PointLight(0xffa733, 0, 15, 1.8);
  private currentBrightness = 0.35;
  private currentWarmth = 0.0;
  private targetBrightness = 0.35;
  private targetWarmth = 0.0;
  private stormFlash = 0;
  private canvas: HTMLCanvasElement;

  constructor(
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
    targets: THREE.Mesh[],
    blockers: THREE.Mesh[],
    onHit: (target: THREE.Mesh, damage: number, shot: ShotDamage) => void,
    canPlay: () => boolean,
    onAimChange: (amount: number) => void
  ) {
    this.camera = camera;
    this.canvas = canvas;
    this.targets = targets;
    this.blockers = blockers;
    this.onHit = onHit;
    this.canPlay = canPlay;
    this.onAimChange = onAimChange;
    this.axeView = new AxeView(this.weaponView);
    this.muzzleLight.position.set(0.08, -0.12, -0.45);
    this.camera.add(this.muzzleLight);

    this.setEffectsVolume(1);

    // Préchargement des planches d'armes
    if (typeof Image !== 'undefined') {
      new Image().src = '/assets/weapons/pistol_actions_v3.png';
      new Image().src = shotgunPump.restAsset;
      new Image().src = shotgunPump.backAsset;
      new Image().src = shotgunPump.hipKickAsset;
      new Image().src = shotgunPump.adsKickAsset;
      new Image().src = '/assets/weapons/shotgun/reload_draft.png';
      new Image().src = '/assets/weapons/shotgun/live_shell.png';
      new Image().src = '/assets/weapons/shotgun/ads_pump_v2.png';
      new Image().src = '/assets/weapons/shotgun/flash.png';
    }

    // Gestion de la visée et du tir
    this.listen(canvas, 'mousedown', (event: MouseEvent) => {
      if (!this.canPlay() || document.pointerLockElement !== this.canvas) return;
      if (event.button === 2) {
        if (!this.isReloading && this.activeWeaponId !== 'axe') this.aimHeld = true;
      }
      if (event.button === 0) this.shoot();
    });

    this.listen(window, 'mouseup', (event: MouseEvent) => {
      if (event.button === 2) this.aimHeld = false;
    });

    // Sélection d'armes avec touches 1 / 2 / 3 et molette
    this.listen(window, 'keydown', (event: KeyboardEvent) => {
      // Ignorer si la simulation n'est pas active ou si le curseur n'est pas capturé
      if (!this.canPlay() || document.pointerLockElement !== this.canvas) return;

      if ((event.code === 'Digit1' || event.code === 'Numpad1') && !event.repeat) {
        this.switchWeapon('axe');
      } else if ((event.code === 'Digit2' || event.code === 'Numpad2') && !event.repeat) {
        this.switchWeapon('pistol');
      } else if ((event.code === 'Digit3' || event.code === 'Numpad3') && !event.repeat) {
        this.switchWeapon('shotgun');
      } else if (event.code === 'KeyR' && !event.repeat) {
        this.reload();
      }
    });

    this.listen(canvas, 'wheel', (event: WheelEvent) => {
      if (!this.canPlay() || document.pointerLockElement !== this.canvas) return;
      if (event.deltaY > 0) {
        this.nextWeapon();
      } else if (event.deltaY < 0) {
        this.prevWeapon();
      }
    });

    this.listen(canvas, 'contextmenu', (event) => event.preventDefault());

    // Interruption propre sur perte de focus
    this.listen(window, 'blur', () => {
      this.suspendSoundEffects();
      this.resetAim();
      this.cancelReload();
    });

    this.listen(document, 'pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas) {
        this.suspendSoundEffects();
        this.resetAim();
        this.cancelReload();
      }
    });

    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.suspendSoundEffects();
        this.resetAim();
        this.cancelReload();
      }
    });

    // Affichage initial
    this.updateWeaponDOM();
    this.setHipFrame(0);
    this.renderShotEffects();
  }

  public resetForNewRun(): void {
    this.suspendSoundEffects();
    this.weapons = createInitialWeapons();
    this.activeWeaponId = 'axe';
    this.axeAttackTime = Infinity;
    this.axeContactResolved = false;
    this.axeSwingSoundPlayed = false;
    this.lastShot = -Infinity;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.shotgunShellCommitted = false;
    this.shotAnimationTime = Infinity;
    this.spentShellScheduled = false;
    this.muzzleLight.intensity = 0;
    this.targets = [];
    if (this.headMarkerTimer !== null) clearTimeout(this.headMarkerTimer);
    this.headMarkerTimer = null;
    this.crosshair?.classList.toggle('head-hit', false);
    this.shotgunRig?.classList.toggle('is-reloading', false);
    for (const sound of Object.values(this.sounds)) {
      sound.nextClip = 0;
    }
    this.currentBrightness = this.targetBrightness;
    this.currentWarmth = this.targetWarmth;
    this.weaponView?.style.setProperty('--weapon-brightness', this.currentBrightness.toFixed(2));
    this.weaponView?.style.setProperty('--weapon-warmth', this.currentWarmth.toFixed(2));
    this.currentFrameIndex = -1;
    this.setHipFrame(0);
    this.resetAim();
    this.updateWeaponDOM();
    this.notifyAmmoChange();
  }

  private listen<T extends Event>(target: EventTarget, type: string, listener: (event: T) => void): void {
    const handler = listener as EventListener;
    target.addEventListener(type, handler);
    this.removeInputListeners.push(() => target.removeEventListener(type, handler));
  }

  public setupMechanicalAudio(context: AudioContext, destination: AudioNode): void {
    if (this.disposed || this.mechanicalAudio) return;
    this.mechanicalContext = context;
    this.mechanicalAudio = new WeaponMechanicalAudio(context, destination);
    this.mechanicalAudio.setVolume(this.effectsVolume);
    this.listen(context, 'statechange', () => {
      if (context.state !== 'running') this.suspendSoundEffects();
    });
  }

  public suspendMechanicalAudio(): void {
    this.pumpSoundActive = false;
    this.reloadSoundActive = false;
    this.mechanicalAudio?.suspend();
  }

  public suspendSoundEffects(): void {
    this.suspendMechanicalAudio();
    for (const sound of Object.values(this.sounds)) {
      for (const clip of sound.clips) {
        if (!clip.paused) clip.pause?.();
      }
    }
  }

  private hasActiveControl(): boolean {
    return this.canPlay() && document.pointerLockElement === this.canvas
      && !document.hidden && (document.hasFocus?.() ?? true);
  }

  private canPlayMechanicalAudio(): boolean {
    return !this.disposed && this.hasActiveControl()
      && (!this.mechanicalContext || this.mechanicalContext.state === 'running');
  }

  private playMechanicalSound(sound: WeaponMechanicalSoundId): void {
    if (this.canPlayMechanicalAudio()) this.mechanicalAudio?.play(sound);
  }

  public getActiveWeapon(): WeaponState {
    return this.weapons[this.activeWeaponId];
  }

  public getActiveWeaponId(): WeaponId {
    return this.activeWeaponId;
  }

  public isWeaponUnlocked(id: WeaponId): boolean {
    return this.weapons[id].unlocked;
  }

  public unlockWeapon(id: WeaponId): void {
    if (!this.weapons[id].unlocked) {
      this.weapons[id].unlocked = true;
      console.log(`Nouvelle arme débloquée : ${this.weapons[id].name}`);
    }
    this.switchWeapon(id);
  }

  public switchWeapon(id: WeaponId): boolean {
    if (this.disposed) return false;
    if (!this.weapons[id].unlocked || this.activeWeaponId === id) return false;
    if (this.activeWeaponId === 'axe' && this.axeAttackTime < axeAttack.duration) return false;

    // Interrompre le rechargement en cours
    this.cancelReload();
    this.suspendMechanicalAudio();

    this.activeWeaponId = id;
    this.axeAttackTime = Infinity;
    this.axeContactResolved = false;
    this.resetAim();
    this.shotAnimationTime = Infinity;
    this.spentShellScheduled = false;

    // Bruit mécanique de prise en main
    this.playSound(this.sounds.empty);

    this.updateWeaponDOM();
    this.notifyAmmoChange();
    this.renderShotEffects();
    return true;
  }

  public nextWeapon(): void {
    const list: WeaponId[] = ['axe', 'pistol', 'shotgun'];
    const unlocked = list.filter((id) => this.weapons[id].unlocked);
    if (unlocked.length <= 1) return;
    const currentIndex = unlocked.indexOf(this.activeWeaponId);
    const nextIndex = (currentIndex + 1) % unlocked.length;
    this.switchWeapon(unlocked[nextIndex]);
  }

  public prevWeapon(): void {
    const list: WeaponId[] = ['axe', 'pistol', 'shotgun'];
    const unlocked = list.filter((id) => this.weapons[id].unlocked);
    if (unlocked.length <= 1) return;
    const currentIndex = unlocked.indexOf(this.activeWeaponId);
    const prevIndex = (currentIndex - 1 + unlocked.length) % unlocked.length;
    this.switchWeapon(unlocked[prevIndex]);
  }

  private updateWeaponDOM(): void {
    this.axeView.setVisible(this.activeWeaponId === 'axe');
    if (this.pistolRig) {
      this.pistolRig.hidden = this.activeWeaponId !== 'pistol';
    }
    if (this.shotgunRig) {
      this.shotgunRig.hidden = this.activeWeaponId !== 'shotgun';
    }
  }

  public reload(): boolean {
    if (this.disposed) return false;
    if (!this.canPlay() || document.pointerLockElement !== this.canvas) return false;
    if (this.isReloading) return false;

    const w = this.getActiveWeapon();
    if (w.id === 'axe') return false;
    if (w.magazine >= w.capacity || w.reserve <= 0) return false;

    this.isReloading = true;
    this.suspendMechanicalAudio();
    this.reloadSoundActive = this.canPlayMechanicalAudio();
    this.reloadTimer = 0;
    this.shotgunShellCommitted = false;
    this.shotAnimationTime = Infinity;
    this.muzzleLight.intensity = 0;
    this.aimHeld = false; // Sortie immédiate de l'ADS
    this.resetAim();

    if (this.activeWeaponId === 'pistol') {
      this.setHipFrame(this.reloadPoses[0].frame);
    } else if (this.activeWeaponId === 'shotgun') {
      this.shotgunRig?.classList.toggle('is-reloading', true);
    }
    this.notifyAmmoChange();
    return true;
  }

  public cancelReload(): void {
    this.suspendMechanicalAudio();
    if (!this.isReloading) return;
    this.isReloading = false;
    this.reloadTimer = 0;
    if (this.activeWeaponId === 'pistol') {
      this.setHipFrame(0);
    } else if (this.activeWeaponId === 'shotgun') {
      this.shotgunRig?.classList.toggle('is-reloading', false);
    }
    this.renderShotEffects();
    this.notifyAmmoChange();
  }

  private setHipFrame(index: number): void {
    if (this.currentFrameIndex !== index && this.hipSprite) {
      this.currentFrameIndex = index;
      const pose = this.reloadPoses.find((candidate) => candidate.frame === index);
      this.hipSprite.style.setProperty('--hand-x', `${pose?.x ?? 0}%`);
      this.hipSprite.style.setProperty('--hand-y', `${pose?.y ?? 0}%`);
      this.hipSprite.style.setProperty('--hand-opacity', `${pose?.opacity ?? 0}`);
      this.hipSprite.style.setProperty('--magazine-opacity', `${pose?.magazine ?? 0}`);
    }
  }

  private notifyAmmoChange(): void {
    const w = this.getActiveWeapon();
    this.onAmmoChange?.(w.magazine, w.capacity, w.reserve, this.isReloading, w.name, w.id);
  }

  private shoot(): void {
    if (this.disposed) return;
    if (this.activeWeaponId === 'axe') {
      if (this.axeAttackTime < axeAttack.duration) return;
      this.axeAttackTime = 0;
      this.axeContactResolved = false;
      this.axeSwingSoundPlayed = false;
      this.onShoot?.(0, 'axe');
      this.renderShotEffects();
      return;
    }
    if (this.isReloading) {
      if (this.activeWeaponId === 'shotgun' && this.getActiveWeapon().magazine > 0) {
        // Interruption immédiate du rechargement cartouche par cartouche si au moins une cartouche est chambrée
        this.cancelReload();
      } else {
        return;
      }
    }

    const now = performance.now();
    const config = this.getActiveWeapon();
    if (now - this.lastShot < config.cooldownMs) return;

    if (config.magazine <= 0) {
      this.lastShot = now;
      this.playSound(this.sounds.empty);
      return;
    }

    config.magazine--;
    this.notifyAmmoChange();
    this.lastShot = now;
    this.shotAnimationTime = 0;
    this.pumpSoundActive = this.activeWeaponId === 'shotgun' && this.canPlayMechanicalAudio();
    this.spentShellScheduled = false;
    this.muzzleLight.intensity = this.activeWeaponId === 'shotgun' ? 14.0 : 10.0;
    this.renderShotEffects();
    this.playSound(this.sounds[this.activeWeaponId]);

    // 1. Enregistrement de la position et de l'orientation de la caméra AVANT le recul de tir
    this.camera.updateWorldMatrix(true, false);
    const camPos = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld);
    const camQuat = this.camera.getWorldQuaternion(new THREE.Quaternion());

    const targets = this.targets.filter((target) => target.visible);
    const objects = [...targets, ...this.blockers];
    for (const object of objects) object.updateWorldMatrix(true, false);

    this.raycaster.far = config.range;

    // 2. Détonation immédiate et recul joueur à t = 0
    this.onShoot?.(this.aimAmount, this.activeWeaponId);

    // Pour le pistolet : éjection immédiate d'une douille 9mm
    if (this.activeWeaponId === 'pistol') {
      this.onCasingEject?.(this.aimAmount, '9mm');
    }

    // Accumulation des dégâts par cible touchée (pour appliquer un unique retour de blessure)
    const zombieHits = new Map<THREE.Mesh, { damage: number; headHits: number; bodyHits: number; headDamage: number; hitPoint: THREE.Vector3; normal: THREE.Vector3; direction: THREE.Vector3; distance: number }>();
    let nearestSurface: { surface: ImpactSurface; distance: number } | null = null;

    // 3. Résolution instantanée de tous les plombs (1 pour pistolet, 8 pour fusil)
    for (let p = 0; p < config.pellets; p++) {
      this.raycaster.ray.origin.copy(camPos);
      const localDir = sampleShotDirection(
        this.aimAmount,
        Math.random,
        config.hipSpreadDeg,
        config.adsSpreadDeg
      );
      this.raycaster.ray.direction.copy(localDir).applyQuaternion(camQuat).normalize();

      const hits = this.raycaster.intersectObjects(objects, false);
      const hit = hits.find((candidate) => {
        const mesh = candidate.object as THREE.Mesh;
        return !targets.includes(mesh) || isOpaqueSpriteHit(mesh, candidate.uv);
      });

      if (hit) {
        const isZombie = targets.includes(hit.object as THREE.Mesh);
        const normal = hit.face
          ? hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
          : this.raycaster.ray.direction.clone().negate();
        if (normal.dot(this.raycaster.ray.direction) > 0) normal.negate();

        if (isZombie) {
          const targetMesh = hit.object as THREE.Mesh;
          const head = isHeadSpriteHit(targetMesh, hit.uv);
          const damage = this.activeWeaponId === 'pistol' ? (head ? 80 : 28) : (head ? 24 : 13);
          const current = zombieHits.get(targetMesh);
          if (current) {
            current.damage += damage;
            if (head) current.headDamage += damage;
            current.hitPoint.add(hit.point);
            current.direction.add(this.raycaster.ray.direction);
            if (head) current.headHits++; else current.bodyHits++;
          } else {
            zombieHits.set(targetMesh, {
              damage,
              headHits: head ? 1 : 0,
              bodyHits: head ? 0 : 1,
              headDamage: head ? damage : 0,
              hitPoint: hit.point.clone(),
              normal,
              direction: this.raycaster.ray.direction.clone(),
              distance: hit.distance,
            });
          }
        } else {
          const surface = getImpactSurface(hit);
          if (!nearestSurface || hit.distance < nearestSurface.distance) {
            nearestSurface = { surface, distance: hit.distance };
          }
          this.onImpact?.({
            kind: 'surface',
            surface,
            object: hit.object,
            point: hit.point.clone(),
            normal,
            direction: this.raycaster.ray.direction.clone(),
          });
        }
      }
    }

    // Appliquer les dégâts cumulés à chaque zombie touché
    if (zombieHits.size > 0) {
      this.playSound(this.sounds.enemy);
      zombieHits.forEach(({ damage, headHits, bodyHits, headDamage, hitPoint, normal, direction, distance }, targetMesh) => {
        console.log(`Zombie touché par ${this.activeWeaponId} (${damage} dégâts cumulés) !`);
        const hits = headHits + bodyHits;
        hitPoint.divideScalar(hits);
        direction.normalize();
        const impact = config.id === 'shotgun' ? { direction, power: shotgunImpactPower(hits, distance) } : undefined;
        this.onImpact?.({
          kind: 'zombie',
          object: targetMesh,
          point: hitPoint,
          normal,
          direction,
          weaponId: config.id,
          power: impact?.power,
        });
        this.onHit(targetMesh, damage, { headHits, bodyHits, headDamage, impactForce: config.damagePerPellet * hits, weaponId: config.id, impact });
        if (headHits > 0) {
          this.crosshair?.classList.add('head-hit');
          if (this.headMarkerTimer) clearTimeout(this.headMarkerTimer);
          this.headMarkerTimer = setTimeout(() => this.crosshair?.classList.remove('head-hit'), 130);
        }
      });
    } else if (nearestSurface) {
      console.log('Tir bloqué par le décor.');
      this.playSurfaceImpact(nearestSurface.surface);
    } else {
      console.log('Tir manqué.');
    }
  }

  private resolveAxeContact(): void {
    // Éventail vertical du tranchant, sans aimantation ni cible multiple.
    // Chaque rayon rencontre aussi le décor : portes et murs arrêtent le coup.
    this.camera.updateWorldMatrix(true, false);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const rotation = this.camera.getWorldQuaternion(new THREE.Quaternion());
    const targets = this.targets.filter(target => target.visible);
    const objects = [...targets, ...this.blockers];
    for (const object of objects) object.updateWorldMatrix(true, false);
    this.raycaster.far = axeAttack.range;
    type Contact = { hit: THREE.Intersection<THREE.Object3D>; direction: THREE.Vector3; angle: number };
    let targetContact: Contact | undefined;
    let surfaceContact: Contact | undefined;
    for (const yaw of [0, -5, 5]) {
      for (const pitch of [0, -7, 7, -14, 14]) {
        const direction = new THREE.Vector3(
          Math.tan(THREE.MathUtils.degToRad(yaw)),
          Math.tan(THREE.MathUtils.degToRad(pitch)), -1,
        ).normalize().applyQuaternion(rotation);
        this.raycaster.set(origin, direction);
        const hit = this.raycaster.intersectObjects(objects, false).find(candidate =>
          !targets.includes(candidate.object as THREE.Mesh) || isOpaqueSpriteHit(candidate.object as THREE.Mesh, candidate.uv));
        if (!hit) continue;
        const candidate = { hit, direction, angle: Math.abs(yaw) + Math.abs(pitch) };
        if (targets.includes(hit.object as THREE.Mesh)) {
          // Un bord de porte périphérique ne masque pas une cible exposée au centre.
          if (!targetContact || candidate.angle < targetContact.angle
            || (candidate.angle === targetContact.angle && hit.distance < targetContact.hit.distance)) targetContact = candidate;
        } else if (!surfaceContact || hit.distance < surfaceContact.hit.distance) surfaceContact = candidate;
      }
    }
    const selected = targetContact ?? surfaceContact;
    if (!selected) return;
    const { hit: contact, direction: contactDirection } = selected;
    const mesh = contact.object as THREE.Mesh;
    const normal = contact.face
      ? contact.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld))
      : contactDirection.clone().negate();
    if (normal.dot(contactDirection) > 0) normal.negate();
    if (targets.includes(mesh)) {
      this.playSound(mesh.userData.impactMaterial === 'portrait' ? this.sounds.wood : this.sounds.axeFlesh);
      this.onImpact?.({ kind: 'zombie', object: mesh, point: contact.point.clone(), normal,
        direction: contactDirection, weaponId: 'axe' });
      this.onHit(mesh, axeAttack.damage, { headHits: 0, bodyHits: 1, headDamage: 0,
        impactForce: axeAttack.damage, weaponId: 'axe', stunSeconds: axeAttack.stunSeconds });
    } else {
      const surface = getImpactSurface(contact);
      this.playSurfaceImpact(surface);
      this.onImpact?.({ kind: 'surface', surface, object: mesh, point: contact.point.clone(), normal,
        direction: contactDirection, weaponId: 'axe' });
    }
  }

  private playSurfaceImpact(surface: ImpactSurface): void {
    this.playSound(this.sounds[surface]);
  }

  private playSound(sound: WeaponSound): void {
    if (!this.hasActiveControl() || this.effectsVolume === 0) return;
    const clip = sound.clips[sound.nextClip];
    // Alterner indépendamment des tirages utilisés pour la dispersion.
    sound.nextClip = (sound.nextClip + 1) % sound.clips.length;
    clip.currentTime = 0;
    void clip.play().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('Impossible de jouer le son :', error);
      }
    });
  }

  public getAmmo(): number {
    return this.getActiveWeapon().magazine;
  }

  public getMaxAmmo(): number {
    return this.getActiveWeapon().capacity;
  }

  public getReserveAmmo(): number {
    return this.getActiveWeapon().reserve;
  }

  public getReserveAmmoFor(id: WeaponId): number {
    return this.weapons[id].reserve;
  }

  public getAmmoStocks(): AmmoStocks {
    const stock = (id: WeaponId) => {
      const { magazine, reserve, unlocked } = this.weapons[id];
      return { magazine, reserve, unlocked };
    };
    return { axe: stock('axe'), pistol: stock('pistol'), shotgun: stock('shotgun') };
  }

  public getMaxReserve(): number {
    return this.getActiveWeapon().maxReserve;
  }

  public getIsReloading(): boolean {
    return this.isReloading;
  }

  public getAmmoState() {
    const w = this.getActiveWeapon();
    return {
      weaponName: w.name,
      weaponId: w.id,
      magazine: w.magazine,
      capacity: w.capacity,
      reserve: w.reserve,
      maxReserve: w.maxReserve,
      isReloading: this.isReloading,
    };
  }

  public setOnAmmoChange(
    callback: (
      magazine: number,
      capacity: number,
      reserve: number,
      isReloading: boolean,
      weaponName: string,
      weaponId: WeaponId
    ) => void
  ): void {
    this.onAmmoChange = callback;
  }

  public setOnShoot(callback: (aimAmount: number, weaponId: WeaponId) => void): void {
    this.onShoot = callback;
  }

  public setOnCasingEject(callback: (aimAmount: number, casingType: CasingType) => void): void {
    this.onCasingEject = callback;
  }

  public setOnImpact(callback: (impact: ShotImpact) => void): void {
    this.onImpact = callback;
  }

  public setTargets(targets: THREE.Mesh[]): void {
    this.targets = targets;
  }

  public cancelMeleeAttack(): void {
    this.axeAttackTime = Infinity;
    this.axeContactResolved = false;
    this.axeSwingSoundPlayed = false;
    this.axeView.update(Infinity);
  }

  public setEnvironmentalLighting(brightness: number, warmth: number, stormFlash = 0): void {
    this.targetBrightness = weaponAmbientBrightness(brightness);
    this.targetWarmth = warmth;
    this.stormFlash = THREE.MathUtils.clamp(stormFlash, 0, 1);
  }

  public setEffectsVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    const gain = THREE.MathUtils.clamp(volume, 0, 1);
    this.effectsVolume = gain;
    this.mechanicalAudio?.setVolume(gain);
    for (const sound of Object.values(this.sounds)) {
      for (const clip of sound.clips) clip.volume = sound.gain * gain;
    }
  }

  public addAmmo(count: number, weaponId: WeaponId = this.activeWeaponId): boolean {
    if (weaponId === 'axe') return false;
    if (!Number.isFinite(count) || Math.floor(count) <= 0) return false;
    const target = this.weapons[weaponId];
    if (target.reserve >= target.maxReserve) return false;
    target.reserve = Math.min(target.maxReserve, target.reserve + Math.floor(count));
    this.notifyAmmoChange();
    return true;
  }

  public update(delta: number): void {
    if (this.disposed) return;
    if (!this.canPlayMechanicalAudio()) this.suspendMechanicalAudio();
    if (!this.canPlay()) {
      this.resetAim();
      this.cancelReload();
    }

    const currentWeapon = this.getActiveWeapon();
    // La mêlée utilise le temps actif : pause/focus perdus figent préparation et contact.
    const axeControlActive = this.hasActiveControl();
    if (this.activeWeaponId === 'axe' && axeControlActive && delta > 0 && Number.isFinite(this.axeAttackTime)) {
      this.axeAttackTime = Math.min(axeAttack.duration, this.axeAttackTime + delta);
      if (!this.axeSwingSoundPlayed && this.axeAttackTime >= axeAttack.windup) {
        this.axeSwingSoundPlayed = true;
        this.playMechanicalSound('axe-swing');
      }
      if (!this.axeContactResolved && this.axeAttackTime >= axeAttack.impactTime) {
        this.axeContactResolved = true;
        this.resolveAxeContact();
      }
    }

    // Gestion du rechargement
    if (this.isReloading) {
      const previousReloadTimer = this.reloadTimer;
      this.reloadTimer += delta;

      if (this.activeWeaponId === 'pistol') {
        if (this.reloadSoundActive) {
          for (const event of crossedWeaponSoundEvents(pistolReloadSoundEvents, previousReloadTimer, this.reloadTimer)) {
            this.playMechanicalSound(event.sound);
          }
        }
        let elapsed = this.reloadTimer;
        let frame = this.reloadPoses[this.reloadPoses.length - 1].frame;
        for (const pose of this.reloadPoses) {
          if (elapsed < pose.duration) {
            frame = pose.frame;
            break;
          }
          elapsed -= pose.duration;
        }
        this.setHipFrame(frame);

        if (this.reloadTimer >= this.reloadDuration) {
          const needed = currentWeapon.capacity - currentWeapon.magazine;
          const transferred = Math.min(needed, currentWeapon.reserve);
          currentWeapon.magazine += transferred;
          currentWeapon.reserve -= transferred;
          this.isReloading = false;
          this.reloadTimer = 0;
          this.setHipFrame(0);
          this.notifyAmmoChange();
        }
      } else {
        // Le clic d'insertion engage la cartouche ; le retrait de la main termine le cycle.
        // Conserver le reliquat de temps évite de ralentir l'animation à faible fréquence.
        while (this.isReloading && this.reloadTimer >= shotgunReload.duration) {
          this.commitShotgunShell();
          this.reloadTimer -= shotgunReload.duration;
          this.shotgunShellCommitted = false;
          if (currentWeapon.magazine >= currentWeapon.capacity || currentWeapon.reserve <= 0) {
            this.isReloading = false;
            this.reloadTimer = 0;
            this.shotgunRig?.classList.toggle('is-reloading', false);
            this.notifyAmmoChange();
          }
        }
        if (this.isReloading && this.reloadTimer >= shotgunReload.commitAt) {
          this.commitShotgunShell();
        }
      }
    }

    // Gestion de l'ADS (interdit pendant le rechargement)
    const target = this.activeWeaponId !== 'axe' && this.aimHeld && !this.isReloading ? 1 : 0;
    const step = delta / this.aimTransitionDuration;
    const nextAim = this.aimAmount + THREE.MathUtils.clamp(target - this.aimAmount, -step, step);
    if (nextAim !== this.aimAmount) {
      this.aimAmount = nextAim;
      this.onAimChange(this.aimAmount);
    }

    // Recul et animations
    if (this.shotAnimationTime < this.recoilDuration) {
      const previousShotAnimationTime = this.shotAnimationTime;
      this.shotAnimationTime += delta;
      if (this.pumpSoundActive) {
        for (const event of crossedWeaponSoundEvents(shotgunPumpSoundEvents, previousShotAnimationTime, this.shotAnimationTime)) {
          this.playMechanicalSound(event.sound);
        }
      }

      // Événement d'éjection unique de la douille de fusil à t = 0.19s
      if (this.activeWeaponId === 'shotgun' && !this.spentShellScheduled && this.shotAnimationTime >= shotgunPump.ejectAt) {
        this.spentShellScheduled = true;
        this.onCasingEject?.(this.aimAmount, '12gauge');
      }
    }

    const flashDuration = 0.06;
    if (this.shotAnimationTime < flashDuration) {
      this.muzzleLight.intensity = Math.max(0, (this.activeWeaponId === 'shotgun' ? 14.0 : 10.0) * (1 - this.shotAnimationTime / flashDuration));
    } else {
      this.muzzleLight.intensity = 0;
    }

    // Adaptation douce de l'éclairage de l'arme
    let effectiveTargetBrightness = this.targetBrightness;
    if (this.shotAnimationTime < 0.07) {
      effectiveTargetBrightness += (1 - this.shotAnimationTime / 0.07) * 0.7;
    }
    this.currentBrightness = THREE.MathUtils.damp(this.currentBrightness, effectiveTargetBrightness, 5, delta);
    this.currentWarmth = THREE.MathUtils.damp(this.currentWarmth, this.targetWarmth, 5, delta);

    // L'éclair est bref : le superposer à l'ambiance amortie évite de perdre son impulsion.
    this.weaponView?.style.setProperty('--weapon-brightness', (this.currentBrightness + this.stormFlash * 0.55).toFixed(2));
    this.weaponView?.style.setProperty('--weapon-warmth', (this.currentWarmth * (1 - this.stormFlash)).toFixed(2));

    this.renderShotEffects();
  }

  private resetAim(): void {
    this.aimHeld = false;
    this.aimAmount = 0;
    this.onAimChange(0);
    this.renderShotEffects();
  }

  private commitShotgunShell(): void {
    if (this.shotgunShellCommitted) return;
    const weapon = this.getActiveWeapon();
    if (weapon.reserve <= 0 || weapon.magazine >= weapon.capacity) return;
    this.shotgunShellCommitted = true;
    weapon.magazine++;
    weapon.reserve--;
    this.notifyAmmoChange();
    if (this.reloadSoundActive) this.playMechanicalSound('shell-insert');
  }

  private renderShotEffects(): void {
    this.axeView.update(this.axeAttackTime);
    const loadingPose = getShotgunReloadPose(this.reloadTimer);
    this.shotgunRig?.style.setProperty('--load-x', `${loadingPose.x}%`);
    this.shotgunRig?.style.setProperty('--load-y', `${loadingPose.y}%`);
    this.shotgunRig?.style.setProperty('--load-shell-x', `${loadingPose.shellX}%`);
    this.shotgunRig?.style.setProperty('--load-shell-y', `${loadingPose.shellY}%`);
    this.shotgunRig?.style.setProperty('--load-shell-opacity', `${loadingPose.shell}`);
    this.shotgunRig?.style.setProperty('--load-shell-hide', `${loadingPose.hide}%`);
    const config = this.getActiveWeapon();
    const progress = Math.min(1, this.shotAnimationTime / this.recoilDuration);
    const kick = this.shotAnimationTime < 0.06 ? this.shotAnimationTime / 0.06 : Math.pow(1 - progress, 3);

    const recoilMultiplier = this.activeWeaponId === 'shotgun' ? 38 : 28;
    const shotgunImpulse = this.activeWeaponId === 'shotgun' && !this.isReloading
      ? shotgunKickAmount(this.shotAnimationTime) : 0;
    const totalRecoil = this.isReloading ? 0 : this.activeWeaponId === 'shotgun'
      ? kick * 8 + shotgunImpulse * 12 : kick * recoilMultiplier;
    this.weaponView?.style.setProperty('--recoil', `${totalRecoil}px`);
    this.weaponView?.style.setProperty('--kick-angle', `${-kick * 6.5 * (1 - this.aimAmount)}deg`);
    this.shotgunRig?.style.setProperty('--shotgun-kick-scale', `${1 + shotgunImpulse * 0.035}`);

    // Pistolet : glissement de culasse
    const slide =
      this.isReloading || this.activeWeaponId !== 'pistol'
        ? 0
        : this.shotAnimationTime < 0.025
        ? 0.5
        : this.shotAnimationTime < 0.075
        ? 1
        : this.shotAnimationTime < 0.12
        ? 0.5
        : 0;
    this.weaponView?.style.setProperty('--slide', `${slide}`);

    // Fusil à pompe : cycle de pompe arrière entre 0.15s et 0.35s
    const isPumping =
      this.activeWeaponId === 'shotgun' &&
      isShotgunPumpBack(this.shotAnimationTime);
    this.weaponView?.style.setProperty('--shotgun-pump', isPumping ? '0%' : '100%');
    const kickPose = this.activeWeaponId === 'shotgun' && !this.isReloading && isShotgunKick(this.shotAnimationTime);
    const hipAsset = kickPose ? shotgunPump.hipKickAsset : isPumping ? shotgunPump.backAsset : shotgunPump.restAsset;
    this.shotgunRig?.style.setProperty('--shotgun-hip-image', weaponArtCss(hipAsset));
    this.shotgunRig?.classList.toggle('is-kicking', kickPose);

    this.hud?.style.setProperty('--aim', `${this.aimAmount}`);

    // Mise à jour de la taille du cercle de dispersion dans le HUD
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const radius = spreadRadiusPixels(
        this.aimAmount,
        this.camera.fov,
        window.innerHeight || 720,
        config.hipSpreadDeg,
        config.adsSpreadDeg
      );
      this.hud?.style.setProperty('--spread-radius', `${radius.toFixed(2)}px`);
    }

    this.muzzleFlashes.forEach((flash) =>
      flash.classList.toggle('visible', this.activeWeaponId !== 'axe' && this.shotAnimationTime < 0.07 && !this.isReloading)
    );
  }

  public upgradeAmmoCapacity(multiplier = 1.5): void {
    for (const key of Object.keys(this.weapons) as WeaponId[]) {
      const w = this.weapons[key];
      w.maxReserve = Math.round(w.maxReserve * multiplier);
      w.reserve = w.maxReserve; // Ravitaillement plein immédiat
    }
    this.notifyAmmoChange();
  }

  public upgradeAccuracy(multiplier = 0.65): void {
    for (const key of Object.keys(this.weapons) as WeaponId[]) {
      const w = this.weapons[key];
      w.hipSpreadDeg = Number((w.hipSpreadDeg * multiplier).toFixed(2));
    }
    this.notifyAmmoChange();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.cancelReload();
    this.suspendSoundEffects();
    this.mechanicalAudio?.dispose();
    this.mechanicalAudio = null;
    this.mechanicalContext = null;
    for (const removeListener of this.removeInputListeners) removeListener();
    this.removeInputListeners.length = 0;
    if (this.headMarkerTimer) clearTimeout(this.headMarkerTimer);
    this.headMarkerTimer = null;
    this.crosshair?.classList.remove?.('head-hit');
    this.muzzleLight.removeFromParent();
    this.muzzleLight.dispose();
    this.axeView.dispose();
    this.disposed = true;
  }
}
