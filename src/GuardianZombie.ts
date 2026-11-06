import * as THREE from 'three';
import type { Level } from './Level.ts';
import { Zombie } from './Zombie.ts';
import { guardianConfig } from './FinaleConfig.ts';
import { visualColors } from './VisualStyle.ts';
import { portraitAnimation, portraitGroundOffsetY, type PortraitPose } from './PortraitAnimation.ts';
import { getPortraitResources, disposePortraitResources } from './PortraitResources.ts';
import { PortraitAttackCue, clearGroundSegment } from './PortraitAttackCue.ts';
import { EnemyImpact, type EnemyShotImpact } from './EnemyImpact.ts';

export type GuardianAttack = 'sweep' | 'blades' | 'tear';
export interface PortraitCue {
  kind: 'transform-start' | 'transform-burst' | 'transform-end' | 'prepare' | 'release' | 'cancel';
  /** Racine au sol et direction horizontale, indépendantes du billboard. */
  position: THREE.Vector3;
  direction: THREE.Vector3;
  attack?: GuardianAttack;
  volleyIndex?: 1 | 2;
  phase: 1 | 2;
}
type GuardianState = ReturnType<Zombie['getState']>;
export type GuardianThrow = (origin: THREE.Vector3, target: THREE.Vector3) => void;

/** Le Maître du Portrait conserve le contrat des menaces, avec ses propres poses et sa mort. */
export class GuardianZombie extends Zombie {
  private readonly guardianLevel: Level;
  private readonly guardianScene: THREE.Scene;
  private readonly presentation?: { cue(event: PortraitCue): void };
  private readonly art = getPortraitResources();
  private readonly paintMaterial: THREE.MeshStandardMaterial;
  private guardianHealth: number = guardianConfig.health;
  private guardianPhase: 1 | 2 = 1;
  private guardianState: GuardianState = 'IDLE';
  private guardianAttack: GuardianAttack | null = null;
  private stateTime = 0;
  private recoveryDuration = 0;
  private lockedTarget: THREE.Vector3 | null = null;
  private readonly attackDirection = new THREE.Vector3(0, 0, 1);
  private readonly attackStart = new THREE.Vector3();
  private targetMemory: THREE.Vector3 | null = null;
  private routeWaypoint: THREE.Vector3 | null = null;
  private routeTimer = 0;
  private walkTime = 0;
  private impactFlash = 0;
  private damageAllowance = 0;
  private frameResistanceTime = 0;
  private attackCount = 0;
  private advanceRemaining = 0;
  private transformRemaining = 0;
  private transformBurstSent = false;
  private comboTransitionRemaining = 0;
  private comboFollowup = false;
  private volleyIndex: 1 | 2 = 1;
  private volleyRemaining = 0;
  private presentationCancelled = false;
  private cue: PortraitAttackCue | null = null;
  private guardianDisposed = false;
  private readonly guardianImpact = new EnemyImpact();

  constructor(scene: THREE.Scene, level: Level, x: number, z: number, presentation?: { cue(event: PortraitCue): void }) {
    super(scene, level, x, z, 'standard', Math.random, { elite: true });
    this.guardianLevel = level;
    this.guardianScene = scene;
    this.presentation = presentation;
    const mesh = this.getMesh();
    mesh.userData.impactMaterial = 'portrait';
    this.paintMaterial = mesh.material as THREE.MeshStandardMaterial;
    mesh.geometry = this.art.geometry;
    mesh.scale.setScalar(1);
    mesh.position.y = level.getFloorHeightAt(x, z) + portraitGroundOffsetY;
    this.paintMaterial.color.setHex(0xffffff);
    this.paintMaterial.emissive.setHex(visualColors.ivory);
    this.showPose('idle');
  }

