import * as THREE from 'three';
import type { Level } from './Level.ts';
import { EnemyImpact, type EnemyShotImpact } from './EnemyImpact.ts';
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
      emissiveMap: map,
      emissive: 0xd4c6a5,
      emissiveIntensity: 0.035,
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
  private stunRemaining = 0;
  private isDying = false;
  private deathTimer = 0;
  private hissAudio: THREE.PositionalAudio | null = null;

  // Traque au ras du sol : traction des bras, arrêt net, nouvelle traction.
  private stutterPhaseTimer = 0;
  private isStutterLunge = true;
  private fixationTimer = 0;
  private fixationCooldown = 0;
  private wasObserved = false;

  // 2. Phobie de la lampe, Fuite & Frénésie
  private isFrenzy = false;
  private frenzyTimer = 0;
  private isFleeing = false;
  private fleeTimer = 0;
  private fleeBlockedTimer = 0;
  private isFlinching = false;
  private flinchTimer = 0;
  private lightCooldown = 0;
  private readonly sightRay = new THREE.Raycaster();

  // 3. Esquive de la ligne de visée (Aim Evasion en fuite uniquement)
  private isEvadingAim = false;
  private evasionSign: 1 | -1 = 1;
  private fleeDodgeTimer = 0;
  private fleeDodgeCooldown = 0;

  // 4. Embuscade suspendue au plafond (Ceiling Ambush & Drop)
  private isCeilingAmbush = false;
  private isDropping = false;
  private dropVelocityY = 0;
  private ceilingStalkTimer = 0;

  private routeWaypoint: THREE.Vector3 | null = null;
  private routeReplanTimer = 0;
  private readonly baseSpeed = crawlerConfig.speed;
  private readonly radius = crawlerConfig.collisionRadius;
  private healthLeft = crawlerConfig.health;
  private readonly shotReaction = new EnemyImpact();
  private fatalImpactTime = Infinity;

  constructor(scene: THREE.Scene, level: Level, x: number, z: number, startOnCeiling = false) {
    this.level = level;
    const floorY = typeof level.getFloorHeightAt === 'function' ? level.getFloorHeightAt(x, z) : 0;
    const ceilingY = typeof (level as unknown as { getCeilingHeightAt?: (x: number, z: number) => number }).getCeilingHeightAt === 'function'
      ? (level as unknown as { getCeilingHeightAt: (x: number, z: number) => number }).getCeilingHeightAt(x, z)
      : (z > 6 ? 4.0 : 6.4);
    const resources = getShared();
    this.mesh = new THREE.Mesh(resources.geometry, resources.materials.idle);

    if (startOnCeiling) {
      this.isCeilingAmbush = true;
      // Positionnée au ras du plafond, tête en bas (offset sous le plafond)
      this.mesh.position.set(x, ceilingY - 0.775, z);
      this.mesh.scale.y = -1; // Tête en bas !
    } else {
      this.mesh.position.set(x, floorY + crawlerGroundOffsetY, z);
    }

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  public static warmup(): void {
    getShared();
  }

  public static disposeSharedResources(): void {
    if (!shared) return;
    shared.geometry.dispose();
    for (const material of Object.values(shared.materials)) {
      material.map?.dispose();
      material.dispose();
    }
    shared = null;
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

  public isFleeingState(): boolean {
    return this.isFleeing;
  }

  public isFrenzyState(): boolean {
    return this.isFrenzy;
  }

  public isEvadingAimState(): boolean {
    return this.isEvadingAim;
  }

  public isCeilingAmbushState(): boolean {
    return this.isCeilingAmbush;
  }

  public isDroppingState(): boolean {
    return this.isDropping;
  }

  public getCollisionRadius(): number {
    return this.radius;
  }

  public alert(targetPos: THREE.Vector3): void {
    if (!this.alive || this.isDying) return;
    this.routeWaypoint = targetPos.clone();
    this.routeReplanTimer = 0.2;
  }

  public setupAudio(listener: THREE.AudioListener, buffer: AudioBuffer, effectsVolume = 1): void {
    if (!this.alive || this.disposed) return;
    try {
      this.hissAudio = new THREE.PositionalAudio(listener);
      this.hissAudio.setBuffer(buffer);
      this.hissAudio.setRefDistance(3);
      this.hissAudio.setMaxDistance(18);
      this.setAudioVolume(effectsVolume);
      this.mesh.add(this.hissAudio);
    } catch {
      // Audio facultatif si contexte verrouillé
    }
  }

  public setAudioVolume(volume: number): void {
    this.hissAudio?.setVolume(0.35 * THREE.MathUtils.clamp(volume, 0, 1));
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

  public stun(seconds: number): void {
    if (!this.alive || this.disposed || this.isDying || !Number.isFinite(seconds) || seconds <= 0) return;
    this.stunRemaining = Math.max(this.stunRemaining, seconds);
    this.isHurt = true;
    this.hurtTimer = Math.max(this.hurtTimer, seconds);
    this.isAttacking = false;
    this.attackTimer = 0;
    this.isEvadingAim = false;
    this.fleeDodgeTimer = 0;
    this.stopAudio();
    this.setPose('hurt');
  }

  public takeDamage(amount: number, isHeadshot = false, _impactForce = 0, impact?: EnemyShotImpact): void {
    if (!this.alive || this.isDying) return;

    // Si touchée au plafond, décroche et tombe immédiatement
    if (this.isCeilingAmbush) {
      this.isCeilingAmbush = false;
      this.isDropping = true;
      this.dropVelocityY = -3.5;
    }

    const effectiveDamage = isHeadshot ? amount * 1.5 : amount;
    this.healthLeft -= effectiveDamage;

    if (this.healthLeft <= 0) {
      this.die();
      this.shotReaction.start(impact, 0.72, true);
      if (impact && impact.power >= 0.35) {
        this.fatalImpactTime = 0;
        this.setPose('hurt');
      }
    } else {
      this.shotReaction.start(impact, 0.72);
      this.isHurt = true;
      this.hurtTimer = Math.max(this.hurtTimer, crawlerConfig.hurtDuration, impact ? 0.26 * impact.power : 0);
      if (impact && impact.power >= 0.35) {
        this.isAttacking = false;
        this.attackTimer = 0;
        this.stopAudio();
      }
      this.setPose('hurt');
    }
    this.shotReaction.apply(this.mesh, -crawlerGroundOffsetY);
  }

  private die(): void {
    this.alive = false;
    this.isDying = true;
    this.deathTimer = crawlerAnimation.deathDuration;
    this.mesh.scale.y = 1; // Toujours remettre à l'endroit
    this.setPose('death');
    this.mesh.castShadow = false;
    this.stopAudio();
    // Si morte en l'air, poser le cadavre au sol
    const floorY = typeof this.level.getFloorHeightAt === 'function'
      ? this.level.getFloorHeightAt(this.mesh.position.x, this.mesh.position.z)
      : 0;
    this.mesh.position.y = floorY + crawlerGroundOffsetY;
    this.isCeilingAmbush = false;
    this.isDropping = false;
  }

  public updateDeath(delta: number, viewer: THREE.Vector3): void {
    if (this.disposed) return;
    if (!this.alive) {
      this.shotReaction.update(delta, this.mesh.position, this.level, this.radius, crawlerGroundOffsetY);
      if (delta > 0 && Number.isFinite(delta)) this.fatalImpactTime += delta;
      if (this.fatalImpactTime >= 0.08) this.setPose('death');
    }
    const dx = viewer.x - this.mesh.position.x;
    const dz = viewer.z - this.mesh.position.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.shotReaction.apply(this.mesh, -crawlerGroundOffsetY);
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
    if (this.disposed || delta <= 0) return;

    // Orientation face au joueur (billboard Y-axis)
    const dx = playerPosition.x - this.mesh.position.x;
    const dz = playerPosition.z - this.mesh.position.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);

    if (this.alive) {
      // La chute du plafond garde sa propre altitude et ses vérifications d'atterrissage.
      this.shotReaction.update(delta, this.mesh.position,
        this.isDropping || this.isCeilingAmbush ? undefined : this.level, this.radius, crawlerGroundOffsetY);
      this.shotReaction.apply(this.mesh, -crawlerGroundOffsetY);
    }

    if (this.isDying) {
      this.deathTimer -= delta;
      return;
    }

    const stunned = this.stunRemaining > 0;
    if (stunned) {
      this.stunRemaining = Math.max(0, this.stunRemaining - delta);
      this.hurtTimer = Math.max(0, this.hurtTimer - delta);
      if (this.stunRemaining < 1e-6) this.stunRemaining = 0;
      if (this.hurtTimer < 1e-6) this.hurtTimer = 0;
      this.isHurt = this.hurtTimer > 0;
    }

    // =========================================================================
    // 0. CHUTE DU PLAFOND EN COURS (Dropping)
    // =========================================================================
    if (this.isDropping) {
      const gravity = 28.0;
      this.dropVelocityY -= gravity * delta;
      this.mesh.position.y += this.dropVelocityY * delta;

      const floorY = typeof this.level.getFloorHeightAt === 'function'
        ? this.level.getFloorHeightAt(this.mesh.position.x, this.mesh.position.z)
        : 0;
      const targetGroundY = floorY + crawlerGroundOffsetY;

      if (this.mesh.position.y <= targetGroundY) {
        this.mesh.position.y = targetGroundY;
        this.mesh.scale.y = 1; // Remise à l'endroit
        this.isDropping = false;
        this.setPose('hurt');
        this.hurtTimer = Math.max(this.hurtTimer, 0.16);
        this.isHurt = true;

        if (!stunned && this.canReachPlayer(playerPosition, 1.8)) {
          onAttackPlayer?.(crawlerConfig.attackDamage, true);
        }
      }
      return;
    }

    if (stunned) {
      this.setPose('hurt');
      return;
    }

    // =========================================================================
    // 0.1 EMBUSCADE AU PLAFOND & DÉCROCHAGE (Ceiling Ambush & Drop)
    // =========================================================================
    if (this.isCeilingAmbush) {
      this.ceilingStalkTimer += delta;
      const distH = Math.hypot(dx, dz);

      // Déclencheurs de décrochage :
      // 1. Joueur à portée horizontale (< 5.0m)
      // 2. Joueur regarde vers elle au plafond (dot > 0.70)
      // 3. Durée de reptation maximale au plafond écoulée (> 2.5s)
      let shouldDrop = distH < 5.0 || this.ceilingStalkTimer >= 2.5;

      if (!shouldDrop && playerContext?.cameraDirection && distH < 16) {
        const toCrawler = new THREE.Vector3().subVectors(this.mesh.position, playerPosition).normalize();
        const dot = playerContext.cameraDirection.dot(toCrawler);
        if (dot > 0.70) {
          shouldDrop = true;
        }
      }

      if (shouldDrop) {
        this.isCeilingAmbush = false;
        this.isDropping = true;
        this.dropVelocityY = -2.5;
        if (this.hissAudio && !this.hissAudio.isPlaying) {
          try { this.hissAudio.play(); } catch { /* ignore */ }
        }
        return;
      }
      // Si elle n'a pas encore décroché, elle continue ci-dessous pour ramper au plafond vers le joueur !
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
    // 2. RÉACTION À LA LAMPE TORCHE : Spasme initial puis 50% Furie / 50% Fuite
    // =========================================================================
    if (this.lightCooldown > 0) this.lightCooldown -= delta;
    if (this.isFrenzy) {
      this.frenzyTimer -= delta;
      if (this.frenzyTimer <= 0) this.isFrenzy = false;
    }
    if (this.isFleeing) {
      this.fleeTimer -= delta;
      if (this.fleeTimer <= 0) this.isFleeing = false;
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

    if (playerContext?.isFlashlightOn && !this.isFrenzy && !this.isFleeing && this.lightCooldown <= 0 && distToPlayer < 14) {
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
          // Déclenchement du spasme d'effroi / éblouissement
          this.isFlinching = true;
          this.flinchTimer = 0.20;
          this.lightCooldown = 5.0;
          this.setPose('hurt');
          if (this.hissAudio && !this.hissAudio.isPlaying) {
            try { this.hissAudio.play(); } catch { /* ignore */ }
          }
          // Comportement aléatoire : 50% Furie (charge directe) / 50% Fuite (repli vers l'ombre)
          if (Math.random() < 0.5) {
            this.isFrenzy = true;
            this.frenzyTimer = 3.2;
            this.isFleeing = false;
          } else {
            this.isFleeing = true;
            this.fleeTimer = 2.6;
            this.isFrenzy = false;
            this.fleeBlockedTimer = 0;
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
      // Une blessure ou la lampe peut suspendre le geste, jamais masquer sa reprise.
      this.setPose('attack');
      this.attackTimer += delta;
      if (this.attackTimer >= crawlerConfig.attackWindup && this.attackTimer - delta < crawlerConfig.attackWindup) {
        if (this.canReachPlayer(playerPosition, crawlerConfig.attackRange + 0.35)) {
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

    if (!this.isCeilingAmbush && !this.isFleeing && this.attackCooldownTimer <= 0
      && this.canReachPlayer(playerPosition, crawlerConfig.attackRange)) {
      this.isAttacking = true;
      this.attackTimer = 0;
      this.setPose('attack');
      // L'indice sonore commence avec la préparation, avant la saisie.
      if (this.hissAudio && !this.hissAudio.isPlaying) {
        try { this.hissAudio.play(); } catch { /* Audio facultatif. */ }
      }
      return;
    }

    // =========================================================================
    // 4. DÉTECTION DU CIBLAGE ET ESQUIVE LATÉRALE (Aim Evasion)
    // =========================================================================
    // Règle formelle : pas d'esquive en mode charge (avance vers le joueur, normale ou furie).
    // Elle ne peut dodger qu'en reculant (mode fuite vers les ombres).
    if (!this.isFleeing || this.isFrenzy) {
      this.isEvadingAim = false;
      this.fleeDodgeTimer = 0;
      this.fleeDodgeCooldown = 0;
    } else if (playerContext?.cameraDirection) {
      const camDir = playerContext.cameraDirection;
      const toCrawlerX = this.mesh.position.x - playerPosition.x;
      const toCrawlerY = this.mesh.position.y - playerPosition.y;
      const toCrawlerZ = this.mesh.position.z - playerPosition.z;

      const forwardProj = toCrawlerX * camDir.x + toCrawlerY * camDir.y + toCrawlerZ * camDir.z;
      // Si la créature se trouve devant le joueur à portée de tir (1.2m à 16m)
      if (forwardProj > 1.2 && forwardProj < 16) {
        const perpX = toCrawlerX - forwardProj * camDir.x;
        const perpY = toCrawlerY - forwardProj * camDir.y;
        const perpZ = toCrawlerZ - forwardProj * camDir.z;
        const perpDist = Math.hypot(perpX, perpY, perpZ);

        // Si le réticule est braqué sur elle pendant sa retraite (< 1.60m)
        if (perpDist < 1.60) {
          if (this.fleeDodgeCooldown > 0) {
            this.fleeDodgeCooldown -= delta;
            this.isEvadingAim = false;
          } else {
            this.isEvadingAim = true;
            this.fleeDodgeTimer += delta;
            if (this.fleeDodgeTimer >= 0.35) {
              this.isEvadingAim = false;
              this.fleeDodgeTimer = 0;
              this.fleeDodgeCooldown = 1.4; // Pause avant un éventuel nouveau sursaut
            }
          }
        } else {
          this.isEvadingAim = false;
          if (this.fleeDodgeCooldown > 0) this.fleeDodgeCooldown -= delta;
        }
      } else {
        this.isEvadingAim = false;
        if (this.fleeDodgeCooldown > 0) this.fleeDodgeCooldown -= delta;
      }
    } else {
      this.isEvadingAim = false;
    }

    // =========================================================================
    // 5. FIXATION AU REGARD, PUIS REPRISE HORS CHAMP
    // =========================================================================
    this.fixationCooldown = Math.max(0, this.fixationCooldown - delta);
    const canStalk = !this.isFrenzy && !this.isFleeing && !this.isCeilingAmbush;
    const observed = canStalk && !!playerContext
      && this.isObservedByPlayer(playerPosition, playerContext.cameraDirection);
    if (!observed) {
      if (this.wasObserved && canStalk) {
        // Pas d'attente artificielle lorsque le joueur lui tourne le dos.
        this.stutterPhaseTimer = 0;
        this.isStutterLunge = true;
      }
      this.fixationTimer = 0;
    } else if (distToPlayer >= 3 && this.fixationTimer <= 0 && this.fixationCooldown <= 0) {
      this.fixationTimer = 0.55;
      this.fixationCooldown = 2.1;
    }
    this.wasObserved = observed;
    if (this.fixationTimer > 0) {
      this.fixationTimer = Math.max(0, this.fixationTimer - delta);
      this.setPose('idle');
      this.syncVerticalPosition();
      return;
    }

    // =========================================================================
    // 6. REPTATION PAR APPUIS OU FUITE
    // =========================================================================
    let tdx: number;
    let tdz: number;

    if (this.isFleeing) {
      // Fuite : s'éloigner directement du joueur
      tdx = this.mesh.position.x - playerPosition.x;
      tdz = this.mesh.position.z - playerPosition.z;
      if (Math.abs(tdx) < 0.01 && Math.abs(tdz) < 0.01) {
        tdx = 1;
        tdz = 0;
      }
    } else {
      this.routeReplanTimer -= delta;
      if (this.routeReplanTimer <= 0 || !this.routeWaypoint) {
        this.routeReplanTimer = 0.35 + Math.random() * 0.2;
        this.routeWaypoint = this.level.findNextWaypoint(this.mesh.position, playerPosition, this.radius);
      }
      const target = this.routeWaypoint ?? playerPosition;
      tdx = target.x - this.mesh.position.x;
      tdz = target.z - this.mesh.position.z;
    }

    const moveDist = Math.hypot(tdx, tdz);

    if (moveDist > 0.05) {
      const unseen = canStalk && !!playerContext && !observed;
      const strokeDistance = this.advanceCrawlStroke(delta, unseen);
      const forwardDistance = Math.min(moveDist, strokeDistance);
      let vx = (tdx / moveDist) * forwardDistance;
      let vz = (tdz / moveDist) * forwardDistance;

      // Décrochage latéral d'esquive si visée active
      if (this.isEvadingAim && playerContext?.cameraDirection) {
        const camDir = playerContext.cameraDirection;
        const hLen = Math.hypot(camDir.x, camDir.z);
        if (hLen > 0.01) {
          const latX = -(camDir.z / hLen) * this.evasionSign;
          const latZ = (camDir.x / hLen) * this.evasionSign;
          const evadeSpeed = strokeDistance * 1.35;
          vx += latX * evadeSpeed;
          vz += latZ * evadeSpeed;
        }
      }

      // Évitement des autres ennemis
      for (const other of strokeDistance > 0 ? allZombies : []) {
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

      const prevX = this.mesh.position.x;
      const prevZ = this.mesh.position.z;
      const steps = Math.max(1, Math.ceil(Math.hypot(vx, vz) / 0.08));
      let collX = false;
      let collZ = false;
      for (let step = 0; step < steps; step++) {
        const nextX = this.mesh.position.x + vx / steps;
        const nextZ = this.mesh.position.z + vz / steps;
        if (this.level.isColliding(nextX, this.mesh.position.z, this.radius)) {
          collX = true;
        } else {
          this.mesh.position.x = nextX;
        }
        if (this.level.isColliding(this.mesh.position.x, nextZ, this.radius)) {
          collZ = true;
        } else {
          this.mesh.position.z = nextZ;
        }
      }
      if (collX || collZ) this.routeReplanTimer = 0;

      // Si heurt d'un mur pendant l'esquive de visée, inverser le côté de zigzag
      if (this.isEvadingAim && (collX || collZ)) {
        this.evasionSign = (this.evasionSign === 1 ? -1 : 1);
      }

      // Détection de coin bloquant pendant la fuite : si acculée contre un mur, bascule en furie
      if (this.isFleeing && strokeDistance > 0) {
        const actualMoved = Math.hypot(this.mesh.position.x - prevX, this.mesh.position.z - prevZ);
        if (actualMoved < 0.003) {
          this.fleeBlockedTimer += delta;
          if (this.fleeBlockedTimer >= 0.45) {
            this.isFleeing = false;
            this.isFrenzy = true;
            this.frenzyTimer = 2.8;
            this.fleeBlockedTimer = 0;
            if (this.hissAudio && !this.hissAudio.isPlaying) {
              try { this.hissAudio.play(); } catch { /* ignore */ }
            }
          }
        } else {
          this.fleeBlockedTimer = 0;
        }
      }
    } else {
      this.setPose('idle');
    }
    this.syncVerticalPosition();
  }

  private isObservedByPlayer(player: THREE.Vector3, cameraDirection: THREE.Vector3): boolean {
    const direction = this.mesh.position.clone().sub(player);
    const distance = direction.length();
    if (distance < 0.001 || distance > 16) return false;
    direction.multiplyScalar(1 / distance);
    if (cameraDirection.dot(direction) < 0.78) return false;
    this.sightRay.set(player, direction);
    this.sightRay.near = 0;
    this.sightRay.far = distance;
    const blockers = this.level.getSolidMeshes();
    for (const blocker of blockers) blocker.updateWorldMatrix(true, false);
    return this.sightRay.intersectObjects(blockers, false).length === 0;
  }

  private advanceCrawlStroke(delta: number, unseen: boolean): number {
    const lungeDuration = this.isFrenzy ? 0.12 : this.isFleeing ? 0.10 : unseen ? 0.18 : 0.14;
    const pauseDuration = this.isFrenzy ? 0.05 : this.isFleeing ? 0.04 : unseen ? 0.07 : 0.12;
    const multiplier = this.isFrenzy ? 2.1 : this.isFleeing ? 1.95 : unseen ? 1.9 : 1.7;
    let remaining = delta;
    let distance = 0;
    // Intégrer chaque appui : les temps d'arrêt restent réellement immobiles,
    // même si une image couvre la fin d'une traction et le début de la suivante.
    while (remaining > 0.000001) {
      const duration = this.isStutterLunge ? lungeDuration : pauseDuration;
      const slice = Math.min(remaining, Math.max(0, duration - this.stutterPhaseTimer));
      if (this.isStutterLunge) {
        const start = this.stutterPhaseTimer / duration;
        const end = (this.stutterPhaseTimer + slice) / duration;
        // Traction franche puis poids du corps qui retombe, sans flottement.
        distance += this.baseSpeed * multiplier * slice * (1.25 - 0.375 * (start + end));
      }
      remaining -= slice;
      this.stutterPhaseTimer += slice;
      if (this.stutterPhaseTimer >= duration - 0.000001) {
        this.stutterPhaseTimer = 0;
        this.isStutterLunge = !this.isStutterLunge;
        if (this.isStutterLunge) this.walkStep = (this.walkStep + 1) % 2;
      }
    }
    this.setPose(this.isStutterLunge ? this.walkStep === 0 ? 'crawl-a' : 'crawl-b' : 'idle');
    return distance;
  }

  private syncVerticalPosition(): void {
    if (this.isCeilingAmbush) {
      const ceilingY = typeof this.level.getCeilingHeightAt === 'function'
        ? this.level.getCeilingHeightAt(this.mesh.position.x, this.mesh.position.z)
        : this.mesh.position.z > 6 ? 4.0 : 6.4;
      this.mesh.position.y = ceilingY - 0.775;
      this.mesh.scale.y = -1;
    } else {
      this.mesh.position.y = this.level.getFloorHeightAt(this.mesh.position.x, this.mesh.position.z) + crawlerGroundOffsetY;
      this.mesh.scale.y = 1;
    }
  }

  private canReachPlayer(playerPosition: THREE.Vector3, reach: number): boolean {
    const origin = new THREE.Vector3(
      this.mesh.position.x,
      this.mesh.position.y - crawlerGroundOffsetY + 0.3,
      this.mesh.position.z,
    );
    // La caméra du joueur est à 1,7 m ; viser son volume bas plutôt que son regard.
    const target = new THREE.Vector3(playerPosition.x, playerPosition.y - 1.7 + 0.3, playerPosition.z);
    const floorAt = (x: number, z: number, fallback: number): number =>
      typeof this.level.getFloorHeightAt === 'function' ? this.level.getFloorHeightAt(x, z) : fallback;
    const ownFloor = floorAt(origin.x, origin.z, origin.y - 0.3);
    const playerFloor = floorAt(target.x, target.z, target.y - 0.3);
    // Tolérer la pente d'une rampe, jamais une attaque entre les deux étages.
    if (Math.abs(ownFloor - playerFloor) > 0.65 || Math.abs(origin.y - target.y) > 0.65) return false;
    const direction = target.clone().sub(origin);
    const horizontalDistance = Math.hypot(direction.x, direction.z);
    if (horizontalDistance > reach) return false;

    // Le segment physique interdit aussi les passages sous un meuble plein ou
    // entre les ornements d'une porte dont le collider reste fermé.
    const steps = Math.max(1, Math.ceil(horizontalDistance / 0.1));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.level.isColliding(origin.x + direction.x * t, origin.z + direction.z * t, 0.05)) return false;
    }
    const distance = direction.length();
    if (distance < 0.001) return true;
    this.sightRay.set(origin, direction.multiplyScalar(1 / distance));
    this.sightRay.near = 0;
    this.sightRay.far = distance;
    const blockers = this.level.getSolidMeshes();
    for (const blocker of blockers) blocker.updateWorldMatrix(true, false);
    return this.sightRay.intersectObjects(blockers, false).length === 0;
  }

  public dispose(scene: THREE.Scene): void {
    if (this.disposed) return;
    this.disposed = true;
    this.shotReaction.dispose();
    this.stopAudio();
    if (this.hissAudio) {
      this.hissAudio.disconnect();
      this.hissAudio.gain.disconnect();
      this.hissAudio.removeFromParent();
      this.hissAudio = null;
    }
    scene.remove(this.mesh);
  }
}
