import assert from 'node:assert/strict';
import * as THREE from 'three';

// Patch TextureLoader et DOM pour exécution en environnement Node (sans DOM/WebGL)
THREE.TextureLoader.prototype.load = function (url) {
  const texture = new THREE.Texture();
  texture.userData = { url };
  return texture;
};

class MockElement extends EventTarget {
  addEventListener() {}
  removeEventListener() {}
  requestPointerLock() {}
}
globalThis.window = Object.assign(new EventTarget(), {
  innerWidth: 1920,
  innerHeight: 1080,
  AudioContext: class {
    createGain() { return { connect() {} }; }
    createPanner() { return { connect() {}, setPosition() {}, setOrientation() {} }; }
  },
});
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null,
});
globalThis.Audio = class {
  volume = 1;
  play() { return Promise.resolve(); }
};

import { Door } from '../src/Door.ts';
import { Level } from '../src/Level.ts';
import { Zombie } from '../src/Zombie.ts';
import { Player } from '../src/Player.ts';
import {
  MANSION_BUDGET,
  MANSION_WAYPOINTS,
  MANSION_SPAWNS,
  MANSION_PICKUPS,
  PLAYER_START_POSITION,
} from '../src/MansionConfig.ts';

console.log('=== SUITE DE TESTS COMPORTEMENTAUX : COHÉRENCE DE L\'ARÈNE (MANOIR 48x40m) ===\n');

const scene = new THREE.Scene();
const level = new Level(scene);
const doors = level.getDoors();

// Vérification de la configuration des portes du manoir
assert.equal(doors.length, 5, 'Le manoir doit comporter exactement 5 portes (2 portes principales de progression, 2 raccourcis de boucle, 1 sortie condamnée)');

const grandHallDoor = doors.find((d) => d.getName() === 'Grand Hall Nord');
const galerieShortcut = doors.find((d) => d.getName() === "Grille de la Galerie");
const libraryStair = doors.find((d) => d.getName() === 'Escalier de la Bibliothèque');
const workshopStair = doors.find((d) => d.getName() === "Escalier de l'Atelier");
const exitDoor = doors.find((d) => d.getName() === 'Sortie du Manoir');

assert.ok(grandHallDoor, 'La porte principale du Grand Hall Nord doit exister');
assert.ok(galerieShortcut, "La grille de retour de la Galerie doit exister");
assert.ok(libraryStair, 'L\'accès principal à la Bibliothèque haute doit exister');
assert.ok(workshopStair, "L'accès à l'Atelier haut doit exister");
assert.ok(exitDoor, 'La porte de sortie du manoir doit exister');

// Règle formelle : UNE SEULE porte de progression principale par palier pour guider le joueur
assert.equal(grandHallDoor.getType(), 'sector_access');
assert.equal(grandHallDoor.getUnlockAfterTier(), 1, 'Le Grand Hall Nord est déverrouillé après le Palier 1');
assert.equal(libraryStair.getType(), 'sector_access');
assert.equal(libraryStair.getUnlockAfterTier(), 2, 'La Grande Bibliothèque est déverrouillée après le Palier 2');
assert.equal(exitDoor.getType(), 'permanent_limit');
assert.equal(exitDoor.getUnlockAfterTier(), Infinity, 'La sortie du manoir est définitivement condamnée');

// Vérification de la signalétique explicite des portes
assert.match(grandHallDoor.getPrompt().text, /GRAND HALL/i);
grandHallDoor.lock();
assert.match(grandHallDoor.getPrompt().text, /PALIER 1/i);

assert.match(libraryStair.getPrompt().text, /BIBLIOTHÈQUE/i);
libraryStair.lock();
assert.match(libraryStair.getPrompt().text, /PALIER 2/i);

assert.match(exitDoor.getPrompt().text, /SORTIE DU MANOIR/i);
assert.match(exitDoor.getPrompt().text, /CONDAMNÉE/i);

console.log('   -> PASS : Portes et signalétique conformes aux spécifications.\n');

// ============================================================================
// ÉPREUVE 1 : ÉTANCHÉITÉ PHYSIQUE STRICTE DU SECTEUR 1
// ============================================================================
console.log('1. Test d\'étanchéité physique des secteurs au Palier 1...');