  static override warmup(): void { getPortraitResources(); }
  static disposeSharedResources(): void { disposePortraitResources(); }
  getHealth(): number { return this.guardianHealth; }
  getMaxHealth(): number { return guardianConfig.health; }
  getPhase(): 1 | 2 { return this.guardianPhase; }
  getAttackKind(): GuardianAttack | null { return this.guardianAttack; }
  getVolleyIndex(): 1 | 2 { return this.volleyIndex; }
  isTransforming(): boolean { return this.transformRemaining > 0; }
  isComboTransition(): boolean { return this.comboTransitionRemaining > 0; }
  isFrameResisting(): boolean { return this.isAlive() && this.frameResistanceTime > 0; }
  isMaskExposed(): boolean {
    return this.isAlive() && this.guardianState === 'RECOVER'
      && !this.isTransforming() && !this.isComboTransition() && this.volleyRemaining === 0;
  }
  override isAlive(): boolean { return this.guardianHealth > 0 && !this.guardianDisposed; }
  override isThreat(): boolean { return this.isAlive(); }
  override getState(): GuardianState { return this.guardianState; }

  override alert(targetPosition: THREE.Vector3): void {
    if (this.isAlive()) this.targetMemory = targetPosition.clone();
  }

  override stun(_seconds: number): void {
    // Le Maître conserve ses attaques annoncées, comme lors des impacts du fusil.
  }

  override takeDamage(amount: number, _headHit = false, _impactForce = 0, impact?: EnemyShotImpact): void {
    if (!this.isAlive() || !Number.isFinite(amount) || amount <= 0) return;
    const appliedDamage = Math.min(amount, this.damageAllowance);
    this.damageAllowance = Math.max(0, this.damageAllowance - appliedDamage);
    if (appliedDamage < amount) this.frameResistanceTime = 0.4;
    this.guardianHealth = Math.max(0, this.guardianHealth - appliedDamage);
    // Le poids du Maître préserve la position et les préparations des attaques.
    this.guardianImpact.start(impact, 0, this.guardianHealth === 0, 0.28);
    this.guardianImpact.apply(this.getMesh(), -portraitGroundOffsetY);
    if (this.guardianHealth === 0) {
      this.cancelPresentation();
      this.guardianAttack = null;
      this.lockedTarget = null;
      this.transformRemaining = 0;
      this.comboTransitionRemaining = 0;
      this.comboFollowup = false;
      this.volleyRemaining = 0;
      this.clearCue();
      this.stopAudio();
      this.showPose('death');
      this.paintMaterial.emissiveIntensity = 0;
      this.paintMaterial.color.setHex(0xffffff);
    } else {
      // Les coups restent visibles sans annuler une préparation engagée.
      this.impactFlash = 0.12;
    }
  }

  override updateDeath(delta: number, viewerPosition: THREE.Vector3): void {
    if (this.isAlive() || this.guardianDisposed) return;
    this.faceViewer(viewerPosition);
    this.guardianImpact.update(delta, this.getPosition(), undefined, guardianConfig.radius, portraitGroundOffsetY);
    this.guardianImpact.apply(this.getMesh(), -portraitGroundOffsetY);
  }

