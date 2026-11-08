import * as THREE from 'three';
import type { Level } from './Level.ts';
import { ZombieRemains } from './ZombieRemains.ts';
import { spitterAnimation, type SpitterPose } from './SpitterAnimation.ts';
import { prepareSpriteHitMask } from './SpriteHitMask.ts';
import { EnemyImpact, type EnemyShotImpact } from './EnemyImpact.ts';

const WIDTH = 1.6;
const HEIGHT = 2.7;

let shared: { texture: THREE.Texture; geometry: THREE.PlaneGeometry; materials: Record<SpitterPose, THREE.MeshStandardMaterial> } | null = null;
function getShared() {
  if (shared) return shared;
  const loader = new THREE.TextureLoader();
  const texture = loader.load('/assets/zombies/spitter/idle.png', prepareSpriteHitMask);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  const materials = {} as Record<SpitterPose, THREE.MeshStandardMaterial>;
  for (const pose of spitterAnimation.poses) {
    const map = pose === 'idle' ? texture : loader.load(`/assets/zombies/spitter/${pose}.png`, prepareSpriteHitMask);
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.colorSpace = THREE.SRGBColorSpace;
    materials[pose] = new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  }
  shared = { texture, geometry: new THREE.PlaneGeometry(WIDTH, HEIGHT), materials };
  return shared;
}

export class SpitterZombie {
  private readonly level: Level;
  private readonly mesh: THREE.Mesh;
  private readonly remains: ZombieRemains;
  private alive = true;
  private disposed = false;
  private pose: SpitterPose = 'idle';
  private poseTime = 0;
  private cooldown = 1.8;
  private routeWaypoint: THREE.Vector3 | null = null;
  private routeReplanTimer = 0;
  private readonly ray = new THREE.Raycaster();
  private readonly speed = 0.62;
  private readonly radius = 0.5;
  private readonly health = 240;
  private healthLeft = this.health;
  private groanAudio: THREE.PositionalAudio | null = null;
  private windupDamageAccumulated = 0;
  private stunRemaining = 0;
  private readonly shotReaction = new EnemyImpact();

  constructor(scene: THREE.Scene, level: Level, x: number, z: number) {
    this.level = level;
    const floorY = level.getFloorHeightAt(x, z);
    this.mesh = new THREE.Mesh(getShared().geometry, getShared().materials.idle);
    this.mesh.position.set(x, floorY + HEIGHT / 2, z);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.remains = new ZombieRemains(scene, 'spitter', level);
  }

  getKind(): 'spitter' { return 'spitter'; }
  getPose(): SpitterPose { return this.pose; }
  getMesh(): THREE.Mesh { return this.mesh; }
  getPosition(): THREE.Vector3 { return this.mesh.position; }
  isAlive(): boolean { return this.alive; }
  stopAudio(): void {
    if (this.groanAudio?.isPlaying) {
      try {
        this.groanAudio.stop();
      } catch {
        // Ignorer les erreurs d'arrêt audio
      }
    }
  }

  setupAudio(listener: THREE.AudioListener, buffer: AudioBuffer, effectsVolume = 1): void {
    if (!this.alive || this.disposed) return;
    this.groanAudio = new THREE.PositionalAudio(listener);
    this.groanAudio.setBuffer(buffer);
    this.groanAudio.setRefDistance(3.0);
    this.groanAudio.setMaxDistance(20);
    this.groanAudio.setRolloffFactor(1.2);
    this.setAudioVolume(effectsVolume);
    // Timbre guttural, lourd et plus grave que les zombies ordinaires
    this.mesh.add(this.groanAudio);
  }

  setAudioVolume(volume: number): void {
    this.groanAudio?.setVolume(0.35 * THREE.MathUtils.clamp(volume, 0, 1));
  }

  alert(_targetPosition: THREE.Vector3): void {}

  stun(seconds: number): void {
    if (!this.alive || this.disposed || !Number.isFinite(seconds) || seconds <= 0) return;
    this.stunRemaining = Math.max(this.stunRemaining, seconds);
    this.stopAudio();
    this.windupDamageAccumulated = 0;
    this.cooldown = Math.max(this.cooldown, 0.4);
    this.setPose('recovery');
  }

