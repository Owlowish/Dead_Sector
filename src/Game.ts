
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

type GameState = 'playing' | 'respite' | 'exploration' | 'won' | 'lost';

export class Game {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  private level: Level;
  private player: Player;
  private zombies: Zombie[] = [];
  private medkits: Medkit[] = [];
  private ammoBoxes: AmmoBox[] = [];
  private shotgunPickup: ShotgunPickup;
  private encounterBell: EncounterBell;
  private upgradePedestals: UpgradePedestal[] = [];
  private appliedUpgrades: UpgradeId[] = [];
  private shellCasings: ShellCasing[] = [];
  private hitEffects: HitEffects;
  private weapon: Weapon;
  private state: GameState = 'playing';
  private currentTier = 1;
  private pendingTierStart = 0;
  private spawnQueue = 0;
  private spawnCooldownTimer = 0;
  private tierAgileSpawned = 0;
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
  private creakAudio: THREE.Audio | null = null;
  private creakTimer = 18.0;
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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
            clickSound.volume = 0.4;
            void clickSound.play().catch(() => {});
          } else if (toggled) {
            // Déclencheur immersif : ouvrir la porte de l'aile déverrouillée déclenche le combat du palier suivant
            if (this.state === 'exploration' && this.pendingTierStart > 0) {
              const nextEncounter = this.encounterConfigs[this.pendingTierStart - 1];
              if (nextEncounter?.activationType === 'wing_gate') {
                const targetUnlockTier = this.pendingTierStart - 1;
                if (door.getUnlockAfterTier() === targetUnlockTier) {
                  this.launchPendingTier();
                }
              }
            }
          }
          break;
        }
      }
    });

    document.querySelectorAll<HTMLButtonElement>('#game-over .restart-button, #victory .restart-button').forEach((button) => {
      button.addEventListener('click', () => window.location.reload());
    });

    if (typeof window !== 'undefined') {
      (window as unknown as { __DEAD_SECTOR_PERF?: () => unknown; __DEAD_SECTOR_PERF_DETAILED?: () => unknown; __DEAD_SECTOR_START_TIER?: (tier: number) => void }).__DEAD_SECTOR_PERF = () => this.getPerformanceReport();
      (window as unknown as { __DEAD_SECTOR_PERF_DETAILED?: () => unknown }).__DEAD_SECTOR_PERF_DETAILED = () => this.getDetailedPerformanceReport();
      (window as unknown as { __DEAD_SECTOR_START_TIER?: (tier: number) => void }).__DEAD_SECTOR_START_TIER = (tier: number) => this.startTier(tier);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.tabBecameVisible = true;
          this.lastFrameTime = performance.now();
        }
      });
    }

    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement === this.renderer.domElement;
      if (this.pauseDisplay) {
        this.pauseDisplay.hidden = isLocked || (this.state !== 'playing' && this.state !== 'exploration');
      }
      this.syncAmbientAudio();
    });

    // Ambiance sonore et audio spatial du manoir
    const audioLoader = new THREE.AudioLoader();

    // 1. Nappe sonore feutrée de vent nocturne en boucle
    audioLoader.load('/assets/sounds/ambiance-soft.wav', (buffer) => {
      const sound = new THREE.Audio(this.player.audioListener);
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.15);
      this.ambianceAudio = sound;
      this.syncAmbientAudio();
    }, undefined, (error) => console.warn('Chargement ambiance impossible :', error));

    // 1B. Événements sonores feutrés et espacés du manoir (craquements de parquet/boiserie)
    audioLoader.load('/assets/sounds/creak-soft.wav', (buffer) => {
      const creak = new THREE.Audio(this.player.audioListener);
      creak.setBuffer(buffer);
      creak.setLoop(false);
      creak.setVolume(0.18);
      this.creakAudio = creak;
    }, undefined, (error) => console.warn('Chargement craquement sonore impossible :', error));

    // 2. Grognements spatiaux des zombies en 3D
    audioLoader.load('/assets/sounds/zombie-groan-soft.wav', (buffer) => {
      this.zombieGroanBuffer = buffer;
      for (const zombie of this.zombies) {
        zombie.setupAudio(this.player.audioListener, buffer);
      }
    }, undefined, (error) => console.warn('Chargement voix ennemie impossible :', error));

    // Trousses de secours réparties dans le manoir.
    this.medkits = MANSION_PICKUPS
      .filter((p) => p.type === 'medkit')
      .map((m) => new Medkit(this.scene, m.x, m.z, m.value, this.level.getFloorHeightAt(m.x, m.z)));

    // Caisses de munitions de ravitaillement dans chaque secteur.
    this.ammoBoxes = MANSION_PICKUPS
      .filter((p) => p.type === 'ammo')
      .map((a) => new AmmoBox(this.scene, a.x, a.z, a.value, a.weaponType ?? 'pistol', this.level.getFloorHeightAt(a.x, a.z)));

    // Fusil à pompe placé au centre du Grand Hall (Secteur 2)
    const shotgunFloorY = this.level.getFloorHeightAt(0, 0);
    this.shotgunPickup = new ShotgunPickup(this.scene, 0, 0, shotgunFloorY + 0.4);

    // Dispositif d'activation volontaire des rencontres (Carillon d'arène au Grand Hall Sud)
    const bellFloorY = this.level.getFloorHeightAt(0, 2.5);
    this.encounterBell = new EncounterBell(this.scene, 0, 2.5, bellFloorY);

    // Présentoirs d'offrandes / améliorations in-world (Grand Hall Sud, encadrant le carillon)
    const pedestalFloorY = this.level.getFloorHeightAt(0, 2.5);
    this.upgradePedestals = [
      new UpgradePedestal(this.scene, -2.5, 2.5, pedestalFloorY, 'left'),
      new UpgradePedestal(this.scene, 2.5, 2.5, pedestalFloorY, 'right'),
    ];

    // Création de l'arme (cibles actualisées dynamiquement lors du démarrage de chaque palier).
    this.weapon = new Weapon(
      this.player.camera,
      this.renderer.domElement,
      [],
      this.level.getSolidMeshes(),
      (target, damage) => {
        const zombie = this.zombies.find(
          (candidate) => candidate.getMesh() === target
        );
        zombie?.takeDamage(damage);
        this.checkTierCompletion();
        this.updateObjectiveDisplay();
      },
      () => this.isSimulationActive(),
      (amount) => this.player.setAimAmount(amount)
    );

    this.weapon.setOnImpact((impact) => this.hitEffects.emit(impact));

    // Préchauffage des ressources graphiques partagées (Warmup standard, agile et cadavres)
    Zombie.warmup();

    // Initialisation du premier palier
    this.startTier(1);

    // Source unique de vérité pour les munitions : notification directe du HUD
    this.weapon.setOnAmmoChange(() => this.updateAmmoDisplay());
    this.updateAmmoDisplay();

    // Détonation, recul de caméra (View Punch) différencié et alerte sonore immédiate à t = 0
    this.weapon.setOnShoot((aimAmount, weaponId) => {
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
  }

  private isSimulationActive(): boolean {
    return this.state === 'playing' || this.state === 'respite' || this.state === 'exploration';
  }

  public start(): void {
    this.lastFrameTime = performance.now();
    this.renderer.setAnimationLoop(() => {
      const now = performance.now();
      const rawDeltaMs = Math.max(0, now - this.lastFrameTime);
      this.lastFrameTime = now;
      const rawDeltaSec = rawDeltaMs / 1000;
      const isTabSwitch = this.tabBecameVisible || (typeof document !== 'undefined' && document.hidden) || rawDeltaMs > 1000;
      this.tabBecameVisible = false;

      // Conserver le plafonnement de simulation existant pour le gameplay (déplacements, physique)
      const delta = Math.min(rawDeltaSec, 0.05);

      const isCombat = this.state === 'playing' && (typeof document !== 'undefined' && document.pointerLockElement === this.renderer.domElement);
      this.perfTracker?.recordFrame(rawDeltaMs, isCombat, isTabSwitch);

      this.updateDamageEffect(delta);

      // Mise à jour des systèmes en jeu, en phase de répit ou en exploration d'accès.
      if (this.isSimulationActive() && document.pointerLockElement === this.renderer.domElement) {
        this.player.update(delta);

        // Déclencheur de secours si le joueur franchit le seuil d'accès dans la nouvelle aile
        if (this.state === 'exploration' && this.pendingTierStart > 0) {
          const nextEncounter = this.encounterConfigs[this.pendingTierStart - 1];
          if (nextEncounter?.activationType === 'wing_gate') {
            const pZ = this.player.camera.position.z;
            if ((this.pendingTierStart === 2 && pZ < 5.8) || (this.pendingTierStart === 3 && pZ < -8.2)) {
              this.launchPendingTier();
            }
          }
        }

        // Simulation des zombies pendant le combat actif
        if (this.state === 'playing') {
          // Gestion échelonnée de la file d'apparition
          this.spawnCooldownTimer -= delta;
          const livingCount = this.zombies.filter((z) => z.isAlive()).length;
          if (this.spawnQueue > 0 && livingCount < this.maxSimultaneousZombies && this.spawnCooldownTimer <= 0) {
            if (this.trySpawnZombie()) {
              this.spawnQueue--;
              this.spawnCooldownTimer = 1.2;
              this.updateObjectiveDisplay();
            } else {
              this.spawnCooldownTimer = 0.5;
            }
          }

          for (const zombie of this.zombies) {
            if (!this.player.isAlive()) break;
            zombie.update(delta, this.player.camera.position, this.zombies, (damage) => {
              const previousHealth = this.player.getHealth();
              this.player.takeDamage(damage);
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
      for (const p of (this.upgradePedestals ?? [])) p.update(delta);

      // Animation et ramassage du fusil à pompe
      this.shotgunPickup.update(delta, this.player.camera.position);
      if (this.isSimulationActive() && this.shotgunPickup.tryPickup(this.player.camera.position, this.weapon)) {
        this.updateAmmoDisplay();
      }

      // Animation et ramassage des trousses de soin.
      for (const medkit of this.medkits) {
        medkit.update(delta, this.player.camera.position);
        if (this.isSimulationActive() && medkit.tryPickup(this.player)) {
          this.updateHealthDisplay();
        }
      }

      // Animation et ramassage des boîtes de munitions.
      for (const box of this.ammoBoxes) {
        box.update(delta, this.player.camera.position);
        if (this.isSimulationActive() && box.tryPickup(this.player.camera.position, this.weapon)) {
          this.updateAmmoDisplay();
        }
      }

      // Mise à jour de la balistique des douilles éjectées
      this.shellCasings = this.shellCasings.filter((casing) => casing.update(delta));
      const effectsDelta = this.isSimulationActive() && document.pointerLockElement === this.renderer.domElement ? delta : 0;
      this.hitEffects.update(effectsDelta, this.player.camera);

      // Craquements de boiseries feutrés et espacés en phase de jeu actif (ambiance d'horreur psychologique)
      if (this.isSimulationActive() && document.pointerLockElement === this.renderer.domElement) {
        this.creakTimer -= delta;
        if (this.creakTimer <= 0) {
          if (this.creakAudio && !this.creakAudio.isPlaying) {
            this.creakAudio.play();
          }
          // Réarmer un intervalle espacé (18 à 35 secondes)
          this.creakTimer = 18.0 + Math.random() * 17.0;
        }
      }

      this.level.update(delta);

      // Transmission de l'éclairage local ambiant du joueur à l'arme 2D (rehaussé par la lampe torche)
      const envLight = this.level.getLightingAt(this.player.camera.position);
      const flashlightBoost = this.player.isFlashlightOn() ? 0.22 : 0;
      this.weapon.setEnvironmentalLighting(envLight.brightness + flashlightBoost, envLight.warmth);

      this.weapon.update(delta);

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
    // Le dernier coup ouvre le menu et libère la souris : sa chute reste visuelle.
    // Échap en combat/exploration suspend en revanche les animations de mort.
    const animate = this.state === 'respite' || this.state === 'won'
      || ((this.state === 'playing' || this.state === 'exploration')
        && document.pointerLockElement === this.renderer.domElement);
    if (!animate) return;
    for (const zombie of this.zombies) zombie.updateDeath(delta, this.player.camera.position);
  }

  private updateResolution(): void {
    const retroWidth = Math.max(320, Math.floor(window.innerWidth / this.retroScale));
    const retroHeight = Math.max(240, Math.floor(window.innerHeight / this.retroScale));
    // Le 3e paramètre 'false' empêche Three.js d'écraser le style CSS 'width: 100vw; height: 100vh'
    this.renderer.setSize(retroWidth, retroHeight, false);
  }

  private checkTierCompletion(): void {
    if (this.state !== 'playing') return;
    const remaining = this.zombies.filter((zombie) => zombie.isAlive()).length;
    if (remaining === 0 && this.spawnQueue === 0) {
      this.enterRespite();
    }
  }

  private enterRespite(): void {
    if (this.state !== 'playing') return;

    // 1. Déverrouiller la nouvelle aile accessible selon la rencontre validée
    const configs = this.encounterConfigs ?? (this as unknown as { tierCandidateSpawns?: EncounterSpec[] }).tierCandidateSpawns;
    const currentEncounter = configs?.[this.currentTier - 1];
    if (currentEncounter?.unlockSectorTier) {
      const doors = this.level.getDoors();
      for (const door of doors) {
        if (door.getUnlockAfterTier() === currentEncounter.unlockSectorTier) {
          door.unlock();
        }
      }
    }

    // 2. Réarmement des ressources du décor (soins et munitions)
    for (const medkit of this.medkits) medkit.respawn();
    for (const box of this.ammoBoxes) box.respawn();

    // 3. Déclic métallique sonore d'ouverture
    const unlockSound = new Audio('/assets/sounds/empty-soft.wav');
    unlockSound.volume = 0.5;
    void unlockSound.play().catch(() => {});

    // 4. Si toutes les rencontres configurées ont été purgées, fin du prototype réussie !
    const maxTiers = configs?.length ?? 4;
    if (this.currentTier >= maxTiers) {
      this.endGame('won');
      return;
    }

    // 5. Transition directe et fluide vers l'exploration sécurisée (sans menu bloquant)
    this.pendingTierStart = this.currentTier + 1;
    this.state = 'exploration';
    const nextEncounter = configs?.[this.pendingTierStart - 1];
    if (nextEncounter?.activationType === 'arena_signal') {
      this.encounterBell?.setActive(true);
    } else {
      this.encounterBell?.setActive(false);
    }

    // 6. Proposer deux améliorations in-world gratuites sur les stèles du Grand Hall (F2)
    const [offerA, offerB] = drawTierUpgrades(this.appliedUpgrades ?? []);
    this.upgradePedestals?.[0]?.setOffer(offerA);
    this.upgradePedestals?.[1]?.setOffer(offerB);

    this.updateObjectiveDisplay();
  }

  public applyUpgrade(upgrade: UpgradeSpec): void {
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
    const t0 = performance.now();
    this.tierAgileSpawned = 0;
    this.encounterBell?.setActive(false);
    for (const p of (this.upgradePedestals ?? [])) {
      p.close();
    }

    // 1. Nettoyer les anciens zombies de la scène et couper leurs sons
    for (const zombie of this.zombies) {
      zombie.dispose(this.scene);
    }
    this.zombies = [];
    this.weapon?.setTargets([]);

    // 2. Gestion et verrouillage des portes du manoir selon la progression
    const doors = this.level.getDoors();
    for (const door of doors) {
      if (door.getType() === 'permanent_limit') {
        door.lock();
      } else if (door.getType() === 'sector_access') {
        if (door.getUnlockAfterTier() < tierNumber) {
          door.unlock();
        } else {
          door.lock();
        }
      }
    }

    // 3. Réarmement de tous les bonus du manoir (santé et munitions)
    for (const medkit of this.medkits) {
      medkit.respawn();
    }
    for (const box of this.ammoBoxes) {
      box.respawn();
    }

    // 4. Initialisation de la file d'apparition échelonnée
    const configs = this.encounterConfigs ?? (this as unknown as { tierCandidateSpawns?: EncounterSpec[] }).tierCandidateSpawns;
    const config = configs?.[tierNumber - 1];
    if (config) {
      this.spawnQueue = config.totalZombies;
      // Au démarrage du Palier 1, accorder un délai d'observation initial de 2 secondes au joueur
      this.spawnCooldownTimer = tierNumber === 1 ? 2.0 : (config.activationType === 'arena_signal' ? 1.0 : 0.8);

      // Au Palier 1 et lors des activations par signal, aucun zombie n'apparaît à la frame 0
      // Pour les paliers 2 et 3 (porte ouverte), 1 zombie initial émerge dans la nouvelle aile
      const initialSpawns = (tierNumber === 1 || config.activationType === 'arena_signal') ? 0 : Math.min(1, this.spawnQueue);
      for (let i = 0; i < initialSpawns; i++) {
        if (this.trySpawnZombie()) {
          this.spawnQueue--;
        }
      }
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
    }
    const eligible: CandidateScore[] = [];
    const pool = config.spawnPool ?? (config as unknown as { pool: Point2D[] }).pool;

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

      let score = dist;
      if (!hasLOS) score += 12; // Fort bonus pour les points masqués par un mur ou une porte
      if (dot <= 0) score += 6;  // Bonus pour les positions latérales ou arrières à bonne distance

      eligible.push({ x: c.x, z: c.z, score });
    }

    if (eligible.length === 0) {
      // Aucun point n'est immédiatement éligible : conserver en file d'attente
      this.perfTracker?.recordSpawn(performance.now() - t0);
      this.perfTracker?.recordPathfinding(this.level?.getLastPathfindingDurationMs?.() ?? 0);
      return false;
    }

    // Choisir parmi les meilleurs scores
    eligible.sort((a, b) => b.score - a.score);
    const chosen = eligible[Math.floor(Math.random() * Math.min(2, eligible.length))];

    // Détermination de la variante selon la configuration de la rencontre
    const maxAgileThisTier = config.maxAgile;
    const maxSimultaneousAgile = config.maxSimultaneousAgile;
    const livingAgile = livingZombies.filter((z) => z.getKind() === 'agile').length;

    let chosenKind: ZombieKind = 'standard';
    if (this.tierAgileSpawned < maxAgileThisTier && livingAgile < maxSimultaneousAgile) {
      chosenKind = 'agile';
      this.tierAgileSpawned++;
    }

    // Créer le zombie et l'alerter vers le joueur
    const zombie = new Zombie(this.scene, this.level, chosen.x, chosen.z, chosenKind);
    zombie.alert(playerPos);
    if (this.zombieGroanBuffer) {
      zombie.setupAudio(this.player.audioListener, this.zombieGroanBuffer);
    }
    this.zombies.push(zombie);

    if (this.weapon) {
      this.weapon.setTargets(this.zombies.map((z) => z.getMesh()));
    }

    this.perfTracker?.recordSpawn(performance.now() - t0);
    this.perfTracker?.recordPathfinding(this.level?.getLastPathfindingDurationMs?.() ?? 0);
    return true;
  }

  private updateObjectiveDisplay(): void {
    if (!this.objectiveDisplay) return;
    const livingZombies = this.zombies.filter((z) => z.isAlive()).length;
    const totalRemaining = livingZombies + this.spawnQueue;
    if (this.state === 'won') {
      this.objectiveDisplay.textContent = 'PROTOTYPE PURGÉ — LES 4 RENCONTRES ONT ÉTÉ ÉLIMINÉES';
      this.objectiveDisplay.style.color = 'var(--sage)';
    } else if (this.state === 'lost') {
      this.objectiveDisplay.textContent = 'MISSION ÉCHOUÉE';
      this.objectiveDisplay.style.color = 'var(--blood)';
    } else if (this.state === 'respite') {
      this.objectiveDisplay.textContent = `PALIER ${this.currentTier} PURGÉ · ACCALMIE EN COURS`;
      this.objectiveDisplay.style.color = 'var(--gold, #dfba73)';
    } else if (this.state === 'exploration') {
      const nextEncounter = this.encounterConfigs[this.pendingTierStart - 1];
      this.objectiveDisplay.textContent = nextEncounter?.explorationPrompt ?? `PALIER ${this.currentTier} PURGÉ · EXPLORATION EN COURS`;
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
    this.state = result;
    this.weapon.cancelReload();
    this.syncAmbientAudio();
    this.updateObjectiveDisplay();
    if (this.pauseDisplay) this.pauseDisplay.hidden = true;
    if (this.promptDisplay) this.promptDisplay.hidden = true;
    if (this.ambianceAudio && this.ambianceAudio.isPlaying) {
      this.ambianceAudio.stop();
    }
    if (this.creakAudio && this.creakAudio.isPlaying) {
      this.creakAudio.stop();
    }
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
    const active = this.isSimulationActive() && document.pointerLockElement === this.renderer.domElement;
    if (active) {
      void this.player.audioListener.context.resume().catch((error: unknown) => {
        console.warn('Activation audio impossible :', error);
      });
      if (this.ambianceAudio && !this.ambianceAudio.isPlaying) this.ambianceAudio.play();
    } else {
      if (this.ambianceAudio?.isPlaying) this.ambianceAudio.pause();
      if (this.creakAudio?.isPlaying) this.creakAudio.stop();
      for (const zombie of this.zombies) zombie.stopAudio();
    }
  }

  public dispose(): void {
    for (const zombie of this.zombies) {
      zombie.dispose(this.scene);
    }
    this.zombies = [];
    this.encounterBell?.dispose(this.scene);
    for (const p of (this.upgradePedestals ?? [])) p.dispose(this.scene);
    if (this.creakAudio?.isPlaying) this.creakAudio.stop();
    disposeAllZombieResources();
  }
}
