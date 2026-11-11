import * as THREE from 'three';
import { getStandardSharedResources, releaseStandardSharedResources } from './Zombie.ts';
import { getAgileSharedResources, releaseAgileSharedResources } from './AgileZombieAnimation.ts';
import { getSpitterGraphicsResources } from './SpitterZombie.ts';
import { getCrawlerGraphicsResources } from './CrawlerZombie.ts';
import { getRemainsGraphicsResources } from './ZombieRemains.ts';
import { getPortraitResources } from './PortraitResources.ts';
import { getPortraitProjectileResources } from './PortraitProjectileResources.ts';
import { prepareSpriteHitMask } from './SpriteHitMask.ts';
import { createPickupSprite } from './PickupSprite.ts';
import { HitEffects } from './HitEffects.ts';
import { ShellCasing } from './ShellCasing.ts';
import { SpitProjectile } from './SpitProjectile.ts';
import { createPortraitCueMaterial } from './PortraitAttackCue.ts';

const yieldToBrowser = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
type Progress = (completed: number, total: number) => void;

/** Prépare les vrais caches sans créer d'ennemi, de dégâts ou d'événement de progression. */
export class GraphicsWarmup {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly fixtures = new THREE.Group();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly ownedGeometries = new Set<THREE.BufferGeometry>();
  private readonly enemyTextures = new Set<THREE.Texture>();
  private readonly cleanup: Array<() => void> = [];
  private disposed = false;
  private prepared = false;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.fixtures.name = 'graphics-warmup';
    const standard = getStandardSharedResources();
    releaseStandardSharedResources();
    for (const pose of Object.keys(standard.textures) as Array<keyof typeof standard.textures>) {
      const map = standard.textures[pose];
      const material = this.ownMaterial(new THREE.MeshStandardMaterial({
        map, roughness: 0.9, metalness: 0, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide,
      }));
      const geometries = standard.geometries[pose];
      for (const geometry of Array.isArray(geometries) ? geometries : [geometries]) {
        this.addEnemy(geometry, material, standard.depthMaterials[pose], standard.distanceMaterials[pose]);
      }
    }
    const agile = getAgileSharedResources();
    releaseAgileSharedResources();
    for (const pose of Object.keys(agile.materials) as Array<keyof typeof agile.materials>) {
      for (const geometry of agile.geometries[pose]) {
        this.addEnemy(geometry, agile.materials[pose], agile.depthMaterials[pose], agile.distanceMaterials[pose]);
      }
    }
    const spitter = getSpitterGraphicsResources();
    for (const material of Object.values(spitter.materials)) this.addEnemy(spitter.geometry, material);
    const crawler = getCrawlerGraphicsResources();
    for (const material of [...Object.values(crawler.materials), ...Object.values(crawler.lightMaterials)]) {
      this.addEnemy(crawler.geometry, material);
    }
    const portrait = getPortraitResources();
    for (const pose of Object.keys(portrait.textures) as Array<keyof typeof portrait.textures>) {
      const map = portrait.textures[pose];
      const material = this.ownMaterial(new THREE.MeshStandardMaterial({
        map, emissiveMap: map, emissive: 0xd4c6a5, roughness: 0.9, metalness: 0,
        transparent: true, alphaTest: 0.4, side: THREE.DoubleSide,
      }));
      this.addEnemy(portrait.geometry, material, portrait.depth[pose], portrait.distance[pose]);
    }
    for (const remains of getRemainsGraphicsResources()) {
      for (let index = 0; index < remains.frames.length; index++) {
        this.addEnemy(remains.frames[index], remains.poseMaterials?.[index] ?? remains.deathMaterial,
          remains.depthMaterial, remains.distanceMaterial);
      }
    }
    for (const atlas of Object.values(getPortraitProjectileResources())) {
      for (const geometry of atlas.geometries) this.fixtures.add(new THREE.Mesh(geometry, atlas.material));
    }
    // Les ressources créées seulement au premier tir restent ici sous forme de prototypes.
    const effectsScene = new THREE.Scene();
    const effects = new HitEffects(effectsScene);
    effects.emit({ kind: 'surface', object: effectsScene, point: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 0, 1), direction: new THREE.Vector3(0, 0, -1), surface: 'wood' });
    const casing = new ShellCasing(effectsScene, camera);
    const spit = new SpitProjectile(effectsScene, new THREE.Vector3(), new THREE.Vector3(1, 0, 0));
    this.fixtures.add(...effectsScene.children.slice());
    this.cleanup.push(() => effects.dispose(), () => casing.dispose(), () => spit.dispose(effectsScene));
    // Les télégraphies sont des triangles sans normales : cette variante est distincte des particules.
    const cueGeometry = new THREE.BufferGeometry();
    cueGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    this.ownedGeometries.add(cueGeometry);
    for (const material of [createPortraitCueMaterial('trace'), createPortraitCueMaterial('stain'),
      createPortraitCueMaterial('rupture'), createPortraitCueMaterial('rupture', true)]) {
      this.fixtures.add(new THREE.Mesh(cueGeometry, this.ownMaterial(material)));
    }
    for (const url of ['/assets/pickups/medkit.png', '/assets/pickups/ammo.png', '/assets/weapons/shotgun/ammo_pickup.png']) {
      const mesh = createPickupSprite(url, 0.6);
      this.ownedGeometries.add(mesh.geometry);
      this.ownedMaterials.add(mesh.material as THREE.Material);
      this.fixtures.add(mesh);
    }
    for (const object of this.fixtures.children) {
      object.frustumCulled = false;
      object.position.set(8, 1, 0);
    }
  }

  private ownMaterial<T extends THREE.Material>(material: T): T {
    this.ownedMaterials.add(material);
    return material;
  }

  private addEnemy(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial,
    depth?: THREE.Material, distance?: THREE.Material): void {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = depth;
    mesh.customDistanceMaterial = distance;
    this.fixtures.add(mesh);
    if (material.map) this.enemyTextures.add(material.map);
  }

  /** Appeler après la fin des téléchargements, avant Game.start et avant tout contrôle joueur. */
  async prepare(renderer: THREE.WebGLRenderer, onProgress: Progress = () => {}): Promise<void> {
    if (this.disposed) throw new Error('Préparation graphique détruite');
    if (this.prepared) return;
    const textures = new Set<THREE.Texture>();
    const collect = (object: THREE.Object3D): void => {
      const mesh = object as THREE.Mesh;
      const materials = mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : [];
      for (const material of [...materials, mesh.customDepthMaterial, mesh.customDistanceMaterial]) {
        if (!material) continue;
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    };
    this.scene.traverse(collect);
    this.fixtures.traverse(collect);
    const batchSize = 8;
    const fixtures = this.fixtures.children.slice();
    const batches = Math.ceil(fixtures.length / batchSize);
    const total = textures.size + batches + 2;
    let completed = 0;
    onProgress(completed, total);
    for (const texture of textures) {
      const image = texture.image as HTMLImageElement | HTMLCanvasElement | undefined;
      if (!image?.width || !image.height) throw new Error(`Image non prête : ${texture.name || 'texture du jeu'}`);
      if ('decode' in image) await image.decode();
      if (this.enemyTextures.has(texture)) prepareSpriteHitMask(texture);
      renderer.initTexture(texture);
      onProgress(++completed, total);
      // Une seule image uploadée par tour : les gros atlas ne se cumulent pas dans une tâche.
      await yieldToBrowser();
      if (this.disposed) throw new Error('Préparation graphique interrompue');
    }

    const viewport = renderer.getViewport(new THREE.Vector4());
    const scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest();
    const target = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace();
    const mipLevel = renderer.getActiveMipmapLevel();
    const visibility = renderer.domElement.style.visibility;
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const originalStates: Array<{ object: THREE.Object3D; visible: boolean; culled: boolean; count?: number }> = [];
    this.scene.traverse(object => {
      originalStates.push({ object, visible: object.visible, culled: object.frustumCulled,
        count: object instanceof THREE.InstancedMesh ? object.count : undefined });
      // Ne pas réactiver les groupes dormants contenant des lumières (ancien carillon).
      // Leur présence modifierait les clés des shaders par rapport au combat réel.
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object === this.camera) {
        object.visible = true;
      }
      object.frustumCulled = false;
      if (object instanceof THREE.InstancedMesh && object.count === 0) object.count = Math.min(1, object.instanceMatrix.count);
    });
    renderer.domElement.style.visibility = 'hidden';
    // Un render target linéaire ne prépare pas les variantes de couleur/tone mapping du canvas.
    // Dessiner dans le canvas masqué conserve exactement la sortie du jeu, sans afficher les prototypes.
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, 1, 1);
    renderer.setScissorTest(false);
    renderer.shadowMap.autoUpdate = true;
    try {
      await renderer.compileAsync(this.scene, this.camera);
      renderer.render(this.scene, this.camera);
      onProgress(++completed, total);
      for (let start = 0; start < fixtures.length; start += batchSize) {
        const batch = fixtures.slice(start, start + batchSize);
        for (const child of batch) child.visible = true;
        // compileAsync compile aussi les objets cachés : cibler le groupe courant avec la lumière du niveau.
        const group = new THREE.Group();
        for (const child of batch) group.add(child);
        this.scene.add(group);
        try {
          await renderer.compileAsync(group, this.camera, this.scene);
          renderer.shadowMap.needsUpdate = true;
          renderer.render(this.scene, this.camera);
        } finally {
          this.scene.remove(group);
          for (const child of batch) { child.visible = false; this.fixtures.add(child); }
        }
        onProgress(++completed, total);
        await yieldToBrowser();
        if (this.disposed) throw new Error('Préparation graphique interrompue');
      }
      // L'accueil masque la caméra joueur (et sa lampe) : préparer également ce compte de lumières.
      for (const state of originalStates) state.object.visible = state.visible;
      await renderer.compileAsync(this.scene, this.camera);
      renderer.render(this.scene, this.camera);
      onProgress(++completed, total);
      this.prepared = true;
    } finally {
      this.scene.remove(this.fixtures);
      for (const state of originalStates) {
        state.object.visible = state.visible;
        state.object.frustumCulled = state.culled;
        if (state.object instanceof THREE.InstancedMesh && state.count !== undefined) state.object.count = state.count;
      }
      renderer.shadowMap.autoUpdate = shadowAutoUpdate;
      renderer.shadowMap.needsUpdate = true;
      renderer.setRenderTarget(target, cubeFace, mipLevel);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.domElement.style.visibility = visibility;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.fixtures.removeFromParent();
    for (const cleanup of this.cleanup) cleanup();
    for (const material of this.ownedMaterials) material.dispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    this.fixtures.clear();
    this.cleanup.length = 0;
    this.ownedMaterials.clear();
    this.ownedGeometries.clear();
    this.enemyTextures.clear();
    // Les textures, géométries et matériaux des caches partagés restent possédés par leurs modules.
  }
}
