import * as THREE from 'three';
import { zombieDeathAnimation as standardConfig, zombieDeathDuration, deathFrame } from './ZombieAnimation.ts';
import {
  agileAnimationsData,
  agileAtlasDimensions,
  agileDeathDuration,
  agileDeathFrameIndex,
  buildFrameGeometry,
} from './AgileZombieAnimation.ts';
import { spitterAnimation, spitterDeathFrame } from './SpitterAnimation.ts';
import type { Level } from './Level.ts';
import { EnemyImpact, type EnemyShotImpact } from './EnemyImpact.ts';

export type ZombieKind = 'standard' | 'agile' | 'spitter' | 'crawler';

function loadPixelTexture(url: string): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface SharedDeathResources {
  users: number;
  deathTexture: THREE.Texture;
  frames: THREE.BufferGeometry[];
  deathMaterial: THREE.MeshStandardMaterial;
  depthMaterial: THREE.MeshDepthMaterial;
  distanceMaterial: THREE.MeshDistanceMaterial;
  duration: number;
  poseMaterials?: THREE.MeshStandardMaterial[];
  extraTextures?: THREE.Texture[];
}

function createStandardResources(): SharedDeathResources {
  const deathTexture = loadPixelTexture('/assets/zombies/zombie_death.png');
  const material = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({
      map,
      roughness: 1,
      metalness: 0,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
    });
  const frames = standardConfig.frames.map((pose) => {
    const geometry = new THREE.PlaneGeometry(
      pose.width / standardConfig.pixelsPerUnit,
      pose.height / standardConfig.pixelsPerUnit
    );
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        (pose.x + uv.getX(i) * pose.width) / standardConfig.atlasWidth,
        1 - (pose.y + (1 - uv.getY(i)) * pose.height) / standardConfig.atlasHeight
      );
    }
    return geometry;
  });

  return {
    users: 0,
    deathTexture,
    frames,
    deathMaterial: material(deathTexture),
    depthMaterial: new THREE.MeshDepthMaterial({
      map: deathTexture,
      alphaTest: 0.4,
      depthPacking: THREE.RGBADepthPacking,
    }),
    distanceMaterial: new THREE.MeshDistanceMaterial({ map: deathTexture, alphaTest: 0.4 }),
    duration: zombieDeathDuration,
  };
}

function createAgileResources(): SharedDeathResources {
  const deathTexture = loadPixelTexture('/assets/zombies/agile/death.png');
  const material = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({
      map,
      roughness: 0.9,
      metalness: 0,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
    });

  const frames = agileAnimationsData.death.frames.map((frame) =>
    buildFrameGeometry(
      frame,
      agileAnimationsData.death.pixelsPerUnit,
      agileAtlasDimensions.death.width,
      agileAtlasDimensions.death.height
    )
  );

  return {
    users: 0,
    deathTexture,
    frames,
    deathMaterial: material(deathTexture),
    depthMaterial: new THREE.MeshDepthMaterial({
      map: deathTexture,
      alphaTest: 0.4,
      depthPacking: THREE.RGBADepthPacking,
    }),
    distanceMaterial: new THREE.MeshDistanceMaterial({ map: deathTexture, alphaTest: 0.4 }),
    duration: agileDeathDuration,
  };
}

function createSpitterResources(): SharedDeathResources {
  const textures = ['death-a', 'death', 'corpse'].map((pose) => loadPixelTexture(`/assets/zombies/spitter/${pose}.png`));
  const materials = textures.map((map) => new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0, alphaTest: 0.4, side: THREE.DoubleSide }));
  const deathTexture = textures[0];
  return {
    users: 0,
    deathTexture,
    frames: Array.from({ length: 3 }, () => new THREE.PlaneGeometry(1.6, 2.7)),
    deathMaterial: materials[0],
    depthMaterial: new THREE.MeshDepthMaterial({ map: deathTexture, alphaTest: 0.4, depthPacking: THREE.RGBADepthPacking }),
    distanceMaterial: new THREE.MeshDistanceMaterial({ map: deathTexture, alphaTest: 0.4 }),
    duration: spitterAnimation.deathFrameDuration * 3,
    poseMaterials: materials,
    extraTextures: textures.slice(1),
  };
}

