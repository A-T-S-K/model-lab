import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_HOME, responsiveSemanticFrame } from '../../app/spatial/camera.js';
import {
  padPublicCameraBounds,
  publicLessonCameraPlan,
  unionPublicCameraBounds,
  type PublicCameraBounds,
} from '../../app/spatial/public-camera.js';

function contains(outer: PublicCameraBounds, inner: PublicCameraBounds): boolean {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

test('public lesson camera plans preserve stable semantic groups', () => {
  assert.equal(publicLessonCameraPlan('cold').mode, 'overview');
  assert.deepEqual(
    ['p1_attention_compare', 'p1_attention_weights', 'p1_value_mixture'].map(state => publicLessonCameraPlan(state as Parameters<typeof publicLessonCameraPlan>[0]).headKinds),
    Array.from({ length: 3 }, () => ['q', 'k', 'v', 'attentionLogits', 'attentionProbabilities', 'headOutput']),
  );
  assert.deepEqual(
    publicLessonCameraPlan('p1_qkv').headKinds,
    ['q', 'k', 'v'],
  );
  assert.equal(publicLessonCameraPlan('p1_complete').includeFocus, true);
  assert.deepEqual(publicLessonCameraPlan('p2_objective').overlays, ['[data-testid="objective-anchor"]']);
  assert.deepEqual(
    publicLessonCameraPlan('p2_gradient_contribution'),
    publicLessonCameraPlan('p2_final_gradient'),
  );
  assert.equal(publicLessonCameraPlan('p2_adam_proposal').overlays?.includes('[data-testid="adam-learning-overlay"]'), true);
  assert.equal(publicLessonCameraPlan('candidate_ready').kinds?.includes('probabilities'), true);
  assert.equal(publicLessonCameraPlan('tour_complete').mode, 'hold');
});

test('unionPublicCameraBounds encloses grouped authoritative focus geometry', () => {
  const boxes: PublicCameraBounds[] = [
    { x: 190, y: 365, width: 110, height: 170 },
    { x: 675, y: 480, width: 110, height: 170 },
    { x: 870, y: 300, width: 115, height: 170 },
  ];
  assert.deepEqual(unionPublicCameraBounds(boxes), { x: 190, y: 300, width: 795, height: 350 });
});

test('padding and responsive aspect-fit keep the same semantic target visible', () => {
  const semantic: PublicCameraBounds = { x: 675, y: 300, width: 1085, height: 560 };
  const padded = padPublicCameraBounds(
    semantic,
    { padX: 150, padY: 105, minWidth: 1500, minHeight: 720 },
    PUBLIC_HOME,
  );
  assert(contains(padded, semantic));

  const at720 = responsiveSemanticFrame(1280, 720, padded, PUBLIC_HOME);
  const at1080 = responsiveSemanticFrame(1920, 1080, padded, PUBLIC_HOME);
  assert(contains(at720, semantic));
  assert(contains(at1080, semantic));
  assert.ok(Math.abs(at720.width / at720.height - 1280 / 720) < 0.01);
  assert.ok(Math.abs(at1080.width / at1080.height - 1920 / 1080) < 0.01);
});
