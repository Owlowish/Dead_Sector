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

export type WeaponId = 'pistol' | 'shotgun';
export interface ShotDamage { headHits: number; bodyHits: number; impactForce: number }

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
    pistol: {
      id: 'pistol',
      name: 'PISTOLET 9MM',
      unlocked: true,
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

export class Weapon {
  private readonly raycaster = new THREE.Raycaster();
  private weapons = createInitialWeapons();

  private activeWeaponId: WeaponId = 'pistol';
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
  private readonly emptySound = new Audio('/assets/sounds/empty-soft.wav');
  private readonly shotSound = new Audio('/assets/sounds/shot-soft.wav');
  private readonly shotgunSound = new Audio('/assets/sounds/shotgun-shot.wav');
  private readonly metalImpactSound = new Audio('/assets/sounds/impact-metal-soft.wav');
  private readonly woodImpactSound = new Audio('/assets/sounds/impact-wood-soft.wav');
  private readonly stoneImpactSound = new Audio('/assets/sounds/impact-stone-soft.wav');
  private readonly zombieImpactSound = new Audio('/assets/sounds/impact-zombie-soft.wav');
  private readonly crosshair = document.querySelector<HTMLElement>('.crosshair');
  private headMarkerTimer: ReturnType<typeof setTimeout> | null = null;

  private shotAnimationTime = Infinity;
  private spentShellScheduled = false;

  // Éléments DOM du HUD
  private readonly weaponView = document.querySelector<HTMLElement>('.weapon-view');
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
    this.muzzleLight.position.set(0.08, -0.12, -0.45);
    this.camera.add(this.muzzleLight);

    this.shotSound.volume = 0.5;
    this.shotgunSound.volume = 0.42;
    this.metalImpactSound.volume = 0.3;
    this.woodImpactSound.volume = 0.3;
    this.stoneImpactSound.volume = 0.27;
    this.zombieImpactSound.volume = 0.35;
    this.emptySound.volume = 0.3;

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
    canvas.addEventListener('mousedown', (event) => {
      if (!this.canPlay() || document.pointerLockElement !== this.canvas) return;
      if (event.button === 2) {
        if (!this.isReloading) this.aimHeld = true;
      }
      if (event.button === 0) this.shoot();
    });

    window.addEventListener('mouseup', (event) => {
      if (event.button === 2) this.aimHeld = false;
    });

    // Sélection d'armes avec touches 1 / 2 et molette
    window.addEventListener('keydown', (event) => {
      // Ignorer si la simulation n'est pas active ou si le curseur n'est pas capturé
      if (!this.canPlay() || document.pointerLockElement !== this.canvas) return;

      if ((event.code === 'Digit1' || event.code === 'Numpad1') && !event.repeat) {
        this.switchWeapon('pistol');
      } else if ((event.code === 'Digit2' || event.code === 'Numpad2') && !event.repeat) {
        this.switchWeapon('shotgun');
      } else if (event.code === 'KeyR' && !event.repeat) {
        this.reload();
      }
    });

    canvas.addEventListener('wheel', (event) => {
      if (!this.canPlay() || document.pointerLockElement !== this.canvas) return;
      if (event.deltaY > 0) {
        this.nextWeapon();
      } else if (event.deltaY < 0) {
        this.prevWeapon();
      }
    });

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    // Interruption propre sur perte de focus
    window.addEventListener('blur', () => {
      this.resetAim();
      this.cancelReload();
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas) {
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
    this.weapons = createInitialWeapons();
    this.activeWeaponId = 'pistol';
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
    for (const sound of [this.emptySound, this.shotSound, this.shotgunSound, this.woodImpactSound,
      this.stoneImpactSound, this.metalImpactSound, this.zombieImpactSound]) {
      sound.pause?.();
      sound.currentTime = 0;
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
    if (!this.weapons[id].unlocked || this.activeWeaponId === id) return false;

    // Interrompre le rechargement en cours
    this.cancelReload();

    this.activeWeaponId = id;
    this.shotAnimationTime = Infinity;
    this.spentShellScheduled = false;

    // Bruit mécanique de prise en main
    this.playSound(this.emptySound);

    this.updateWeaponDOM();
    this.notifyAmmoChange();
    this.renderShotEffects();
    return true;
  }

  public nextWeapon(): void {
    const list: WeaponId[] = ['pistol', 'shotgun'];
    const unlocked = list.filter((id) => this.weapons[id].unlocked);
    if (unlocked.length <= 1) return;
    const currentIndex = unlocked.indexOf(this.activeWeaponId);
    const nextIndex = (currentIndex + 1) % unlocked.length;
    this.switchWeapon(unlocked[nextIndex]);
  }

  public prevWeapon(): void {
    const list: WeaponId[] = ['pistol', 'shotgun'];
    const unlocked = list.filter((id) => this.weapons[id].unlocked);
    if (unlocked.length <= 1) return;
    const currentIndex = unlocked.indexOf(this.activeWeaponId);
    const prevIndex = (currentIndex - 1 + unlocked.length) % unlocked.length;
    this.switchWeapon(unlocked[prevIndex]);
  }

  private updateWeaponDOM(): void {
    if (this.pistolRig) {
      this.pistolRig.hidden = this.activeWeaponId !== 'pistol';
    }
    if (this.shotgunRig) {
      this.shotgunRig.hidden = this.activeWeaponId !== 'shotgun';
    }
  }

  public reload(): boolean {
    if (!this.canPlay() || document.pointerLockElement !== this.canvas) return false;
    if (this.isReloading) return false;

    const w = this.getActiveWeapon();
    if (w.magazine >= w.capacity || w.reserve <= 0) return false;

    this.isReloading = true;
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
    if (this.isReloading) {
      if (this.activeWeaponId === 'shotgun' && this.getActiveWeapon().magazine > 0) {
        // Interruption immédiate du rechargement cartouche par cartouche si au moins une cartouche est chambrée
        this.isReloading = false;
        this.reloadTimer = 0;
        this.shotgunRig?.classList.toggle('is-reloading', false);
        this.notifyAmmoChange();
      } else {
        return;
      }
    }

    const now = performance.now();
    const config = this.getActiveWeapon();
    if (now - this.lastShot < config.cooldownMs) return;

    if (config.magazine <= 0) {
      this.lastShot = now;
      this.playSound(this.emptySound);
      return;
    }

    config.magazine--;
    this.notifyAmmoChange();
    this.lastShot = now;
    this.shotAnimationTime = 0;
    this.spentShellScheduled = false;
    this.muzzleLight.intensity = this.activeWeaponId === 'shotgun' ? 14.0 : 10.0;
    this.renderShotEffects();
    this.playSound(this.activeWeaponId === 'shotgun' ? this.shotgunSound : this.shotSound);

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
    const zombieHits = new Map<THREE.Mesh, { damage: number; headHits: number; bodyHits: number; hitPoint: THREE.Vector3; normal: THREE.Vector3 }>();
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
          const damage = this.activeWeaponId === 'pistol' ? (head ? 80 : 28) : (head ? 24 : 12);
          const current = zombieHits.get(targetMesh);
          if (current) {
            current.damage += damage;
            if (head) current.headHits++; else current.bodyHits++;
          } else {
            zombieHits.set(targetMesh, {
              damage,
              headHits: head ? 1 : 0,
              bodyHits: head ? 0 : 1,
              hitPoint: hit.point.clone(),
              normal,
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
      this.playSound(this.zombieImpactSound);
      zombieHits.forEach(({ damage, headHits, bodyHits, hitPoint, normal }, targetMesh) => {
        console.log(`Zombie touché par ${this.activeWeaponId} (${damage} dégâts cumulés) !`);
        this.onImpact?.({
          kind: 'zombie',
          object: targetMesh,
          point: hitPoint,
          normal,
          direction: new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat),
        });
        this.onHit(targetMesh, damage, { headHits, bodyHits, impactForce: config.damagePerPellet * (headHits + bodyHits) });
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

  private playSurfaceImpact(surface: ImpactSurface): void {
    const sound = surface === 'wood' ? this.woodImpactSound
      : surface === 'metal' ? this.metalImpactSound : this.stoneImpactSound;
    this.playSound(sound);
  }

  private playSound(sound: HTMLAudioElement): void {
    sound.currentTime = 0;
    void sound.play().catch((error: unknown) => {
      console.warn('Impossible de jouer le son :', error);
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

  public setEnvironmentalLighting(brightness: number, warmth: number): void {
    this.targetBrightness = weaponAmbientBrightness(brightness);
    this.targetWarmth = warmth;
  }

  public addAmmo(count: number, weaponId: WeaponId = this.activeWeaponId): boolean {
    const target = this.weapons[weaponId];
    if (target.reserve >= target.maxReserve) return false;
    target.reserve = Math.min(target.maxReserve, target.reserve + count);
    this.notifyAmmoChange();
    return true;
  }

  public update(delta: number): void {
    if (!this.canPlay()) {
      this.resetAim();
      this.cancelReload();
    }

    const currentWeapon = this.getActiveWeapon();

    // Gestion du rechargement
    if (this.isReloading) {
      this.reloadTimer += delta;

      if (this.activeWeaponId === 'pistol') {
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
    const target = this.aimHeld && !this.isReloading ? 1 : 0;
    const step = delta / this.aimTransitionDuration;
    const nextAim = this.aimAmount + THREE.MathUtils.clamp(target - this.aimAmount, -step, step);
    if (nextAim !== this.aimAmount) {
      this.aimAmount = nextAim;
      this.onAimChange(this.aimAmount);
    }

    // Recul et animations
    if (this.shotAnimationTime < this.recoilDuration) {
      this.shotAnimationTime += delta;

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

    this.weaponView?.style.setProperty('--weapon-brightness', this.currentBrightness.toFixed(2));
    this.weaponView?.style.setProperty('--weapon-warmth', this.currentWarmth.toFixed(2));

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
    this.playSound(this.emptySound);
  }

  private renderShotEffects(): void {
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
      flash.classList.toggle('visible', this.shotAnimationTime < 0.07 && !this.isReloading)
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
}
