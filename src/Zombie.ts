import * as THREE from 'three';
import type { Level } from './Level';
import { visualColors } from './VisualStyle.ts';
import { zombieAnimation, attackFrame, createAtlasFrameGeometry } from './ZombieAnimation.ts';
import { ZombieRemains } from './ZombieRemains.ts';
import { SpitterZombie } from './SpitterZombie.ts';
import { prepareSpriteHitMask } from './SpriteHitMask.ts';
import {
  agileZombieConfig,
  agileAnimationsData,
  agileAttackFrameIndex,
  getAgileSharedResources,
  releaseAgileSharedResources,
  disposeAgileSharedResources,
  type AgileSharedResources,
} from './AgileZombieAnimation.ts';

type ZombieState = 'IDLE' | 'CHASE' | 'SEARCH' | 'ATTACK' | 'RECOVER';

export interface StandardSharedResources {
  users: number;
  textures: {
    idle: THREE.Texture;
    walk: THREE.Texture;
    attack: THREE.Texture;
    hurt: THREE.Texture;
  };
  geometries: {
    idle: THREE.BufferGeometry;
    walk: THREE.BufferGeometry[];
    attack: THREE.BufferGeometry[];
    hurt: THREE.BufferGeometry[];
  };
  depthMaterials: {
    idle: THREE.MeshDepthMaterial;
    walk: THREE.MeshDepthMaterial;
    attack: THREE.MeshDepthMaterial;
    hurt: THREE.MeshDepthMaterial;
  };
  distanceMaterials: {
    idle: THREE.MeshDistanceMaterial;
    walk: THREE.MeshDistanceMaterial;
    attack: THREE.MeshDistanceMaterial;
    hurt: THREE.MeshDistanceMaterial;
  };
}

let standardSharedInstance: StandardSharedResources | null = null;

export function getStandardSharedResources(): StandardSharedResources {
  if (standardSharedInstance) {
    standardSharedInstance.users++;
    return standardSharedInstance;
  }

  const loader = new THREE.TextureLoader();
  const idle = loader.load('/assets/zombies/zombie_idle.png', prepareSpriteHitMask);
  const walk = loader.load('/assets/zombies/zombie_walk_v2.png', prepareSpriteHitMask);
  const attack = loader.load('/assets/zombies/zombie_attack.png', prepareSpriteHitMask);
  const hurt = loader.load('/assets/zombies/zombie_hurt_v2.png', prepareSpriteHitMask);

  for (const texture of [idle, walk, attack, hurt]) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  const textures = { idle, walk, attack, hurt };

  const createDepth = (map: THREE.Texture) =>
    new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map,
      alphaTest: 0.4,
    });

  const createDistance = (map: THREE.Texture) =>
    new THREE.MeshDistanceMaterial({
      map,
      alphaTest: 0.4,
    });

  const geometries = {
    idle: new THREE.PlaneGeometry(1, 2),
    walk: Array.from({ length: zombieAnimation.walk.frames }, (_, i) =>
      createAtlasFrameGeometry(1, 2, i, zombieAnimation.walk)
    ),
    attack: Array.from({ length: zombieAnimation.attack.frames }, (_, i) =>
      createAtlasFrameGeometry(1, 2, i, zombieAnimation.attack)
    ),
    hurt: Array.from({ length: zombieAnimation.hurt.frames }, (_, i) =>
      createAtlasFrameGeometry(1, 2, i, zombieAnimation.hurt)
    ),
  };

  const depthMaterials = {
    idle: createDepth(textures.idle),
    walk: createDepth(textures.walk),
    attack: createDepth(textures.attack),
    hurt: createDepth(textures.hurt),
  };

  const distanceMaterials = {
    idle: createDistance(textures.idle),
    walk: createDistance(textures.walk),
    attack: createDistance(textures.attack),
    hurt: createDistance(textures.hurt),
  };

  standardSharedInstance = {
    users: 1,
    textures,
    geometries,
    depthMaterials,
    distanceMaterials,
  };

  return standardSharedInstance;
}

export function releaseStandardSharedResources(): void {
  if (!standardSharedInstance) return;
  standardSharedInstance.users--;
  // Ne pas détruire les ressources graphiques entre les paliers :
  // elles restent en mémoire GPU/VRAM pour les paliers 2 et 3.
}

