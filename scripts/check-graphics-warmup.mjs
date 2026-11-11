import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

registerHooks({ resolve(specifier, context, next) {
  return next(specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture({ width: 1, height: 1, src: url });
  texture.name = url;
  return texture;
};
const { GraphicsWarmup } = await import('../src/GraphicsWarmup.ts');
const { getCrawlerGraphicsResources } = await import('../src/CrawlerZombie.ts');
const { getStandardSharedResources, releaseStandardSharedResources } = await import('../src/Zombie.ts');

function harness(failAt = Infinity) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  camera.visible = false;
  scene.add(camera);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(), material, 2);
  mesh.count = 0;
  mesh.visible = false;
  scene.add(mesh);
  const dormant = new THREE.Group();
  dormant.visible = false;
  dormant.add(new THREE.PointLight());
  scene.add(dormant);
  const viewport = new THREE.Vector4(3, 4, 426, 240);
  const scissor = new THREE.Vector4(5, 6, 20, 30);
  const originalTarget = {};
  const renderer = {
    domElement: { style: { visibility: 'visible' } },
    shadowMap: { autoUpdate: false, needsUpdate: false },
    target: originalTarget, viewport: viewport.clone(), scissor: scissor.clone(), scissorTest: true,
    uploaded: new Set(), rendered: new Set(), compiled: new Set(), renders: 0,
    initTexture(texture) { this.uploaded.add(texture); },
    getViewport(value) { return value.copy(this.viewport); },
    getScissor(value) { return value.copy(this.scissor); },
    getScissorTest() { return this.scissorTest; },
    getRenderTarget() { return this.target; },
    getActiveCubeFace() { return 2; },
    getActiveMipmapLevel() { return 1; },
    setRenderTarget(value, face, level) { this.target = value; this.face = face; this.level = level; },
    setViewport(...args) { this.viewport = args[0] instanceof THREE.Vector4 ? args[0].clone() : new THREE.Vector4(...args); },
    setScissor(value) { this.scissor.copy(value); },
    setScissorTest(value) { this.scissorTest = value; },
    async compileAsync(group, _camera, target) {
      assert.equal(target ?? group, scene, 'Les variantes emploient les lumières de la vraie scène');
      group.traverse(object => { if (object.material) this.compiled.add(object); });
    },
    render(group) {
      assert.equal(this.domElement.style.visibility, 'hidden');
      assert.equal(this.target, null, 'Préparation des variantes de sortie du canvas');
      assert.equal(this.viewport.z, 1);
      assert.equal(this.viewport.w, 1);
      assert.equal(mesh.count, 1, 'Les effets instanciés vides sont initialisés sans gameplay');
      assert.equal(dormant.visible, false, 'Un ancien système caché ne doit pas ajouter sa lumière aux variantes');
      if (++this.renders === failAt) throw new Error('GPU indisponible');
      group.traverseVisible(object => { if (object.material) this.rendered.add(object); });
    },
  };
  const verifyRestored = () => {
    assert.equal(camera.visible, false);
    assert.equal(mesh.visible, false);
    assert.equal(mesh.frustumCulled, true);
    assert.equal(mesh.count, 0);
    assert.equal(scene.children.length, 3, 'Aucun prototype conservé dans la scène jouable');
    assert.equal(renderer.target, originalTarget);
    assert.equal(renderer.face, 2);
    assert.equal(renderer.level, 1);
    assert.deepEqual(renderer.viewport, viewport);
    assert.deepEqual(renderer.scissor, scissor);
    assert.equal(renderer.scissorTest, true);
    assert.equal(renderer.shadowMap.autoUpdate, false);
    assert.equal(renderer.shadowMap.needsUpdate, true, 'Les ombres temporaires seront invalidées');
    assert.equal(renderer.domElement.style.visibility, 'visible');
  };
  return { scene, camera, mesh, renderer, verifyRestored };
}

const { scene, camera, renderer, verifyRestored } = harness();
const warmup = new GraphicsWarmup(scene, camera);
let progress = 0;
let total = 0;
await warmup.prepare(renderer, (done, count) => {
  assert.ok(done >= progress);
  progress = done; total = count;
});
assert.equal(progress, total);
verifyRestored();
assert.ok(renderer.uploaded.size >= 50, 'Toutes les familles, morts et projectiles sont anticipés');
assert.ok(renderer.rendered.size > 90, 'Toutes les poses/UV sont réellement soumises au rendu');
assert.ok([...renderer.rendered].some(object => !object.geometry.attributes.normal && !object.material.toneMapped),
  'Le liseré du Portrait est préparé sans normales et sans tone mapping');
for (const object of renderer.rendered) assert.ok(renderer.compiled.has(object), 'Compilation avant rendu');
const renderedMaps = new Set([...renderer.rendered].map(object => object.material.map).filter(Boolean));
for (const texture of renderer.uploaded) assert.ok(renderedMaps.has(texture), `Texture jamais rendue : ${texture.name}`);
const crawler = getCrawlerGraphicsResources();
for (const material of Object.values(crawler.lightMaterials)) {
  assert.ok([...renderer.rendered].some(object => object.material === material), 'Télégraphie Rampeuse réelle');
}
const standard = getStandardSharedResources(); releaseStandardSharedResources();
for (const texture of Object.values(standard.textures)) assert.equal(texture.generateMipmaps, false);
let sharedDisposals = 0;
for (const texture of renderer.uploaded) texture.addEventListener('dispose', () => sharedDisposals++);
for (const material of Object.values(crawler.materials)) material.addEventListener('dispose', () => sharedDisposals++);
const renders = renderer.renders;
await warmup.prepare(renderer);
assert.equal(renderer.renders, renders, 'Pas de nouvelle chauffe à la reprise');
warmup.dispose(); warmup.dispose();
assert.equal(sharedDisposals, 0, 'Les caches partagés survivent à la destruction des prototypes');

const failing = harness(3);
const retry = new GraphicsWarmup(failing.scene, failing.camera);
await assert.rejects(retry.prepare(failing.renderer), /GPU indisponible/);
failing.verifyRestored();
retry.dispose();
console.log(`PASS : ${renderer.uploaded.size} textures, ${renderer.rendered.size} poses/effets, progression, lumière réelle, restauration après erreur et propriété des caches.`);
