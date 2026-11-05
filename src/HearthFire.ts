import * as THREE from 'three';
import { getHearthFireFrame, hearthFireAnimation } from './HearthFireAnimation.ts';

/** Une surface fixe dans l'âtre ; seuls ses UV avancent, sans nouveau téléversement de texture. */
export class HearthFire {
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly texture: THREE.Texture;
  private elapsed = 0;
  private frame = -1;
  private loaded = false;
  private disposed = false;

  constructor(scene: THREE.Scene, position: THREE.Vector3, width = 2.2, height = 1.28) {
    this.texture = new THREE.TextureLoader().load(hearthFireAnimation.url, () => {
      if (this.disposed) return;
      this.loaded = true;
      if (this.mesh) this.mesh.visible = true;
    });
    this.texture.name = 'hearth-fire-atlas';
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.repeat.set(
      (hearthFireAnimation.frameWidth - 1) / hearthFireAnimation.atlasWidth,
      (hearthFireAnimation.frameHeight - 1) / hearthFireAnimation.atlasHeight,
    );
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      toneMapped: false,
    });
    material.name = 'hearth-fire-emissive';
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    this.mesh.name = 'hearth-fire';
    this.mesh.position.copy(position);
    this.mesh.rotation.y = Math.PI / 2;
    this.mesh.updateMatrix();
    this.mesh.matrixAutoUpdate = false;
    this.mesh.visible = this.loaded;
    this.setFrame(0);
    scene.add(this.mesh);
  }

  public update(delta: number): void {
    if (this.disposed || !Number.isFinite(delta) || delta <= 0) return;
    this.elapsed = (this.elapsed + delta % hearthFireAnimation.duration) % hearthFireAnimation.duration;
    this.setFrame(getHearthFireFrame(this.elapsed));
  }

  private setFrame(frame: number): void {
    if (this.frame === frame) return;
    this.frame = frame;
    const column = frame % hearthFireAnimation.columns;
    const row = Math.floor(frame / hearthFireAnimation.columns);
    // Un demi-texel de marge garde les échantillons dans leur cellule, même au bord du plan.
    this.texture.offset.set(
      (column * hearthFireAnimation.frameWidth + 0.5) / hearthFireAnimation.atlasWidth,
      1 - ((row + 1) * hearthFireAnimation.frameHeight - 0.5) / hearthFireAnimation.atlasHeight,
    );
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
}
