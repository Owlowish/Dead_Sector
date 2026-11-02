import * as THREE from 'three';

// Textures immuables partagées : quatre boîtes n'ont pas besoin de quatre copies GPU.
const textures = new Map<string, THREE.Texture>();

// Même représentation que les ennemis : plan éclairé, pixels nets et alpha découpé.
export function createPickupSprite(url: string, size: number): THREE.Mesh {
  let texture = textures.get(url);
  if (!texture) {
    texture = new THREE.TextureLoader().load(url);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(url, texture);
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({
    map: texture, roughness: 1, metalness: 0, transparent: true,
    alphaTest: 0.4, side: THREE.DoubleSide,
  }));
  mesh.receiveShadow = true;
  return mesh;
}
