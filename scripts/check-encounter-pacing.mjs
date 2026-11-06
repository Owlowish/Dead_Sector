import assert from 'node:assert/strict';
import { ENCOUNTER_CONFIGS } from '../src/EncounterConfig.ts';

const quotasOf = (config) => ({
  standard: config.totalZombies - config.maxAgile - config.maxSpitter - (config.maxCrawler ?? 0),
  agile: config.maxAgile,
  spitter: config.maxSpitter,
  crawler: config.maxCrawler ?? 0,
});

for (const config of ENCOUNTER_CONFIGS) {
  const quotas = quotasOf(config);
  for (const quota of Object.values(quotas)) assert.ok(Number.isInteger(quota) && quota >= 0);
  assert.ok(config.maxActiveZombies > 0 && config.maxActiveZombies <= 8);
  assert.ok(config.openingSpawns > 0 && config.openingSpawns <= config.maxActiveZombies);
  assert.ok(quotas.agile >= quotas.spitter, `P${config.tierNumber} réserve toutes les escortes`);
  if (quotas.spitter > 0) assert.ok(config.maxSimultaneousAgile > 0 && config.maxActiveZombies >= 2);

  // Chaque seuil doit être atteignable avec les types déjà déverrouillés.
  for (const threshold of Object.values(config.spawnUnlocks ?? {})) {
    assert.ok(Number.isInteger(threshold) && threshold >= 0);
    const availableBefore = Object.entries(quotas)
      .filter(([kind]) => (config.spawnUnlocks?.[kind] ?? 0) < threshold)
      .reduce((sum, [, quota]) => sum + quota, 0);
    assert.ok(availableBefore >= threshold, `P${config.tierNumber} ne peut se bloquer avant ${threshold} éliminations`);
  }

  if (!config.spawnGroups) continue;
  const sum = { standard: 0, agile: 0, spitter: 0, crawler: 0 };
  for (const group of config.spawnGroups) {
    let size = 0;
    for (const kind of Object.keys(sum)) {
      assert.ok(Number.isInteger(group[kind]) && group[kind] >= 0);
      sum[kind] += group[kind];
      size += group[kind];
    }
    assert.ok(size > 0, 'Aucun groupe vide susceptible de faire sauter la récupération');
    assert.ok(group.agile >= group.spitter, 'Les escortes restent disponibles dans chaque groupe');
    assert.ok(Number.isFinite(group.pauseAfterSeconds ?? 0) && (group.pauseAfterSeconds ?? 0) >= 0);
  }
  assert.deepEqual(sum, quotas, `P${config.tierNumber} conserve le budget et tous les types entre ses groupes`);
}

const p3 = ENCOUNTER_CONFIGS[2];
assert.equal(p3.spawnUnlocks.agile, 2, 'Les premiers Coureurs attendent les deux standards définitifs');
assert.equal(p3.spawnUnlocks.spitter, 2, 'Le premier Cracheur attend son introduction');
assert.equal(ENCOUNTER_CONFIGS[3].spawnUnlocks.crawler, 2);
const p6 = ENCOUNTER_CONFIGS[5];
assert.deepEqual(p6.spawnGroups.map((group) => Object.entries(group)
  .filter(([key]) => key !== 'pauseAfterSeconds').reduce((sum, [, value]) => sum + value, 0)), [6, 6]);
assert.equal(p6.spawnGroups[0].pauseAfterSeconds, 3);
assert.equal(p6.spawnGroups[0].crawler, 0, 'Les Rampeuses appartiennent à la seconde poussée');
const finale = ENCOUNTER_CONFIGS.at(-1);
assert.ok(finale.finalEncounter);
assert.deepEqual(quotasOf(finale), { standard: 1, agile: 0, spitter: 0, crawler: 0 });
assert.equal(finale.maxActiveZombies, 1, 'Le boss reste un duel');
console.log('Quotas, escortes, introductions atteignables et groupes finis : OK. Orchestration et gameplay à vérifier séparément.');
