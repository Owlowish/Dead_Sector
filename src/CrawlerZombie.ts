import * as THREE from 'three';
import type { Level } from './Level.ts';
import { crawlerConfig, crawlerAnimation, crawlerGroundOffsetY, type CrawlerPose } from './CrawlerAnimation.ts';
import { prepareSpriteHitMask } from './SpriteHitMask.ts';

const WIDTH = crawlerConfig.width;
const HEIGHT = crawlerConfig.height;

interface CrawlerSharedResources {
  geometry: THREE.PlaneGeometry;
  materials: Record<CrawlerPose, THREE.MeshStandardMaterial>;
}

let shared: CrawlerSharedResources | null = null;

function getShared(): CrawlerSharedResources {
  if (shared) return shared;
  const loader = new THREE.TextureLoader();
  const materials = {} as Record<CrawlerPose, THREE.MeshStandardMaterial>;

  for (const pose of crawlerAnimation.poses) {
    const map = loader.load(`/assets/zombies/crawler/${pose}.png`, prepareSpriteHitMask);
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.colorSpace = THREE.SRGBColorSpace;
    materials[pose] = new THREE.MeshStandardMaterial({
      map,
      roughness: 1,
      metalness: 0,
      transparent: true,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
    });
  }

  shared = {
    geometry: new THREE.PlaneGeometry(WIDTH, HEIGHT),
    materials,
  };
  return shared;
}

export class CrawlerZombie {
  private readonly level: Level;
  private readonly mesh: THREE.Mesh;
  private alive = true;
  private disposed = false;
  private pose: CrawlerPose = 'idle';
  private walkStep = 0;
  private attackCooldownTimer = 0;
  private isAttacking = false;
  private attackTimer = 0;
  private isHurt = false;
  private hurtTimer = 0;
  private isDying = false;
  private deathTimer = 0;
  private hissAudio: THREE.PositionalAudio | null = null;

  // 1. Ghostly Stutter : Mouvement paranormal saccadé
  private stutterPhaseTimer = 0;
  private isStutterLunge = true;

  // 2. Phobie de la lampe & Frénésie
  private isFrenzy = false;
  private frenzyTimer = 0;
  private isFlinching = false;
  private flinchTimer = 0;
  private lightCooldown = 0;
  private readonly sightRay = new THREE.Raycaster();

  private routeWaypoint: THREE.Vector3 | null = null;
  private routeReplanTimer = 0;
  private readonly baseSpeed = crawlerConfig.speed;
  private readonly radius = crawlerConfig.collisionRadius;
  private healthLeft = crawlerConfig.health;

