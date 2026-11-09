
import * as THREE from 'three';

import { Level } from './Level';
import { Player } from './Player';
import { Zombie, disposeAllZombieResources } from './Zombie';
import { type ZombieKind } from './ZombieRemains';
import { Weapon, type FirearmId, type ShotDamage } from './Weapon';
import { Medkit } from './Medkit';
import { AmmoBox } from './AmmoBox';
import { ShotgunPickup } from './ShotgunPickup';
import { PistolPickup } from './PistolPickup.ts';
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
import { GuardianZombie, type PortraitCue } from './GuardianZombie.ts';
import { guardianConfig } from './FinaleConfig.ts';
import { GuardianProjectile, type PortraitProjectileEffects } from './GuardianProjectile.ts';
import { PortraitProjectileImpacts } from './PortraitProjectileImpacts.ts';
import { PortraitParticles } from './PortraitParticles.ts';
import { PortraitAudio } from './PortraitAudio.ts';
import { TierDiagnosticsTracker, type TierDiagnosticRecord } from './TierDiagnostics.ts';
import { GameHud, type HudPrompt } from './GameHud.ts';
import { AudioMix, type AudioChannel } from './AudioMix.ts';
import { Music, type MusicTrack } from './Music.ts';
import { SoundEffects } from './SoundEffects.ts';
import type { Door } from './Door.ts';
import { FootstepAudio } from './FootstepAudio.ts';
import { WeaponMotion } from './WeaponMotion.ts';
import { GameMenus } from './GameMenus.ts';
import { TitleScene } from './TitleScene.ts';

type GameState = 'playing' | 'respite' | 'exploration' | 'terminal' | 'won' | 'lost';

const enemyVoiceFiles: Record<ZombieKind, string> = {
  standard: 'zombie-groan-soft',
  agile: 'zombie-runner',
  spitter: 'spitter-gurgle',
  crawler: 'crawler-hiss',
};