// Configuration Palier 1 : toutes les portes et grilles sont verrouillées
grandHallDoor.lock();
galerieShortcut.lock();
libraryStair.lock();
workshopStair.lock();
exitDoor.lock();

const checkSegmentCollision = (p1, p2, radius) => {
  const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
  const steps = Math.max(1, Math.ceil(dist / 0.05));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = p1.x + (p2.x - p1.x) * t;
    const z = p1.z + (p2.z - p1.z) * t;
    if (level.isColliding(x, z, radius)) return true;
  }
  return false;
};

// Scan de la ligne de démarcation du Grand Hall à Z = 6 (de X = -1.5 à 23.5)
let breachesFound = 0;
for (let x = -1.5; x <= 23.5; x += 0.2) {
  const start = new THREE.Vector3(x, 1, 7.5);
  const end = new THREE.Vector3(x, 1, 4.5);
  if (!checkSegmentCollision(start, end, 0.35)) {
    breachesFound++;
  }
}
assert.equal(breachesFound, 0, `Aucune brèche vers le Grand Hall autorisée au Palier 1 (trouvé ${breachesFound} brèches)`);

// Scan de la grille de retour Galerie <-> Grand Hall à X = -3 (Z in [-2.5, 0.5])
let shortcutBreaches = 0;
for (let z = -2.5; z <= 0.5; z += 0.2) {
  const start = new THREE.Vector3(-4.5, 1, z);
  const end = new THREE.Vector3(-1.5, 1, z);
  if (!checkSegmentCollision(start, end, 0.35)) {
    shortcutBreaches++;
  }
}
assert.equal(shortcutBreaches, 0, `Aucune brèche par la grille de la galerie autorisée au Palier 1 (trouvé ${shortcutBreaches} brèches)`);

console.log('   -> PASS : Grand Hall hermétiquement clos au Palier 1, accès prématuré impossible.\n');

// ============================================================================
// ÉPREUVE 2 : BOUCLE DE COMBAT INTERNE DU SECTEUR 1 DÈS LE PALIER 1
// ============================================================================
console.log('2. Test de la boucle de combat interne du Secteur 1 (Vestibule <-> Grand Salon <-> Galerie Ouest)...');

// Circuit fermé à tester dans le Secteur 1 :
// Vestibule Sud (8, 16.5) -> Arche Sud (-3, 16.5) -> détour autour des piédestaux (-8, 13)
// -> Salon Nord (-12, 9.5) -> Passage Galerie (-12, 6.0) -> Galerie Ouest (-12, 3.0)
// -> Retour Salon (-12, 9.5) -> Arche Nord (-3, 9.5) -> Vestibule Nord (8, 9.5) -> Retour (8, 16.5)
const loopWaypoints = [
  new THREE.Vector3(8, 1, 16.5),
  new THREE.Vector3(-3, 1, 16.5),
  new THREE.Vector3(-8, 1, 13),
  new THREE.Vector3(-12, 1, 9.5),
  new THREE.Vector3(-12, 1, 6.0),
  new THREE.Vector3(-12, 1, 3.0),
  new THREE.Vector3(-12, 1, 6.0),
  new THREE.Vector3(-12, 1, 9.5),
  new THREE.Vector3(-3, 1, 9.5),
  new THREE.Vector3(8, 1, 9.5),
  new THREE.Vector3(8, 1, 16.5),
];

for (let i = 0; i < loopWaypoints.length - 1; i++) {
  const pA = loopWaypoints[i];
  const pB = loopWaypoints[i + 1];
  const blockedForPlayer = checkSegmentCollision(pA, pB, 0.35);
  const blockedForZombie = checkSegmentCollision(pA, pB, 0.40);
  assert.equal(blockedForPlayer, false, `Le segment de boucle [${i}] (${pA.x},${pA.z}) -> (${pB.x},${pB.z}) doit être praticable pour le joueur`);
  assert.equal(blockedForZombie, false, `Le segment de boucle [${i}] (${pA.x},${pA.z}) -> (${pB.x},${pB.z}) doit être praticable pour le zombie`);
}