const sharedByType = new Map<ZombieKind, SharedDeathResources>();

export function warmupRemainsResources(): void {
  for (const kind of ['standard', 'agile', 'spitter'] as ZombieKind[]) {
    if (!sharedByType.has(kind)) {
      sharedByType.set(kind, kind === 'agile' ? createAgileResources() : kind === 'spitter' ? createSpitterResources() : createStandardResources());
    }
  }
}

/** Les caches restent possédés par ZombieRemains, y compris après la préparation GPU. */
export function getRemainsGraphicsResources(): readonly SharedDeathResources[] {
  warmupRemainsResources();
  return [...sharedByType.values()];
}

export function disposeRemainsSharedResources(): void {
  for (const [, res] of sharedByType.entries()) {
    res.frames.forEach((geometry) => geometry.dispose());
    res.deathMaterial.dispose();
    res.poseMaterials?.slice(1).forEach((material) => material.dispose());
    res.depthMaterial.dispose();
    res.distanceMaterial.dispose();
    res.deathTexture.dispose();
    res.extraTextures?.forEach((texture) => texture.dispose());
  }
  sharedByType.clear();
}

export class ZombieRemains {
  private kind: ZombieKind;
  private resources: SharedDeathResources;
  private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private elapsed: number | null = null;
  private baseFloorY = 0;
  private displayScale = 1;
  private settled = false;
  private reversing = false;
  private revivalFinished = false;
  private disposed = false;
  private readonly level?: Level;
  private readonly shotReaction = new EnemyImpact();
  private readonly position = new THREE.Vector3();
  private openingPose: Pick<THREE.Mesh, 'geometry' | 'material' | 'customDepthMaterial' | 'customDistanceMaterial'> | null = null;
  private openingDuration = 0;

  constructor(scene: THREE.Scene, kind: ZombieKind = 'standard', level?: Level) {
    this.kind = kind;
    this.level = level;
    let res = sharedByType.get(kind);
    if (!res) {
      res = kind === 'agile' ? createAgileResources() : kind === 'spitter' ? createSpitterResources() : createStandardResources();
      sharedByType.set(kind, res);
    }
    this.resources = res;
    this.resources.users++;

    this.mesh = new THREE.Mesh(this.resources.frames[0], this.resources.deathMaterial);
    this.mesh.visible = false;
    this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = this.resources.depthMaterial;
    this.mesh.customDistanceMaterial = this.resources.distanceMaterial;
    scene.add(this.mesh);
  }

  public start(position: THREE.Vector3, facingAngle: number, scale = 1, impact?: EnemyShotImpact, recoilPose?: THREE.Mesh): void {
    if (this.disposed || this.elapsed !== null) return;
    this.elapsed = 0;
    this.displayScale = scale;
    const standingCenter = this.kind === 'spitter' ? 1.35 : 1;
    this.baseFloorY = position.y - standingCenter * scale;
    this.position.copy(position);
    // Le coup fatal commence par la vraie pose de choc, avant les poses de chute.
    this.openingDuration = impact && impact.power >= 0.35 && recoilPose ? 0.08 : 0;
    this.openingPose = this.openingDuration > 0 ? {
      geometry: recoilPose!.geometry, material: recoilPose!.material,
      customDepthMaterial: recoilPose!.customDepthMaterial, customDistanceMaterial: recoilPose!.customDistanceMaterial,
    } : null;
    this.shotReaction.start(impact, this.kind === 'spitter' ? 0.55 : this.kind === 'agile' ? 1.15 : 1, true);
    this.mesh.scale.setScalar(scale);
    this.mesh.position.set(position.x, this.baseFloorY, position.z);
    this.mesh.rotation.set(0, facingAngle, 0);
    this.mesh.visible = true;
    this.mesh.castShadow = true;
    if (this.kind === 'spitter') this.mesh.castShadow = false;
    this.showFrame(0);
    this.showOpeningPose();
  }

  public beginRevival(): void {
    if ((this.kind !== 'standard' && this.kind !== 'agile') || this.elapsed === null || this.disposed) return;
    this.reversing = true;
    this.shotReaction.clear();
    this.openingPose = null;
    this.openingDuration = 0;
    this.settled = false;
    this.elapsed = this.resources.duration;
  }

