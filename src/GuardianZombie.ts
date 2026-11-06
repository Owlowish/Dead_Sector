import * as THREE from 'three';
import type { Level } from './Level.ts';
import {
  Zombie,
  getStandardSharedResources,
  releaseStandardSharedResources,
  type StandardSharedResources,
} from './Zombie.ts';
import { guardianConfig } from './FinaleConfig.ts';
import { visualColors } from './VisualStyle.ts';
import { zombieAnimation } from './ZombieAnimation.ts';

export type GuardianAttack = 'sweep' | 'throw';
type GuardianState = ReturnType<Zombie['getState']>;
export type GuardianThrow = (origin: THREE.Vector3, target: THREE.Vector3) => void;

/** Duel spécifique ; le socle Zombie garde ses ressources, masques, audio et cadavre. */
export class GuardianZombie extends Zombie {
  private readonly guardianLevel: Level;
  private readonly guardianArt: StandardSharedResources;
  private readonly guardianMaterial: THREE.MeshStandardMaterial;
  private readonly throwSign: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private guardianHealth: number = guardianConfig.health;
  private guardianPhase: 1 | 2 = 1;
  private guardianState: GuardianState = 'IDLE';
  private guardianAttack: GuardianAttack | null = null;
  private stateTime = 0;
  private recoveryDuration = 0;
  private lockedTarget: THREE.Vector3 | null = null;
  private targetMemory: THREE.Vector3 | null = null;
  private routeWaypoint: THREE.Vector3 | null = null;
  private routeTimer = 0;
  private walkTime = 0;
  private impactFlash = 0;
  private guardianDisposed = false;

