import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { composedPortraits } from './MansionComposition.ts';
import { getMansionFloorHeight, MANSION_ROOMS } from './MansionConfig.ts';

export const PORTRAIT_DEPTH = 0.09;

/** Les tableaux ont un dos et des chants ; la face avant garde exactement son image. */
export class MansionPortraits {
  private readonly group = new THREE.Group();
  private readonly texture: THREE.Texture;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'mansion-portraits';
    this.texture = new THREE.TextureLoader().load('/assets/textures/portrait_v2.png');
    this.texture.name = 'mansion-portrait';
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestMipmapNearestFilter;
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.9, metalness: 0 });
    this.material.name = 'mansion-portraits';
    for (const room of MANSION_ROOMS) {
      const parts = composedPortraits.filter(item => item.roomId === room.id).map(item => {
        const geometry = new THREE.BoxGeometry(item.width, item.height, PORTRAIT_DEPTH);
        const uv = geometry.getAttribute('uv');
        // Le coin sombre du cadre donne une matière sobre aux chants, sans nouveau matériau.
        for (let i = 0; i < uv.count; i++) {
          if (i < 16 || i >= 20) uv.setXY(i, 0.006, 0.006);
        }
        geometry.clearGroups();
        geometry.translate(0, 0, -PORTRAIT_DEPTH / 2);
        geometry.rotateY(item.rotationY);
        geometry.translate(item.x, getMansionFloorHeight(item.x, item.z) + item.centerY, item.z);
        return geometry;
      });
      if (parts.length === 0) continue;
      const geometry = mergeGeometries(parts);
      for (const part of parts) part.dispose();
      if (!geometry) throw new Error(`Fusion des tableaux impossible : ${room.id}`);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `mansion-portraits-${room.id}`;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      this.geometries.push(geometry);
    }
    scene.add(this.group);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