  public consumeRevivalFinished(): boolean {
    const finished = this.revivalFinished;
    this.revivalFinished = false;
    return finished;
  }

  public update(delta: number, viewerPosition: THREE.Vector3): void {
    if (this.disposed || this.elapsed === null) return;
    const offset = (this.kind === 'spitter' ? 1.35 : 1) * this.displayScale;
    this.shotReaction.update(delta, this.position, this.level, this.kind === 'spitter' ? 0.5 : 0.4, offset);
    this.baseFloorY = this.position.y - offset;
    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
    // Le corps est dessiné couché, mais son support reste vertical, comme les vivants face au joueur
    this.mesh.rotation.set(
      0,
      Math.atan2(viewerPosition.x - this.mesh.position.x, viewerPosition.z - this.mesh.position.z),
      0
    );
    if (this.settled) return;
    this.elapsed = this.reversing
      ? Math.max(0, this.elapsed - Math.max(0, delta))
      : Math.min(this.resources.duration + this.openingDuration, this.elapsed + Math.max(0, delta));
    const fallTime = Math.max(0, this.elapsed - this.openingDuration);
    const frameIdx =
      this.kind === 'agile' ? agileDeathFrameIndex(fallTime) : this.kind === 'spitter' ? spitterDeathFrame(fallTime) : deathFrame(fallTime);
    this.showFrame(frameIdx);
    if (this.elapsed < this.openingDuration) this.showOpeningPose();
    if (this.reversing && this.elapsed <= 0) {
      this.mesh.visible = false;
      this.reversing = false;
      this.elapsed = null;
      this.revivalFinished = true;
      return;
    }
    if (this.elapsed >= this.resources.duration + this.openingDuration - 1e-6) {
      this.mesh.castShadow = false;
      this.settled = true;
    }
  }

  private showFrame(index: number): void {
    this.mesh.geometry = this.resources.frames[index];
    this.mesh.material = this.kind === 'spitter' ? this.resources.poseMaterials![index] : this.resources.deathMaterial;
    this.mesh.customDepthMaterial = this.resources.depthMaterial;
    this.mesh.customDistanceMaterial = this.resources.distanceMaterial;
    if (this.kind === 'standard') {
      const pose = standardConfig.frames[index];
      this.mesh.position.y =
        this.baseFloorY +
        (pose.groundY - pose.y - pose.height / 2) / standardConfig.pixelsPerUnit * this.displayScale + standardConfig.floorHeight;
    } else if (this.kind === 'agile') {
      // Pour l'agile, les sommets sont déjà calibrés par rapport au centre mondial y = 1
      this.mesh.position.y = this.baseFloorY + this.displayScale;
    } else {
      this.mesh.position.y = this.baseFloorY + 1.35 * this.displayScale;
    }
    this.shotReaction.apply(this.mesh, (this.baseFloorY - this.mesh.position.y) / this.displayScale);
  }

  private showOpeningPose(): void {
    if (!this.openingPose) return;
    this.mesh.geometry = this.openingPose.geometry;
    this.mesh.material = this.openingPose.material as THREE.MeshStandardMaterial;
    this.mesh.customDepthMaterial = this.openingPose.customDepthMaterial;
    this.mesh.customDistanceMaterial = this.openingPose.customDistanceMaterial;
    this.mesh.position.y = this.position.y;
    this.shotReaction.apply(this.mesh, (this.baseFloorY - this.mesh.position.y) / this.displayScale);
  }

  public getPosition(): THREE.Vector3 { return this.position; }

  public static warmup(): void {
    warmupRemainsResources();
  }

  public static disposeSharedResources(): void {
    disposeRemainsSharedResources();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.shotReaction.dispose();
    this.mesh.visible = false;
    this.mesh.removeFromParent();
    this.resources.users--;
    // Le mesh d'instance est retiré du graphe de scène Three.js.
    // Les ressources partagées (textures GPU, matériaux compilés, géométries UV)
    // sont conservées en mémoire pour les paliers suivants et libérées explicitement.
  }
}
