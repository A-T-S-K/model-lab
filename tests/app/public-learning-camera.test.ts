import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  objectiveLearningBounds,
  parameterLearningBounds,
  adamLearningBounds,
  publicLearningCameraBox,
  unionBoxes,
  type WorldRect,
} from '../../app/spatial/public-learning.js';
import { stationFor } from '../../app/spatial/scene.js';
import { parameterOwners } from '../../app/spatial/forward.js';
import type { ParameterPin } from '../../app/spatial/learning.js';

function containsRect(outer: WorldRect, inner: WorldRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function withinDomain(box: WorldRect, maxX = 4500, maxY = 1300): boolean {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= maxX &&
    box.y + box.height <= maxY
  );
}

test('objectiveLearningBounds computes exact bounds matching rendering formulas', () => {
  const prob = stationFor('probabilities');

  // 4 rows (e.g. abca input)
  const b4 = objectiveLearningBounds(4);
  assert.equal(b4.x, prob.x + prob.width + 30);
  assert.equal(b4.y, prob.y - 120);
  assert.equal(b4.width, 400);
  // height = 114 + 4 * 28 + 8 + 28 + 28 + 22 + 26 = 338
  assert.equal(b4.height, 338);

  // 8 rows (max untruncated)
  const b8 = objectiveLearningBounds(8);
  assert.equal(b8.height, 114 + 8 * 28 + 8 + 28 + 28 + 22 + 26);

  // 12 rows (truncated at 8 + 1 truncation line = 9 lines)
  const b12 = objectiveLearningBounds(12);
  assert.equal(b12.height, 114 + 9 * 28 + 8 + 28 + 28 + 22 + 26);
});

test('parameterLearningBounds and adamLearningBounds attach adjacent to parameter banks', () => {
  const pins: ParameterPin[] = [
    { name: 'wte', row: 0, column: 0 },
    { name: 'layer0.attn_wo', row: 0, column: 0 },
    { name: 'lm_head', row: 0, column: 0 },
  ];

  for (const pin of pins) {
    const bank = stationFor(pin.name);
    const pb = parameterLearningBounds(pin);
    assert.equal(pb.x, bank.x + bank.width + 25);
    assert.equal(pb.y, bank.y - 45);
    assert.equal(pb.width, 450);
    assert.equal(pb.height, 180);

    const ab = adamLearningBounds(pin);
    assert.equal(ab.x, bank.x + bank.width + 25);
    assert.equal(ab.y, bank.y + 145);
    assert.equal(ab.width, 450);
    assert.equal(ab.height, 160);
  }
});

test('publicLearningCameraBox frames objective evidence inside 4500x1300 canonical world', () => {
  const pin: ParameterPin = { name: 'wte', row: 0, column: 0 };
  const prob = stationFor('probabilities');
  const objBounds = objectiveLearningBounds(4);

  const box = publicLearningCameraBox('objective', pin, { rowsCount: 4 });

  assert(withinDomain(box, 4500, 1300), `Box ${JSON.stringify(box)} must be inside [0..4500, 0..1300]`);
  assert(containsRect(box, prob), `Camera box ${JSON.stringify(box)} must contain probabilities station ${JSON.stringify(prob)}`);
  assert(containsRect(box, objBounds), `Camera box ${JSON.stringify(box)} must contain objective overlay ${JSON.stringify(objBounds)}`);
});

test('publicLearningCameraBox frames parameter/backward evidence across distinct pins', () => {
  const pins: ParameterPin[] = [
    { name: 'wte', row: 0, column: 0 },
    { name: 'wpe', row: 0, column: 0 },
    { name: 'layer0.attn_wq', row: 0, column: 0 },
    { name: 'layer0.attn_wo', row: 0, column: 0 },
    { name: 'layer0.mlp_fc1', row: 0, column: 0 },
    { name: 'lm_head', row: 0, column: 0 },
  ];

  for (const pin of pins) {
    const ownerName = parameterOwners[pin.name] ?? 'tokenEmbedding';
    const owner = stationFor(ownerName);
    const bank = stationFor(pin.name);
    const paramBounds = parameterLearningBounds(pin);

    const box = publicLearningCameraBox('parameter', pin);

    assert(withinDomain(box, 4500, 1300), `Box ${JSON.stringify(box)} for ${pin.name} must be within [0..4500, 0..1300]`);
    assert(containsRect(box, owner), `Camera box ${JSON.stringify(box)} must contain owner ${ownerName} ${JSON.stringify(owner)}`);
    assert(containsRect(box, bank), `Camera box ${JSON.stringify(box)} must contain bank ${pin.name} ${JSON.stringify(bank)}`);
    assert(containsRect(box, paramBounds), `Camera box ${JSON.stringify(box)} must contain parameter overlay ${JSON.stringify(paramBounds)}`);
  }
});

test('publicLearningCameraBox frames adam/ready evidence with focused composition without requiring owner', () => {
  const pins: ParameterPin[] = [
    { name: 'wte', row: 0, column: 0 },
    { name: 'layer0.attn_wo', row: 0, column: 0 },
    { name: 'lm_head', row: 0, column: 0 },
  ];

  for (const pin of pins) {
    const bank = stationFor(pin.name);
    const paramBounds = parameterLearningBounds(pin);
    const adamBounds = adamLearningBounds(pin);

    const box = publicLearningCameraBox('adam', pin);

    assert(withinDomain(box, 4500, 1300), `Box ${JSON.stringify(box)} for ${pin.name} must be within [0..4500, 0..1300]`);
    assert(containsRect(box, bank), `Camera box ${JSON.stringify(box)} must contain bank ${pin.name} ${JSON.stringify(bank)}`);
    assert(containsRect(box, paramBounds), `Camera box ${JSON.stringify(box)} must contain parameter overlay ${JSON.stringify(paramBounds)}`);
    assert(containsRect(box, adamBounds), `Camera box ${JSON.stringify(box)} must contain adam overlay ${JSON.stringify(adamBounds)}`);

    // Verify bounded height: focused Adam decision context does not create a tall oversized box
    assert(box.height <= 700, `Adam box height (${box.height}) must be <= 700 to keep decision context focused`);
  }
});

test('unionBoxes computes minimal enclosing rectangle', () => {
  const empty = unionBoxes([]);
  assert.deepEqual(empty, { x: 0, y: 0, width: 0, height: 0 });

  const b1: WorldRect = { x: 100, y: 200, width: 50, height: 60 };
  const b2: WorldRect = { x: 80, y: 150, width: 120, height: 200 };

  const u = unionBoxes([b1, b2]);
  assert.equal(u.x, 80);
  assert.equal(u.y, 150);
  assert.equal(u.width, 120); // 80 + 120 = 200, b1 right is 150, max is 200
  assert.equal(u.height, 200); // 150 + 200 = 350, b1 bottom is 260, max is 350
});