  constructor(scene: THREE.Scene, level: Level, x: number, z: number) {
    super(scene, level, x, z, 'standard', Math.random, { elite: true });
    this.guardianLevel = level;
    // Le socle détient déjà une référence pendant toute la durée de cette instance.
    this.guardianArt = getStandardSharedResources();
    releaseStandardSharedResources();
    this.guardianMaterial = this.getMesh().material as THREE.MeshStandardMaterial;
    this.guardianMaterial.emissiveMap = this.guardianMaterial.map;
    this.guardianMaterial.needsUpdate = true;
    this.throwSign = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.035, 4, 8),
      new THREE.MeshBasicMaterial({ color: visualColors.ivory }),
    );
    this.throwSign.position.set(0.32, 0.62, 0.06);
    this.throwSign.visible = false;
    this.getMesh().add(this.throwSign);
  }

  getHealth(): number { return this.guardianHealth; }
  getMaxHealth(): number { return guardianConfig.health; }
  getPhase(): 1 | 2 { return this.guardianPhase; }
  getAttackKind(): GuardianAttack | null { return this.guardianAttack; }
  override getState(): GuardianState { return this.guardianState; }

  override alert(targetPosition: THREE.Vector3): void {
    if (this.isAlive()) this.targetMemory = targetPosition.clone();
  }

  override takeDamage(amount: number, _headHit = false): void {
    if (!this.isAlive() || !Number.isFinite(amount) || amount <= 0) return;
    this.guardianHealth = Math.max(0, this.guardianHealth - amount);
    if (this.guardianHealth === 0) {
      this.guardianAttack = null;
      this.lockedTarget = null;
      this.throwSign.visible = false;
      this.guardianMaterial.emissiveIntensity = 0;
      // Seule la mort passe au socle : une blessure n'interrompt jamais le coup engagé.
      super.takeDamage(guardianConfig.health, true);
    } else {
      this.impactFlash = 0.12;
    }
  }

  override update(
    delta: number,
    playerPosition: THREE.Vector3,
    _otherZombies: Zombie[],
    onAttack: (damage: number) => void,
    onThrow?: GuardianThrow,
  ): void {
    if (!this.isAlive() || delta <= 0) return;
    this.impactFlash = Math.max(0, this.impactFlash - delta);
    this.getMesh().rotation.y = Math.atan2(
      playerPosition.x - this.getPosition().x,
      playerPosition.z - this.getPosition().z,
    );
    if (this.guardianState === 'ATTACK') {
      this.stateTime += delta;
      if (this.guardianAttack === 'throw' && !this.lockedTarget
        && this.stateTime >= guardianConfig.attackWindup - guardianConfig.throwLockBeforeRelease) {
        this.lockedTarget = playerPosition.clone();
      }
      if (this.stateTime >= guardianConfig.attackWindup) {
        this.guardianState = 'RECOVER';
        this.stateTime = 0;
        this.throwSign.visible = false;
        if (this.guardianAttack === 'sweep') {
          this.recoveryDuration = guardianConfig.attackRecovery;
          if (this.canSweep(playerPosition)) onAttack(guardianConfig.attackDamage);
        } else {
          this.recoveryDuration = this.guardianPhase === 1
            ? guardianConfig.throwRecovery : guardianConfig.secondPhaseThrowRecovery;
          if (this.lockedTarget && this.lockedTarget.distanceToSquared(this.attackOrigin()) > 0.01) {
            onThrow?.(this.attackOrigin(), this.lockedTarget.clone());
          }
        }
      }
      this.showGuardianFrame('attack', this.guardianState === 'RECOVER' ? 2 : this.guardianAttack === 'sweep' ? 1 : 0);
    } else if (this.guardianState === 'RECOVER') {
      this.stateTime += delta;
      if (this.stateTime >= this.recoveryDuration) {
        if (this.guardianHealth <= guardianConfig.health / 2) this.guardianPhase = 2;
        this.guardianState = 'IDLE';
        this.guardianAttack = null;
        this.lockedTarget = null;
        this.showGuardianFrame('idle');
      } else {
        this.showGuardianFrame('attack', this.stateTime < 0.15 ? 2 : 3);
      }
    } else {
      this.approachOrAttack(delta, playerPosition);
    }
    this.presentGuardian();
  }

  private approachOrAttack(delta: number, playerPosition: THREE.Vector3): void {
    const visible = this.guardianLevel.hasLineOfSight(this.attackOrigin(), playerPosition);
    const distance = this.getPosition().distanceTo(playerPosition);
    if (visible) this.targetMemory = playerPosition.clone();
    // Aucun intervalle sûr entre mêlée et projectile ; plus loin, le Gardien se rapproche.
    if (visible && distance <= guardianConfig.throwRange) {
      this.guardianAttack = this.canSweep(playerPosition) ? 'sweep' : 'throw';
      this.guardianState = 'ATTACK';
      this.stateTime = 0;
      this.lockedTarget = null;
      this.throwSign.visible = this.guardianAttack === 'throw';
      this.showGuardianFrame('attack', this.guardianAttack === 'sweep' ? 1 : 0);
      return;
    }
    if (!this.targetMemory) {
      this.guardianState = 'IDLE';
      this.showGuardianFrame('idle');
      return;
    }
    this.guardianState = visible ? 'CHASE' : 'SEARCH';
    this.routeTimer -= delta;
    if (this.routeTimer <= 0) {
      this.routeWaypoint = this.guardianLevel.findNextWaypoint(this.getPosition(), this.targetMemory, guardianConfig.radius);
      this.routeTimer = 0.4;
    }
    const before = this.getPosition().clone();
    if (this.routeWaypoint) {
      const direction = this.routeWaypoint.clone().sub(before);
      direction.y = 0;
      const step = Math.min(direction.length(), guardianConfig.speed * delta);
      if (step > 0.001) this.moveGuardian(direction.normalize().multiplyScalar(step));
    }
    if (this.getPosition().distanceToSquared(before) > 1e-8) {
      this.walkTime += delta;
      this.showGuardianFrame('walk', Math.floor(this.walkTime / zombieAnimation.walk.frameDuration) % zombieAnimation.walk.frames);
    } else {
      this.showGuardianFrame('idle');
    }
  }

  private canSweep(player: THREE.Vector3): boolean {
    const position = this.getPosition();
    const ownFloor = this.guardianLevel.getFloorHeightAt(position.x, position.z);
    const playerFloor = this.guardianLevel.getFloorHeightAt(player.x, player.z);
    return Math.abs(ownFloor - playerFloor) <= 0.8
      && Math.hypot(player.x - position.x, player.z - position.z) <= guardianConfig.attackRange
      && this.guardianLevel.hasLineOfSight(this.attackOrigin(), player);
  }

  private attackOrigin(): THREE.Vector3 {
    return this.getPosition().clone().add(new THREE.Vector3(0, 0.35, 0));
  }

  private moveGuardian(direction: THREE.Vector3): void {
    const position = this.getPosition();
    const steps = Math.max(1, Math.ceil(direction.length() / 0.1));
    for (let index = 0; index < steps; index++) {
      const nextX = position.x + direction.x / steps;
      if (!this.guardianLevel.isColliding(nextX, position.z, guardianConfig.radius)) position.x = nextX;
      const nextZ = position.z + direction.z / steps;
      if (!this.guardianLevel.isColliding(position.x, nextZ, guardianConfig.radius)) position.z = nextZ;
    }
    position.y = this.guardianLevel.getFloorHeightAt(position.x, position.z) + guardianConfig.scale;
  }

  private showGuardianFrame(kind: 'idle' | 'walk' | 'attack', frame = 0): void {
    const mesh = this.getMesh();
    mesh.geometry = kind === 'idle' ? this.guardianArt.geometries.idle : this.guardianArt.geometries[kind][frame];
    if (this.guardianMaterial.map !== this.guardianArt.textures[kind]) {
      this.guardianMaterial.map = this.guardianArt.textures[kind];
      this.guardianMaterial.emissiveMap = this.guardianArt.textures[kind];
      this.guardianMaterial.needsUpdate = true;
    }
    mesh.customDepthMaterial = this.guardianArt.depthMaterials[kind];
    mesh.customDistanceMaterial = this.guardianArt.distanceMaterials[kind];
  }

  private presentGuardian(): void {
    const preparing = this.guardianState === 'ATTACK';
    const color = preparing
      ? this.guardianAttack === 'throw' ? 0xa6d5da : visualColors.warning
      : this.guardianPhase === 2 ? visualColors.blood : visualColors.brass;
    this.guardianMaterial.color.setHex(this.impactFlash > 0 ? visualColors.blood : color);
    this.guardianMaterial.emissive.setHex(color);
    this.guardianMaterial.emissiveIntensity = preparing ? 0.4 : this.guardianPhase === 2 ? 0.08 : 0;
    this.throwSign.rotation.z = this.stateTime * 4;
  }

  override dispose(scene: THREE.Scene): void {
    if (this.guardianDisposed) return;
    this.guardianDisposed = true;
    this.guardianHealth = 0;
    this.throwSign.removeFromParent();
    this.throwSign.geometry.dispose();
    this.throwSign.material.dispose();
    super.dispose(scene);
  }
}