  override update(
    delta: number,
    playerPosition: THREE.Vector3,
    _otherZombies: Zombie[],
    onAttack: (damage: number) => void,
    onBlades?: GuardianThrow,
  ): void {
    if (!this.isAlive() || !Number.isFinite(delta) || delta <= 0) return;
    // Le cadre cède au plus health / minimumCombatDuration PV par seconde active.
    // Une petite réserve conserve l'intérêt des tirs précis et des ouvertures,
    // sans permettre d'accumuler toute la vulnérabilité en attendant au couvert.
    this.damageAllowance = Math.min(guardianConfig.damageReserve, this.damageAllowance
      + delta * guardianConfig.health / guardianConfig.minimumCombatDuration);
    this.frameResistanceTime = Math.max(0, this.frameResistanceTime - delta);
    this.impactFlash = Math.max(0, this.impactFlash - delta);
    this.faceViewer(playerPosition);
    this.guardianImpact.update(delta, this.getPosition(), undefined, guardianConfig.radius, portraitGroundOffsetY);
    this.guardianImpact.apply(this.getMesh(), -portraitGroundOffsetY);
    if (this.transformRemaining > 0) {
      this.transformRemaining = Math.max(0, this.transformRemaining - delta);
      if (!this.transformBurstSent && this.transformRemaining <= guardianConfig.transformationDuration * 0.45) {
        this.transformBurstSent = true;
        this.emitCue('transform-burst');
      }
      const progress = 1 - this.transformRemaining / guardianConfig.transformationDuration;
      this.showPose(progress < 1 / 3 ? 'transform-a' : progress < 2 / 3 ? 'transform-b' : 'transform-c', false);
      if (this.transformRemaining === 0) {
        this.guardianState = 'IDLE';
        this.advanceRemaining = guardianConfig.secondPhaseAdvanceDuration;
        this.showPose('phase2-idle', false);
        this.emitCue('transform-end');
      }
    } else if (this.volleyRemaining > 0) {
      this.stateTime += delta;
      this.volleyRemaining = Math.max(0, this.volleyRemaining - delta);
      const canFollow = this.canAimFollowingVolley(playerPosition);
      if (!canFollow) {
        this.enterRecovery(false);
        this.guardianAttack = null;
        this.lockedTarget = null;
        this.showPose('recovery');
      } else {
        if (!this.lockedTarget && this.volleyRemaining <= guardianConfig.throwLockBeforeRelease) {
          this.lockedTarget = playerPosition.clone();
        }
        this.showPose(this.stateTime < 0.1 ? 'blades-release'
          : this.volleyRemaining > 0.15 ? 'blades-windup' : 'blades-windup-b');
        if (this.volleyRemaining === 0) this.releaseBladeVolley(playerPosition, onBlades);
      }
    } else if (this.comboTransitionRemaining > 0) {
      this.stateTime += delta;
      this.comboTransitionRemaining = Math.max(0, this.comboTransitionRemaining - delta);
      this.showRecoveryPose();
      if (this.comboTransitionRemaining === 0) {
        // Vérifier le vrai joueur au second geste : jamais un coup caché derrière
        // une porte, entre étages ou au contact immédiat après une salve distante.
        const distance = Math.hypot(playerPosition.x - this.getPosition().x, playerPosition.z - this.getPosition().z);
        if (distance > guardianConfig.attackRange && distance <= guardianConfig.tearRange
          && this.sameFloor(playerPosition)
          && this.guardianLevel.hasLineOfSight(this.attackOrigin(), playerPosition)
          && clearGroundSegment(this.guardianLevel, this.getPosition(), playerPosition)) {
          this.beginAttack('tear', playerPosition, true);
        } else {
          this.guardianState = 'RECOVER';
          this.stateTime = 0;
          this.recoveryDuration = guardianConfig.secondPhaseRecovery;
          this.comboFollowup = false;
          this.guardianAttack = null;
          this.lockedTarget = null;
          this.showPose('recovery');
        }
      }
    } else if (this.guardianState === 'ATTACK') {
      this.stateTime += delta;
      const windup = this.windupDuration();
      this.showWindupPose(windup);
      if (this.guardianAttack === 'blades' && !this.lockedTarget
        && this.stateTime >= windup - guardianConfig.throwLockBeforeRelease) this.lockedTarget = playerPosition.clone();
      this.cue?.update(this.stateTime / windup, false);
      if (this.stateTime >= windup) this.releaseAttack(playerPosition, onAttack, onBlades);
    } else if (this.guardianState === 'RECOVER') {
      this.stateTime += delta;
      if (this.stateTime > 0.3) this.clearCue();
      if (this.stateTime >= this.recoveryDuration) {
        this.guardianAttack = null;
        this.lockedTarget = null;
        if (this.guardianPhase === 1 && this.guardianHealth <= guardianConfig.health / 2) {
          this.guardianPhase = 2;
          this.attackCount = 0;
          this.transformRemaining = guardianConfig.transformationDuration;
          this.transformBurstSent = false;
          this.showPose('transform-a', false);
          this.emitCue('transform-start');
        } else {
          this.guardianState = 'IDLE';
          this.advanceRemaining = this.guardianPhase === 2
            ? guardianConfig.secondPhaseAdvanceDuration : guardianConfig.advanceDuration;
          this.showPose('idle');
        }
      } else this.showRecoveryPose();
    } else {
      this.approachOrAttack(delta, playerPosition);
    }
    this.paintMaterial.color.setHex(this.frameResistanceTime > 0 ? 0xbda579
      : this.impactFlash > 0 ? 0xf5c8bb : 0xffffff);
    // Émission texturée faible : le masque et les matières survivent à la pénombre.
    this.paintMaterial.emissiveIntensity = this.isTransforming() ? 0.22 : this.guardianState === 'ATTACK' ? 0.14 : 0.06;
  }

