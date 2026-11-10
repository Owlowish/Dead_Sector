import * as THREE from 'three';
import { crawlerLightCue, type CrawlerLightReaction } from './CrawlerAnimation.ts';

/** Emission locale sur les pixels opaques de la pose, test de profondeur conservé. */
export function createCrawlerLightCueMaterial(base: THREE.MeshStandardMaterial, reaction: CrawlerLightReaction): THREE.MeshStandardMaterial {
  const { center, radius, color } = crawlerLightCue[reaction].glow;
  const region = new THREE.Vector4(center[0], center[1], radius[0], radius[1]);
  const glow = new THREE.Color(color).multiplyScalar(1.15);
  const material = base.clone();
  material.customProgramCacheKey = () => 'crawler-light-cue';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.crawlerGlowRegion = { value: region };
    shader.uniforms.crawlerGlowColor = { value: glow };
    shader.fragmentShader = `uniform vec4 crawlerGlowRegion;
uniform vec3 crawlerGlowColor;
${shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef USE_EMISSIVEMAP
  vec2 spritePixel = vec2(vEmissiveMapUv.x, 1.0 - vEmissiveMapUv.y);
  vec2 glowOffset = (spritePixel - crawlerGlowRegion.xy) / crawlerGlowRegion.zw;
  float glowStrength = 1.0 - smoothstep(0.25, 1.0, dot(glowOffset, glowOffset));
  totalEmissiveRadiance += emissiveColor.rgb * crawlerGlowColor * glowStrength;
#endif`)} `;
  };
  return material;
}