export function disposeStandardSharedResources(): void {
  if (!standardSharedInstance) return;
  const res = standardSharedInstance;
  Object.values(res.textures).forEach((t) => t.dispose());
  res.geometries.idle.dispose();
  res.geometries.walk.forEach((g) => g.dispose());
  res.geometries.attack.forEach((g) => g.dispose());
  res.geometries.hurt.forEach((g) => g.dispose());
  Object.values(res.depthMaterials).forEach((m) => m.dispose());
  Object.values(res.distanceMaterials).forEach((m) => m.dispose());
  standardSharedInstance = null;
}

export function disposeAllZombieResources(): void {
  disposeStandardSharedResources();
  disposeAgileSharedResources();
  ZombieRemains.disposeSharedResources();
  SpitterZombie.disposeSharedResources();
}

export class Zombie {
  private mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;
  private level: Level;
  private remains: ZombieRemains;
  private disposed = false;
  private readonly kind: 'standard' | 'agile';

  // Ressources zombie standard (partagées en cache)
  private standardResources: StandardSharedResources | null = null;

  // Ressources zombie agile (partagées en cache pour économiser la VRAM)
  private agileResources: AgileSharedResources | null = null;

  private hurtRemaining = 0;
  private attackAnimationTime: number | null = null;

  private state: ZombieState = 'IDLE';
  private lastSeenPosition: THREE.Vector3 | null = null;
  private searchWaypoint: THREE.Vector3 | null = null;
  private searchReplanTimer = 0;

  private readonly detectionRadius = 8;
  private readonly speed: number;
  private readonly radius = 0.4;
  private readonly stopDistance = 1.2;
  private readonly separationRadius = 0.85;
  private readonly separationStrength = 1.8;
  private readonly attackRange = 1.4;
  private readonly attackDamage = 10;
  private readonly attackInterval: number;
  private readonly attackWindupDuration: number;
  private readonly hurtDuration: number;
  private attackWindupRemaining = 0;
  private attackCooldown = 0;
  private readonly sightRay = new THREE.Raycaster();

  private readonly frameCount: number;
  private readonly frameDuration: number;

  private frameIndex = 0;
  private frameTimer = 0;
  private isWalking = false;

  // Système de santé.
  private health: number;
  private alive = true;
  private revivalPending = false;
  private reviving = false;
  private hasRevived = false;
  private justRevived = false;
  private revivalDelay = 0;
  private readonly random: () => number;
  private readonly hitFlashDuration = 0.2;
  private hitFlashRemaining = 0;
  private groanAudio: THREE.PositionalAudio | null = null;
  private groanTimer = 1.5 + Math.random() * 3;

  constructor(
    scene: THREE.Scene,
    level: Level,
    x: number,
    z: number,
    kind: 'standard' | 'agile' = 'standard',
    random: () => number = Math.random
  ) {
    this.level = level;
    this.kind = kind;
    this.random = random;
    const initialFloorY = typeof this.level.getFloorHeightAt === 'function' ? this.level.getFloorHeightAt(x, z) : 0;

    if (kind === 'agile') {
      this.speed = agileZombieConfig.speed;
      this.health = agileZombieConfig.health;
      this.attackWindupDuration = agileZombieConfig.attackWindup;
      this.attackInterval = agileZombieConfig.attackInterval;
      this.hurtDuration = agileZombieConfig.hurtDuration;
      this.frameCount = agileAnimationsData.run.frames.length;
      this.frameDuration = agileAnimationsData.run.frames[0].duration;

      this.agileResources = getAgileSharedResources();
      this.material = this.agileResources.materials.idle;
      const initialGeom = this.agileResources.geometries.idle[0];

      this.mesh = new THREE.Mesh(initialGeom, this.material);
      this.mesh.position.set(x, initialFloorY + 1.0, z);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.mesh.customDepthMaterial = this.agileResources.depthMaterials.idle;
      this.mesh.customDistanceMaterial = this.agileResources.distanceMaterials.idle;
    } else {
      this.speed = 1.5;
      this.health = 100;
      this.attackWindupDuration = zombieAnimation.windup;
      this.attackInterval = 1.0;
      this.hurtDuration = zombieAnimation.hurtDuration;
      this.frameCount = zombieAnimation.walk.frames;
      this.frameDuration = zombieAnimation.walk.frameDuration;

      this.standardResources = getStandardSharedResources();
      this.material = new THREE.MeshStandardMaterial({
        map: this.standardResources.textures.idle,
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
      });

      this.mesh = new THREE.Mesh(this.standardResources.geometries.idle, this.material);
      this.mesh.position.set(x, initialFloorY + 1.0, z);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.mesh.customDepthMaterial = this.standardResources.depthMaterials.idle;
      this.mesh.customDistanceMaterial = this.standardResources.distanceMaterials.idle;
    }

    scene.add(this.mesh);
    this.remains = new ZombieRemains(scene, this.kind);
  }