  private windupDuration(): number {
    return this.guardianAttack === 'tear' ? guardianConfig.tearWindup : guardianConfig.attackWindup;
  }

  private releaseAttack(player: THREE.Vector3, onAttack: (damage: number) => void, onBlades?: GuardianThrow): void {
    if (this.guardianAttack === 'blades') {
      const distance = Math.hypot(player.x - this.getPosition().x, player.z - this.getPosition().z);
      if (this.guardianPhase === 2 && this.sameFloor(player) && distance <= guardianConfig.closePriorityRange) {
        // Le joueur a pu se rapprocher pendant la préparation : remplacer le
        // fan trop serré par un geste de sol entièrement annoncé, sans impact ici.
        this.beginAttack(distance <= guardianConfig.attackRange ? 'sweep' : 'tear', player);
        return;
      }
      this.releaseBladeVolley(player, onBlades);
      return;
    }
    this.enterRecovery(false);
    this.cue?.update(1, true);
    this.emitCue('release');
    if (this.guardianAttack === 'tear') {
      const offset = player.clone().sub(this.attackStart).setY(0);
      const along = offset.dot(this.attackDirection);
      const side = Math.abs(offset.x * this.attackDirection.z - offset.z * this.attackDirection.x);
      if (along >= 0 && along <= (this.cue?.length ?? 0) && side <= guardianConfig.tearHalfWidth
        && this.sameFloor(player) && clearGroundSegment(this.guardianLevel, this.attackStart, player)
        && this.guardianLevel.hasLineOfSight(this.attackOrigin(), player)) onAttack(guardianConfig.tearDamage);
      this.showPose('tear-release');
    } else {
      const toward = player.clone().sub(this.attackStart).setY(0);
      if (toward.length() <= guardianConfig.attackRange && this.sameFloor(player)
        && this.cue?.coversSweepTarget(player)
        && (toward.lengthSq() < 0.01 || toward.normalize().dot(this.attackDirection) >= Math.cos(1.35))
        && clearGroundSegment(this.guardianLevel, this.attackStart, player)
        && this.guardianLevel.hasLineOfSight(this.attackOrigin(), player)) onAttack(guardianConfig.attackDamage);
      this.showPose('sweep-release');
    }
  }

  private enterRecovery(allowCombo: boolean): void {
    this.guardianState = 'RECOVER';
    this.stateTime = 0;
    this.volleyRemaining = 0;
    const startsCombo = allowCombo && this.guardianPhase === 2 && this.guardianAttack === 'blades' && !this.comboFollowup;
    this.comboFollowup = false;
    this.comboTransitionRemaining = startsCombo ? guardianConfig.comboTransition : 0;
    this.recoveryDuration = this.guardianPhase === 2 ? guardianConfig.secondPhaseRecovery
      : this.guardianAttack === 'tear' ? guardianConfig.tearRecovery
        : this.guardianAttack === 'sweep' ? guardianConfig.attackRecovery : guardianConfig.throwRecovery;
  }