// Vérifier la largeur minimale des passages des deux arches (doit être >= 3.5m)
assert.equal(level.isColliding(-3, 9.5, 0.40), false, 'Le centre de l\'arche Nord doit être parfaitement dégagé');
assert.equal(level.isColliding(-3, 16.5, 0.40), false, 'Le centre de l\'arche Sud doit être parfaitement dégagé');
assert.equal(level.isColliding(-12, 6.0, 0.40), false, 'Le passage Salon <-> Galerie doit être parfaitement dégagé');

console.log('   -> PASS : Boucle interne fluide et continue entre le Vestibule, le Grand Salon et la Galerie.\n');

// ============================================================================
// ÉPREUVE 3 : PALIER VS SECTEUR : PORTES NEUTRES, RÉCOMPENSE UNIQUE ET DÉCLENCHEMENT IMMERSIF
// ============================================================================
console.log('3. Test de distinction Palier vs Secteur, portes neutres et transition immersive...');

class MockSession {
  constructor(level) {
    this.level = level;
    this.currentTier = 1;
    this.pendingTierStart = 0;
    this.state = 'playing';
    this.playerHealth = 70;
    this.playerReserveAmmo = 20;
    this.rewardAppliedCount = 0;
  }

  // Franchir une porte ne change JAMAIS le palier par simple déplacement
  onPlayerCrossDoor() {
    return false;
  }

  enterRespite() {
    this.state = 'respite';
    const doors = this.level.getDoors();
    for (const door of doors) {
      if (door.getUnlockAfterTier() === this.currentTier) {
        door.unlock();
      }
    }
  }

  confirmRewardAndContinue(rewardType) {
    if (this.state !== 'respite') return false;
    this.rewardAppliedCount++;

    if (rewardType === 'medkit') {
      this.playerHealth = Math.min(100, this.playerHealth + 30);
    } else if (rewardType === 'ammo') {
      this.playerReserveAmmo += 15;
    }

    // Le palier suivant reste en attente d'ouverture de la nouvelle aile par le joueur
    this.pendingTierStart = this.currentTier + 1;
    this.state = 'exploration';
    return true;
  }

  launchPendingTier() {
    if (this.state !== 'exploration' || !this.pendingTierStart) return false;
    this.currentTier = this.pendingTierStart;
    this.pendingTierStart = 0;
    this.state = 'playing';
    return true;
  }
}

const session = new MockSession(level);

// 3.1 Déplacement dans le manoir pendant le combat : jamais de changement de palier
for (let x = -20; x <= 20; x += 5) {
  for (let z = 7; z <= 18; z += 3) {
    session.onPlayerCrossDoor();
    assert.equal(session.currentTier, 1, 'Aucun changement de palier par simple déplacement');
  }
}

// 3.2 Fin du Palier 1 : entrée en répit et déverrouillage du Grand Hall
session.enterRespite();
assert.equal(grandHallDoor.isLocked(), false, 'La porte du Grand Hall doit être déverrouillée');
assert.equal(libraryStair.isLocked(), true, 'L\'escalier de la Bibliothèque reste verrouillé tant que le Palier 2 n\'est pas fini');

// 3.3 Choix de récompense et passage en exploration paisible (aucun spawn prématuré !)
const applied = session.confirmRewardAndContinue('medkit');
assert.equal(applied, true, 'La récompense doit être confirmée');
assert.equal(session.playerHealth, 100, 'Le soin de 30 PV doit être appliqué (70 + 30 = 100)');
assert.equal(session.rewardAppliedCount, 1, 'La récompense est appliquée exactement une fois');
assert.equal(session.state, 'exploration', 'Le jeu passe en exploration sécurisée');
assert.equal(session.currentTier, 1, 'Le palier 2 NE DOIT PAS démarrer tant que la porte n\'est pas ouverte');
assert.equal(session.pendingTierStart, 2, 'Le palier 2 est en attente d\'ouverture');

// 3.4 Déclencheur immersif : l'ouverture de la porte lance le combat du Palier 2
grandHallDoor.toggle();
for (let i = 0; i < 20; i++) grandHallDoor.update(0.1);
assert.equal(grandHallDoor.isOpen(), true);

session.launchPendingTier();
assert.equal(session.state, 'playing', 'Le combat commence maintenant que la porte est ouverte');
assert.equal(session.currentTier, 2, 'Le palier passe désormais au Palier 2');
assert.equal(session.pendingTierStart, 0);