  takeDamage(amount: number, _headHit = false, impactForce = amount, impact?: EnemyShotImpact): void {
    if (!this.alive) return;
    this.healthLeft = Math.max(0, this.healthLeft - amount);
    if (this.healthLeft === 0) {
      this.alive = false;
      this.mesh.visible = false;
      this.stopAudio();
      this.shotReaction.clear();
      this.remains.start(this.mesh.position, this.mesh.rotation.y, 1, impact, this.mesh);
      this.setPose('death');
    } else if (this.pose === 'windup' || this.pose === 'release') {
      this.windupDamageAccumulated += impactForce;
      // Règle de gros choc : un coup lourd (fusil >= 55) ou dégâts cumulés (2 balles pistolet >= 75)
      // brise la préparation du crachat. Un tir léger de loin est encaissé sans annulation.
      if (impactForce >= 55 || this.windupDamageAccumulated >= 75) {
        this.stopAudio();
        this.poseTime = 0;
        this.setPose('idle');
        this.cooldown = Math.max(this.cooldown, 1.2);
        this.windupDamageAccumulated = 0;
      }
    }
    if (this.alive) {
      this.shotReaction.start(impact, 0.55);
      this.shotReaction.apply(this.mesh, -HEIGHT / 2);
    }
  }

  update(delta: number, playerPosition: THREE.Vector3, _others: Array<{ getPosition(): THREE.Vector3; isAlive(): boolean }>, spit: (origin: THREE.Vector3, target: THREE.Vector3) => void): void {
    if (!this.alive) return;
    this.shotReaction.update(delta, this.mesh.position, this.level, this.radius, HEIGHT / 2);
    this.cooldown = Math.max(0, this.cooldown - delta);
    if (this.stunRemaining > 0) {
      this.stunRemaining = Math.max(0, this.stunRemaining - Math.max(0, delta));
      if (this.stunRemaining < 1e-6) {
        this.stunRemaining = 0;
        this.setPose('idle');
      }
      this.mesh.rotation.y = Math.atan2(playerPosition.x - this.mesh.position.x, playerPosition.z - this.mesh.position.z);
      this.shotReaction.apply(this.mesh, -HEIGHT / 2);
      return;
    }
    this.poseTime += delta;
    const dx = playerPosition.x - this.mesh.position.x;
    const dy = playerPosition.y - (this.mesh.position.y - 0.25);
    const dz = playerPosition.z - this.mesh.position.z;
    const distance = Math.hypot(dx, dy, dz);
    const minAttackDistance = 1.0;
    const maxAttackDistance = 12.0;
    const visible = distance <= maxAttackDistance && distance >= minAttackDistance && this.hasClearPath(playerPosition, distance);

    if (this.pose === 'windup') {
      if (distance > maxAttackDistance || distance < 0.85 || !this.hasClearPath(playerPosition, distance)) {
        this.setPose('idle');
        this.cooldown = 0.8;
      } else if (this.poseTime >= spitterAnimation.windupDuration) {
        const yaw = Math.atan2(dx, dz);
        this.mesh.rotation.y = yaw;
        const offsetDist = Math.min(0.3, Math.max(0.08, (distance - 0.4) * 0.5));
        const origin = this.mesh.position.clone().add(new THREE.Vector3(Math.sin(yaw) * offsetDist, 0.62, Math.cos(yaw) * offsetDist));
        spit(origin, playerPosition.clone());
        this.setPose('release');
      }
    } else if (this.pose === 'release') {
      if (this.poseTime >= spitterAnimation.releaseDuration) this.setPose('recovery');
    } else if (this.pose === 'recovery') {
      if (this.poseTime >= spitterAnimation.recoveryDuration) {
        this.setPose('idle');
        this.cooldown = Math.max(this.cooldown, spitterAnimation.attackCooldown);
      }
    } else if (visible && this.cooldown <= 0) {
      this.mesh.rotation.y = Math.atan2(dx, dz);
      this.setPose('windup');
    } else if (distance > 10 || !this.hasClearPath(playerPosition, distance)) {
      const flat = Math.hypot(dx, dz) || 1;
      const step = this.speed * delta;
      const directX = dx / flat * step;
      const directZ = dz / flat * step;
      if (!this.hasClearPath(playerPosition, distance)
        || this.level.isColliding(this.mesh.position.x + directX, this.mesh.position.z + directZ, this.radius)) {
        this.routeReplanTimer -= delta;
        if (!this.routeWaypoint || this.routeReplanTimer <= 0) {
          this.routeWaypoint = this.level.findNextWaypoint(this.mesh.position, playerPosition, this.radius);
          this.routeReplanTimer = 0.4;
        }
      } else {
        this.routeWaypoint = null;
      }
      let moveX = directX;
      let moveZ = directZ;
      if (this.routeWaypoint) {
        const wx = this.routeWaypoint.x - this.mesh.position.x;
        const wz = this.routeWaypoint.z - this.mesh.position.z;
        const waypointDistance = Math.hypot(wx, wz);
        if (waypointDistance < 0.25) {
          this.routeWaypoint = null;
        } else {
          const waypointStep = Math.min(step, waypointDistance);
          moveX = wx / waypointDistance * waypointStep;
          moveZ = wz / waypointDistance * waypointStep;
        }
      }
      const nx = this.mesh.position.x + moveX;
      const nz = this.mesh.position.z + moveZ;
      if (!this.level.isColliding(nx, this.mesh.position.z, this.radius)) this.mesh.position.x = nx;
      if (!this.level.isColliding(this.mesh.position.x, nz, this.radius)) this.mesh.position.z = nz;
      this.mesh.position.y = this.level.getFloorHeightAt(this.mesh.position.x, this.mesh.position.z) + HEIGHT / 2;
      if (this.pose !== 'walk-a' && this.pose !== 'walk-b') {
        this.setPose('walk-a');
      } else if (this.poseTime >= spitterAnimation.walkPoseDuration) {
        this.setPose(this.pose === 'walk-a' ? 'walk-b' : 'walk-a');
      }
    } else {
      this.setPose('idle');
    }
    this.mesh.rotation.y = Math.atan2(playerPosition.x - this.mesh.position.x, playerPosition.z - this.mesh.position.z);
    this.shotReaction.apply(this.mesh, -HEIGHT / 2);
  }

