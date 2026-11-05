
import * as THREE from 'three';

import { Level } from './Level';
import { Player } from './Player';
import { Zombie, disposeAllZombieResources } from './Zombie';
import { type ZombieKind } from './ZombieRemains';
import { Weapon } from './Weapon';
import { Medkit } from './Medkit';
import { AmmoBox } from './AmmoBox';
import { ShotgunPickup } from './ShotgunPickup';
import { ShellCasing } from './ShellCasing';
import { HitEffects } from './HitEffects';
import { PerfTracker, type DetailedPerfReport } from './PerfTracker';
import {
  MANSION_BUDGET,
  MANSION_PICKUPS,
  type Point2D,
} from './MansionConfig.ts';
import { ENCOUNTER_CONFIGS, type EncounterSpec } from './EncounterConfig.ts';
import { EncounterBell } from './EncounterBell.ts';
import { UpgradePedestal } from './UpgradePedestal.ts';
import { drawTierUpgrades, type UpgradeId, type UpgradeSpec } from './UpgradeConfig.ts';
import { HorrorDirector } from './HorrorDirector.ts';
import { StormController } from './StormController.ts';
import { SpitterZombie } from './SpitterZombie.ts';
import { CrawlerZombie } from './CrawlerZombie.ts';
import { SpitProjectile } from './SpitProjectile.ts';
import { TierDiagnosticsTracker, type TierDiagnosticRecord } from './TierDiagnostics.ts';
import { AudioMix, type AudioChannel } from './AudioMix.ts';
import { FootstepAudio } from './FootstepAudio.ts';
import { WeaponMotion } from './WeaponMotion.ts';

type GameState = 'playing' | 'respite' | 'exploration' | 'terminal' | 'won' | 'lost';

export class Game {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  private level: Level;
  private player: Player;
  private zombies: Array<Zombie | SpitterZombie | CrawlerZombie> = [];
  private spitProjectiles: SpitProjectile[] = [];
  private medkits: Medkit[] = [];
  private ammoBoxes: AmmoBox[] = [];
  private ammoDrops: AmmoBox[] = [];
  private dropBudget = 0;
  private dropsMade = 0;
  private killsThisTier = 0;
  private hordeAlertTimer = 0;
  private respiteTimer = 0;
  private shotgunPickup: ShotgunPickup;
  private encounterBell: EncounterBell;
  private upgradePedestals: UpgradePedestal[] = [];
  private appliedUpgrades: UpgradeId[] = [];
  private shellCasings: ShellCasing[] = [];
  private hitEffects: HitEffects;
  private weapon: Weapon;
  private readonly weaponMotion = new WeaponMotion(document.querySelector<HTMLElement>('.weapon-view'));
  private state: GameState = 'playing';
  private currentTier = 1;
  private debugMenuOpen = false;
  private readonly debugDisplay = document.querySelector<HTMLElement>('#debug-menu');
  private debugPreviousFocus: HTMLElement | null = null;
  private readonly onDebugKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (event.code === 'KeyK' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey
      && !(target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select')))) {
      event.preventDefault();
      this.setDebugMenuOpen(!this.debugMenuOpen);
    } else if (this.debugMenuOpen && event.code === 'Escape') {
      event.preventDefault();
      this.setDebugMenuOpen(false);
    } else if (this.debugMenuOpen && event.code === 'Tab') {
      const buttons = Array.from(this.debugDisplay?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };
  private readonly onDebugClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || !this.debugDisplay?.contains(button)) return;
    if (button.hasAttribute('data-debug-close')) this.setDebugMenuOpen(false);
    else if (button.dataset.tier) this.jumpToDebugTier(Number(button.dataset.tier));
    else if (button.dataset.debugSpawn) this.spawnDebugZombie(button.dataset.debugSpawn as ZombieKind | 'crawler-ceiling');
  };
  private pendingTierStart = 0;
  private spawnQueue = 0;
  private spawnCooldownTimer = 0;
  private tierAgileSpawned = 0;
  private tierSpitterSpawned = 0;
  private tierCrawlerSpawned = 0;
  private tierStandardSpawned = 0;
  private tierDiagnostics = new TierDiagnosticsTracker();
  private lastSpawnQuadrant = -1;
  private readonly maxSimultaneousZombies = MANSION_BUDGET.maxSimultaneousZombies;

  private readonly encounterConfigs: EncounterSpec[] = ENCOUNTER_CONFIGS;

  private readonly healthDisplay = document.querySelector<HTMLElement>('#health');
  private readonly ammoDisplay = document.querySelector<HTMLElement>('#ammo');
  private readonly flashlightDisplay = document.querySelector<HTMLElement>('#flashlight-status');
  private readonly objectiveDisplay = document.querySelector<HTMLElement>('#objective');
  private readonly promptDisplay = document.querySelector<HTMLElement>('#prompt');
  private readonly gameOverDisplay = document.querySelector<HTMLElement>('#game-over');
  private readonly victoryDisplay = document.querySelector<HTMLElement>('#victory');
  private readonly pauseDisplay = document.querySelector<HTMLElement>('#pause-message');
  private readonly damageOverlay = document.querySelector<HTMLElement>('#damage-overlay');
  private readonly damageEffectDuration = 0.4;
  private damageEffectRemaining = 0;

  // Facteur de réduction de résolution pour le rendu 3D rétro (divise par 3)
  private readonly retroScale = 3;
  private ambianceAudio: THREE.Audio | null = null;
  private musicAudio: THREE.Audio | null = null;
  private readonly audioMix = new AudioMix();
  private readonly footsteps: FootstepAudio;
  private readonly horrorDirector = new HorrorDirector();
  private stormController: StormController;
  private disposed = false;
  private zombieGroanBuffer: AudioBuffer | null = null;

  // Métriques de performance haute précision (raw delta, percentiles, combat vs pause)
  private perfTracker = new PerfTracker(300);
  private lastFrameTime = typeof performance !== 'undefined' ? performance.now() : 0;
  private tabBecameVisible = false;

  constructor() {
    this.scene = new THREE.Scene();
    this.hitEffects = new HitEffects(this.scene);

    this.scene.background = new THREE.Color(
      0x10131a
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
    });

    // Éclairage dramatique et ombres portées douces
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.renderer.setPixelRatio(1);

    this.updateResolution();

    document.body.appendChild(
      this.renderer.domElement
    );

    // Création du niveau.
    this.level = new Level(this.scene);

    // Création du joueur.
    this.player = new Player(
      this.level,
      this.renderer.domElement,
      () => this.isSimulationActive()
    );

    // Intégrer la caméra du joueur à la scène pour que ses enfants (lumières 3D, audio) soient rendus.
    this.scene.add(this.player.camera);
    this.footsteps = new FootstepAudio(this.player.audioListener.context, this.player.audioListener.getInput());
    this.stormController = new StormController(
      this.level.getStormLights(),
      Math.random,
      () => this.player.audioListener.context.state === 'running',
    );

    this.updateHealthDisplay();
    this.player.setOnFlashlightToggle((enabled) => {
      this.updateFlashlightDisplay(enabled);
    });
    this.updateFlashlightDisplay(this.player.isFlashlightOn());

    // Interaction du joueur avec le décor (touche E).
    this.player.setOnInteract(() => {
      const cameraDir = this.player.camera.getWorldDirection(new THREE.Vector3());

      // 1. Ramassage du fusil à pompe si visé
      if (this.shotgunPickup.canInteract(this.player.camera.position, cameraDir)) {
        if (this.shotgunPickup.collect(this.weapon)) {
          this.updateAmmoDisplay();
          return;
        }
      }

      // 2. Dispositif d'activation volontaire (Carillon d'arène pour rencontres en manoir ouvert)
      if (this.state === 'exploration' && this.pendingTierStart > 0 && this.encounterBell.canInteract(this.player.camera.position, cameraDir)) {
        const nextEncounter = this.encounterConfigs[this.pendingTierStart - 1];
        if (nextEncounter?.activationType === 'arena_signal') {
          this.encounterBell.trigger();
          this.launchPendingTier();
          return;
        }
      }

      // 3. Présentoirs d'offrandes / améliorations in-world sans menu bloquant (F2)
      if (this.state === 'exploration') {
        for (const pedestal of (this.upgradePedestals ?? [])) {
          if (pedestal.canInteract(this.player.camera.position, cameraDir)) {
            const chosen = pedestal.choose();
            if (chosen) {
              this.applyUpgrade(chosen);
              // Fermer immédiatement l'autre stèle : choix unique pour cette accalmie
              for (const other of (this.upgradePedestals ?? [])) {
                if (other !== pedestal) other.close();
              }
              this.updateObjectiveDisplay();
              return;
            }
          }
        }
      }

      // 4. Portes du manoir
      for (const door of this.level.getDoors()) {
        if (door.canInteract(this.player.camera.position, cameraDir)) {
          const toggled = door.toggle();
          if (!toggled && door.isLocked()) {
            const clickSound = new Audio('/assets/sounds/empty-soft.wav');
            clickSound.volume = 0.4 * this.getEffectsVolume();
            void clickSound.play().catch(() => {});
          }
          break;
        }
      }
    });