  constructor(scene: THREE.Scene, level: Level, x: number, z: number) {
    this.level = level;
    const floorY = typeof level.getFloorHeightAt === 'function' ? level.getFloorHeightAt(x, z) : 0;
    const resources = getShared();
    this.mesh = new THREE.Mesh(resources.geometry, resources.materials.idle);
    this.mesh.position.set(x, floorY + crawlerGroundOffsetY, z);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  public static warmup(): void {
    getShared();
  }

  public getKind(): 'crawler' {
    return 'crawler';
  }

  public getPose(): CrawlerPose {
    return this.pose;
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position;
  }

  public isAlive(): boolean {
    return this.alive;
  }

  public isThreat(): boolean {
    return this.alive && !this.isDying;
  }

  public getCollisionRadius(): number {
    return this.radius;
  }

  public alert(targetPos: THREE.Vector3): void {
    if (!this.alive || this.isDying) return;
    this.routeWaypoint = targetPos.clone();
    this.routeReplanTimer = 0.2;
  }

  public setupAudio(listener: THREE.AudioListener, buffer: AudioBuffer): void {
    if (!this.alive || this.disposed) return;
    try {
      this.hissAudio = new THREE.PositionalAudio(listener);
      this.hissAudio.setBuffer(buffer);
      this.hissAudio.setRefDistance(3);
      this.hissAudio.setMaxDistance(18);
      this.hissAudio.setPlaybackRate(1.45);
      this.hissAudio.setVolume(0.35);
      this.mesh.add(this.hissAudio);
    } catch {
      // Audio facultatif si contexte verrouillé
    }
  }

  public stopAudio(): void {
    if (this.hissAudio?.isPlaying) {
      try {
        this.hissAudio.stop();
      } catch {
        // Ignorer erreurs audio
      }
    }
  }

  public takeDamage(amount: number, isHeadshot = false, _impactForce = 0): void {
    if (!this.alive || this.isDying) return;
    const effectiveDamage = isHeadshot ? amount * 1.5 : amount;
    this.healthLeft -= effectiveDamage;

    if (this.healthLeft <= 0) {
      this.die();
    } else {
      this.isHurt = true;
      this.hurtTimer = crawlerConfig.hurtDuration;
      this.setPose('hurt');
    }
  }

  private die(): void {
    this.alive = false;
    this.isDying = true;
    this.deathTimer = crawlerAnimation.deathDuration;
    this.setPose('death');
    this.mesh.castShadow = false;
    this.stopAudio();
  }

  public updateDeath(_delta: number, viewer: THREE.Vector3): void {
    if (this.disposed) return;
    const dx = viewer.x - this.mesh.position.x;
    const dz = viewer.z - this.mesh.position.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  private setPose(newPose: CrawlerPose): void {
    if (this.pose === newPose) return;
    this.pose = newPose;
    this.mesh.material = getShared().materials[newPose];
  }

  public update(
    delta: number,
    playerPosition: THREE.Vector3,
    allZombies: Array<{ getPosition(): THREE.Vector3; isAlive(): boolean }>,
    onAttackPlayer?: (damage: number, isAnkleGrab?: boolean) => void,
    playerContext?: { isFlashlightOn: boolean; cameraDirection: THREE.Vector3 }
  ): void {
    if (this.disposed) return;

    // Orientation face au joueur (billboard Y-axis)
    const dx = playerPosition.x - this.mesh.position.x;
    const dz = playerPosition.z - this.mesh.position.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);

    if (this.isDying) {
      this.deathTimer -= delta;
      return;
    }

    // Gestion du recul de blessure classique
    if (this.isHurt) {
      this.hurtTimer -= delta;
      if (this.hurtTimer <= 0) {
        this.isHurt = false;
      } else {
        return;
      }
    }

    const distToPlayer = Math.hypot(dx, dz);

    // =========================================================================
    // 2. RÉACTION À LA LAMPE TORCHE : Spasme initial puis Frénésie
    // =========================================================================
    if (this.lightCooldown > 0) this.lightCooldown -= delta;
    if (this.isFrenzy) {
      this.frenzyTimer -= delta;
      if (this.frenzyTimer <= 0) this.isFrenzy = false;
    }

    if (this.isFlinching) {
      this.flinchTimer -= delta;
      if (this.flinchTimer <= 0) {
        this.isFlinching = false;
      } else {
        this.setPose('hurt');
        return; // Stoppée brièvement par l'éblouissement
      }
    }

    if (playerContext?.isFlashlightOn && !this.isFrenzy && this.lightCooldown <= 0 && distToPlayer < 14) {
      // Vecteur du Joueur vers le Crawler
      const dirToCrawler = new THREE.Vector3(this.mesh.position.x - playerPosition.x, 0, this.mesh.position.z - playerPosition.z).normalize();
      const dot = playerContext.cameraDirection.x * dirToCrawler.x + playerContext.cameraDirection.z * dirToCrawler.z;
      // Si la créature se trouve dans le cône lumineux frontal (~26 degrés)
      if (dot > 0.88) {
        const rayStart = playerPosition.clone();
        const rayDir = dirToCrawler.clone();
        this.sightRay.set(rayStart, rayDir);
        this.sightRay.far = distToPlayer;
        const blockers = this.level.getSolidMeshes();
        for (const b of blockers) b.updateWorldMatrix(true, false);
        if (this.sightRay.intersectObjects(blockers, false).length === 0) {
          // Déclenchement du spasme d'effroi et passage en furie
          this.isFlinching = true;
          this.flinchTimer = 0.20;
          this.isFrenzy = true;
          this.frenzyTimer = 3.2;
          this.lightCooldown = 6.0;
          this.setPose('hurt');
          if (this.hissAudio && !this.hissAudio.isPlaying) {
            try { this.hissAudio.play(); } catch { /* ignore */ }
          }
          return;
        }
      }
    }

    // =========================================================================
    // 3. ATTAQUE & AGRIPPEMENT AUX CHEVILLES (The Ankle Grab)
    // =========================================================================
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= delta;
    }

    if (this.isAttacking) {
      this.attackTimer += delta;
      if (this.attackTimer >= crawlerConfig.attackWindup && this.attackTimer - delta < crawlerConfig.attackWindup) {
        if (distToPlayer <= crawlerConfig.attackRange + 0.35) {
          // Attaque avec agrippement (isAnkleGrab = true)
          onAttackPlayer?.(crawlerConfig.attackDamage, true);
          if (this.hissAudio && !this.hissAudio.isPlaying) {
            try { this.hissAudio.play(); } catch { /* ignore */ }
          }
        }
      }
      if (this.attackTimer >= crawlerConfig.attackWindup + crawlerConfig.attackRecovery) {
        this.isAttacking = false;
        this.attackCooldownTimer = crawlerConfig.attackCooldown;
      }
      return;
    }

    if (distToPlayer <= crawlerConfig.attackRange && this.attackCooldownTimer <= 0) {
      this.isAttacking = true;
      this.attackTimer = 0;
      this.setPose('attack');
      return;
    }

    // =========================================================================
    // 1. DÉPLACEMENT SACCADÉ PARANORMAL (Ghostly Stutter)
    // =========================================================================
    this.routeReplanTimer -= delta;
    if (this.routeReplanTimer <= 0 || !this.routeWaypoint) {
      this.routeReplanTimer = 0.35 + Math.random() * 0.2;
      this.routeWaypoint = this.level.findNextWaypoint(this.mesh.position, playerPosition, this.radius);
    }

    const target = this.routeWaypoint ?? playerPosition;
    const tdx = target.x - this.mesh.position.x;
    const tdz = target.z - this.mesh.position.z;
    const moveDist = Math.hypot(tdx, tdz);

    if (moveDist > 0.05) {
      // Rythme de pulsation : propulsion nerveuse vs micro-arrêt convulsif
      const lungeDuration = this.isFrenzy ? 0.12 : 0.16;
      const pauseDuration = this.isFrenzy ? 0.05 : 0.08;
      this.stutterPhaseTimer += delta;

      if (this.isStutterLunge && this.pose === 'idle') {
        this.setPose(this.walkStep === 0 ? 'crawl-a' : 'crawl-b');
      }

      if (this.isStutterLunge && this.stutterPhaseTimer >= lungeDuration) {
        this.isStutterLunge = false;
        this.stutterPhaseTimer = 0;
        this.setPose('idle');
      } else if (!this.isStutterLunge && this.stutterPhaseTimer >= pauseDuration) {
        this.isStutterLunge = true;
        this.stutterPhaseTimer = 0;
        this.walkStep = (this.walkStep + 1) % 2;
        this.setPose(this.walkStep === 0 ? 'crawl-a' : 'crawl-b');
      }

      // Vitesse instantanée selon la phase
      const currentMultiplier = this.isStutterLunge
        ? (this.isFrenzy ? 1.85 : 1.50)
        : 0.12;
      const currentSpeed = this.baseSpeed * currentMultiplier;

      let vx = (tdx / moveDist) * currentSpeed * delta;
      let vz = (tdz / moveDist) * currentSpeed * delta;

      // Évitement des autres ennemis
      for (const other of allZombies) {
        if (other === this || !other.isAlive()) continue;
        const op = other.getPosition();
        const sepX = this.mesh.position.x - op.x;
        const sepZ = this.mesh.position.z - op.z;
        const sepDist = Math.hypot(sepX, sepZ);
        if (sepDist > 0.001 && sepDist < 0.8) {
          const push = ((0.8 - sepDist) / 0.8) * 1.5 * delta;
          vx += (sepX / sepDist) * push;
          vz += (sepZ / sepDist) * push;
        }
      }

      const nextX = this.mesh.position.x + vx;
      const nextZ = this.mesh.position.z + vz;

      if (!this.level.isColliding(nextX, this.mesh.position.z, this.radius)) {
        this.mesh.position.x = nextX;
      }
      if (!this.level.isColliding(this.mesh.position.x, nextZ, this.radius)) {
        this.mesh.position.z = nextZ;
      }

      const floorY = typeof this.level.getFloorHeightAt === 'function'
        ? this.level.getFloorHeightAt(this.mesh.position.x, this.mesh.position.z)
        : 0;
      this.mesh.position.y = floorY + crawlerGroundOffsetY;
    } else {
      this.setPose('idle');
    }
  }

  public dispose(scene: THREE.Scene): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAudio();
    scene.remove(this.mesh);
  }
}