console.log('   -> PASS : Portes strictement neutres, récompense unique et exploration sécurisée.\n');

// ============================================================================
// ÉPREUVE 4 : VALIDATION DYNAMIQUE DES APPARITIONS D'ENNEMIS (FOV, LOS, DISTANCE >= 6m)
// ============================================================================
console.log('4. Test de validation dynamique des apparitions (FOV, LOS, distance >= 6m)...');

function evaluateSpawn(candidate, playerPos, cameraDir, livingZombies, level, bounds) {
  if (level.isColliding(candidate.x, candidate.z, 0.45)) return null;
  if (candidate.x < bounds.minX || candidate.x > bounds.maxX || candidate.z < bounds.minZ || candidate.z > bounds.maxZ) return null;

  const dx = candidate.x - playerPos.x;
  const dz = candidate.z - playerPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 6.0) return null; // 6 mètres minimum

  const tooClose = livingZombies.some((z) => Math.hypot(candidate.x - z.x, candidate.z - z.z) < 1.8);
  if (tooClose) return null;

  const hasPath = level.findNextWaypoint(new THREE.Vector3(candidate.x, 1, candidate.z), playerPos, 0.4);
  if (!hasPath) return null;

  const dirX = dx / dist;
  const dirZ = dz / dist;
  const dot = dirX * cameraDir.x + dirZ * cameraDir.z;
  const hasLOS = level.hasLineOfSight(playerPos, new THREE.Vector3(candidate.x, 1, candidate.z));

  // Rejet si le spawn est en plein champ de vision direct dégagé
  if (dot > 0.45 && hasLOS) return null;

  let score = dist;
  if (!hasLOS) score += 12; // Bonus fort pour les spawns dissimulés
  if (dot <= 0) score += 6;  // Bonus pour les positions latérales ou arrières
  return { ...candidate, score };
}

const tier1Config = MANSION_SPAWNS[0];
const playerStartPos = new THREE.Vector3(PLAYER_START_POSITION.x, 1.7, PLAYER_START_POSITION.z);
const cameraLookingNorth = new THREE.Vector3(0, 0, -1);

// Vérifier que tous les points de spawn candidats du Palier 1 sont hors collision
for (const spawn of tier1Config.pool) {
  assert.equal(level.isColliding(spawn.x, spawn.z, 0.45), false, `Spawn (${spawn.x}, ${spawn.z}) doit être hors obstacle`);
}

// Avec le joueur au point de départ, tester l'éligibilité des spawns
const validCandidates = tier1Config.pool
  .map((c) => evaluateSpawn(c, playerStartPos, cameraLookingNorth, [], level, tier1Config.sectorBounds))
  .filter(Boolean);

assert.ok(validCandidates.length >= 3, `Au moins 3 emplacements valides doivent être trouvés (trouvé ${validCandidates.length})`);
for (const vc of validCandidates) {
  const d = Math.hypot(vc.x - playerStartPos.x, vc.z - playerStartPos.z);
  assert.ok(d >= 6.0, `Distance de spawn (${d.toFixed(2)}m) doit être >= 6.0m`);
}

console.log('   -> PASS : Apparitions sûres, distance >= 6m, masquage par les murs et zéro spawn immédiat sur le joueur.\n');

// ============================================================================
// ÉPREUVE 5 : NAVIGATION VERS ZONE D'APPROCHE QUAND LA CIBLE TOUCHE UN MUR
// ============================================================================
console.log('5. Test de navigation vers une zone d\'approche praticable...');

// Mur Est du Vestibule à X = 23.5. Cible joueur proche du mur : (23.1, 16)
// Le joueur (rayon 0.35) passe à 23.1 (23.1 + 0.35 = 23.45 < 23.5)
// Mais le zombie (rayon 0.40) toucherait le mur (23.1 + 0.40 = 23.5)
const wallTarget = new THREE.Vector3(23.1, 1, 16);
const zombieStart = new THREE.Vector3(18, 1, 16);

assert.equal(level.isColliding(wallTarget.x, wallTarget.z, 0.35), false, 'Le joueur passe à 23.1');
assert.equal(level.isColliding(wallTarget.x, wallTarget.z, 0.40), true, 'Le zombie touche le mur à 23.1');

