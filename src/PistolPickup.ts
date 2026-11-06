import type * as THREE from 'three';
import { FirearmPickup } from './FirearmPickup.ts';

export class PistolPickup extends FirearmPickup {
  constructor(scene: THREE.Scene, x = 0, z = 0, baseY = 0.4) {
    super(scene, 'pistol', x, z, baseY);
  }
}
