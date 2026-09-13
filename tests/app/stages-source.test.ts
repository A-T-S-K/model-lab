import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import fixture from '../../fixtures/canonical.initial.json';
import { loadModel } from '../../model/state.js';
import { predict } from '../../model/microgpt.js';
import { forwardStages, trainingStages, greedySelection } from '../../app/source/stages.js';
import { sourceMapping } from '../../app/source/mappings.js';

test('displayed forward order follows actual observed execution and ends in one greedy selection', () => {
  const observed: string[] = [];
  predict(loadModel(fixture.config, fixture.parameters), [fixture.config.bosTokenId], { observe(event) {
    if (!observed.includes(event.kind)) observed.push(event.kind);
  } });
  assert.deepEqual(forwardStages.map(([kind]) => kind), [...observed, 'greedy']);
  assert.deepEqual(trainingStages.map(([kind]) => kind), ['target', 'targetProbability', 'loss', 'meanLoss', 'backward', 'gradient', 'adam', 'changedParameters', 'rerun']);
  assert.equal(greedySelection([0.1, 0.4, 0.4, 0.1]), 1);
  assert.equal(greedySelection([0.8, 0.1, 0.1]), 0);
});

test('every displayed stage maps to a real bundled implementation symbol', () => {
  for (const [kind] of [...forwardStages, ...trainingStages]) {
    const mapping = sourceMapping(kind);
    assert.equal(mapping.status, 'mapped', kind);
    if (mapping.status !== 'mapped') continue;
    const source = readFileSync(new URL(`../../${mapping.file}`, import.meta.url), 'utf8');
    const marker = mapping.file === 'model/value.ts' ? `  ${mapping.symbol}(` : `export function${mapping.symbol === 'forwardSequence' ? '*' : ''} ${mapping.symbol}(`;
    assert.ok(source.includes(marker), `${kind}: ${mapping.file} ${mapping.symbol}`);
  }
  assert.deepEqual(sourceMapping('gradient'), sourceMapping('backward'));
  const combined = sourceMapping('attentionOutput');
  assert.equal(combined.status, 'mapped');
  if (combined.status === 'mapped') {
    assert.equal(combined.file, 'model/microgpt.ts'); assert.equal(combined.symbol, 'forwardSequence');
    assert.match(readFileSync(new URL('../../model/microgpt.ts', import.meta.url), 'utf8'), /combinedHeads\.push\(\.\.\.headOutput\)/);
  }
});

test('known scalar leaves are terminal; unknown concepts are explicitly unmapped', () => {
  assert.equal(sourceMapping('leaf').status, 'terminal');
  assert.equal(sourceMapping('futureConcept').status, 'unmapped');
});