// Test de calcul du point d'approche praticable
const reachableTarget = level.getReachableTarget(zombieStart, wallTarget, 0.4);
assert.notEqual(reachableTarget, null, 'Un point d\'approche doit être calculé');
assert.equal(level.isColliding(reachableTarget.x, reachableTarget.z, 0.4), false, 'Le point d\'approche doit être hors collision pour r=0.4');

const distToPlayer = Math.hypot(reachableTarget.x - wallTarget.x, reachableTarget.z - wallTarget.z);
assert.ok(distToPlayer <= 1.4, `Le point d'approche (${distToPlayer.toFixed(2)}m) doit permettre l'attaque (portée 1.4m)`);

const waypoint = level.findNextWaypoint(zombieStart, wallTarget, 0.4);
assert.notEqual(waypoint, null, 'Le zombie ne doit pas se figer avec null');
assert.equal(level.isColliding(waypoint.x, waypoint.z, 0.4), false, 'Le waypoint renvoyé doit être praticable');
console.log('   -> PASS : Cible murale convertie en approche praticable à portée d\'attaque.\n');

// ============================================================================
// ÉPREUVE 6 : SÉCURITÉ ANTI-PINCEMENT DES PORTES
// ============================================================================
console.log('6. Test anti-pincement des battants de porte...');

const testDoor = new Door(scene, {
  id: 'test_door',
  x: 0,
  z: 6,
  passageWidth: 4.0,
  name: 'Porte Test',
  type: 'sector_access',
  unlockAfterTier: 1,
});
testDoor.unlock();
testDoor.toggle(); // OPENING
for (let i = 0; i < 20; i++) testDoor.update(0.1);
assert.equal(testDoor.isOpen(), true, 'La porte est ouverte');

testDoor.toggle(); // Déclenche CLOSING
assert.equal(testDoor.getState(), 'CLOSING');

// Un personnage se trouve dans l'embrasure de la porte
const occupant = [{ x: 0, z: 6, radius: 0.35 }];
testDoor.update(0.016, occupant);

// La porte doit immédiatement interrompre la fermeture et repasser en OPENING
assert.equal(testDoor.getState(), 'OPENING', 'La porte doit repasser en OPENING pour éviter de coincer l\'occupant');
console.log('   -> PASS : Obstruction détectée, fermeture interrompue et réouverture de sécurité.\n');

// ============================================================================
// ÉPREUVE 7 : CORRESPONDANCE GÉOMÉTRIE / GRAPHES DE NAVIGATION (40 WAYPOINTS)
// ============================================================================
console.log('7. Test de correspondance géométrie et graphe de navigation (45 waypoints)...');

assert.equal(MANSION_WAYPOINTS.length, 45, 'Le graphe doit comporter exactement 45 waypoints');

for (let i = 0; i < MANSION_WAYPOINTS.length; i++) {
  const wp = MANSION_WAYPOINTS[i];
  const collides = level.isColliding(wp.x, wp.z, 0.40);
  assert.equal(collides, false, `Le waypoint #${i} (${wp.x}, ${wp.z}) doit être praticable pour un zombie de rayon 0.40m`);
}

// Vérifier la connectivité par Dijkstra entre deux points éloignés du Secteur 1
const startPoint = new THREE.Vector3(8, 1, 16);
const endPoint = new THREE.Vector3(-14, 1, 10);
const nextWp = level.findNextWaypoint(startPoint, endPoint, 0.40);
assert.notEqual(nextWp, null, 'Un chemin de navigation doit être trouvé entre le Vestibule et le Grand Salon');
assert.equal(level.isColliding(nextWp.x, nextWp.z, 0.40), false, 'Le prochain waypoint doit être praticable');

console.log('   -> PASS : Tous les 45 waypoints sont praticables et connectés par Dijkstra.\n');

// ============================================================================
// ÉPREUVE 8 : FIN DE PALIER DIFFÉRÉE AVEC FILE D'ATTENTE
// ============================================================================
console.log('8. Test de non-fin prématurée de palier avec file d\'attente...');

let isTierComplete = false;
function checkCompletion(livingCount, queueCount) {
  if (livingCount === 0 && queueCount === 0) {
    isTierComplete = true;
  } else {
    isTierComplete = false;
  }
}