  updateDeath(delta: number, viewer: THREE.Vector3): void {
    if (!this.alive && !this.disposed) {
      this.remains.update(delta, viewer);
      this.mesh.position.copy(this.remains.getPosition());
    }
  }

  dispose(scene: THREE.Scene): void {
    if (this.disposed) return;
    this.disposed = true;
    this.alive = false;
    this.stopAudio();
    if (this.groanAudio) {
      this.groanAudio.disconnect();
      this.groanAudio.gain.disconnect();
      this.groanAudio.removeFromParent();
      this.groanAudio = null;
    }
    this.shotReaction.dispose();
    this.remains.dispose();
    scene.remove(this.mesh);
  }

  static disposeSharedResources(): void {
    if (!shared) return;
    shared.geometry.dispose();
    for (const material of Object.values(shared.materials)) {
      material.map?.dispose();
      material.dispose();
    }
    shared = null;
  }

  static warmup(): void {
    getShared();
  }

  private setPose(pose: SpitterPose): void {
    if (this.pose === pose) return;
    this.pose = pose;
    this.poseTime = 0;
    this.mesh.material = getShared().materials[pose];
    if (pose === 'windup') {
      this.windupDamageAccumulated = 0;
      if (this.groanAudio && !this.groanAudio.isPlaying) {
        try {
          this.groanAudio.play();
        } catch {
          // Contexte audio non déverrouillé ou environnement headless
        }
      }
    } else if (pose === 'idle') {
      this.windupDamageAccumulated = 0;
    }
  }

  private hasClearPath(target: THREE.Vector3, distance: number): boolean {
    if (distance < 0.001) return true;
    const origin = this.mesh.position.clone().add(new THREE.Vector3(0, 0.35, 0));
    const direction = target.clone().sub(origin).normalize();
    this.ray.set(origin, direction);
    this.ray.far = distance;
    const blockers = this.level.getSolidMeshes();
    for (const blocker of blockers) blocker.updateWorldMatrix(true, false);
    return this.ray.intersectObjects(blockers, false).length === 0;
  }
}