  private releaseBladeVolley(player: THREE.Vector3, onBlades?: GuardianThrow): void {
    if (!this.lockedTarget) return;
    const origin = this.attackOrigin();
    const direction = this.lockedTarget.clone().sub(origin);
    this.emitCue('release', direction);
    const count = this.guardianPhase === 2 ? guardianConfig.secondPhaseBladeCount : guardianConfig.bladeCount;
    const spread = this.guardianPhase === 2 ? guardianConfig.secondPhaseBladeSpread : guardianConfig.bladeSpread;
    for (let i = 0; i < count; i++) {
      const angle = -spread + i / (count - 1) * 2 * spread;
      const target = origin.clone().add(direction.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle));
      onBlades?.(origin.clone(), target);
      if (!this.isAlive()) return;
    }
    this.showPose('blades-release');
    if (this.volleyIndex === 1) {
      this.volleyIndex = 2;
      this.volleyRemaining = this.guardianPhase === 2 ? guardianConfig.secondPhaseVolleyInterval : guardianConfig.volleyInterval;
      this.stateTime = 0;
      this.lockedTarget = null;
      this.attackDirection.copy(player).sub(this.getPosition()).setY(0).normalize();
      if (this.attackDirection.lengthSq() < 0.001) this.attackDirection.set(0, 0, 1);
      this.emitCue('prepare');
    } else this.enterRecovery(true);
  }

  private canAimFollowingVolley(player: THREE.Vector3): boolean {
    const distance = Math.hypot(player.x - this.getPosition().x, player.z - this.getPosition().z);
    return distance > guardianConfig.closePriorityRange && distance <= guardianConfig.throwRange
      && this.sameFloor(player) && this.guardianLevel.hasLineOfSight(this.attackOrigin(), player);
  }

  private showWindupPose(windup: number): void {
    const late = this.stateTime >= windup * 0.6;
    this.showPose(this.guardianAttack === 'blades' ? late ? 'blades-windup-b' : 'blades-windup'
      : this.guardianAttack === 'tear' ? late ? 'tear-windup-b' : 'tear-windup' : 'sweep-windup');
  }

  private showRecoveryPose(): void {
    if (this.stateTime >= 0.25) this.showPose('recovery');
    else if (this.guardianAttack === 'blades') {
      this.showPose(this.stateTime < 0.1 ? 'blades-release' : 'blades-followthrough');
    }
  }

  private approachOrAttack(delta: number, player: THREE.Vector3): void {
    this.advanceRemaining = Math.max(0, this.advanceRemaining - delta);
    const visible = this.guardianLevel.hasLineOfSight(this.attackOrigin(), player);
    const distance = Math.hypot(player.x - this.getPosition().x, player.z - this.getPosition().z);
    if (visible) this.targetMemory = player.clone();
    if (visible && distance <= guardianConfig.throwRange
      && (this.advanceRemaining === 0 || distance <= guardianConfig.attackRange)) {
      const close = distance <= guardianConfig.attackRange && this.sameFloor(player);
      const tearPossible = this.sameFloor(player) && distance <= guardianConfig.tearRange
        && clearGroundSegment(this.guardianLevel, this.getPosition(), player);
      const attack = close && this.guardianPhase === 2 ? 'sweep'
        : tearPossible && (distance <= guardianConfig.closePriorityRange || this.attackCount % 2 === 1) ? 'tear' : 'blades';
      this.beginAttack(attack, player);
      return;
    }
    if (!this.targetMemory) {
      this.guardianState = 'IDLE';
      this.showPose('idle');
      return;
    }
    this.guardianState = visible ? 'CHASE' : 'SEARCH';
    this.routeTimer -= delta;
    if (this.routeTimer <= 0) {
      this.routeWaypoint = this.guardianLevel.findNextWaypoint(this.getPosition(), this.targetMemory, guardianConfig.radius);
      this.routeTimer = 0.4;
    }
    const before = this.getPosition().clone();
    const contactDistance = this.sameFloor(player) ? Math.max(0, distance - guardianConfig.approachStopDistance) : Infinity;
    if (this.routeWaypoint && contactDistance > 0) {
      const direction = this.routeWaypoint.clone().sub(before).setY(0);
      const speed = this.guardianPhase === 2 ? guardianConfig.secondPhaseSpeed : guardianConfig.speed;
      const step = Math.min(direction.length(), speed * delta, contactDistance);
      if (step > 0.001) this.moveGuardian(direction.normalize().multiplyScalar(step));
    }
    if (this.getPosition().distanceToSquared(before) > 1e-8) {
      this.walkTime += delta;
      this.showPose(Math.floor(this.walkTime / portraitAnimation.walkPoseDuration) % 2 === 0 ? 'walk-a' : 'walk-b');
    } else this.showPose('idle');
  }

  private beginAttack(attack: GuardianAttack, player: THREE.Vector3, followup = false): void {
    this.clearCue();
    this.guardianAttack = attack;
    this.comboFollowup = followup;
    this.volleyIndex = 1;
    this.volleyRemaining = 0;
    this.attackCount++;
    this.guardianState = 'ATTACK';
    this.stateTime = 0;
    this.lockedTarget = null;
    this.attackStart.copy(this.getPosition());
    this.attackDirection.copy(player).sub(this.attackStart).setY(0).normalize();
    if (this.attackDirection.lengthSq() < 0.001) this.attackDirection.set(0, 0, 1);
    this.showPose(attack === 'blades' ? 'blades-windup' : attack === 'tear' ? 'tear-windup' : 'sweep-windup');
    if (attack !== 'blades') {
      this.cue = new PortraitAttackCue(this.guardianLevel, this.attackStart, this.attackDirection,
        attack === 'tear' ? guardianConfig.tearRange : guardianConfig.attackRange,
        guardianConfig.tearHalfWidth, attack === 'sweep');
      this.guardianScene.add(this.cue.group);
    }
    this.emitCue('prepare');
  }

  private emitCue(kind: PortraitCue['kind'], direction = this.attackDirection): void {
    if (!this.presentation || (kind !== 'cancel' && !this.isAlive())) return;
    const position = this.getPosition().clone();
    position.y = this.guardianLevel.getFloorHeightAt(position.x, position.z);
    const heading = direction.clone().setY(0);
    if (heading.lengthSq() < 0.001) heading.copy(this.attackDirection);
    this.presentation.cue({ kind, position, direction: heading.normalize(),
      attack: this.guardianAttack ?? undefined, volleyIndex: this.guardianAttack === 'blades' ? this.volleyIndex : undefined,
      phase: this.guardianPhase });
  }

  private cancelPresentation(): void {
    if (this.presentationCancelled) return;
    this.presentationCancelled = true;
    this.emitCue('cancel');
  }

  private sameFloor(player: THREE.Vector3): boolean {
    const own = this.getPosition();
    return Math.abs(this.guardianLevel.getFloorHeightAt(own.x, own.z)
      - this.guardianLevel.getFloorHeightAt(player.x, player.z)) <= 0.8;
  }

  private attackOrigin(): THREE.Vector3 {
    return this.getPosition().clone().add(new THREE.Vector3(0, 1.45 - portraitGroundOffsetY, 0));
  }

  private faceViewer(viewer: THREE.Vector3): void {
    this.getMesh().rotation.y = Math.atan2(viewer.x - this.getPosition().x, viewer.z - this.getPosition().z);
  }

  private moveGuardian(direction: THREE.Vector3): void {
    const position = this.getPosition();
    const steps = Math.max(1, Math.ceil(direction.length() / 0.1));
    for (let i = 0; i < steps; i++) {
      const x = position.x + direction.x / steps;
      if (!this.guardianLevel.isColliding(x, position.z, guardianConfig.radius)) position.x = x;
      const z = position.z + direction.z / steps;
      if (!this.guardianLevel.isColliding(position.x, z, guardianConfig.radius)) position.z = z;
    }
    position.y = this.guardianLevel.getFloorHeightAt(position.x, position.z) + portraitGroundOffsetY;
  }

  private showPose(pose: PortraitPose, phaseVariant = true): void {
    const variant = `phase2-${pose}` as PortraitPose;
    const selected = phaseVariant && this.guardianPhase === 2 && this.art.textures[variant] ? variant : pose;
    this.paintMaterial.map = this.art.textures[selected];
    this.paintMaterial.emissiveMap = this.art.textures[selected];
    this.getMesh().customDepthMaterial = this.art.depth[selected];
    this.getMesh().customDistanceMaterial = this.art.distance[selected];
  }

  private clearCue(): void { this.cue?.dispose(); this.cue = null; }

  override dispose(scene: THREE.Scene): void {
    this.guardianImpact.dispose();
    if (this.guardianDisposed) return;
    this.cancelPresentation();
    this.guardianDisposed = true;
    this.guardianHealth = 0;
    this.comboTransitionRemaining = 0;
    this.transformRemaining = 0;
    this.volleyRemaining = 0;
    this.clearCue();
    super.dispose(scene);
  }
}