    document.querySelectorAll<HTMLButtonElement>('#game-over .restart-button, #victory .restart-button').forEach((button) => {
      button.addEventListener('click', () => window.location.reload());
    });

    if (typeof window !== 'undefined') {
      (window as unknown as {
        __DEAD_SECTOR_PERF?: () => unknown;
        __DEAD_SECTOR_PERF_DETAILED?: () => unknown;
        __DEAD_SECTOR_START_TIER?: (tier: number) => void;
        __DEAD_SECTOR_DIAGNOSTICS?: () => unknown;
        __DEAD_SECTOR_DAMAGE_TARGET?: (amount?: number) => boolean;
      }).__DEAD_SECTOR_PERF = () => this.getPerformanceReport();
      (window as unknown as { __DEAD_SECTOR_PERF_DETAILED?: () => unknown }).__DEAD_SECTOR_PERF_DETAILED = () => this.getDetailedPerformanceReport();
      (window as unknown as { __DEAD_SECTOR_START_TIER?: (tier: number) => void }).__DEAD_SECTOR_START_TIER = (tier: number) => this.startTier(tier);
      (window as unknown as { __DEAD_SECTOR_DIAGNOSTICS?: () => unknown }).__DEAD_SECTOR_DIAGNOSTICS = () => this.getTierDiagnostics();
      (window as unknown as { __DEAD_SECTOR_DAMAGE_TARGET?: (amount?: number) => boolean }).__DEAD_SECTOR_DAMAGE_TARGET = (amount = 100) => {
        const target = this.zombies.find((z) => z.isAlive());
        if (!target) return false;
        target.takeDamage(amount);
        this.tierDiagnostics?.recordDamageDealt();
        this.checkTierCompletion();
        this.updateObjectiveDisplay();
        return true;
      };
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.tabBecameVisible = true;
          this.lastFrameTime = performance.now();
        }
        this.syncAmbientAudio();
      });
    }

    window.addEventListener('blur', () => this.syncAmbientAudio());
    window.addEventListener('focus', () => this.syncAmbientAudio());

    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement === this.renderer.domElement;
      if (this.pauseDisplay) {
        this.pauseDisplay.hidden = isLocked || !this.isSimulationActive();
      }
      this.syncAmbientAudio();
    });

    this.setupAudioControls();

    // Ambiance sonore et audio spatial du manoir
    const audioLoader = new THREE.AudioLoader();

    // 1. Nappe sonore feutrée de vent nocturne en boucle
    audioLoader.load('/assets/sounds/ambiance-soft.wav', (buffer) => {
      if (this.disposed) return;
      const sound = new THREE.Audio(this.player.audioListener);
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.15 * this.audioMix.getVolume('ambience'));
      this.ambianceAudio = sound;
      this.syncAmbientAudio();
    }, undefined, (error) => console.warn('Chargement ambiance impossible :', error));

    audioLoader.load('/assets/sounds/combat-music.wav', (buffer) => {
      if (this.disposed) return;
      const music = new THREE.Audio(this.player.audioListener);
      music.setBuffer(buffer);
      music.setLoop(true);
      music.setVolume(0.3 * this.audioMix.getVolume('music') * this.audioMix.getMusicPresence());
      this.musicAudio = music;
      this.syncAmbientAudio();
    }, undefined, (error) => console.warn('Chargement musique impossible :', error));

    // 1B. Événement sonore spatial rare du manoir (source unique réutilisée)
    audioLoader.load('/assets/sounds/creak-soft.wav', (buffer) => {
      if (this.disposed) return;
      const creak = new THREE.PositionalAudio(this.player.audioListener);
      creak.setBuffer(buffer);
      creak.setLoop(false);
      creak.setRefDistance(2);
      creak.setMaxDistance(20);
      creak.setRolloffFactor(1);
      this.scene.add(creak);
      this.horrorDirector.setSource(creak);
    }, undefined, (error) => console.warn('Chargement craquement sonore impossible :', error));

    audioLoader.load('/assets/sounds/rain-soft.wav', (buffer) => {
      if (this.disposed) return;
      const rain = new THREE.PositionalAudio(this.player.audioListener);
      rain.setBuffer(buffer);
      rain.setLoop(true);
      rain.setRefDistance(4);
      rain.setMaxDistance(24);
      rain.setRolloffFactor(0.8);
      rain.position.copy(this.level.getStormWindowPositions()[0]!);
      this.scene.add(rain);
      this.stormController.setRain(rain);
    }, undefined, (error) => console.warn('Chargement de la pluie impossible :', error));

    audioLoader.load('/assets/sounds/thunder-soft.wav', (buffer) => {
      if (this.disposed) return;
      const thunder = new THREE.PositionalAudio(this.player.audioListener);
      thunder.setBuffer(buffer);
      thunder.setLoop(false);
      thunder.setRefDistance(6);
      thunder.setMaxDistance(36);
      thunder.setRolloffFactor(0.65);
      this.scene.add(thunder);
      this.stormController.setThunder(thunder);
    }, undefined, (error) => console.warn('Chargement du tonnerre impossible :', error));

    // 2. Grognements spatiaux des zombies en 3D
    audioLoader.load('/assets/sounds/zombie-groan-soft.wav', (buffer) => {
      if (this.disposed) return;
      this.zombieGroanBuffer = buffer;
      for (const zombie of this.zombies) {
        zombie.setupAudio(this.player.audioListener, buffer, this.getEffectsVolume());
      }
    }, undefined, (error) => console.warn('Chargement voix ennemie impossible :', error));

    // Trousses de secours réparties dans le manoir.
    this.medkits = MANSION_PICKUPS
      .filter((p) => p.type === 'medkit')
      .map((m) => new Medkit(this.scene, m.x, m.z, m.value, this.level.getFloorHeightAt(m.x, m.z)));

    // Les munitions proviennent désormais des ennemis éliminés.
    this.ammoBoxes = [];

    // Fusil à pompe placé au centre du Grand Hall (Secteur 2)
    const shotgunFloorY = this.level.getFloorHeightAt(0, 0);
    this.shotgunPickup = new ShotgunPickup(this.scene, 0, 0, shotgunFloorY + 0.4);

    // Dispositif d'activation volontaire des rencontres (Carillon d'arène au Grand Hall Sud)
    const bellFloorY = this.level.getFloorHeightAt(0, 2.5);
    this.encounterBell = new EncounterBell(this.scene, 0, 2.5, bellFloorY);

    // Les présentoirs sont retirés du cycle normal de rencontres.
    this.upgradePedestals = [];

    // Création de l'arme (cibles actualisées dynamiquement lors du démarrage de chaque palier).
    this.weapon = new Weapon(
      this.player.camera,
      this.renderer.domElement,
      [],
      this.level.getSolidMeshes(),
      (target, damage, shot) => {
        const zombie = this.zombies.find(
          (candidate) => candidate.getMesh() === target
        );
        if (zombie) {
          const wasAlive = zombie.isAlive();
          zombie.takeDamage(damage, shot.headHits > 0, shot.impactForce);
          this.tierDiagnostics?.recordHit(shot.headHits, shot.bodyHits);
          if (wasAlive && !zombie.isAlive()) this.onZombieKilled(zombie);
          this.tierDiagnostics?.recordDamageDealt();
        }
        this.checkTierCompletion();
        this.updateObjectiveDisplay();
      },
      () => this.isSimulationActive(),
      (amount) => this.player.setAimAmount(amount)
    );

    this.weapon.setOnImpact((impact) => this.hitEffects.emit(impact));
    this.weapon.setupMechanicalAudio(this.player.audioListener.context, this.player.audioListener.getInput());
    this.applyAudioMix();

    // Préchauffage des ressources graphiques partagées (Warmup standard, agile et cadavres)
    Zombie.warmup();
    SpitterZombie.warmup();

    // Initialisation du premier palier
    this.startTier(1);
    this.setupDebugMenu();

    // Source unique de vérité pour les munitions : notification directe du HUD
    this.weapon.setOnAmmoChange(() => this.updateAmmoDisplay());
    this.updateAmmoDisplay();

    // Détonation, recul de caméra (View Punch) différencié et alerte sonore immédiate à t = 0
    this.weapon.setOnShoot((aimAmount, weaponId) => {
      this.tierDiagnostics?.recordShot();
      const isShotgun = weaponId === 'shotgun';
      const pitchRecoil = isShotgun
        ? (aimAmount > 0.5 ? 0.05 : 0.09)
        : (aimAmount > 0.5 ? 0.025 : 0.048);
      const yawRecoil = isShotgun
        ? (aimAmount > 0.5 ? 0.012 : 0.025)
        : (aimAmount > 0.5 ? 0.006 : 0.015);
      const rollRecoil = isShotgun
        ? (aimAmount > 0.5 ? 0.01 : 0.02)
        : (aimAmount > 0.5 ? 0.005 : 0.012);
      this.player.applyRecoil(pitchRecoil, yawRecoil, rollRecoil);

      // Alerte sonore : la détonation prévient les zombies en maraude
      for (const zombie of this.zombies) {
        if (zombie.isAlive()) {
          zombie.alert(this.player.camera.position);
        }
      }
    });

    // Éjection physique de la douille (à t = 0 pour pistolet 9mm, à t = 0.19s lors du cycle pompe pour calibre 12)
    this.weapon.setOnCasingEject((aimAmount, casingType) => {
      this.shellCasings.push(new ShellCasing(this.scene, this.player.camera, aimAmount, casingType));
    });

    window.addEventListener(
      'resize',
      () => {
        this.player.resize(
          window.innerWidth,
          window.innerHeight
        );

        this.updateResolution();
      }
    );

    // Préchauffage des shaders WebGL pour éviter le micro-gel de la première frame de rendu
    if (typeof this.renderer.compile === 'function') {
      try {
        this.renderer.compile(this.scene, this.player.camera);
      } catch {
        // Ignorer en environnement de test sans contexte WebGL complet
      }
    }
  }

  private isSimulationActive(): boolean {
    return !this.debugMenuOpen && (this.state === 'playing' || this.state === 'respite' || this.state === 'exploration' || this.state === 'terminal');
  }

  private setupDebugMenu(): void {
    const list = this.debugDisplay?.querySelector<HTMLElement>('[data-debug-tiers]');
    if (!list) return;
    for (const encounter of this.encounterConfigs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tier = String(encounter.tierNumber);
      button.textContent = `Palier ${encounter.tierNumber} · ${encounter.name}`;
      list.appendChild(button);
    }
    window.addEventListener('keydown', this.onDebugKeyDown);
    this.debugDisplay?.addEventListener('click', this.onDebugClick);
  }

  private setDebugMenuOpen(open: boolean): void {
    if (!this.debugDisplay || this.disposed || this.debugMenuOpen === open) return;
    this.debugMenuOpen = open;
    this.debugDisplay.hidden = !open;
    if (open) {
      this.debugPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.weapon.cancelReload();
      if (this.pauseDisplay) this.pauseDisplay.hidden = true;
      if (this.promptDisplay) this.promptDisplay.hidden = true;
      if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
      for (const button of this.debugDisplay.querySelectorAll<HTMLButtonElement>('[data-tier]')) {
        button.setAttribute('aria-current', String(Number(button.dataset.tier) === this.currentTier));
      }
      this.debugDisplay.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    } else {
      if (this.pauseDisplay) this.pauseDisplay.hidden = !this.isSimulationActive() || document.pointerLockElement === this.renderer.domElement;
      this.debugPreviousFocus?.focus();
    }
    this.syncAmbientAudio();
  }

  private spawnDebugZombie(kind: ZombieKind | 'crawler-ceiling'): void {
    if (this.disposed) return;
    const forward = new THREE.Vector3();
    this.player.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, 1);
    else forward.normalize();

    const dist = kind === 'spitter' ? 5.0 : 3.2;
    let targetX = this.player.camera.position.x + forward.x * dist;
    let targetZ = this.player.camera.position.z + forward.z * dist;

    if (this.level.isColliding(targetX, targetZ, 0.45)) {
      targetX = this.player.camera.position.x + forward.x * 1.5;
      targetZ = this.player.camera.position.z + forward.z * 1.5;
    }

    let zombie: Zombie | SpitterZombie | CrawlerZombie;
    if (kind === 'crawler-ceiling') {
      zombie = new CrawlerZombie(this.scene, this.level, targetX, targetZ, true);
    } else if (kind === 'crawler') {
      zombie = new CrawlerZombie(this.scene, this.level, targetX, targetZ);
    } else if (kind === 'spitter') {
      zombie = new SpitterZombie(this.scene, this.level, targetX, targetZ);
    } else {
      zombie = new Zombie(this.scene, this.level, targetX, targetZ, kind);
    }

    zombie.alert(this.player.camera.position);
    if (this.zombieGroanBuffer) {
      zombie.setupAudio(this.player.audioListener, this.zombieGroanBuffer, this.getEffectsVolume());
    }
    this.zombies.push(zombie);
    if (this.weapon) {
      this.weapon.setTargets(this.zombies.map((z) => z.getMesh()));
    }
    this.updateObjectiveDisplay();
    this.setDebugMenuOpen(false);
  }

  private jumpToDebugTier(tierNumber: number): void {
    if (!Number.isInteger(tierNumber) || !this.encounterConfigs[tierNumber - 1] || this.disposed) return;
    this.weapon.cancelReload();
    this.player.resetForDebug();
    this.footsteps?.reset();
    this.weaponMotion?.reset();
    for (const drop of this.ammoDrops) drop.dispose();
    this.ammoDrops = [];
    for (const shell of this.shellCasings) shell.dispose();
    this.shellCasings = [];
    this.hitEffects.clear();
    this.damageEffectRemaining = 0;
    if (this.damageOverlay) this.damageOverlay.style.opacity = '0';
    if (this.gameOverDisplay) this.gameOverDisplay.hidden = true;
    if (this.victoryDisplay) this.victoryDisplay.hidden = true;
    // Forcer un démarrage direct, même si le menu a été ouvert pendant une accalmie.
    this.state = 'playing';
    this.startTier(tierNumber);
    this.updateHealthDisplay();
    this.updateAmmoDisplay();
    this.setDebugMenuOpen(false);
  }

  private updateHorrorAudio(delta: number): void {
    const eligible = !this.debugMenuOpen && this.state === 'exploration'
      && this.pendingTierStart > 0
      && this.spawnQueue === 0
      && this.zombies.every((zombie) => !zombie.isAlive())
      && document.pointerLockElement === this.renderer.domElement
      && !document.hidden
      && (document.hasFocus?.() ?? true);
    const viewDirection = this.player.camera.getWorldDirection(new THREE.Vector3());
    this.horrorDirector?.update(
      delta,
      eligible,
      this.player.camera.position,
      viewDirection,
      this.level.getAccessibleHorrorPoints(),
    );
  }

  public start(): void {
    this.lastFrameTime = performance.now();
    this.renderer.setAnimationLoop(() => {
      const now = performance.now();
      const rawDeltaMs = Math.max(0, now - this.lastFrameTime);
      this.lastFrameTime = now;
      const rawDeltaSec = rawDeltaMs / 1000;
      const isTabSwitch = this.tabBecameVisible || (typeof document !== 'undefined' && document.hidden);
      this.tabBecameVisible = false;

      // Conserver le plafonnement de simulation existant pour le gameplay (déplacements, physique)
      const delta = this.debugMenuOpen ? 0 : Math.min(rawDeltaSec, 0.05);

      const isCombat = this.state === 'playing' && (typeof document !== 'undefined' && document.pointerLockElement === this.renderer.domElement);
      this.perfTracker?.recordFrame(rawDeltaMs, isCombat, isTabSwitch);

      this.updateDamageEffect(delta);
      // Les réglages continuent de fondre dans le panneau de pause, sans avancer le combat.
      this.updateAudioMix(Math.min(rawDeltaSec, 0.05));

      const stormActive = this.isSimulationActive()
        && document.pointerLockElement === this.renderer.domElement
        && !document.hidden
        && (document.hasFocus?.() ?? true);
      this.stormController.update(delta, stormActive, this.player.camera.position, this.level.getStormWindowPositions());
      if (!stormActive) this.footsteps?.reset();

      // Mise à jour des systèmes en jeu, en phase de répit ou en exploration d'accès.
      if (this.isSimulationActive() && document.pointerLockElement === this.renderer.domElement) {
        this.player.update(delta);
        this.footsteps?.update(delta, this.player.camera.position, stormActive);

        // Simulation des zombies pendant le combat actif
        if (this.state === 'playing') {
          this.hordeAlertTimer -= delta;
          if (this.hordeAlertTimer <= 0) {
            this.hordeAlertTimer = 0.75;
            for (const zombie of this.zombies) if (zombie.isAlive()) zombie.alert(this.player.camera.position);
          }
          this.spitProjectiles = this.spitProjectiles.filter((projectile) => projectile.update(delta, this.scene, this.level, this.player.camera.position, (damage) => {
            const previousHealth = this.player.getHealth();
            this.player.takeDamage(damage);
            this.tierDiagnostics?.recordDamageTaken(damage);
            if (this.player.getHealth() < previousHealth) {
              this.damageEffectRemaining = this.damageEffectDuration;
              if (this.damageOverlay) this.damageOverlay.style.opacity = '1';
            }
            this.updateHealthDisplay();
            if (!this.player.isAlive()) this.endGame('lost');
          }));
          // Gestion échelonnée de la file d'apparition
          this.spawnCooldownTimer -= delta;
          const livingCount = this.zombies.filter((z) => z instanceof Zombie ? z.isThreat() : z.isAlive()).length;
          this.tierDiagnostics?.updateActiveThreats(livingCount);
          const activeLimit = Math.min(this.maxSimultaneousZombies, this.encounterConfigs[this.currentTier - 1]?.maxActiveZombies ?? this.maxSimultaneousZombies);
          if (this.spawnQueue > 0 && livingCount < activeLimit && this.spawnCooldownTimer <= 0) {
            if (this.trySpawnZombie()) {
              this.spawnQueue--;
              const config = this.encounterConfigs[this.currentTier - 1];
              const spawnedSoFar = config ? (config.totalZombies - this.spawnQueue) : 0;
              const openingTarget = config?.openingSpawns ?? 1;
              if (spawnedSoFar < openingTarget) {
                this.spawnCooldownTimer = 0.4;
              } else {
                this.spawnCooldownTimer = 0.8;
              }
              this.updateObjectiveDisplay();
            } else {
              this.spawnCooldownTimer = 0.3;
            }
          }

          for (const zombie of this.zombies) {
            if (!this.player.isAlive()) break;
            if (zombie instanceof SpitterZombie) {
              zombie.update(delta, this.player.camera.position, this.zombies, (origin, target) => {
                this.spitProjectiles.push(new SpitProjectile(this.scene, origin, target));
              });
              continue;
            }
            if (zombie instanceof CrawlerZombie) {
              const forward = new THREE.Vector3();
              this.player.camera.getWorldDirection(forward);
              zombie.update(
                delta,
                this.player.camera.position,
                this.zombies,
                (damage, isAnkleGrab) => {
                  const previousHealth = this.player.getHealth();
                  this.player.takeDamage(damage);
                  if (isAnkleGrab) {
                    this.player.applyAnkleGrab(0.75, 0.4, 0.28);
                  }
                  this.tierDiagnostics?.recordDamageTaken(damage);
                  if (this.player.getHealth() < previousHealth) {
                    this.damageEffectRemaining = this.damageEffectDuration;
                    if (this.damageOverlay) this.damageOverlay.style.opacity = '1';
                  }
                  this.updateHealthDisplay();
                  if (!this.player.isAlive()) {
                    this.endGame('lost');
                  }
                },
                {
                  isFlashlightOn: this.player.isFlashlightOn(),
                  cameraDirection: forward,
                }
              );
              continue;
            }
            zombie.update(delta, this.player.camera.position, this.zombies.filter((z): z is Zombie => z instanceof Zombie), (damage) => {
              const previousHealth = this.player.getHealth();
              this.player.takeDamage(damage);
              this.tierDiagnostics?.recordDamageTaken(damage);
              if (this.player.getHealth() < previousHealth) {
                this.damageEffectRemaining = this.damageEffectDuration;
                if (this.damageOverlay) this.damageOverlay.style.opacity = '1';
              }
              this.updateHealthDisplay();
              if (!this.player.isAlive()) {
                this.endGame('lost');
              }
            });
          }
        }
      }

      if (this.isSimulationActive() && this.state === 'exploration' && this.pendingTierStart > 0 && document.pointerLockElement === this.renderer.domElement && !document.hidden && (document.hasFocus?.() ?? true)) {
        this.advanceRespite(delta);
      }

      this.updateZombieRemains(delta);

      // Animation des portes et détection d'interaction avec sécurité anti-pincement
      const occupants: Array<{ x: number; z: number; radius: number }> = [
        { x: this.player.camera.position.x, z: this.player.camera.position.z, radius: 0.3 }
      ];
      for (const zombie of this.zombies) {
        if (zombie.isAlive()) {
          const zPos = zombie.getPosition();
          occupants.push({ x: zPos.x, z: zPos.z, radius: 0.4 });
        }
      }

      let canInteract = false;
      const cameraDir = this.player.camera.getWorldDirection(new THREE.Vector3());

      if (this.isSimulationActive() && this.shotgunPickup.canInteract(this.player.camera.position, cameraDir)) {
        canInteract = true;
        if (this.promptDisplay) {
          this.promptDisplay.textContent = '[E] RAMASSER LE FUSIL À POMPE';
          this.promptDisplay.style.color = 'var(--gold, #dfba73)';
        }
      } else if (this.isSimulationActive() && this.state === 'exploration' && this.encounterBell.canInteract(this.player.camera.position, cameraDir)) {
        canInteract = true;
        if (this.promptDisplay) {
          const prompt = this.encounterBell.getPrompt();
          this.promptDisplay.textContent = prompt.text;
          this.promptDisplay.style.color = prompt.color;
        }
      } else if (this.isSimulationActive() && this.state === 'exploration' && (this.upgradePedestals ?? []).some((p) => p.canInteract(this.player.camera.position, cameraDir))) {
        const ped = (this.upgradePedestals ?? []).find((p) => p.canInteract(this.player.camera.position, cameraDir));
        if (ped) {
          canInteract = true;
          if (this.promptDisplay) {
            const prompt = ped.getPrompt();
            this.promptDisplay.textContent = prompt.text;
            this.promptDisplay.style.color = prompt.color;
          }
        }
      } else {
        for (const door of this.level.getDoors()) {
          if (this.isSimulationActive() && door.canInteract(this.player.camera.position, cameraDir)) {
            canInteract = true;
            if (this.promptDisplay) {
              const prompt = door.getPrompt();
              this.promptDisplay.textContent = prompt.text;
              this.promptDisplay.style.color = prompt.color;
            }
            break;
          }
        }
      }

      for (const door of this.level.getDoors()) {
        door.update(delta, occupants);
      }

      if (this.promptDisplay) {
        this.promptDisplay.hidden = !canInteract || !this.isSimulationActive() || document.pointerLockElement !== this.renderer.domElement;
      }

      // Animation du carillon d'arène et des stèles d'offrandes
      this.encounterBell?.update(delta);
      for (const p of (this.upgradePedestals ?? [])) p.update(delta, this.player.camera.position);

      // Animation et ramassage du fusil à pompe
      this.shotgunPickup.update(delta, this.player.camera.position);
      if (this.isSimulationActive() && this.shotgunPickup.tryPickup(this.player.camera.position, this.weapon)) {
        this.updateAmmoDisplay();
      }

      // Animation et ramassage des trousses de soin.
      for (const medkit of this.medkits) {
        medkit.update(delta, this.player.camera.position);
        if (this.isSimulationActive() && medkit.tryPickup(this.player)) {
          this.tierDiagnostics?.recordMedkit();
          this.updateHealthDisplay();
        }
      }

      // Animation et ramassage des boîtes de munitions.
      for (const box of this.ammoBoxes) {
        box.update(delta, this.player.camera.position);
        if (this.isSimulationActive() && box.tryPickup(this.player.camera.position, this.weapon)) {
          this.tierDiagnostics?.recordAmmoBox();
          this.updateAmmoDisplay();
        }
      }
      for (const box of this.ammoDrops) {
        box.update(delta, this.player.camera.position);
        if (this.isSimulationActive() && box.tryPickup(this.player.camera.position, this.weapon)) this.updateAmmoDisplay();
      }
      this.ammoDrops = this.ammoDrops.filter((box) => {
        if (!box.isConsumed()) return true;
        box.dispose();
        return false;
      });

      // Mise à jour de la balistique des douilles éjectées
      this.shellCasings = this.shellCasings.filter((casing) => casing.update(delta));
      const effectsDelta = this.isSimulationActive() && document.pointerLockElement === this.renderer.domElement ? delta : 0;
      this.hitEffects.update(effectsDelta, this.player.camera);

      this.updateHorrorAudio(delta);

      this.level.update(delta, stormActive ? delta : 0);

      // Transmission de l'éclairage local ambiant du joueur à l'arme 2D (rehaussé par la lampe torche)
      const envLight = this.level.getLightingAt(this.player.camera.position);
      const flashlightBoost = this.player.isFlashlightOn() ? 0.08 : 0;
      this.weapon.setEnvironmentalLighting(envLight.brightness + flashlightBoost, envLight.warmth, envLight.stormFlash);

      this.weapon.update(delta);
      this.weaponMotion?.update(delta, this.player.camera.position, stormActive, this.weapon.aimAmount, this.weapon.getIsReloading());

      // Affichage.
      this.renderer.render(
        this.scene,
        this.player.camera
      );

      this.logPerformanceMetrics(delta);
    });
  }

  private perfTimer = 0;
  public getPerformanceReport() {
    const info = this.renderer?.info ?? { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 }, programs: [] };
    const combat = this.perfTracker?.getCombatMetrics() ?? { count: 0, medianMs: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, over33Ms: 0, over50Ms: 0 };
    const overall = this.perfTracker?.getOverallMetrics() ?? { count: 0, medianMs: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, over33Ms: 0, over50Ms: 0 };
    const targetMetrics = combat.count > 0 ? combat : overall;
    const avgDeltaMs = targetMetrics.count > 0 ? targetMetrics.medianMs : 16.67;
    const fps = avgDeltaMs > 0 ? Math.round(1000 / avgDeltaMs) : 60;
    const perfMemory = (typeof performance !== 'undefined' && (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory);

    return {
      fps,
      frameTimeMs: Number(avgDeltaMs.toFixed(2)),
      medianFrameTimeMs: targetMetrics.medianMs,
      p95FrameTimeMs: targetMetrics.p95Ms,
      p99FrameTimeMs: targetMetrics.p99Ms,
      maxFrameTimeMs: targetMetrics.maxMs,
      framesOver33Ms: targetMetrics.over33Ms,
      framesOver50Ms: targetMetrics.over50Ms,
      lastSpawnMs: Number((this.perfTracker?.getLastSpawnDurationMs() ?? 0).toFixed(2)),
      lastPathfindingMs: Number((this.perfTracker?.getLastPathfindingDurationMs() ?? 0).toFixed(2)),
      lastTransitionMs: this.perfTracker?.getLastTransition() ? Number(this.perfTracker.getLastTransition()!.durationMs.toFixed(2)) : null,
      combatMetrics: combat,
      overallMetrics: overall,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      shaders: info.programs?.length ?? 0,
      jsHeapUsedMB: perfMemory ? Number((perfMemory.usedJSHeapSize / (1024 * 1024)).toFixed(2)) : null,
      jsHeapTotalMB: perfMemory ? Number((perfMemory.totalJSHeapSize / (1024 * 1024)).toFixed(2)) : null,
      internalResolution: typeof window !== 'undefined' ? `${Math.round(window.innerWidth / this.retroScale)}x${Math.round(window.innerHeight / this.retroScale)}` : '320x240',
      viewportResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '1920x1080',
      activeZombies: this.zombies ? this.zombies.filter((z) => z.isAlive()).length : 0,
      spawnQueue: this.spawnQueue ?? 0,
      state: this.state,
    };
  }

  public getDetailedPerformanceReport(): DetailedPerfReport {
    return this.getPerformanceReport() as unknown as DetailedPerfReport;
  }

  public getTierDiagnostics(): TierDiagnosticRecord[] {
    return this.tierDiagnostics?.getRecords() ?? [];
  }

  private logPerformanceMetrics(delta: number): void {
    this.perfTimer += delta;
    if (this.perfTimer >= 3.0) {
      this.perfTimer = 0;
      const stats = this.getPerformanceReport();
      const heapStr = stats.jsHeapUsedMB !== null ? ` | RAM JS: ${stats.jsHeapUsedMB}Mo` : '';
      const spikeStr = stats.framesOver33Ms > 0 || stats.framesOver50Ms > 0 ? ` [Saccades >33ms: ${stats.framesOver33Ms}, >50ms: ${stats.framesOver50Ms}]` : '';
      console.log(
        `[PERF] ${stats.fps} FPS (médiane: ${stats.medianFrameTimeMs}ms, p95: ${stats.p95FrameTimeMs}ms, max: ${stats.maxFrameTimeMs}ms)${spikeStr} | DrawCalls: ${stats.drawCalls} | Triangles: ${stats.triangles} | Textures: ${stats.textures} | Géométries: ${stats.geometries}${heapStr}`
      );
    }
  }

  private updateZombieRemains(delta: number): void {
    if (this.debugMenuOpen) return;
    // Le dernier coup ouvre le menu et libère la souris : sa chute reste visuelle.
    // Échap en combat/exploration suspend en revanche les animations de mort.
    const animate = this.state === 'respite' || this.state === 'won'
      || ((this.state === 'playing' || this.state === 'exploration' || this.state === 'terminal')
        && document.pointerLockElement === this.renderer.domElement);
    if (!animate) return;
    for (const zombie of this.zombies) {
      zombie.updateDeath(delta, this.player.camera.position);
      if (zombie instanceof Zombie && zombie.consumeJustRevived()) {
        this.tierDiagnostics?.recordRevival(zombie.getKind());
      }
    }
  }

  private updateResolution(): void {
    const retroWidth = Math.max(320, Math.floor(window.innerWidth / this.retroScale));
    const retroHeight = Math.max(240, Math.floor(window.innerHeight / this.retroScale));
    // Le 3e paramètre 'false' empêche Three.js d'écraser le style CSS 'width: 100vw; height: 100vh'
    this.renderer.setSize(retroWidth, retroHeight, false);
  }

  private checkTierCompletion(): void {
    if (this.state !== 'playing') return;
    const remaining = this.zombies.filter((zombie) => zombie instanceof Zombie ? zombie.isThreat() : zombie.isAlive()).length;
    if (remaining === 0 && this.spawnQueue === 0) {
      this.enterRespite();
    }
  }

  public respawnPickups(): void {
    for (const medkit of this.medkits) medkit.respawn();
  }

  private advanceRespite(delta: number): void {
    this.respiteTimer = Math.max(0, this.respiteTimer - delta);
    this.updateObjectiveDisplay();
    if (this.respiteTimer === 0) this.launchPendingTier();
  }

  private onZombieKilled(zombie: Zombie | SpitterZombie | CrawlerZombie): void {
    this.killsThisTier++;
    const remaining = this.encounterConfigs[this.currentTier - 1].totalZombies - this.killsThisTier;
    const due = this.dropBudget > 0 && (this.killsThisTier <= 2 || remaining <= this.dropBudget);
    if (!due && (this.dropBudget <= 0 || Math.random() >= 0.32)) return;
    const pos = zombie.getPosition();
    const kind = this.weapon.isWeaponUnlocked('shotgun') && this.dropsMade % 3 === 2 ? 'shotgun' : 'pistol';
    const count = kind === 'shotgun' ? 4 : 10;
    this.ammoDrops.push(new AmmoBox(this.scene, pos.x, pos.z, count, kind, this.level.getFloorHeightAt(pos.x, pos.z)));
    this.tierDiagnostics?.recordAmmoDrop();
    this.dropsMade++;
    this.dropBudget = Math.max(0, this.dropBudget - 1);
  }

  private enterRespite(): void {
    if (this.state !== 'playing') return;
    this.tierDiagnostics?.endTier();

    // 1. Déverrouiller la nouvelle aile accessible selon la rencontre validée
    const configs = this.encounterConfigs ?? (this as unknown as { tierCandidateSpawns?: EncounterSpec[] }).tierCandidateSpawns;
    const currentEncounter = configs?.[this.currentTier - 1];
    if (currentEncounter?.unlockSectorTier) {
      const doors = this.level.getDoors();
      for (const door of doors) {
        if (door.getUnlockAfterTier() === currentEncounter.unlockSectorTier) {
          door.unlock();
          if (door.getState() === 'CLOSED') door.toggle();
        }
      }
    }

    // 2. Réarmement unique des ressources du décor (soins et munitions) pour l'exploration
    this.respawnPickups();

    // 3. Déclic métallique sonore d'ouverture
    const unlockSound = new Audio('/assets/sounds/empty-soft.wav');
    unlockSound.volume = 0.5 * this.getEffectsVolume();
    void unlockSound.play().catch(() => {});

    // Après la dernière rencontre configurée, conserver l'exploration libre.
    const maxTiers = configs?.length ?? 4;
    if (this.currentTier >= maxTiers) {
      this.pendingTierStart = 0;
      this.state = 'terminal';
      this.encounterBell?.setActive(false);
      for (const pedestal of (this.upgradePedestals ?? [])) pedestal.close();
      this.updateObjectiveDisplay();
      return;
    }

    // 5. Transition directe et fluide vers l'exploration sécurisée (sans menu bloquant)
    this.pendingTierStart = this.currentTier + 1;
    this.state = 'exploration';
    this.encounterBell?.setActive(false);
    this.respiteTimer = 10;

    // 6. Proposer jusqu'à deux bonus encore inédits ; le ravitaillement reste indépendant.
    const offers = drawTierUpgrades(this.appliedUpgrades ?? []);
    for (let i = 0; i < (this.upgradePedestals ?? []).length; i++) {
      const pedestal = this.upgradePedestals[i];
      const offer = offers[i];
      if (pedestal && offer) pedestal.setOffer(offer);
      else pedestal?.close();
    }

    this.updateObjectiveDisplay();
  }

  public applyUpgrade(upgrade: UpgradeSpec): void {
    if (this.appliedUpgrades.includes(upgrade.id)) return;
    this.appliedUpgrades.push(upgrade.id);
    switch (upgrade.id) {
      case 'ammo_capacity':
        this.weapon.upgradeAmmoCapacity(1.5);
        this.updateAmmoDisplay();
        break;
      case 'hip_accuracy':
        this.weapon.upgradeAccuracy(0.65);
        break;
      case 'vitality':
        this.player.setMaxHealth(120);
        this.player.heal(40);
        this.updateHealthDisplay();
        break;
      case 'agility':
        this.player.setSpeedMultiplier(1.12);
        break;
    }
  }

  public confirmRewardAndContinue(): void {
    if (this.pendingTierStart > 0) {
      this.launchPendingTier();
    }
  }

  public launchPendingTier(): void {
    if (this.state !== 'exploration' || this.pendingTierStart === 0) return;
    const nextTier = this.pendingTierStart;
    this.pendingTierStart = 0;
    this.currentTier = nextTier;
    this.startTier(this.currentTier);
  }

  public startTier(tierNumber: number): void {
    this.footsteps?.reset();
    this.weaponMotion?.reset();
    this.weapon?.suspendMechanicalAudio?.();
    const configs = this.encounterConfigs ?? (this as unknown as { tierCandidateSpawns?: EncounterSpec[] }).tierCandidateSpawns;
    if (!Number.isInteger(tierNumber) || tierNumber < 1 || tierNumber > (configs?.length ?? 0)) return;
    this.currentTier = tierNumber;
    this.pendingTierStart = 0;
    this.respiteTimer = 0;
    this.horrorDirector?.resetRespite();
    const t0 = performance.now();
    this.tierAgileSpawned = 0;
    this.tierSpitterSpawned = 0;
    this.tierCrawlerSpawned = 0;
    this.tierStandardSpawned = 0;
    this.dropBudget = Math.max(2, Math.ceil((configs?.[tierNumber - 1]?.totalZombies ?? 4) / 3));
    this.dropsMade = 0;
    this.killsThisTier = 0;
    this.hordeAlertTimer = 0;
    this.lastSpawnQuadrant = -1;
    this.tierDiagnostics?.startTier(tierNumber);
    this.encounterBell?.setActive(false);
    for (const p of (this.upgradePedestals ?? [])) {
      p.close();
    }

    // 1. Nettoyer les anciens zombies de la scène et couper leurs sons
    for (const zombie of this.zombies) {
      zombie.dispose(this.scene);
    }
    this.zombies = [];
    for (const projectile of (this.spitProjectiles ?? [])) projectile.dispose(this.scene);
    this.spitProjectiles = [];
    this.weapon?.setTargets([]);

    // 2. Gestion et verrouillage des portes du manoir selon la progression
    const doors = this.level.getDoors();
    for (const door of doors) {
      if (door.getType() === 'permanent_limit') {
        door.lock();
      } else if (door.getType() === 'sector_access') {
        if (door.getUnlockAfterTier() < tierNumber) {
          door.unlock();
          if (door.getState() === 'CLOSED') door.toggle();
        } else {
          door.lock();
        }
      }
    }

    // 3. Réarmement des ressources du décor (santé et munitions)
    // Règle du réarmement unique (Tâche 5) : si l'on arrive d'une accalmie normale ('exploration'),
    // les pickups ont déjà été réarmés dans enterRespite(). Tout objet ramassé pendant l'accalmie
    // pour se préparer au combat ne doit pas réapparaître immédiatement au gong.
    // On ne réarme ici que lors d'un démarrage direct hors accalmie (P1 initial ou test direct).
    if (this.state !== 'exploration') {
      this.respawnPickups();
    }

    // 4. Initialisation de la file d'apparition échelonnée
    const config = configs?.[tierNumber - 1];
    if (config) {
      this.spawnQueue = config.totalZombies;
      // Au démarrage du Palier 1, accorder un délai d'observation initial de 2 secondes au joueur.
      // Aux autres paliers, premier spawn différé à 0.8 s (salve d'ouverture espacée).
      this.spawnCooldownTimer = tierNumber === 1 ? 2.0 : 0.8;
    }

    // 5. Basculer en phase de combat actif
    this.state = 'playing';
    this.updateObjectiveDisplay();
    this.perfTracker?.recordTransition(tierNumber, performance.now() - t0);
  }

  public trySpawnZombie(): boolean {
    const t0 = performance.now();
    const configs = this.encounterConfigs ?? (this as unknown as { tierCandidateSpawns?: EncounterSpec[] }).tierCandidateSpawns;
    const config = configs?.[this.currentTier - 1];
    if (!config) return false;

    const playerPos = this.player.camera.position;
    const cameraDir = this.player.camera.getWorldDirection(new THREE.Vector3());
    const livingZombies = this.zombies.filter((z) => z.isAlive());

    interface CandidateScore {
      x: number;
      z: number;
      score: number;
      quadrant: number;
    }
    const eligible: CandidateScore[] = [];
    const pool = config.spawnPool ?? (config as unknown as { pool: Point2D[] }).pool;

    // Répartition des zombies vivants par quadrant angulaire relatif au joueur (4 directions : 0=Est, 1=Sud, 2=Ouest, 3=Nord)
    const livingQuadrantCounts = [0, 0, 0, 0];
    for (const living of livingZombies) {
      const lPos = living.getPosition();
      const ldx = lPos.x - playerPos.x;
      const ldz = lPos.z - playerPos.z;
      const lAngle = Math.atan2(ldz, ldx);
      const lq = Math.floor(((lAngle + Math.PI + Math.PI / 4) % (2 * Math.PI)) / (Math.PI / 2)) % 4;
      livingQuadrantCounts[lq]++;
    }

    // Détermination de la composition garantie selon les quotas de la rencontre
    this.tierStandardSpawned = this.tierStandardSpawned ?? 0;
    const totalZombies = config.totalZombies;
    const maxAgileThisTier = config.maxAgile;
    const maxSpitterThisTier = config.maxSpitter;
    const maxCrawlerThisTier = config.maxCrawler ?? 0;
    const maxStandardThisTier = Math.max(0, totalZombies - maxAgileThisTier - maxSpitterThisTier - maxCrawlerThisTier);

    const remainingAgile = Math.max(0, maxAgileThisTier - this.tierAgileSpawned);
    const remainingSpitter = Math.max(0, maxSpitterThisTier - this.tierSpitterSpawned);
    const remainingCrawler = Math.max(0, maxCrawlerThisTier - this.tierCrawlerSpawned);
    const remainingStandard = Math.max(0, maxStandardThisTier - this.tierStandardSpawned);

    const livingAgile = this.zombies.filter((z) => z instanceof Zombie && z.getKind() === 'agile' && z.isThreat()).length;
    const livingSpitter = livingZombies.filter((z) => z.getKind() === 'spitter').length;
    const livingCrawler = livingZombies.filter((z) => z.getKind() === 'crawler').length;

    const canSpawnSpitter = remainingSpitter > 0 && livingSpitter < config.maxSimultaneousSpitter;
    const canSpawnCrawler = remainingCrawler > 0 && livingCrawler < (config.maxSimultaneousCrawler ?? 2);
    const canSpawnAgile = remainingAgile > 0 && livingAgile < config.maxSimultaneousAgile;
    const canSpawnSoloAgile = canSpawnAgile && remainingAgile > remainingSpitter;
    const canSpawnStandard = remainingStandard > 0;

    if (!canSpawnSpitter && !canSpawnCrawler && !canSpawnAgile && !canSpawnStandard) {
      this.perfTracker?.recordSpawn(performance.now() - t0);
      return false;
    }

    let chosenKind: ZombieKind;
    if (this.currentTier === 3 && this.tierSpitterSpawned === 0 && canSpawnSpitter) {
      chosenKind = 'spitter';
    } else if (canSpawnSpitter) {
      chosenKind = 'spitter';
    } else if (canSpawnCrawler && (this.tierCrawlerSpawned <= this.tierAgileSpawned || !canSpawnAgile)) {
      chosenKind = 'crawler';
    } else if (canSpawnSoloAgile && canSpawnStandard) {
      chosenKind = this.tierAgileSpawned <= this.tierStandardSpawned ? 'agile' : 'standard';
    } else if (canSpawnSoloAgile) {
      chosenKind = 'agile';
    } else if (canSpawnStandard) {
      chosenKind = 'standard';
    } else if (canSpawnCrawler) {
      chosenKind = 'crawler';
    } else {
      return false;
    }

    for (const c of pool) {
      // 1. Collision solide avec le décor
      if (this.level.isColliding(c.x, c.z, 0.45)) continue;

      // 2. Vérification des limites du secteur ouvert
      if (
        c.x < config.sectorBounds.minX ||
        c.x > config.sectorBounds.maxX ||
        c.z < config.sectorBounds.minZ ||
        c.z > config.sectorBounds.maxZ
      ) {
        continue;
      }

      // 3. Distance minimale de sécurité au joueur (6 unités minimum)
      const dx = c.x - playerPos.x;
      const dz = c.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6.0) continue;

      // 4. Séparation minimale avec les autres zombies vivants
      const tooCloseToOther = livingZombies.some((other) => {
        const oPos = other.getPosition();
        return Math.hypot(c.x - oPos.x, c.z - oPos.z) < 1.8;
      });
      if (tooCloseToOther) continue;

      // 5. Évaluation du champ de vision (FOV) et de la visibilité réelle (rejet rapide)
      const spawnFloorY = this.level.getFloorHeightAt(c.x, c.z);
      if (chosenKind === 'spitter' && this.currentTier === 3 && spawnFloorY < 2.0) continue;
      const spawnPos3D = new THREE.Vector3(c.x, spawnFloorY + 1.0, c.z);
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const dot = dirX * cameraDir.x + dirZ * cameraDir.z;
      const hasLOS = this.level.hasLineOfSight(playerPos, spawnPos3D);

      // Rejeter si le point est en plein champ de vision direct dégagé
      if (dot > 0.45 && hasLOS) continue;

      // 6. Chemin praticable jusqu'au joueur
      const hasPath = this.level.findNextWaypoint(spawnPos3D, playerPos, 0.4);
      if (!hasPath) continue;

      // Calcul du quadrant d'apparition relatif au joueur
      const angle = Math.atan2(dz, dx);
      const quadrant = Math.floor(((angle + Math.PI + Math.PI / 4) % (2 * Math.PI)) / (Math.PI / 2)) % 4;

      // Une apparition sûre mais proche met la vague en contact sans longue chasse dans le manoir.
      let score = Math.max(0, 24 - dist) * 2;
      if (!hasLOS) score += 5;
      if (dot <= 0) score += 2;

      // Diversité multidirectionnelle et imprévisibilité :
      // 1. Privilégier les directions sans aucun zombie vivant
      if (livingQuadrantCounts[quadrant] === 0) {
        score += 4;
      } else if (livingQuadrantCounts[quadrant] === 1) {
        score += 1;
      } else {
        score -= 3;
      }

      // 2. Alterner par rapport à la dernière direction d'apparition
      if (this.lastSpawnQuadrant >= 0 && quadrant !== this.lastSpawnQuadrant) {
        score += 2;
      }

      eligible.push({ x: c.x, z: c.z, score, quadrant });
    }

    if (eligible.length === 0) {
      // Aucun point n'est immédiatement éligible : conserver en file d'attente
      this.perfTracker?.recordSpawn(performance.now() - t0);
      this.perfTracker?.recordPathfinding(this.level?.getLastPathfindingDurationMs?.() ?? 0);
      return false;
    }

    // Trier par score et piocher aléatoirement parmi les meilleurs candidats variés
    eligible.sort((a, b) => b.score - a.score);
    const selectionPoolSize = Math.min(5, eligible.length);
    let chosen = eligible[Math.floor(Math.random() * selectionPoolSize)];
    let escort: CandidateScore | undefined;
    if (chosenKind === 'spitter') {
      const threats = this.zombies.filter((z) => z instanceof Zombie ? z.isThreat() : z.isAlive()).length;
      const activeLimit = Math.min(this.maxSimultaneousZombies, config.maxActiveZombies);
      if (!canSpawnAgile || this.spawnQueue < 2 || threats > activeLimit - 2) return false;
      for (const candidate of eligible) {
        const partner = eligible.find((other) => {
          const distance = Math.hypot(other.x - candidate.x, other.z - candidate.z);
          if (distance < 2 || distance > 8) return false;
          const first = new THREE.Vector3(candidate.x, this.level.getFloorHeightAt(candidate.x, candidate.z) + 1, candidate.z);
          const second = new THREE.Vector3(other.x, this.level.getFloorHeightAt(other.x, other.z) + 1, other.z);
          return Math.abs(first.y - second.y) < 1 && this.level.hasLineOfSight(first, second);
        });
        if (partner) { chosen = candidate; escort = partner; break; }
      }
      if (!escort) return false;
    }
    this.lastSpawnQuadrant = chosen.quadrant;

    if (chosenKind === 'spitter') {
      this.tierSpitterSpawned++;
    } else if (chosenKind === 'crawler') {
      this.tierCrawlerSpawned++;
    } else if (chosenKind === 'agile') {
      this.tierAgileSpawned++;
    } else {
      this.tierStandardSpawned++;
    }

    // Créer le zombie et l'alerter vers le joueur
    const zombie = chosenKind === 'spitter'
      ? new SpitterZombie(this.scene, this.level, chosen.x, chosen.z)
      : chosenKind === 'crawler'
      ? new CrawlerZombie(this.scene, this.level, chosen.x, chosen.z)
      : new Zombie(this.scene, this.level, chosen.x, chosen.z, chosenKind);
    zombie.alert(playerPos);
    if (this.zombieGroanBuffer) {
      zombie.setupAudio(this.player.audioListener, this.zombieGroanBuffer, this.getEffectsVolume());
    }
    this.zombies.push(zombie);
    this.tierDiagnostics?.recordSpawn(chosenKind, livingZombies.length + 1);

    if (escort) {
      const runner = new Zombie(this.scene, this.level, escort.x, escort.z, 'agile');
      runner.alert(playerPos);
      if (this.zombieGroanBuffer) runner.setupAudio(this.player.audioListener, this.zombieGroanBuffer, this.getEffectsVolume());
      this.zombies.push(runner);
      this.tierAgileSpawned++;
      this.spawnQueue--;
      this.tierDiagnostics?.recordSpawn('agile', livingZombies.length + 2);
    }

    if (this.weapon) {
      this.weapon.setTargets(this.zombies.map((z) => z.getMesh()));
    }

    this.perfTracker?.recordSpawn(performance.now() - t0);
    this.perfTracker?.recordPathfinding(this.level?.getLastPathfindingDurationMs?.() ?? 0);
    return true;
  }

  private updateObjectiveDisplay(): void {
    if (!this.objectiveDisplay) return;
    const livingZombies = this.zombies.filter((z) => z instanceof Zombie ? z.isThreat() : z.isAlive()).length;
    const totalRemaining = livingZombies + this.spawnQueue;
    if (this.state === 'won') {
      const total = this.encounterConfigs.length;
      this.objectiveDisplay.textContent = `TENTATIVE SURVÉCUE · ${total} RENCONTRES PURGÉES`;
      this.objectiveDisplay.style.color = 'var(--sage)';
    } else if (this.state === 'lost') {
      this.objectiveDisplay.textContent = 'MISSION ÉCHOUÉE';
      this.objectiveDisplay.style.color = 'var(--blood)';
    } else if (this.state === 'terminal') {
      this.objectiveDisplay.textContent = `${this.encounterConfigs.length} RENCONTRES PURGÉES · FINALE F6 À VENIR`;
      this.objectiveDisplay.style.color = 'var(--gold, #dfba73)';
    } else if (this.state === 'respite') {
      this.objectiveDisplay.textContent = `PALIER ${this.currentTier} PURGÉ · ACCALMIE EN COURS`;
      this.objectiveDisplay.style.color = 'var(--gold, #dfba73)';
    } else if (this.state === 'exploration') {
      this.objectiveDisplay.textContent = `PALIER ${this.currentTier} PURGÉ · PROCHAIN COMBAT DANS ${Math.ceil(this.respiteTimer)} S`;
      this.objectiveDisplay.style.color = 'var(--gold, #dfba73)';
    } else {
      const plural = totalRemaining > 1 ? 'MENACES' : 'MENACE';
      const encounter = this.encounterConfigs[this.currentTier - 1];
      const sectorName = encounter?.sectorName ?? `SECTEUR ${this.currentTier}`;
      this.objectiveDisplay.textContent = `PALIER ${this.currentTier} (${sectorName}) · ${totalRemaining} ${plural}`;
      this.objectiveDisplay.style.color = 'var(--ivory)';
    }
  }

  private updateAmmoDisplay(): void {
    if (!this.ammoDisplay) return;
    const { weaponName, magazine, capacity, reserve, isReloading } = this.weapon.getAmmoState();
    if (isReloading) {
      this.ammoDisplay.textContent = `${weaponName} · RECHARGEMENT… (${magazine} / ${capacity} · RÉSERVE : ${reserve})`;
      this.ammoDisplay.style.color = 'var(--ivory)';
    } else {
      this.ammoDisplay.textContent = `${weaponName} · ${magazine} / ${capacity} · RÉSERVE : ${reserve}`;
      this.ammoDisplay.style.color = magazine === 0 ? 'var(--blood)' : 'var(--brass)';
    }
  }

  private updateHealthDisplay(): void {
    if (this.healthDisplay) {
      this.healthDisplay.textContent = `VIE : ${this.player.getHealth()} / ${this.player.getMaxHealth()}`;
    }
  }

  private updateFlashlightDisplay(enabled: boolean): void {
    if (this.flashlightDisplay) {
      this.flashlightDisplay.textContent = `[F] LAMPE : ${enabled ? 'ALLUMÉE' : 'ÉTEINTE'}`;
      this.flashlightDisplay.classList.toggle('off', !enabled);
    }
  }

  private endGame(result: 'won' | 'lost'): void {
    if (this.state !== 'playing' && this.state !== 'respite' && this.state !== 'exploration') return;
    this.tierDiagnostics?.endTier();
    this.state = result;
    for (const projectile of (this.spitProjectiles ?? [])) projectile.dispose(this.scene);
    this.spitProjectiles = [];
    this.weapon.cancelReload();
    this.syncAmbientAudio();
    this.updateObjectiveDisplay();
    if (this.pauseDisplay) this.pauseDisplay.hidden = true;
    if (this.promptDisplay) this.promptDisplay.hidden = true;
    if (this.ambianceAudio && this.ambianceAudio.isPlaying) {
      this.ambianceAudio.stop();
    }
    if (this.musicAudio?.isPlaying) this.musicAudio.stop();
    this.horrorDirector?.suspend();
    this.footsteps?.reset();
    const message = result === 'won' ? this.victoryDisplay : this.gameOverDisplay;
    if (message) message.hidden = false;
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
  }

  private updateDamageEffect(delta: number): void {
    if (this.damageEffectRemaining <= 0) return;
    this.damageEffectRemaining = Math.max(0, this.damageEffectRemaining - delta);
    if (this.damageOverlay) {
      this.damageOverlay.style.opacity = String(this.damageEffectRemaining / this.damageEffectDuration);
    }
  }

  private syncAmbientAudio(): void {
    const active = this.isSimulationActive()
      && document.pointerLockElement === this.renderer.domElement
      && !document.hidden
      && (document.hasFocus?.() ?? true);
    if (active) {
      void this.player.audioListener.context.resume().catch((error: unknown) => {
        console.warn('Activation audio impossible :', error);
      });
      if (this.ambianceAudio && !this.ambianceAudio.isPlaying) this.ambianceAudio.play();
      if (this.musicAudio && !this.musicAudio.isPlaying) this.musicAudio.play();
    } else {
      if (this.ambianceAudio?.isPlaying) this.ambianceAudio.pause();
      if (this.musicAudio?.isPlaying) this.musicAudio.pause();
      this.horrorDirector?.suspend();
      this.stormController?.suspend();
      this.footsteps?.reset();
      this.weaponMotion?.reset();
      this.weapon?.suspendMechanicalAudio?.();
      for (const zombie of this.zombies) zombie.stopAudio();
    }
  }

  private setupAudioControls(): void {
    const channels: AudioChannel[] = ['ambience', 'effects', 'music', 'horror'];
    for (const channel of channels) {
      const input = document.querySelector<HTMLInputElement>(`#${channel}-volume`);
      const output = document.querySelector<HTMLOutputElement>(`#${channel}-volume-value`);
      if (!input) continue;
      input.value = String(this.audioMix.getSetting(channel));
      if (output) output.value = `${Math.round(Number(input.value) * 100)} %`;
      input.addEventListener('input', () => {
        if (this.disposed) return;
        this.audioMix.setVolume(channel, Number(input.value));
        this.audioMix.saveSettings();
        if (output) output.value = `${Math.round(this.audioMix.getSetting(channel) * 100)} %`;
      });
    }
  }

  private getEffectsVolume(): number {
    return this.audioMix?.getVolume('effects') ?? 1;
  }

  private updateAudioMix(delta: number): void {
    if (!this.audioMix.update(delta, this.state === 'playing')) return;
    this.applyAudioMix();
  }

  private applyAudioMix(): void {
    const ambience = this.audioMix.getVolume('ambience');
    const effects = this.getEffectsVolume();
    this.ambianceAudio?.setVolume(0.15 * ambience);
    this.stormController.setAmbienceVolume(ambience);
    this.horrorDirector.setVolume(this.audioMix.getVolume('horror') * ambience);
    this.musicAudio?.setVolume(0.3 * this.audioMix.getVolume('music') * this.audioMix.getMusicPresence());
    this.weapon.setEffectsVolume(effects);
    this.player.setEffectsVolume(effects);
    this.footsteps?.setVolume(effects);
    this.encounterBell.setEffectsVolume(effects);
    for (const zombie of this.zombies) zombie.setAudioVolume(effects);
  }

  public dispose(): void {
    this.disposed = true;
    window.removeEventListener('keydown', this.onDebugKeyDown);
    this.debugDisplay?.removeEventListener('click', this.onDebugClick);
    if (this.debugDisplay) this.debugDisplay.hidden = true;
    if (this.ambianceAudio?.isPlaying) this.ambianceAudio.stop();
    if (this.musicAudio?.isPlaying) this.musicAudio.stop();
    for (const drop of (this.ammoDrops ?? [])) drop.dispose();
    this.ammoDrops = [];
    for (const projectile of (this.spitProjectiles ?? [])) projectile.dispose(this.scene);
    this.spitProjectiles = [];
    for (const zombie of this.zombies) {
      zombie.dispose(this.scene);
    }
    this.zombies = [];
    this.encounterBell?.dispose(this.scene);
    for (const p of (this.upgradePedestals ?? [])) p.dispose(this.scene);
    this.horrorDirector?.dispose();
    this.stormController?.dispose();
    this.footsteps?.dispose();
    this.weaponMotion?.dispose();
    this.weapon?.dispose?.();
    this.level?.disposeDecor();
    disposeAllZombieResources();
  }
}