export class Game {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  private level: Level;
  private player: Player;
  private zombies: Array<Zombie | SpitterZombie | CrawlerZombie> = [];
  private spitProjectiles: Array<SpitProjectile | GuardianProjectile> = [];
  private medkits: Medkit[] = [];
  private ammoBoxes: AmmoBox[] = [];
  private ammoDrops: AmmoBox[] = [];
  private dropBudget = 0;
  private dropsMade = 0;
  private killsThisTier = 0;
  private defeatedZombies = new WeakSet<Zombie | SpitterZombie | CrawlerZombie>();
  private spawnGroupIndex = 0;
  private groupRespiteRemaining: number | null = null;
  private finaleSupplyLots = 0;
  private guardianSupplyElapsed = 0;
  private guardianHealthSupplyElapsed = 0;
  private guardianSupplyIndex = 0;
  private guardianAmmoDrops: AmmoBox[] = [];
  private guardianMedkitDrops: Medkit[] = [];
  private hordeAlertTimer = 0;
  private respiteTimer = 0;
  private pistolPickup: PistolPickup;
  private shotgunPickup: ShotgunPickup;
  private encounterBell: EncounterBell;
  private upgradePedestals: UpgradePedestal[] = [];
  private appliedUpgrades: UpgradeId[] = [];
  private shellCasings: ShellCasing[] = [];
  private hitEffects: HitEffects;
  private portraitParticles: PortraitParticles;
  private portraitAudio: PortraitAudio;
  private portraitProjectileImpacts: PortraitProjectileImpacts;
  private portraitProjectileEffects: PortraitProjectileEffects;
  private weapon: Weapon;
  private readonly weaponMotion = new WeaponMotion(document.querySelector<HTMLElement>('.weapon-view'));
  private state: GameState = 'playing';
  private currentTier = 1;
  private runElapsedSeconds = 0;
  private wasControlActive = false;
  private completedTiers = new Set<number>();
  private runResult: 'won' | 'lost' | null = null;
  private runSummaryOpen = false;
  private debugRun = false;
  private debugMenuOpen = false;
  private readonly debugDisplay = document.querySelector<HTMLElement>('#debug-menu');
  private debugPreviousFocus: HTMLElement | null = null;
  private readonly onDebugKeyDown = (event: KeyboardEvent): void => {
    if (this.titleScene || this.menus?.panelOpen) return;
    const target = event.target;
    if (event.code === 'KeyB' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey
      && !(target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select')))) {
      if (this.runResult) {
        event.preventDefault();
        if (this.runSummaryOpen) this.closeRunSummary();
        else this.openRunSummary();
      }
      return;
    }
    if (this.runSummaryOpen && event.code === 'Escape') {
      event.preventDefault();
      this.closeRunSummary();
      return;
    }
    if (event.code === 'KeyK' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey
      && !(target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select')))) {
      event.preventDefault();
      this.setDebugMenuOpen(!this.debugMenuOpen);
    } else if (this.debugMenuOpen && event.code === 'Escape') {
      event.preventDefault();
      this.setDebugMenuOpen(false);
    } else if ((this.debugMenuOpen || this.runSummaryOpen) && event.code === 'Tab') {
      const dialog = this.runSummaryOpen ? this.summaryDisplay : this.debugDisplay;
      const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []);
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

  private readonly hud = new GameHud();
  private readonly promptDisplay = document.querySelector<HTMLElement>('#prompt');
  private readonly gameOverDisplay = document.querySelector<HTMLElement>('#game-over');
  private readonly victoryDisplay = document.querySelector<HTMLElement>('#victory');
  private readonly summaryDisplay = document.querySelector<HTMLElement>('#run-summary');
  private readonly summaryOpenButton = document.querySelector<HTMLButtonElement>('#run-summary-open');
  private readonly pauseDisplay = document.querySelector<HTMLElement>('#pause-message');
  private readonly menus: GameMenus;
  private titleScene: TitleScene | null;
  private readonly onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (locked) {
      this.menus.closePanel();
      this.menus.setCaptureError(false);
      if (this.titleScene) {
        this.titleScene.dispose();
        this.titleScene = null;
        this.player.camera.visible = true;
        this.menus.setTitle(false);
      }
    }
    if (this.pauseDisplay) {
      this.pauseDisplay.hidden = locked || !this.isSimulationActive();
      if (!this.pauseDisplay.hidden && (document.hasFocus?.() ?? true)) this.menus.focusResume();
    }
    this.syncAmbientAudio();
  };
  private readonly onPointerLockError = (): void => this.menus.setCaptureError(true);
  private readonly requestControl = (): void => {
    const canvas = this.renderer.domElement;
    if (this.disposed || this.menus.panelOpen || document.pointerLockElement === canvas
      || (!this.titleScene && !this.isSimulationActive())) return;
    this.menus.setCaptureError(false);
    this.resumeAudio();
    try {
      void canvas.requestPointerLock()?.catch(this.onPointerLockError);
    } catch {
      this.onPointerLockError();
    }
  };
  private readonly onCanvasClick = (): void => {
    if (!this.titleScene) this.requestControl();
  };
  private readonly damageOverlay = document.querySelector<HTMLElement>('#damage-overlay');
  private readonly damageEffectDuration = 0.4;
  private damageEffectRemaining = 0;

  // Facteur de réduction de résolution pour le rendu 3D rétro (divise par 3)
  private readonly retroScale = 3;
  private ambianceAudio: THREE.Audio | null = null;
  private readonly music: Music;
  private readonly soundEffects: SoundEffects;
  private bossMusic: MusicTrack | null = null;
  private hasEnteredManor = false;
  private readonly musicEnableButton = document.querySelector<HTMLButtonElement>('#music-enable');
  private readonly onAudioGesture = (): void => this.resumeAudio();
  private readonly audioMix = new AudioMix();
  private readonly footsteps: FootstepAudio;
  private readonly horrorDirector = new HorrorDirector();
  private stormController: StormController;
  private disposed = false;
  private readonly enemyVoiceBuffers: Partial<Record<ZombieKind, AudioBuffer>> = {};
  private readonly onZombieRise = (position: THREE.Vector3): void => this.soundEffects.play('zombie-rise', position);

  // Métriques de performance haute précision (raw delta, percentiles, combat vs pause)
  private perfTracker = new PerfTracker(300);
  private lastFrameTime = typeof performance !== 'undefined' ? performance.now() : 0;
  private tabBecameVisible = false;

  constructor(showTitle = false) {
    this.scene = new THREE.Scene();
    this.hitEffects = new HitEffects(this.scene);
    this.portraitParticles = new PortraitParticles(this.scene);
    this.portraitProjectileImpacts = new PortraitProjectileImpacts(this.scene);
    this.portraitProjectileEffects = {
      trail: (position, direction) => this.portraitParticles.trail(position, direction),
      impact: (position, normal) => {
        this.portraitParticles.impact(position, normal);
        this.portraitProjectileImpacts.impact(position, normal);
        this.soundEffects.play('portrait-blade-impact', position);
      },
    };

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
    this.menus = new GameMenus(this.requestControl, this.onAudioGesture);
    this.portraitAudio = new PortraitAudio(this.player.audioListener);
    const listener = this.player.audioListener;
    const audioLoader = new THREE.AudioLoader();
    this.soundEffects = new SoundEffects(listener, audioLoader);
    this.music = new Music(listener.context, listener.getInput());
    this.music.preload('menu', 'pause', 'main', 'defeat', 'victory');
    if (this.musicEnableButton) this.musicEnableButton.hidden = listener.context.state === 'running';
    this.musicEnableButton?.addEventListener('click', this.onAudioGesture);
    this.renderer.domElement.addEventListener('click', this.onCanvasClick);
    this.footsteps = new FootstepAudio(this.player.audioListener.context, this.player.audioListener.getInput());
    this.stormController = new StormController(
      this.level.getStormLights(),
      Math.random,
      () => this.player.audioListener.context.state === 'running',
    );
    this.titleScene = showTitle ? new TitleScene(this.level, this.stormController) : null;
    this.player.camera.visible = !this.titleScene;

    this.updateHealthDisplay();
    this.player.setOnFlashlightToggle((enabled) => {
      this.updateFlashlightDisplay(enabled);
    });
    this.updateFlashlightDisplay(this.player.isFlashlightOn());

    // Interaction du joueur avec le décor (touche E).
    this.player.setOnInteract(() => {
      const cameraDir = this.player.camera.getWorldDirection(new THREE.Vector3());

      // 1. Ramassage des armes offertes par les paliers purgés.
      if (this.pistolPickup.canInteract(this.player.camera.position, cameraDir)) {
        if (this.collectWeaponPickup('pistol')) return;
      }
      if (this.shotgunPickup.canInteract(this.player.camera.position, cameraDir)) {
        if (this.collectWeaponPickup('shotgun')) return;
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
          if (toggled) this.playDoorSound(door, door.getState() === 'OPENING' ? 'door-open' : 'door-close');
          else if (door.isLocked()) this.soundEffects.play('empty-soft');
          break;
        }
      }
    });

    document.querySelectorAll<HTMLButtonElement>('#game-over .restart-button, #victory .restart-button').forEach((button) => {
      button.addEventListener('click', () => this.restartRun());
    });
    this.summaryOpenButton?.addEventListener('click', () => this.openRunSummary());
    this.summaryDisplay?.querySelector('[data-summary-close]')?.addEventListener('click', () => this.closeRunSummary());
    this.summaryDisplay?.querySelector('[data-summary-restart]')?.addEventListener('click', () => this.restartRun());

    if (typeof window !== 'undefined') {
      (window as unknown as {
        __DEAD_SECTOR_PERF?: () => unknown;
        __DEAD_SECTOR_PERF_DETAILED?: () => unknown;
        __DEAD_SECTOR_START_TIER?: (tier: number) => void;
        __DEAD_SECTOR_DIAGNOSTICS?: () => unknown;
        __DEAD_SECTOR_DAMAGE_TARGET?: (amount?: number) => boolean;
      }).__DEAD_SECTOR_PERF = () => this.getPerformanceReport();
      (window as unknown as { __DEAD_SECTOR_PERF_DETAILED?: () => unknown }).__DEAD_SECTOR_PERF_DETAILED = () => this.getDetailedPerformanceReport();
      (window as unknown as { __DEAD_SECTOR_START_TIER?: (tier: number) => void }).__DEAD_SECTOR_START_TIER = (tier: number) => this.jumpToDebugTier(tier);
      (window as unknown as { __DEAD_SECTOR_DIAGNOSTICS?: () => unknown }).__DEAD_SECTOR_DIAGNOSTICS = () => this.getTierDiagnostics();
      (window as unknown as { __DEAD_SECTOR_DAMAGE_TARGET?: (amount?: number) => boolean }).__DEAD_SECTOR_DAMAGE_TARGET = (amount = 100) => {
        const target = this.zombies.find((z) => z.isAlive());
        if (!target) return false;
        target.takeDamage(amount);
        if (!target.isAlive()) this.onZombieKilled(target);
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

    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);

    this.setupAudioControls();

    // Ambiance sonore et audio spatial du manoir
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

    // Voix spatiales par famille, y compris pour un ennemi apparu pendant le chargement.
    for (const kind of Object.keys(enemyVoiceFiles) as ZombieKind[]) {
      audioLoader.load(`/assets/sounds/${enemyVoiceFiles[kind]}.wav`, (buffer) => {
        if (this.disposed) return;
        this.enemyVoiceBuffers[kind] = buffer;
        for (const zombie of this.zombies) {
          if (zombie.getKind() === kind) this.setupEnemyVoice(zombie);
        }
      }, undefined, (error) => console.warn('Chargement voix ennemie impossible', kind, error));
    }

    // Trousses de secours réparties dans le manoir.
    this.medkits = MANSION_PICKUPS
      .filter((p) => p.type === 'medkit')
      .map((m) => new Medkit(this.scene, m.x, m.z, m.value, this.level.getFloorHeightAt(m.x, m.z)));

    // Les munitions proviennent désormais des ennemis éliminés.
    this.ammoBoxes = [];

    // Récompenses inactives jusqu'aux purges P1 et P3, puis posées près du joueur.
    this.pistolPickup = new PistolPickup(this.scene);
    this.shotgunPickup = new ShotgunPickup(this.scene);
    this.pistolPickup.resetForNewRun();
    this.shotgunPickup.resetForNewRun();

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
      (target, damage, shot) => this.handleWeaponHit(target, damage, shot),
      () => this.isSimulationActive(),
      (amount) => this.player.setAimAmount(amount)
    );

    this.weapon.setOnImpact((impact) => this.hitEffects.emit(impact));
    this.weapon.setupMechanicalAudio(this.player.audioListener.context, this.player.audioListener.getInput());
    this.applyAudioMix();

    // Préchauffage des ressources graphiques partagées (Warmup standard, agile et cadavres)
    Zombie.warmup();
    SpitterZombie.warmup();
    CrawlerZombie.warmup();
    GuardianZombie.warmup();
    GuardianProjectile.warmup();
    PortraitProjectileImpacts.warmup();

    // Initialisation du premier palier
    this.startTier(1);
    this.setupDebugMenu();

    // Source unique de vérité pour les munitions : notification directe du HUD
    this.weapon.setOnAmmoChange(() => this.updateAmmoDisplay());
    this.updateAmmoDisplay();

    // Détonation, recul de caméra (View Punch) différencié et alerte sonore immédiate à t = 0
    this.weapon.setOnShoot((aimAmount, weaponId) => {
      this.tierDiagnostics?.recordShot(weaponId);
      if (weaponId === 'axe') return;
      this.hud.notifyShot();
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
        this.titleScene?.resize(window.innerWidth, window.innerHeight);

        this.updateResolution();
      }
    );

    // Préchauffage des shaders WebGL pour éviter le micro-gel de la première frame de rendu
    if (typeof this.renderer.compile === 'function') {
      try {
        this.renderer.compile(this.scene, this.titleScene?.camera ?? this.player.camera);
      } catch {
        // Ignorer en environnement de test sans contexte WebGL complet
      }
    }
    this.menus.setTitle(showTitle);
    if (this.pauseDisplay) this.pauseDisplay.hidden = showTitle;
  }

  private isSimulationActive(): boolean {
    return !this.titleScene && !this.menus?.panelOpen && !this.debugMenuOpen && !this.runSummaryOpen
      && (this.state === 'playing' || this.state === 'respite' || this.state === 'exploration' || this.state === 'terminal' || this.state === 'won');
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
    if (open && this.runSummaryOpen) this.closeRunSummary();
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
    this.debugRun = true;
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
    this.setupEnemyVoice(zombie);
    this.zombies.push(zombie);
    if (this.weapon) {
      this.weapon.setTargets(this.zombies.map((z) => z.getMesh()));
    }
    this.updateObjectiveDisplay();
    this.setDebugMenuOpen(false);
  }

  private jumpToDebugTier(tierNumber: number): void {
    if (!Number.isInteger(tierNumber) || !this.encounterConfigs[tierNumber - 1] || this.disposed) return;
    this.debugRun = true;
    this.runResult = null;
    this.runSummaryOpen = false;
    if (this.summaryDisplay) this.summaryDisplay.hidden = true;
    if (this.summaryOpenButton) this.summaryOpenButton.hidden = true;
    this.weapon.cancelReload();
    this.player.resetForDebug();
    this.footsteps?.reset();
    this.weaponMotion?.reset();
    for (const drop of this.ammoDrops) drop.dispose();
    this.ammoDrops = [];
    this.finaleSupplyLots = 0;
    for (const shell of this.shellCasings) shell.dispose();
    this.shellCasings = [];
    this.hitEffects.clear();
    this.hud?.clear();
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
      const frameDelta = Math.min(rawDeltaSec, 0.05);
      if (this.titleScene) {
        this.updateAudioMix(frameDelta);
        this.titleScene.update(frameDelta, !document.hidden && (document.hasFocus?.() ?? true));
        this.renderer.render(this.scene, this.titleScene.camera);
        return;
      }
      const delta = this.debugMenuOpen || this.runSummaryOpen || this.menus?.panelOpen ? 0 : frameDelta;
      const controlActive = this.isSimulationActive()
        && document.pointerLockElement === this.renderer.domElement
        && !document.hidden && (document.hasFocus?.() ?? true);
      const wasControlActive = this.wasControlActive;
      this.wasControlActive = controlActive;
      if (!controlActive && wasControlActive) this.portraitAudio?.stop();
      this.soundEffects?.setActive(controlActive);

      const isCombat = this.state === 'playing' && controlActive;
      this.perfTracker?.recordFrame(rawDeltaMs, isCombat, isTabSwitch);

      this.updateDamageEffect(delta);
      // Les réglages continuent de fondre dans le panneau de pause, sans avancer le combat.
      this.updateAudioMix(frameDelta);

      const stormActive = controlActive;
      this.stormController.update(delta, stormActive, this.player.camera.position, this.level.getStormWindowPositions());
      if (!stormActive) this.footsteps?.reset();

      // Mise à jour des systèmes en jeu, en phase de répit ou en exploration d'accès.
      if (controlActive) {
        if (wasControlActive && !isTabSwitch && (this.state === 'playing' || this.state === 'exploration' || this.state === 'respite')) this.runElapsedSeconds += rawDeltaSec;
        this.player.update(delta);
        this.footsteps?.update(delta, this.player.camera.position, stormActive);

        // Simulation des zombies pendant le combat actif
        if (this.state === 'playing') {
          if (wasControlActive && !isTabSwitch) this.tierDiagnostics?.advance(rawDeltaSec);
          this.hordeAlertTimer -= delta;
          if (this.hordeAlertTimer <= 0) {
            this.hordeAlertTimer = 0.75;
            for (const zombie of this.zombies) if (zombie.isAlive()) zombie.alert(this.player.camera.position);
          }
          this.updateProjectiles(delta);
          // Gestion échelonnée de la file d'apparition
          this.spawnCooldownTimer -= delta;
          this.advanceSpawnGroup(delta);
          const livingCount = this.zombies.filter((z) => z instanceof Zombie ? z.isThreat() : z.isAlive()).length;
          this.tierDiagnostics?.updateActiveThreats(livingCount);
          const activeLimit = Math.min(this.maxSimultaneousZombies, this.encounterConfigs[this.currentTier - 1]?.maxActiveZombies ?? this.maxSimultaneousZombies);
          if (this.state === 'playing' && this.player.isAlive()
            && this.spawnQueue > 0 && livingCount < activeLimit && this.spawnCooldownTimer <= 0) {
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
            if (zombie instanceof GuardianZombie) {
              zombie.update(delta, this.player.camera.position,
                this.zombies.filter((z): z is Zombie => z instanceof Zombie),
                (damage) => this.applyEnemyDamage(damage),
                (origin, target) => this.spitProjectiles.push(new GuardianProjectile(this.scene, origin, target, this.portraitProjectileEffects)));
              this.updateGuardianSupplies(delta, zombie);
              this.updateBossDisplay();
              continue;
            }
            if (zombie instanceof SpitterZombie) {
              zombie.update(delta, this.player.camera.position, this.zombies, (origin, target) => {
                this.soundEffects?.play('spit-launch', origin);
                this.spitProjectiles.push(new SpitProjectile(this.scene, origin, target,
                  (point) => this.soundEffects?.play('spit-impact', point)));
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
                (damage, isAnkleGrab) => this.applyEnemyDamage(damage, isAnkleGrab),
                {
                  isFlashlightOn: this.player.isFlashlightOn(),
                  cameraDirection: forward,
                }
              );
              continue;
            }
            zombie.update(delta, this.player.camera.position, this.zombies.filter((z): z is Zombie => z instanceof Zombie),
              (damage) => this.applyEnemyDamage(damage));
          }
        }
      }

      if (controlActive && this.state === 'exploration' && this.pendingTierStart > 0) {
        this.advanceRespite(delta);
      }

      this.portraitParticles?.update(controlActive && this.state === 'playing' ? delta : 0, this.player.camera);
      this.portraitProjectileImpacts?.update(controlActive && this.state === 'playing' ? delta : 0, this.player.camera);
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

      for (const door of this.level.getDoors()) {
        door.update(delta, occupants);
      }

      // Animation du carillon d'arène et des stèles d'offrandes
      this.encounterBell?.update(delta);
      for (const p of (this.upgradePedestals ?? [])) p.update(delta, this.player.camera.position);

      // Les gains et leurs notifications partagent le même contrôle effectif.
      const hudControlActive = controlActive && this.isSimulationActive();
      this.updatePickups(delta, hudControlActive);
      this.soundEffects?.setHeartbeat(hudControlActive && this.state !== 'won'
        && this.player.getHealth() <= this.player.getMaxHealth() * 0.25);
      this.hud.setPrompt(hudControlActive ? this.getInteractionPrompt() : null);
      this.hud.update(delta, hudControlActive);

      // Mise à jour de la balistique des douilles éjectées
      this.shellCasings = this.shellCasings.filter((casing) => casing.update(delta));
      const effectsDelta = controlActive ? delta : 0;
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

  private getInteractionPrompt(): HudPrompt | null {
    const position = this.player.camera.position;
    const direction = this.player.camera.getWorldDirection(new THREE.Vector3());
    if (this.pistolPickup?.canInteract(position, direction)) {
      return { key: 'E', action: 'RAMASSER', object: 'PISTOLET · ARME 2' };
    }
    if (this.shotgunPickup.canInteract(position, direction)) {
      return { key: 'E', action: 'RAMASSER', object: 'FUSIL À POMPE · ARME 3' };
    }
    // Ces dispositifs restent inactifs dans la boucle actuelle.
    if (this.state === 'exploration') {
      if (this.encounterBell.canInteract(position, direction)) {
        return { key: 'E', action: this.encounterBell.getPrompt().text.replace(/^\[E\]\s*/, '') };
      }
      const pedestal = this.upgradePedestals.find((entry) => entry.canInteract(position, direction));
      if (pedestal) return { key: 'E', action: pedestal.getPrompt().text.replace(/^\[E\]\s*/, '') };
    }
    const door = this.level.getDoors().find((entry) => entry.canInteract(position, direction));
    if (!door) return null;
    if (door.isLocked()) {
      const permanent = door.getType() === 'permanent_limit';
      return {
        action: permanent ? 'CONDAMNÉE' : 'VERROUILLÉE',
        object: permanent ? door.getName() : `${door.getName()} · après le palier ${door.getUnlockAfterTier()}`,
        locked: true,
      };
    }
    const closingAction = door.getState() === 'OPEN' || door.getState() === 'OPENING';
    return { key: 'E', action: closingAction ? 'FERMER' : 'OUVRIR', object: door.getName() };
  }

  private updatePickups(delta: number, controlActive: boolean): void {
    // Même garde que le déplacement, notamment pendant Échap, alt-tab et le bilan.
    if (!controlActive) return;
    const position = this.player.camera.position;
    this.pistolPickup?.update(delta, position);
    if (this.pistolPickup?.tryPickup(position, this.weapon)) {
      this.soundEffects?.play('pickup-weapon');
      this.recordWeaponGain('pistol', 0);
      this.updateAmmoDisplay();
      this.hud?.notifyWeapon('pistol');
    }
    this.shotgunPickup.update(delta, position);
    const shotgunBefore = this.weapon.getAmmoStocks().shotgun;
    if (this.shotgunPickup.tryPickup(position, this.weapon)) {
      this.soundEffects?.play('pickup-weapon');
      this.recordWeaponGain('shotgun', shotgunBefore.unlocked ? shotgunBefore.magazine + shotgunBefore.reserve : 0);
      this.updateAmmoDisplay();
      this.hud?.notifyWeapon('shotgun');
    }
    for (const medkit of [...this.medkits, ...(this.guardianMedkitDrops ?? [])]) {
      medkit.update(delta, position);
      const before = this.player.getHealth();
      if (medkit.tryPickup(this.player)) {
        this.soundEffects?.play('pickup-medkit');
        this.hud?.notifyGain('health', this.player.getHealth() - before);
        this.tierDiagnostics?.recordMedkit(this.player.getHealth() - before);
        this.updateHealthDisplay();
      }
    }
    for (const box of this.ammoBoxes) {
      box.update(delta, position);
      this.collectAmmoBox(box);
    }
    for (const box of this.ammoDrops) {
      box.update(delta, position);
      this.collectAmmoBox(box);
    }
    this.ammoDrops = this.ammoDrops.filter((box) => {
      if (!box.isConsumed()) return true;
      box.dispose();
      return false;
    });
    for (const box of this.guardianAmmoDrops ?? []) {
      box.update(delta, position);
      this.collectAmmoBox(box);
    }
    this.guardianAmmoDrops = (this.guardianAmmoDrops ?? []).filter((box) => {
      if (!box.isConsumed()) return true;
      box.dispose();
      return false;
    });
    this.guardianMedkitDrops = (this.guardianMedkitDrops ?? []).filter((medkit) => {
      if (!medkit.isConsumed()) return true;
      medkit.dispose();
      return false;
    });
  }

  private collectAmmoBox(box: AmmoBox): boolean {
    const kind = box.getWeaponType();
    const before = this.weapon.getReserveAmmoFor(kind);
    if (!box.tryPickup(this.player.camera.position, this.weapon)) return false;
    this.soundEffects?.play('pickup-ammo');
    const gained = this.weapon.getReserveAmmoFor(kind) - before;
    this.hud?.notifyGain(kind, gained);
    this.tierDiagnostics?.recordAmmoBox(kind, gained);
    this.updateAmmoDisplay();
    return true;
  }

  private recordWeaponGain(weaponId: FirearmId, before: number): void {
    const stock = this.weapon.getAmmoStocks()[weaponId];
    this.tierDiagnostics?.recordAmmoGain(weaponId, stock.magazine + stock.reserve - before);
  }

  private collectWeaponPickup(weaponId: FirearmId): boolean {
    const pickup = weaponId === 'pistol' ? this.pistolPickup : this.shotgunPickup;
    if (!pickup) return false;
    const stock = this.weapon.getAmmoStocks()[weaponId];
    if (!pickup.collect(this.weapon)) return false;
    this.soundEffects?.play('pickup-weapon');
    this.recordWeaponGain(weaponId, stock.unlocked ? stock.magazine + stock.reserve : 0);
    this.updateAmmoDisplay();
    this.hud?.notifyWeapon(weaponId);
    return true;
  }

  private offerProgressionWeapon(completedTier: number): string | null {
    const weaponId = completedTier === 1 ? 'pistol' : completedTier === 3 ? 'shotgun' : null;
    if (!weaponId) return null;
    const pickup = weaponId === 'pistol' ? this.pistolPickup : this.shotgunPickup;
    if (!pickup || this.weapon.isWeaponUnlocked(weaponId)) return null;
    const position = this.player.camera.position;
    const direction = this.player.camera.getWorldDirection(new THREE.Vector3());
    const angle = Math.atan2(direction.z, direction.x);
    const playerFloor = this.level.getFloorHeightAt(position.x, position.z);
    let chosen = { x: position.x, z: position.z, floor: playerFloor };
    // Même sol et chemin réel : ne pas poser la récompense derrière une porte ou à l'étage.
    search: for (const radius of [2, 2.5, 1.8]) {
      for (const offset of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
        const x = position.x + Math.cos(angle + offset) * radius;
        const z = position.z + Math.sin(angle + offset) * radius;
        const floor = this.level.getFloorHeightAt(x, z);
        if (Math.abs(floor - playerFloor) > 0.45 || this.level.isColliding(x, z, 0.3)) continue;
        const target = new THREE.Vector3(x, floor + 0.6, z);
        if (!this.level.hasLineOfSight(position, target)
          || !this.level.findNextWaypoint(target, position, 0.3)) continue;
        chosen = { x, z, floor };
        break search;
      }
    }
    pickup.activateAt(chosen.x, chosen.z, chosen.floor + 0.4);
    return weaponId === 'pistol' ? 'PISTOLET À PROXIMITÉ · ARME 2' : 'FUSIL À POMPE À PROXIMITÉ · ARME 3';
  }

  private ensureProgressionWeapons(tierNumber: number): string[] {
    const granted: string[] = [];
    for (const [weaponId, tier] of [['pistol', 2], ['shotgun', 4]] as const) {
      const pickup = weaponId === 'pistol' ? this.pistolPickup : this.shotgunPickup;
      if (!pickup || tierNumber < tier || this.weapon.isWeaponUnlocked(weaponId)) continue;
      const position = this.player.camera.position;
      const floor = this.level.getFloorHeightAt(position.x, position.z);
      pickup.activateAt(position.x, position.z, floor + 0.4);
      if (this.collectWeaponPickup(weaponId)) {
        granted.push(weaponId === 'pistol' ? 'PISTOLET ACQUIS · [2]' : 'FUSIL À POMPE ACQUIS · [3]');
      }
    }
    return granted;
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
    const records = this.tierDiagnostics?.getRecords() ?? [];
    const current = this.tierDiagnostics?.getCurrentRecord?.(this.weapon?.getAmmoStocks?.());
    return current ? [...records, current] : records;
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
    if (this.debugMenuOpen || this.runSummaryOpen) return;
    const animate = ((this.state === 'playing' || this.state === 'exploration' || this.state === 'terminal' || this.state === 'won' || this.state === 'respite')
        && document.pointerLockElement === this.renderer.domElement
        && !document.hidden && (document.hasFocus?.() ?? true));
    if (!animate) return;
    for (const zombie of this.zombies) {
      if (zombie instanceof Zombie) {
        zombie.updateDeath(delta, this.player.camera.position, this.onZombieRise);
        if (zombie.consumeJustRevived()) this.tierDiagnostics?.recordRevival(zombie.getKind());
      } else {
        zombie.updateDeath(delta, this.player.camera.position);
      }
      if (!zombie.isAlive()) this.onZombieKilled(zombie);
    }
  }

  private playDoorSound(door: Door, sound: 'door-open' | 'door-close'): void {
    if (!this.soundEffects) return;
    const { x, z } = door.getPosition();
    this.soundEffects.play(sound, new THREE.Vector3(x, this.level.getFloorHeightAt(x, z) + 1, z));
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
    if (zombie instanceof Zombie && zombie.isThreat()) return;
    const defeated = this.defeatedZombies ??= new WeakSet();
    if (defeated.has(zombie)) return;
    defeated.add(zombie);
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
    (this.completedTiers ??= new Set<number>()).add(this.currentTier);
    this.tierDiagnostics?.endTier(this.weapon?.getAmmoStocks?.());

    // 1. Déverrouiller la nouvelle aile accessible selon la rencontre validée
    const configs = this.encounterConfigs ?? (this as unknown as { tierCandidateSpawns?: EncounterSpec[] }).tierCandidateSpawns;
    const currentEncounter = configs?.[this.currentTier - 1];
    const unlockedNames: string[] = [];
    if (currentEncounter?.unlockSectorTier) {
      const doors = this.level.getDoors();
      for (const door of doors) {
        if (door.getUnlockAfterTier() === currentEncounter.unlockSectorTier) {
          if (door.isLocked()) unlockedNames.push(door.getName());
          door.unlock();
          if (door.getState() === 'CLOSED' && door.toggle()) this.playDoorSound(door, 'door-open');
        }
      }
    }

    // 2. Réarmement unique des ressources du décor (soins et munitions) pour l'exploration
    this.respawnPickups();

    if (unlockedNames.length > 0) this.soundEffects?.play('unlock-click');

    // Le bilan reste volontaire : terminer la finale ne libère pas la souris.
    const maxTiers = configs?.length ?? 4;
    if (this.currentTier >= maxTiers) {
      this.pendingTierStart = 0;
      this.respiteTimer = 0;
      this.encounterBell?.setActive(false);
      for (const pedestal of (this.upgradePedestals ?? [])) pedestal.close();
      this.endGame('won');
      return;
    }

    // 5. Transition directe et fluide vers l'exploration sécurisée (sans menu bloquant)
    this.pendingTierStart = this.currentTier + 1;
    this.state = 'exploration';
    this.encounterBell?.setActive(false);
    this.respiteTimer = 10;
    if (configs?.[this.pendingTierStart - 1]?.finalEncounter) this.prepareFinaleSupplies();
    const weaponNotice = this.offerProgressionWeapon(this.currentTier);
    this.hud?.announce(weaponNotice ?? (unlockedNames.length > 0
      ? `ACCÈS OUVERTS · ${unlockedNames.join(' · ')}`
      : 'PALIER PURGÉ · RÉCUPÉREZ VOS RESSOURCES'), weaponNotice ? 6 : 3);

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
    const configs = this.encounterConfigs ?? (this as unknown as { tierCandidateSpawns?: EncounterSpec[] }).tierCandidateSpawns;
    if (!Number.isInteger(tierNumber) || tierNumber < 1 || tierNumber > (configs?.length ?? 0)) return;
    this.clearGuardianSupplies();
    this.footsteps?.reset();
    this.weaponMotion?.reset();
    this.weapon?.suspendSoundEffects?.();
    this.soundEffects?.stop();
    this.weapon?.cancelMeleeAttack?.();
    this.currentTier = tierNumber;
    // Une récompense oubliée pendant l'accalmie ne doit pas bloquer la progression.
    const grantedWeapons = this.ensureProgressionWeapons(tierNumber);
    this.pendingTierStart = 0;
    this.respiteTimer = 0;
    this.horrorDirector?.resetRespite();
    const t0 = performance.now();
    this.tierAgileSpawned = 0;
    this.tierSpitterSpawned = 0;
    this.tierCrawlerSpawned = 0;
    this.tierStandardSpawned = 0;
    this.dropBudget = tierNumber === 1 || configs?.[tierNumber - 1]?.finalEncounter ? 0
      : Math.max(2, Math.ceil((configs?.[tierNumber - 1]?.totalZombies ?? 4) / 3));
    this.dropsMade = 0;
    this.killsThisTier = 0;
    this.defeatedZombies = new WeakSet();
    this.spawnGroupIndex = 0;
    this.groupRespiteRemaining = null;
    this.hordeAlertTimer = 0;
    this.lastSpawnQuadrant = -1;
    this.tierDiagnostics?.startTier(tierNumber, this.weapon?.getAmmoStocks?.());
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
    this.portraitParticles?.clear();
    this.portraitAudio?.stop();
    this.portraitProjectileImpacts?.clear();
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
    this.bossMusic = config?.finalEncounter ? 'boss1' : null;
    if (this.bossMusic) this.music?.rewind('boss1', 'transformation', 'boss2');
    if (this.bossMusic || configs?.[tierNumber]?.finalEncounter) {
      this.music?.preload('boss1', 'transformation', 'boss2');
    }
    this.syncMusic();
    if (config?.finalEncounter) this.prepareFinaleSupplies();
    // Une nouvelle rencontre remplace les retours de la précédente.
    this.hud?.clear();
    if (config?.finalEncounter) this.hud?.announce('DERNIÈRE RENCONTRE · LE MAÎTRE DU PORTRAIT');
    else if (grantedWeapons.length > 0) this.hud?.announce(grantedWeapons.join(' · '), 5);
    this.updateObjectiveDisplay();
    this.updateBossDisplay();
    this.perfTracker?.recordTransition(tierNumber, performance.now() - t0);
  }

  private getSpawnQuota(config: EncounterSpec): Record<ZombieKind, number> {
    const quota = {
      standard: Math.max(0, config.totalZombies - config.maxAgile - config.maxSpitter - (config.maxCrawler ?? 0)),
      agile: config.maxAgile, spitter: config.maxSpitter, crawler: config.maxCrawler ?? 0,
    };
    if (!config.spawnGroups) return quota;
    for (const kind of Object.keys(quota) as ZombieKind[]) quota[kind] = 0;
    for (const group of config.spawnGroups.slice(0, (this.spawnGroupIndex ?? 0) + 1)) {
      for (const kind of Object.keys(quota) as ZombieKind[]) quota[kind] += group[kind];
    }
    return quota;
  }

  private advanceSpawnGroup(delta: number): void {
    if (this.state !== 'playing') return;
    const config = this.encounterConfigs[this.currentTier - 1];
    const groups = config?.spawnGroups;
    const index = this.spawnGroupIndex ?? 0;
    if (!groups || index >= groups.length - 1 || delta <= 0) return;
    const groupTotal = Object.values(this.getSpawnQuota(config)).reduce((sum, count) => sum + count, 0);
    if (config.totalZombies - this.spawnQueue < groupTotal || this.killsThisTier < groupTotal) return;
    if (this.groupRespiteRemaining == null) {
      this.groupRespiteRemaining = groups[index].pauseAfterSeconds ?? 0;
      this.hud?.announce('UNE COURTE ACCALMIE · RECHARGEZ', 3);
      return;
    }
    this.groupRespiteRemaining = Math.max(0, this.groupRespiteRemaining - delta);
    if (this.groupRespiteRemaining === 0) {
      this.spawnGroupIndex = index + 1;
      this.groupRespiteRemaining = null;
      this.spawnCooldownTimer = 0;
      this.hud?.announce('LE MANOIR SE RÉVEILLE · RENFORTS', 2);
    }
  }

  public trySpawnZombie(): boolean {
    const t0 = performance.now();
    const configs = this.encounterConfigs ?? (this as unknown as { tierCandidateSpawns?: EncounterSpec[] }).tierCandidateSpawns;
    const config = configs?.[this.currentTier - 1];
    if (!config || this.spawnQueue <= 0) return false;
    const playerPos = this.player.camera.position;
    const cameraDir = this.player.camera.getWorldDirection(new THREE.Vector3());
    const living = this.zombies.filter((z) => z.isAlive());
    const threats = this.zombies.filter((z) => z instanceof Zombie ? z.isThreat() : z.isAlive()).length;
    const activeLimit = Math.min(this.maxSimultaneousZombies ?? 8, config.maxActiveZombies);
    if (threats >= activeLimit) return false;
    const quota = this.getSpawnQuota(config);
    const spawned = {
      standard: this.tierStandardSpawned ?? 0, agile: this.tierAgileSpawned ?? 0,
      spitter: this.tierSpitterSpawned ?? 0, crawler: this.tierCrawlerSpawned ?? 0,
    };
    const remaining = (kind: ZombieKind) => Math.max(0, quota[kind] - spawned[kind]);
    const aliveAgile = this.zombies.filter((z) => z instanceof Zombie && z.getKind() === 'agile' && z.isThreat()).length;
    const unlocked = (kind: 'agile' | 'spitter' | 'crawler') => (this.killsThisTier ?? 0) >= (config.spawnUnlocks?.[kind] ?? 0);
    const canAgile = remaining('agile') > 0 && aliveAgile < config.maxSimultaneousAgile && unlocked('agile');
    const canSpitter = remaining('spitter') > 0 && unlocked('spitter')
      && living.filter((z) => z.getKind() === 'spitter').length < config.maxSimultaneousSpitter;
    const canCrawler = remaining('crawler') > 0 && unlocked('crawler')
      && living.filter((z) => z.getKind() === 'crawler').length < (config.maxSimultaneousCrawler ?? 2);
    // Un Coureur reste reserve pour chaque Cracheur encore attendu.
    const canSoloAgile = canAgile && remaining('agile') > remaining('spitter');
    const canStandard = remaining('standard') > 0;
    const order: ZombieKind[] = [];
    if (canSpitter && canAgile && this.spawnQueue >= 2 && threats + 2 <= activeLimit) order.push('spitter');
    if (canCrawler && (spawned.crawler <= spawned.agile || !canSoloAgile)) order.push('crawler');
    if (canSoloAgile && (!canStandard || spawned.agile <= spawned.standard)) order.push('agile');
    if (canStandard) order.push('standard');
    if (canSoloAgile && !order.includes('agile')) order.push('agile');
    if (canCrawler && !order.includes('crawler')) order.push('crawler');

    interface Candidate { x: number; z: number; floor: number; score: number; quadrant: number }
    const quadrants = [0, 0, 0, 0];
    const quadrantOf = (dx: number, dz: number) => Math.floor(((Math.atan2(dz, dx) + Math.PI + Math.PI / 4) % (2 * Math.PI)) / (Math.PI / 2)) % 4;
    for (const other of living) {
      const pos = other.getPosition();
      quadrants[quadrantOf(pos.x - playerPos.x, pos.z - playerPos.z)]++;
    }
    const candidates: Candidate[] = [];
    const pool = config.spawnPool ?? (config as unknown as { pool: Point2D[] }).pool;
    for (const point of pool) {
      if (this.level.isColliding(point.x, point.z, 0.45)) continue;
      if (point.x < config.sectorBounds.minX || point.x > config.sectorBounds.maxX
        || point.z < config.sectorBounds.minZ || point.z > config.sectorBounds.maxZ) continue;
      const dx = point.x - playerPos.x, dz = point.z - playerPos.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 6 || living.some((other) => Math.hypot(other.getPosition().x - point.x, other.getPosition().z - point.z) < 1.8)) continue;
      const floor = this.level.getFloorHeightAt(point.x, point.z);
      const position = new THREE.Vector3(point.x, floor + 1, point.z);
      const dot = (dx * cameraDir.x + dz * cameraDir.z) / distance;
      const visible = this.level.hasLineOfSight(playerPos, position);
      if (dot > 0.45 && visible) continue;
      if (!this.level.findNextWaypoint(position, playerPos, 0.4)) continue;
      const quadrant = quadrantOf(dx, dz);
      const score = Math.max(0, 24 - distance) * 2 + (!visible ? 5 : 0) + (dot <= 0 ? 2 : 0)
        + (quadrants[quadrant] === 0 ? 4 : quadrants[quadrant] === 1 ? 1 : -3)
        + (this.lastSpawnQuadrant >= 0 && quadrant !== this.lastSpawnQuadrant ? 2 : 0);
      candidates.push({ ...point, floor, score, quadrant });
    }
    candidates.sort((a, b) => b.score - a.score);
    for (const kind of order) {
      const eligible = kind === 'spitter' && this.currentTier === 3
        ? candidates.filter((c) => c.floor >= 2) : candidates;
      if (eligible.length === 0) continue;
      let chosen = eligible[Math.floor(Math.random() * Math.min(5, eligible.length))];
      let escort: Candidate | undefined;
      if (kind === 'spitter') {
        for (const candidate of eligible) {
          const partner = eligible.find((other) => {
            const distance = Math.hypot(other.x - candidate.x, other.z - candidate.z);
            return distance >= 2 && distance <= 8 && Math.abs(other.floor - candidate.floor) < 1
              && this.level.hasLineOfSight(new THREE.Vector3(candidate.x, candidate.floor + 1, candidate.z),
                new THREE.Vector3(other.x, other.floor + 1, other.z));
          });
          if (partner) { chosen = candidate; escort = partner; break; }
        }
        if (!escort) continue;
      }
      this.lastSpawnQuadrant = chosen.quadrant;
      const zombie = kind === 'spitter' ? new SpitterZombie(this.scene, this.level, chosen.x, chosen.z)
        : kind === 'crawler' ? new CrawlerZombie(this.scene, this.level, chosen.x, chosen.z)
        : config.finalEncounter ? new GuardianZombie(this.scene, this.level, chosen.x, chosen.z,
          { cue: (event) => this.onPortraitCue(event) })
        : new Zombie(this.scene, this.level, chosen.x, chosen.z, kind);
      if (kind === 'standard') this.tierStandardSpawned = spawned.standard + 1;
      else if (kind === 'agile') this.tierAgileSpawned = spawned.agile + 1;
      else if (kind === 'spitter') this.tierSpitterSpawned = spawned.spitter + 1;
      else this.tierCrawlerSpawned = spawned.crawler + 1;
      zombie.alert(playerPos);
      this.setupEnemyVoice(zombie);
      this.zombies.push(zombie);
      this.tierDiagnostics?.recordSpawn(kind, threats + 1);
      if (escort) {
        const runner = new Zombie(this.scene, this.level, escort.x, escort.z, 'agile');
        runner.alert(playerPos);
        this.setupEnemyVoice(runner);
        this.zombies.push(runner);
        this.tierAgileSpawned = spawned.agile + 1;
        this.spawnQueue--;
        this.tierDiagnostics?.recordSpawn('agile', threats + 2);
      }
      this.weapon?.setTargets(this.zombies.map((z) => z.getMesh()));
      this.updateBossDisplay();
      this.perfTracker?.recordSpawn(performance.now() - t0);
      this.perfTracker?.recordPathfinding(this.level.getLastPathfindingDurationMs?.() ?? 0);
      return true;
    }
    this.perfTracker?.recordSpawn(performance.now() - t0);
    this.perfTracker?.recordPathfinding(this.level.getLastPathfindingDurationMs?.() ?? 0);
    return false;
  }

  private prepareFinaleSupplies(): void {
    if ((this.finaleSupplyLots ?? 0) >= 3) return;
    const position = this.player.camera.position;
    const points: Point2D[] = [];
    for (const radius of [2, 3.5, 5]) {
      for (let i = 0; i < 8; i++) points.push({ x: position.x + Math.cos(i * Math.PI / 4) * radius,
        z: position.z + Math.sin(i * Math.PI / 4) * radius });
    }
    points.push(...(this.encounterConfigs.find((config) => config.finalEncounter)?.spawnPool ?? []));
    const chosen: Point2D[] = [];
    for (const point of points) {
      if (this.level.isColliding(point.x, point.z, 0.45)
        || chosen.some((other) => Math.hypot(other.x - point.x, other.z - point.z) < 1.5)) continue;
      const floor = this.level.getFloorHeightAt(point.x, point.z);
      if (!this.level.findNextWaypoint(new THREE.Vector3(point.x, floor + 1, point.z), position, 0.4)) continue;
      this.ammoDrops.push(new AmmoBox(this.scene, point.x, point.z, 20, 'pistol', floor));
      this.finaleSupplyLots = (this.finaleSupplyLots ?? 0) + 1;
      chosen.push(point);
      if (this.finaleSupplyLots === 3) break;
    }
    if (chosen.length > 0) this.hud?.announce('LA TOILE REMUE · MUNITIONS À PROXIMITÉ', 4);
  }

  private updateGuardianSupplies(delta: number, boss: GuardianZombie): void {
    if (this.state !== 'playing' || !boss.isAlive() || !this.player.isAlive()
      || !this.encounterConfigs[this.currentTier - 1]?.finalEncounter
      || this.debugMenuOpen || this.runSummaryOpen || document.hidden
      || document.pointerLockElement !== this.renderer.domElement || !(document.hasFocus?.() ?? true)
      || !Number.isFinite(delta) || delta <= 0) return;
    // Même temps plafonné que l'IA : un retour de pause ne produit jamais une rafale de lots.
    const activeDelta = Math.min(delta, 0.05);
    this.guardianSupplyElapsed = (this.guardianSupplyElapsed ?? 0) + activeDelta;
    this.guardianHealthSupplyElapsed = (this.guardianHealthSupplyElapsed ?? 0) + activeDelta;
    if (this.guardianSupplyElapsed + 1e-8 < guardianConfig.supplyInterval) return;
    this.guardianSupplyElapsed = Math.max(0, this.guardianSupplyElapsed - guardianConfig.supplyInterval);
    const healthDue = this.guardianHealthSupplyElapsed + 1e-8 >= guardianConfig.healthSupplyInterval;
    if (healthDue) this.guardianHealthSupplyElapsed = Math.max(0,
      this.guardianHealthSupplyElapsed - guardianConfig.healthSupplyInterval);
    const ammoDrops = this.guardianAmmoDrops ??= [];
    const medkitDrops = this.guardianMedkitDrops ??= [];
    const origin = boss.getPosition();
    const originFloor = this.level.getFloorHeightAt(origin.x, origin.z);
    const playerPosition = this.player.camera.position;
    const rotation = (this.guardianSupplyIndex ?? 0) * 0.7;
    this.guardianSupplyIndex = (this.guardianSupplyIndex ?? 0) + 1;
    const points: Array<Point2D & { floor: number }> = [];
    for (const radius of [1.3, 2, 2.8]) {
      for (let i = 0; i < 8; i++) {
        const angle = Math.atan2(playerPosition.z - origin.z, playerPosition.x - origin.x) + rotation + i * Math.PI / 4;
        const x = origin.x + Math.cos(angle) * radius, z = origin.z + Math.sin(angle) * radius;
        const floor = this.level.getFloorHeightAt(x, z);
        if (this.level.isColliding(x, z, 0.4) || Math.abs(floor - originFloor) > 0.7
          || !this.level.findNextWaypoint(new THREE.Vector3(x, floor + 1, z), playerPosition, 0.4)) continue;
        points.push({ x, z, floor });
      }
    }
    const chosen: Point2D[] = [];
    const nextPoint = () => {
      const point = points.find((candidate) => chosen.every((other) => Math.hypot(candidate.x - other.x, candidate.z - other.z) >= 0.9));
      if (point) chosen.push(point);
      return point;
    };
    let created = false;
    for (const kind of ['pistol', 'shotgun'] as const) {
      if (!this.weapon.isWeaponUnlocked(kind)
        || ammoDrops.filter((box) => !box.isConsumed() && box.getWeaponType() === kind).length >= guardianConfig.maxSupplyAmmoPerType) continue;
      const point = nextPoint();
      if (!point) continue;
      ammoDrops.push(new AmmoBox(this.scene, point.x, point.z,
        kind === 'pistol' ? guardianConfig.supplyPistolAmmo : guardianConfig.supplyShotgunAmmo, kind, point.floor));
      this.tierDiagnostics?.recordAmmoDrop();
      created = true;
    }
    if (healthDue && this.player.getHealth() <= guardianConfig.supplyHealthThreshold
      && medkitDrops.filter((medkit) => !medkit.isConsumed()).length < guardianConfig.maxSupplyMedkits) {
      const point = nextPoint();
      if (point) {
        medkitDrops.push(new Medkit(this.scene, point.x, point.z, guardianConfig.supplyHealth, point.floor));
        created = true;
      }
    }
    if (created) this.hud?.announce('LE CADRE S\u2019EFFRITE · RESSOURCES AU SOL', 3);
  }

  private clearGuardianSupplies(): void {
    for (const drop of this.guardianAmmoDrops ?? []) drop.dispose();
    for (const medkit of this.guardianMedkitDrops ?? []) medkit.dispose();
    this.guardianAmmoDrops = [];
    this.guardianMedkitDrops = [];
    this.guardianSupplyElapsed = 0;
    this.guardianHealthSupplyElapsed = 0;
    this.guardianSupplyIndex = 0;
  }

  private setupEnemyVoice(zombie: Zombie | SpitterZombie | CrawlerZombie): void {
    const buffer = this.enemyVoiceBuffers?.[zombie.getKind()];
    if (buffer && !(zombie instanceof GuardianZombie)) {
      zombie.setupAudio(this.player.audioListener, buffer, this.getEffectsVolume());
    }
  }

  private applyEnemyDamage(damage: number, isAnkleGrab = false): void {
    if (this.state !== 'playing' || !this.player.isAlive()) return;
    const before = this.player.getHealth();
    this.player.takeDamage(damage);
    if (isAnkleGrab) this.player.applyAnkleGrab(0.75, 0.4, 0.28);
    this.tierDiagnostics?.recordDamageTaken(before - this.player.getHealth());
    if (this.player.getHealth() < before) {
      if (this.player.isAlive()) this.soundEffects?.playPlayerHurt();
      this.damageEffectRemaining = this.damageEffectDuration;
      if (this.damageOverlay) this.damageOverlay.style.opacity = '1';
    }
    this.updateHealthDisplay();
    if (!this.player.isAlive()) this.endGame('lost');
  }

  private updateProjectiles(delta: number): void {
    const projectiles = this.spitProjectiles;
    this.spitProjectiles = [];
    for (const projectile of projectiles) {
      if (this.state === 'playing' && projectile.update(delta, this.scene, this.level,
        this.player.camera.position, (damage) => this.applyEnemyDamage(damage))) {
        this.spitProjectiles.push(projectile);
      } else {
        projectile.dispose(this.scene);
      }
    }
  }

  private handleWeaponHit(target: THREE.Mesh, damage: number, shot: ShotDamage): void {
    const zombie = this.zombies.find(candidate => candidate.getMesh() === target);
    if (zombie) {
      const wasAlive = zombie.isAlive();
      const bossHealthBefore = zombie instanceof GuardianZombie ? zombie.getHealth() : 0;
      const headDamage = shot.headDamage ?? shot.headHits * (shot.weaponId === 'pistol' ? 80 : 24);
      const appliedDamage = zombie instanceof GuardianZombie && !zombie.isMaskExposed()
        ? Math.max(0, damage - Math.min(damage, headDamage) * 0.5) : damage;
      zombie.takeDamage(appliedDamage, shot.headHits > 0, shot.impactForce, shot.impact);
      if (shot.stunSeconds) zombie.stun(shot.stunSeconds);
      this.tierDiagnostics?.recordHit(shot.headHits, shot.bodyHits, shot.weaponId);
      if (wasAlive && !zombie.isAlive()) {
        if (!(zombie instanceof GuardianZombie)) this.soundEffects?.play('zombie-death', zombie.getPosition());
        this.onZombieKilled(zombie);
      } else if (wasAlive && appliedDamage > 0 && !(zombie instanceof GuardianZombie)) {
        this.soundEffects?.play('zombie-hurt', zombie.getPosition());
      }
      if (!(zombie instanceof GuardianZombie) || zombie.getHealth() < bossHealthBefore) {
        this.tierDiagnostics?.recordDamageDealt();
      }
    }
    this.checkTierCompletion();
    this.updateObjectiveDisplay();
  }

  private onPortraitCue(event: PortraitCue): void {
    if (event.kind === 'cancel') {
      this.portraitParticles?.clear();
      this.portraitAudio?.stop();
      this.portraitProjectileImpacts?.clear();
      return;
    }
    if (this.disposed || this.state !== 'playing') return;
    if (this.bossMusic && (event.kind === 'transform-start' || event.kind === 'transform-end')) {
      this.bossMusic = event.kind === 'transform-start' ? 'transformation' : 'boss2';
      this.syncMusic();
    }
    if (event.kind === 'release' && event.attack === 'blades') {
      this.soundEffects?.play('portrait-blade-launch', event.position);
    } else if (event.kind === 'prepare' && event.attack) {
      this.portraitParticles?.prepare(event.position, event.direction, event.attack);
    } else if (event.kind === 'transform-start' || event.kind === 'transform-burst') {
      const stage = event.kind === 'transform-start' ? 'gather' : 'burst';
      this.portraitParticles?.transformation(event.position, stage);
      this.portraitAudio?.play(stage, event.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    }
  }

  private updateBossDisplay(): void {
    const boss = this.zombies.find((z): z is GuardianZombie => z instanceof GuardianZombie && z.isAlive());
    this.hud?.setBoss?.(this.state === 'playing' && boss
      ? { health: boss.getHealth(), maxHealth: boss.getMaxHealth(), phase: boss.getPhase(),
        attack: boss.getState() === 'ATTACK' ? boss.getAttackKind() : null,
        recovering: boss.getState() === 'RECOVER' && !boss.isComboTransition() && !boss.isTransforming(),
        transforming: boss.isTransforming(), comboTransition: boss.isComboTransition(),
        maskExposed: boss.isMaskExposed(), volleyIndex: boss.getVolleyIndex(), frameResisting: boss.isFrameResisting() } : null);
  }

  private updateObjectiveDisplay(): void {
    this.updateBossDisplay();
    const livingZombies = this.zombies.filter((z) => z instanceof Zombie ? z.isThreat() : z.isAlive()).length;
    const encounter = this.encounterConfigs?.[this.currentTier - 1];
    this.hud?.setProgression({
      phase: this.state === 'playing' ? 'combat'
        : this.state === 'exploration' || this.state === 'respite' ? 'respite' : this.state,
      tier: this.currentTier,
      total: this.encounterConfigs?.length ?? 0,
      sector: encounter?.finalEncounter ? 'FINALE · LE MAÎTRE DU PORTRAIT' : encounter?.sectorName ?? `SECTEUR ${this.currentTier}`,
      remaining: livingZombies + this.spawnQueue,
      respiteSeconds: this.respiteTimer,
    });
  }

  private updateAmmoDisplay(): void {
    this.hud?.setAmmo(this.weapon.getAmmoState(), this.weapon.isWeaponUnlocked('shotgun'), this.weapon.isWeaponUnlocked('pistol'));
  }

  private updateHealthDisplay(): void {
    this.hud?.setHealth(this.player.getHealth(), this.player.getMaxHealth());
  }

  private updateFlashlightDisplay(enabled: boolean): void {
    this.hud?.setFlashlight(enabled);
  }

  private endGame(result: 'won' | 'lost'): void {
    if (this.state !== 'playing' && this.state !== 'respite' && this.state !== 'exploration') return;
    this.tierDiagnostics?.endTier(this.weapon?.getAmmoStocks?.());
    this.state = result;
    this.runResult = result;
    this.soundEffects?.setHeartbeat(false);
    this.music?.rewind(result === 'won' ? 'victory' : 'defeat');
    this.pendingTierStart = 0;
    this.respiteTimer = 0;
    for (const projectile of (this.spitProjectiles ?? [])) projectile.dispose(this.scene);
    this.spitProjectiles = [];
    this.portraitParticles?.clear();
    this.portraitAudio?.stop();
    this.portraitProjectileImpacts?.clear();
    this.weapon.cancelReload();
    this.hud?.clear();
    this.updateObjectiveDisplay();
    if (this.promptDisplay) this.promptDisplay.hidden = true;
    if (this.victoryDisplay) this.victoryDisplay.hidden = true;
    if (this.summaryOpenButton) this.summaryOpenButton.hidden = false;
    this.horrorDirector?.suspend();
    for (const zombie of this.zombies) zombie.stopAudio();
    if (result === 'won') {
      if (this.gameOverDisplay) this.gameOverDisplay.hidden = true;
      if (this.pauseDisplay) this.pauseDisplay.hidden = document.pointerLockElement === this.renderer.domElement;
      this.syncAmbientAudio();
      return;
    }
    if (this.pauseDisplay) this.pauseDisplay.hidden = true;
    if (this.ambianceAudio && this.ambianceAudio.isPlaying) {
      this.ambianceAudio.stop();
    }
    if (this.gameOverDisplay) this.gameOverDisplay.hidden = false;
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.syncAmbientAudio();
  }

  public getRunSummary() {
    const records = this.tierDiagnostics?.getRecords?.() ?? [];
    return {
      result: this.runResult ?? null,
      elapsedSeconds: Math.round(this.runElapsedSeconds ?? 0),
      completedTiers: this.completedTiers?.size ?? 0,
      totalTiers: this.encounterConfigs.length,
      shotsFired: records.reduce((sum, record) => sum + record.shotsFired, 0),
      headHits: records.reduce((sum, record) => sum + record.headHits, 0),
      bodyHits: records.reduce((sum, record) => sum + record.bodyHits, 0),
      damageTaken: records.reduce((sum, record) => sum + record.damageTaken, 0),
      debugUsed: this.debugRun ?? false,
    };
  }

  public openRunSummary(): void {
    if (!this.runResult || !this.summaryDisplay || this.disposed || this.runSummaryOpen) return;
    if (this.debugMenuOpen) this.setDebugMenuOpen(false);
    const summary = this.getRunSummary();
    const minutes = Math.floor(summary.elapsedSeconds / 60);
    const seconds = String(summary.elapsedSeconds % 60).padStart(2, '0');
    const values: Record<string, string> = {
      duration: `${minutes}:${seconds}`,
      tiers: `${summary.completedTiers} / ${summary.totalTiers}`,
      shots: String(summary.shotsFired),
      hits: `${summary.headHits} tête · ${summary.bodyHits} corps`,
      damage: `${summary.damageTaken} PV`,
      mode: summary.debugUsed ? 'Essai avec sauts debug' : 'Tentative normale',
    };
    const title = this.summaryDisplay.querySelector<HTMLElement>('#run-summary-title');
    if (title) title.textContent = this.runResult === 'won' ? 'LE MANOIR EST PURGÉ' : 'TENTATIVE INTERROMPUE';
    const hint = this.summaryDisplay.querySelector<HTMLElement>('[data-summary-hint]');
    if (hint) hint.textContent = this.runResult === 'won'
      ? "Fermez le bilan puis cliquez dans le jeu pour reprendre l'exploration."
      : 'Lancez une nouvelle tentative pour retourner dans le manoir.';
    for (const field of this.summaryDisplay.querySelectorAll<HTMLElement>('[data-run-stat]')) {
      field.textContent = values[field.dataset.runStat ?? ''] ?? '—';
    }
    this.runSummaryOpen = true;
    this.summaryDisplay.hidden = false;
    this.weapon.cancelReload();
    if (this.pauseDisplay) this.pauseDisplay.hidden = true;
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.syncAmbientAudio();
    this.summaryDisplay.querySelector<HTMLButtonElement>('[data-summary-close]')?.focus();
  }

  public closeRunSummary(): void {
    if (!this.runSummaryOpen) return;
    this.runSummaryOpen = false;
    if (this.summaryDisplay) this.summaryDisplay.hidden = true;
    if (this.pauseDisplay) this.pauseDisplay.hidden = !this.isSimulationActive() || document.pointerLockElement === this.renderer.domElement;
    this.syncAmbientAudio();
    if (this.state === 'lost') this.gameOverDisplay?.querySelector<HTMLButtonElement>('.restart-button')?.focus();
    else this.summaryOpenButton?.focus();
  }

  public restartRun(): void {
    if (this.disposed) return;
    this.runSummaryOpen = false;
    this.debugMenuOpen = false;
    for (const display of [this.summaryDisplay, this.debugDisplay, this.gameOverDisplay, this.victoryDisplay]) {
      if (display) display.hidden = true;
    }
    if (this.summaryOpenButton) this.summaryOpenButton.hidden = true;
    for (const drop of this.ammoDrops) drop.dispose();
    for (const shell of this.shellCasings) shell.dispose();
    this.ammoDrops = [];
    this.finaleSupplyLots = 0;
    this.shellCasings = [];
    this.hitEffects.clear();
    this.appliedUpgrades = [];
    this.player.resetForNewRun();
    this.weapon.resetForNewRun();
    this.pistolPickup?.resetForNewRun();
    this.shotgunPickup.resetForNewRun();
    for (const door of this.level.getDoors()) door.resetForNewRun();
    this.tierDiagnostics.clear();
    this.completedTiers = new Set<number>();
    this.runElapsedSeconds = 0;
    this.wasControlActive = false;
    this.runResult = null;
    this.debugRun = false;
    this.damageEffectRemaining = 0;
    if (this.damageOverlay) this.damageOverlay.style.opacity = '0';
    this.stormController.resetForNewRun();
    this.state = 'playing';
    this.music?.rewind('main', 'pause', 'defeat', 'victory');
    this.startTier(1);
    this.updateHealthDisplay();
    this.updateAmmoDisplay();
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    if (this.pauseDisplay) this.pauseDisplay.hidden = false;
    this.syncAmbientAudio();
  }

  private updateDamageEffect(delta: number): void {
    if (this.damageEffectRemaining <= 0) return;
    this.damageEffectRemaining = Math.max(0, this.damageEffectRemaining - delta);
    if (this.damageOverlay) {
      this.damageOverlay.style.opacity = String(this.damageEffectRemaining / this.damageEffectDuration);
    }
  }

  private resumeAudio(): void {
    if (this.disposed) return;
    void this.player.audioListener.context.resume().then(() => {
      if (this.musicEnableButton) this.musicEnableButton.hidden = true;
    }).catch((error: unknown) => {
      console.warn('Activation audio impossible :', error);
    });
  }

  private syncMusic(): void {
    if (!this.music || this.disposed) return;
    const focused = !document.hidden && (document.hasFocus?.() ?? true);
    const active = focused && this.isSimulationActive() && document.pointerLockElement === this.renderer.domElement;
    if (active) this.hasEnteredManor = true;
    let track: MusicTrack;
    if (this.state === 'lost') track = 'defeat';
    else if (this.state === 'won') track = 'victory';
    else if (active) track = this.bossMusic ?? 'main';
    else track = this.hasEnteredManor || this.debugMenuOpen ? 'pause' : 'menu';
    this.music.select(track, focused);
  }

  private syncAmbientAudio(): void {
    if (this.disposed) return;
    const focused = !document.hidden && (document.hasFocus?.() ?? true);
    const active = focused && this.isSimulationActive() && document.pointerLockElement === this.renderer.domElement;
    this.syncMusic();
    this.soundEffects?.setActive(active);
    if (active) {
      this.resumeAudio();
      if (this.ambianceAudio && !this.ambianceAudio.isPlaying) this.ambianceAudio.play();
    } else {
      this.wasControlActive = false;
      if (this.ambianceAudio?.isPlaying) this.ambianceAudio.pause();
      this.horrorDirector?.suspend();
      if (!this.titleScene || !focused) this.stormController?.suspend();
      this.footsteps?.reset();
      this.weaponMotion?.reset();
      this.weapon?.suspendSoundEffects?.();
      this.player?.suspendFlashlightAudio?.();
      this.portraitAudio?.stop();
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
    this.music?.setVolume(this.audioMix.getVolume('music'), this.audioMix.getMusicPresence());
    this.soundEffects?.setVolume(effects);
    this.weapon.setEffectsVolume(effects);
    this.player.setEffectsVolume(effects);
    this.footsteps?.setVolume(effects);
    this.portraitAudio?.setVolume(effects);
    this.encounterBell.setEffectsVolume(effects);
    for (const zombie of this.zombies) zombie.setAudioVolume(effects);
  }

  public dispose(): void {
    this.disposed = true;
    this.titleScene?.dispose();
    this.menus?.dispose();
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    this.clearGuardianSupplies();
    this.hud?.dispose();
    window.removeEventListener('keydown', this.onDebugKeyDown);
    this.debugDisplay?.removeEventListener('click', this.onDebugClick);
    if (this.debugDisplay) this.debugDisplay.hidden = true;
    if (this.ambianceAudio?.isPlaying) this.ambianceAudio.stop();
    this.music?.dispose();
    this.soundEffects?.dispose();
    this.player?.suspendFlashlightAudio?.();
    this.musicEnableButton?.removeEventListener('click', this.onAudioGesture);
    this.renderer.domElement.removeEventListener?.('click', this.onCanvasClick);
    for (const drop of (this.ammoDrops ?? [])) drop.dispose();
    this.ammoDrops = [];
    for (const projectile of (this.spitProjectiles ?? [])) projectile.dispose(this.scene);
    this.spitProjectiles = [];
    for (const zombie of this.zombies) {
      zombie.dispose(this.scene);
    }
    this.zombies = [];
    this.portraitParticles?.dispose();
    this.portraitAudio?.dispose();
    this.portraitProjectileImpacts?.dispose();
    this.encounterBell?.dispose(this.scene);
    for (const p of (this.upgradePedestals ?? [])) p.dispose(this.scene);
    this.horrorDirector?.dispose();
    this.stormController?.dispose();
    this.footsteps?.dispose();
    this.weaponMotion?.dispose();
    this.weapon?.dispose?.();
    this.pistolPickup?.dispose();
    this.shotgunPickup?.dispose();
    this.level?.disposeDecor();
    disposeAllZombieResources();
    GuardianZombie.disposeSharedResources();
    GuardianProjectile.disposeSharedResources();
    PortraitProjectileImpacts.disposeSharedResources();
    CrawlerZombie.disposeSharedResources();
  }
}
