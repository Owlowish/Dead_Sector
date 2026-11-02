import * as THREE from 'three';
import { zombieDeathAnimation as standardConfig, zombieDeathDuration, deathFrame } from './ZombieAnimation.ts';
import {
  agileAnimationsData,
  agileAtlasDimensions,
  agileDeathDuration,
  agileDeathFrameIndex,
  buildFrameGeometry,
} from './AgileZombieAnimation.ts';

export type ZombieKind = 'standard' | 'agile';

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

const sharedByType = new Map<ZombieKind, SharedDeathResources>();

export function warmupRemainsResources(): void {
  for (const kind of ['standard', 'agile'] as ZombieKind[]) {
    if (!sharedByType.has(kind)) {
      sharedByType.set(kind, kind === 'agile' ? createAgileResources() : createStandardResources());
    }
  }
}

export function disposeRemainsSharedResources(): void {
  for (const [, res] of sharedByType.entries()) {
    res.frames.forEach((geometry) => geometry.dispose());
    res.deathMaterial.dispose();
    res.depthMaterial.dispose();
    res.distanceMaterial.dispose();
    res.deathTexture.dispose();
  }
  sharedByType.clear();
}

export class ZombieRemains {
  private kind: ZombieKind;
  private resources: SharedDeathResources;
  private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private elapsed: number | null = null;
  private baseFloorY = 0;
  private settled = false;
  private disposed = false;

  constructor(scene: THREE.Scene, kind: ZombieKind = 'standard') {
    this.kind = kind;
    let res = sharedByType.get(kind);
    if (!res) {
      res = kind === 'agile' ? createAgileResources() : createStandardResources();
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

  public start(position: THREE.Vector3, facingAngle: number): void {
    if (this.disposed || this.elapsed !== null) return;
    this.elapsed = 0;
    this.baseFloorY = position.y >= 2.0 ? 2.4 : 0;
    this.mesh.position.set(position.x, this.baseFloorY + (this.kind === 'agile' ? 1 : 0), position.z);
    this.mesh.rotation.set(0, facingAngle, 0);
    this.mesh.visible = true;
    this.mesh.castShadow = true;
    this.showFrame(0);
  }

  public update(delta: number, viewerPosition: THREE.Vector3): void {
    if (this.disposed || this.elapsed === null) return;
    // Le corps est dessiné couché, mais son support reste vertical, comme les vivants face au joueur
    this.mesh.rotation.set(
      0,
      Math.atan2(viewerPosition.x - this.mesh.position.x, viewerPosition.z - this.mesh.position.z),
      0
    );
    if (this.settled) return;
    this.elapsed = Math.min(this.resources.duration, this.elapsed + Math.max(0, delta));
    const frameIdx =
      this.kind === 'agile' ? agileDeathFrameIndex(this.elapsed) : deathFrame(this.elapsed);
    this.showFrame(frameIdx);
    if (this.elapsed >= this.resources.duration - 1e-6) {
      this.mesh.castShadow = false;
      this.settled = true;
    }
  }

  private showFrame(index: number): void {
    this.mesh.geometry = this.resources.frames[index];
    if (this.kind === 'standard') {
      const pose = standardConfig.frames[index];
      this.mesh.position.y =
        this.baseFloorY +
        (pose.groundY - pose.y - pose.height / 2) / standardConfig.pixelsPerUnit + standardConfig.floorHeight;
    } else {
      // Pour l'agile, les sommets sont déjà calibrés par rapport au centre mondial y = 1
      this.mesh.position.y = this.baseFloorY + 1;
    }
  }

  public static warmup(): void {
    warmupRemainsResources();
  }

  public static disposeSharedResources(): void {
    disposeRemainsSharedResources();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.visible = false;
    this.mesh.removeFromParent();
    this.resources.users--;
    // Le mesh d'instance est retiré du graphe de scène Three.js.
    // Les ressources partagées (textures GPU, matériaux compilés, géométries UV)
    // sont conservées en mémoire pour les paliers suivants et libérées explicitement.
  }
}