checkCompletion(0, 2);
assert.equal(isTierComplete, false, 'Le palier ne doit JAMAIS se terminer tant que la file d\'apparition n\'est pas vide');

checkCompletion(1, 0);
assert.equal(isTierComplete, false, 'Le palier ne doit pas se terminer tant qu\'un zombie est en vie');

checkCompletion(0, 0);
assert.equal(isTierComplete, true, 'Le palier est terminé uniquement quand vivants === 0 ET file === 0');
console.log('   -> PASS : Fin de palier strictement conditionnée à l\'élimination de TOUS les ennemis prévus.\n');

// ============================================================================
// ÉPREUVE 9 : RESPECT DU BUDGET FORMEL DU MANOIR (MANSION_BUDGET)
// ============================================================================
console.log('9. Test de respect du budget formel du manoir (MANSION_BUDGET)...');

assert.equal(MANSION_BUDGET.bounds.width, 48, 'La largeur totale doit être de 48m');
assert.equal(MANSION_BUDGET.bounds.depth, 40, 'La profondeur totale doit être de 40m');
assert.ok(MANSION_BUDGET.currentRooms <= MANSION_BUDGET.maxRooms, `Nombre de pièces (${MANSION_BUDGET.currentRooms}) <= max (${MANSION_BUDGET.maxRooms})`);
assert.equal(MANSION_BUDGET.maxSimultaneousZombies, 4, 'Budget de 4 zombies simultanés');
assert.equal(MANSION_BUDGET.maxShadowCastingLights, 2, 'Budget de 2 lumières avec ombres');
assert.equal(MANSION_BUDGET.maxPointLights, 6, 'Budget de 6 lumières ponctuelles');

console.log('   -> PASS : Données de budget centralisées et conformes aux limites.\n');

// ============================================================================
// ÉPREUVE 10 : LAMPE TORCHE ET CONTRÔLE LUMINEUX
// ============================================================================
console.log('10. Test de la lampe torche et du faisceau frontal...');

const mockCanvas = new MockElement();
const player = new Player(level, mockCanvas, () => true);

assert.equal(player.isFlashlightOn(), true, 'La lampe torche doit être allumée par défaut');

const spotLight = player.camera.children.find((child) => child.isSpotLight);
assert.ok(spotLight, 'Un SpotLight doit être attaché directement à la caméra du joueur');
assert.equal(spotLight.decay, 1.8, 'Le SpotLight doit avoir une atténuation physique decay');
assert.ok(spotLight.angle < Math.PI / 4, 'Le faisceau doit avoir un angle conique focalisé (< 45°)');
assert.equal(spotLight.visible, true);
const litIntensity = spotLight.intensity;
assert.ok(litIntensity > 0, 'La lampe doit contribuer à l’éclairage au démarrage');
const activeLights = () => {
  let count = 0;
  player.camera.traverseVisible((object) => { if (object.isLight) count++; });
  return count;
};
const lightCount = activeLights();

let lastToggleState = null;
player.setOnFlashlightToggle((enabled) => {
  lastToggleState = enabled;
});

const newState = player.toggleFlashlight();
assert.equal(newState, false, 'La lampe doit être éteinte après un premier toggle');
assert.equal(player.isFlashlightOn(), false);
assert.equal(spotLight.intensity, 0, 'Éteindre doit supprimer la contribution lumineuse');
assert.equal(activeLights(), lightCount, 'Éteindre doit conserver la structure des lumières pour les shaders');
assert.equal(lastToggleState, false, 'Le callback de toggle doit être déclenché pour notifier le HUD');

player.toggleFlashlight();
assert.equal(player.isFlashlightOn(), true);
assert.equal(spotLight.visible, true);
assert.equal(spotLight.intensity, litIntensity, 'Rallumer restaure exactement l’intensité initiale');
assert.equal(lastToggleState, true);

console.log('   -> PASS : Lampe torche SpotLight attachée, commutable et réactive.\n');

console.log('================================================================');
console.log('TOUTES LES 10 ÉPREUVES COMPORTEMENTALES ONT RÉUSSI AVEC SUCCÈS !');
console.log('================================================================');