  public getKind(): 'standard' | 'agile' {
    return this.kind;
  }

  public setupAudio(listener: THREE.AudioListener, buffer: AudioBuffer): void {
    if (!this.alive || this.disposed) return;
    this.groanAudio = new THREE.PositionalAudio(listener);
    this.groanAudio.setBuffer(buffer);
    this.groanAudio.setRefDistance(2.5);
    this.groanAudio.setMaxDistance(16);
    this.groanAudio.setRolloffFactor(1.5);
    // Le Coureur a une tonalité légèrement plus haute
    if (this.kind === 'agile') {
      this.groanAudio.setPlaybackRate(1.25);
      this.groanAudio.setVolume(0.25);
    } else {
      this.groanAudio.setVolume(0.3);
    }
    this.mesh.add(this.groanAudio);
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  public stopAudio(): void {
    if (this.groanAudio?.isPlaying) this.groanAudio.stop();
  }

  public static warmup(): void {
    getStandardSharedResources();
    getAgileSharedResources();
    ZombieRemains.warmup();
  }

  public dispose(scene: THREE.Scene): void {
    if (this.disposed) return;
    this.disposed = true;
    this.alive = false;
    this.revivalPending = false;
    this.mesh.visible = false;
    this.stopAudio();
    if (this.groanAudio) {
      this.groanAudio.disconnect();
      this.groanAudio.gain.disconnect();
      this.groanAudio.removeFromParent();
      this.groanAudio = null;
    }
    this.remains.dispose();
    scene.remove(this.mesh);

    if (this.kind === 'agile') {
      releaseAgileSharedResources();
      this.agileResources = null;
    } else {
      this.material.dispose();
      releaseStandardSharedResources();
      this.standardResources = null;
    }
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position;
  }

  public isAlive(): boolean {
    return this.alive;
  }

  public isThreat(): boolean {
    return this.alive || this.revivalPending;
  }

  public getState(): ZombieState {
    return this.state;
  }

  public alert(targetPosition: THREE.Vector3): void {
    if (!this.alive) return;
    this.lastSeenPosition = targetPosition.clone();
    this.searchWaypoint = null;
    this.searchReplanTimer = Math.random() * 0.1;
    if (this.state === 'IDLE') {
      this.state = 'SEARCH';
    }
  }

  public takeDamage(amount: number, headHit = false): void {
    if (!this.alive) return;

    this.health = Math.max(0, this.health - amount);
    console.log(`Zombie [${this.kind}] HP: ${this.health}`);

    if (this.health <= 0) {
      this.die(headHit);
    } else {
      this.hitFlashRemaining = this.hitFlashDuration;
      this.hurtRemaining = this.hurtDuration;
      // Une blessure interrompt la préparation d'attaque
      this.attackWindupRemaining = 0;
      this.attackAnimationTime = null;
      this.state = 'IDLE';
      this.isWalking = false;

      if (this.kind === 'agile') {
        this.showAgileFrame('hurt', 0);
      } else {
        this.showStandardFrame('hurt', 0);
      }
      this.material.color.setHex(visualColors.blood);
    }
  }

  private die(headHit = false): void {
    const revivalChance = this.kind === 'agile' ? 0.12 : 0.2;
    this.revivalPending = !headHit && (this.kind === 'standard' || this.kind === 'agile') && !this.hasRevived && this.random() < revivalChance;
    this.revivalDelay = this.revivalPending ? (this.kind === 'agile' ? 2.0 : 2.5) : 0;
    this.alive = false;
    this.mesh.visible = false;
    this.attackWindupRemaining = 0;
    this.attackAnimationTime = null;
    this.hurtRemaining = 0;
    this.isWalking = false;
    this.stopAudio();
    this.remains.start(this.mesh.position, this.mesh.rotation.y);

    console.log(`Zombie [${this.kind}] éliminé !`);
  }

  public updateDeath(delta: number, viewerPosition: THREE.Vector3): void {
    if (this.alive || this.disposed) return;
    this.remains.update(delta, viewerPosition);
    if (!this.revivalPending) return;
    if (!this.reviving) {
      const prevDelay = this.revivalDelay;
      this.revivalDelay = Math.max(0, this.revivalDelay - delta);
      if (prevDelay > 0.4 && this.revivalDelay <= 0.4) {
        if (this.groanAudio && !this.groanAudio.isPlaying) {
          this.groanAudio.play();
        }
      }
      if (this.revivalDelay === 0) {
        this.reviving = true;
        this.remains.beginRevival();
      }
    } else if (this.remains.consumeRevivalFinished()) {
      this.reviving = false;
      this.revivalPending = false;
      this.hasRevived = true;
      this.alive = true;
      this.justRevived = true;
      this.health = 40;
      this.mesh.visible = true;
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.material.color.setHex(0xffffff);
      if (this.kind === 'agile') {
        this.showAgileFrame('idle', 0);
      } else {
        this.showStandardFrame('idle');
      }
      this.state = 'SEARCH';
      this.lastSeenPosition = viewerPosition.clone();
      this.searchWaypoint = null;
      this.attackCooldown = 0.8;
    }
  }

  public consumeJustRevived(): boolean {
    const val = this.justRevived;
    this.justRevived = false;
    return val;
  }

  public update(
    delta: number,
    playerPosition: THREE.Vector3,
    otherZombies: Zombie[],
    onAttack: (damage: number) => void
  ): void {
    if (!this.alive) return;

    // Râle spatial périodique
    if (this.groanAudio) {
      this.groanTimer -= delta;
      if (this.groanTimer <= 0) {
        if (!this.groanAudio.isPlaying) {
          this.groanAudio.play();
        }
        this.groanTimer = 6 + Math.random() * 4;
      }
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    if (this.attackAnimationTime !== null) this.attackAnimationTime += delta;

    const attackTotalDuration =
      this.kind === 'agile'
        ? agileZombieConfig.attackWindup + agileZombieConfig.attackImpactDuration + agileZombieConfig.attackRecoveryDuration
        : zombieAnimation.windup + zombieAnimation.impactDuration + zombieAnimation.recoveryDuration;

    if (this.state === 'RECOVER' && this.attackAnimationTime !== null && this.attackAnimationTime >= attackTotalDuration) {
      this.attackAnimationTime = null;
      this.state = 'IDLE';
    }

    if (this.hitFlashRemaining > 0) {
      this.hitFlashRemaining = Math.max(0, this.hitFlashRemaining - delta);
    }

    if (this.hurtRemaining > 0) {
      this.hurtRemaining = Math.max(0, this.hurtRemaining - delta);
      if (this.hurtRemaining < 1e-6) this.hurtRemaining = 0;
      const elapsed = this.hurtDuration - this.hurtRemaining;
      const frame = Math.min(1, Math.floor(elapsed / (this.hurtDuration / 2)));
      if (this.kind === 'agile') {
        this.showAgileFrame('hurt', frame);
      } else {
        this.showStandardFrame('hurt', frame);
      }
      this.material.color.setHex(this.hitFlashRemaining > 0 ? visualColors.blood : 0xffffff);
      this.mesh.rotation.y = Math.atan2(playerPosition.x - this.mesh.position.x, playerPosition.z - this.mesh.position.z);
      return; // Ni poursuite, ni séparation, ni attaque pendant la réaction de douleur
    }

    const dx = playerPosition.x - this.mesh.position.x;
    const dy = playerPosition.y - this.mesh.position.y;
    const dz = playerPosition.z - this.mesh.position.z;
    const distance = Math.hypot(dx, dy, dz);

    const canSeePlayer = distance <= this.detectionRadius && this.hasClearPath(dx, dy, dz, distance);
    if (canSeePlayer) {
      this.lastSeenPosition = playerPosition.clone();
      this.searchWaypoint = null;
      this.searchReplanTimer = 0;
    }
    if (this.state === 'ATTACK' && (distance > this.attackRange || !canSeePlayer)) {
      this.attackWindupRemaining = 0;
      this.attackAnimationTime = null;
      this.state = 'IDLE';
    }
    if (this.state !== 'ATTACK' && this.state !== 'RECOVER') {
      this.state = canSeePlayer ? 'CHASE' : this.lastSeenPosition ? 'SEARCH' : 'IDLE';
    }

    const oldX = this.mesh.position.x;
    const oldZ = this.mesh.position.z;
    let moveX = 0;
    let moveZ = 0;

    if (this.state === 'CHASE' && distance > this.stopDistance) {
      const hDist = Math.hypot(dx, dz) || 1;
      moveX += (dx / hDist) * this.speed * delta;
      moveZ += (dz / hDist) * this.speed * delta;
    }

    if (this.state === 'SEARCH' && this.lastSeenPosition) {
      const remaining = Math.hypot(this.lastSeenPosition.x - this.mesh.position.x, this.lastSeenPosition.z - this.mesh.position.z);
      if (remaining < 0.25) {
        this.lastSeenPosition = null;
        this.searchWaypoint = null;
        this.state = 'IDLE';
      } else {
        this.searchReplanTimer -= delta;
        if (this.searchReplanTimer <= 0) {
          this.searchWaypoint = this.level.findNextWaypoint(this.mesh.position, this.lastSeenPosition, this.radius);
          this.searchReplanTimer = 0.4 + Math.random() * 0.2;
        }
        if (this.searchWaypoint) {
          const sx = this.searchWaypoint.x - this.mesh.position.x;
          const sz = this.searchWaypoint.z - this.mesh.position.z;
          const length = Math.hypot(sx, sz);
          if (length > 0.001) {
            const step = Math.min(length, this.speed * delta);
            moveX += (sx / length) * step;
            moveZ += (sz / length) * step;
          }
        }
      }
    }

    // Répulsion mutuelle pour éviter l'empilement
    const sep = this.computeSeparation(otherZombies, delta);
    moveX += sep.x;
    moveZ += sep.z;

    if (moveX !== 0 || moveZ !== 0) {
      this.move(moveX, moveZ);
    }

    const attackX = playerPosition.x - this.mesh.position.x;
    const attackY = playerPosition.y - this.mesh.position.y;
    const attackZ = playerPosition.z - this.mesh.position.z;
    const attackDistance = Math.hypot(attackX, attackY, attackZ);
    const canAttack = attackDistance <= this.attackRange && this.hasClearPath(attackX, attackY, attackZ, attackDistance);

    if (this.state === 'ATTACK') {
      if (!canAttack) {
        this.attackWindupRemaining = 0;
        this.attackAnimationTime = null;
        this.state = 'IDLE';
      } else {
        this.attackWindupRemaining = Math.max(0, this.attackWindupRemaining - delta);
        if (this.attackWindupRemaining === 0) {
          this.state = 'RECOVER';
          this.attackAnimationTime = this.attackWindupDuration;
          this.attackCooldown = this.attackInterval;
          onAttack(this.attackDamage);
        }
      }
    } else if (this.state !== 'RECOVER' && canAttack && this.attackCooldown === 0) {
      this.state = 'ATTACK';
      this.attackWindupRemaining = this.attackWindupDuration;
      this.attackAnimationTime = 0;
    }

    this.material.color.setHex(
      this.hitFlashRemaining > 0 ? visualColors.blood : this.state === 'ATTACK' ? visualColors.warning : 0xffffff
    );

    const movedDistance = Math.hypot(this.mesh.position.x - oldX, this.mesh.position.z - oldZ);
    this.isWalking = movedDistance > 0.00001;

    this.updateAnimation(delta);

    // Orientation billboard face au joueur
    this.mesh.rotation.y = Math.atan2(playerPosition.x - this.mesh.position.x, playerPosition.z - this.mesh.position.z);
  }

  private hasClearPath(dx: number, dy: number, dz: number, distance: number): boolean {
    if (distance === 0) return true;
    const direction = new THREE.Vector3(dx / distance, dy / distance, dz / distance);
    this.sightRay.set(this.mesh.position, direction);
    this.sightRay.far = distance;
    const blockers = this.level.getSolidMeshes();
    for (const blocker of blockers) blocker.updateWorldMatrix(true, false);
    return this.sightRay.intersectObjects(blockers, false).length === 0;
  }

  private updateAnimation(delta: number): void {
    if (this.kind === 'agile') {
      this.updateAgileAnimation(delta);
    } else {
      this.updateStandardAnimation(delta);
    }
  }

  private updateStandardAnimation(delta: number): void {
    if (!this.standardResources) return;
    if (this.attackAnimationTime !== null) {
      this.frameIndex = 0;
      this.frameTimer = 0;
      this.showStandardFrame('attack', attackFrame(this.attackAnimationTime));
      return;
    }
    if (!this.isWalking) {
      this.frameIndex = 0;
      this.frameTimer = 0;
      this.showStandardFrame('idle');
      return;
    }

    this.frameTimer += delta;
    while (this.frameTimer >= this.frameDuration) {
      this.frameTimer -= this.frameDuration;
      this.frameIndex = (this.frameIndex + 1) % this.frameCount;
    }

    this.showStandardFrame('walk', this.frameIndex);
  }

  private showStandardFrame(animKey: 'idle' | 'walk' | 'attack' | 'hurt', frameIdx = 0): void {
    if (!this.standardResources) return;

    const geom = animKey === 'idle'
      ? this.standardResources.geometries.idle
      : this.standardResources.geometries[animKey][frameIdx];
    const texture = this.standardResources.textures[animKey];

    if (this.mesh.geometry !== geom) {
      this.mesh.geometry = geom;
    }

    if (this.material.map !== texture) {
      this.material.map = texture;
      this.material.needsUpdate = true;
    }

    this.mesh.customDepthMaterial = this.standardResources.depthMaterials[animKey];
    this.mesh.customDistanceMaterial = this.standardResources.distanceMaterials[animKey];
  }

  private updateAgileAnimation(delta: number): void {
    if (this.attackAnimationTime !== null) {
      this.frameIndex = 0;
      this.frameTimer = 0;
      this.showAgileFrame('attack', agileAttackFrameIndex(this.attackAnimationTime));
      return;
    }

    if (!this.isWalking) {
      this.frameIndex = 0;
      this.frameTimer = 0;
      this.showAgileFrame('idle', 0);
      return;
    }

    this.frameTimer += delta;
    while (this.frameTimer >= this.frameDuration) {
      this.frameTimer -= this.frameDuration;
      this.frameIndex = (this.frameIndex + 1) % this.frameCount;
    }

    this.showAgileFrame('run', this.frameIndex);
  }

  private showAgileFrame(animKey: 'idle' | 'run' | 'attack' | 'hurt', frameIdx: number): void {
    if (!this.agileResources) return;
    const geom = this.agileResources.geometries[animKey][frameIdx];
    const mat = this.agileResources.materials[animKey];

    if (this.mesh.geometry !== geom) {
      this.mesh.geometry = geom;
    }
    if (this.material !== mat) {
      this.material = mat;
      this.mesh.material = mat;
      this.mesh.customDepthMaterial = this.agileResources.depthMaterials[animKey];
      this.mesh.customDistanceMaterial = this.agileResources.distanceMaterials[animKey];
    }
  }

  private computeSeparation(otherZombies: Zombie[], delta: number): { x: number; z: number } {
    let pushX = 0;
    let pushZ = 0;

    for (const other of otherZombies) {
      if (other === this || !other.isAlive()) continue;

      const otherPos = other.getPosition();
      const dx = this.mesh.position.x - otherPos.x;
      const dz = this.mesh.position.z - otherPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist < this.separationRadius) {
        const angle = dist > 0.0001 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
        const safeDist = Math.max(dist, 0.0001);
        const overlap = (this.separationRadius - safeDist) / this.separationRadius;
        const push = overlap * this.separationStrength * delta;

        pushX += Math.cos(angle) * push;
        pushZ += Math.sin(angle) * push;
      }
    }

    return { x: pushX, z: pushZ };
  }

  private move(dx: number, dz: number): void {
    const distance = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(distance / 0.1));

    for (let i = 0; i < steps; i++) {
      const nextX = this.mesh.position.x + dx / steps;
      if (!this.level.isColliding(nextX, this.mesh.position.z, this.radius)) {
        this.mesh.position.x = nextX;
      }

      const nextZ = this.mesh.position.z + dz / steps;
      if (!this.level.isColliding(this.mesh.position.x, nextZ, this.radius)) {
        this.mesh.position.z = nextZ;
      }
    }

    const floorY = typeof this.level.getFloorHeightAt === 'function' ? this.level.getFloorHeightAt(this.mesh.position.x, this.mesh.position.z) : 0;
    this.mesh.position.y = floorY + 1.0;
  }
}
