import assert from 'node:assert/strict';
import { PerfTracker } from '../src/PerfTracker.ts';

console.log('=== SUITE DE TESTS : SYSTÈME DE MESURE DES PERFORMANCES (PerfTracker) ===\n');

const tracker = new PerfTracker(100);

// 1. Test des percentiles avec un échantillon connu
console.log('1. Test de calcul des percentiles (médiane, p95, p99, max, >33ms, >50ms)...');
// Injecter 100 frames : 90 frames à 16.6ms, 5 frames à 30ms, 3 frames à 40ms (>33ms), 2 frames à 70ms (>50ms)
for (let i = 0; i < 90; i++) tracker.recordFrame(16.6, true, false);
for (let i = 0; i < 5; i++) tracker.recordFrame(30.0, true, false);
for (let i = 0; i < 3; i++) tracker.recordFrame(40.0, true, false);
for (let i = 0; i < 2; i++) tracker.recordFrame(70.0, true, false);

const combat = tracker.getCombatMetrics();
assert.equal(combat.count, 100);
assert.equal(combat.medianMs, 16.6);
assert.equal(combat.p95Ms, 40.0);
assert.equal(combat.p99Ms, 70.0);
assert.equal(combat.maxMs, 70.0);
assert.equal(combat.over33Ms, 5); // 3 (40ms) + 2 (70ms)
assert.equal(combat.over50Ms, 2); // 2 (70ms)
console.log('   -> PASS : Percentiles et compteurs de saccades rigoureusement conformes.\n');

// 2. Test d\'isolation : les frames de pause ne polluent pas les métriques de combat
console.log('2. Test d\'isolation combat vs pause / menu...');
tracker.reset();
// 10 frames de pause lentes (ex: menu à 35ms)
for (let i = 0; i < 10; i++) tracker.recordFrame(35.0, false, false);
// 10 frames de combat rapides (16.6ms)
for (let i = 0; i < 10; i++) tracker.recordFrame(16.6, true, false);

const isolatedCombat = tracker.getCombatMetrics();
const overall = tracker.getOverallMetrics();

assert.equal(isolatedCombat.count, 10);
assert.equal(isolatedCombat.maxMs, 16.6, 'Le combat ne doit pas être affecté par la lenteur hors-combat');
assert.equal(overall.count, 20);
assert.equal(overall.over33Ms, 10, 'La métrique globale recense les frames hors combat');
console.log('   -> PASS : Isolation stricte du combat actif vs phases hors simulation.\n');

// 3. Test de rejet des sauts d\'onglets (tab switch / unfocus > 1000ms)
console.log('3. Test de rejet des sauts de reprise d\'onglet...');
tracker.reset();
tracker.recordFrame(16.6, true, false);
tracker.recordFrame(2500.0, true, true); // Reprise d'onglet
tracker.recordFrame(16.6, true, false);

const tabMetrics = tracker.getCombatMetrics();
assert.equal(tabMetrics.count, 2, 'La reprise d\'onglet de 2500ms doit être ignorée');
assert.equal(tabMetrics.maxMs, 16.6);
console.log('   -> PASS : Reprise d\'onglet ignorée, aucun faux pic de latence introduit.\n');

// 4. Test du chronométrage des spawns, pathfinding et transitions
console.log('4. Test du chronométrage des événements système...');
tracker.recordSpawn(12.45);
tracker.recordPathfinding(8.32);
tracker.recordTransition(2, 45.10);

assert.equal(tracker.getLastSpawnDurationMs(), 12.45);
assert.equal(tracker.getLastPathfindingDurationMs(), 8.32);
assert.equal(tracker.getLastTransition()?.tier, 2);
assert.equal(tracker.getLastTransition()?.durationMs, 45.10);
console.log('   -> PASS : Enregistrement et restitution exacte des durées système.\n');

console.log('================================================================');
console.log('TOUS LES TESTS DE PERF TRACKER ONT RÉUSSI AVEC SUCCÈS !');
console.log('================================================================');
