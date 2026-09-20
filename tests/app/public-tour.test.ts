import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_TOUR_STATES,
  getPublicTourContent,
  advanceTour,
  previousTourState,
  startPart2,
  facilitatorTourStateForLandmark,
  type PublicTourState,
} from '../../app/spatial/public-tour.js';

test('PUBLIC_TOUR_STATES defines all 17 authoritative narrative states', () => {
  assert.equal(PUBLIC_TOUR_STATES.length, 17);
  const expectedStates: PublicTourState[] = [
    'cold',
    'p1_prediction_preview',
    'p1_represent',
    'p1_mix_context',
    'p1_transform',
    'p1_score',
    'p1_probabilities',
    'p1_complete',
    'p2_objective',
    'p2_score_backward',
    'p2_transform_backward',
    'p2_mix_context_backward',
    'p2_represent_backward',
    'p2_parameter_gradient',
    'p2_adam_proposal',
    'candidate_ready',
    'tour_complete',
  ];
  assert.deepEqual([...PUBLIC_TOUR_STATES], expectedStates);

  for (const st of PUBLIC_TOUR_STATES) {
    const content = getPublicTourContent(st);
    assert.equal(content.state, st);
    assert(content.headline.length > 0, `Headline missing for ${st}`);
    assert(content.routePurpose.length > 0, `Route purpose missing for ${st}`);
    assert(content.plainMeaning.length > 0, `Plain meaning missing for ${st}`);
    assert(content.selectionIntent, `Selection intent missing for ${st}`);
  }
});

test('Part 1 has 6 teaching states followed by an explicit Part 1 Complete state', () => {
  const p1Expected = [
    { state: 'p1_prediction_preview', progress: 'Part 1 of 2 · 1 of 6 · Prediction', headline: 'PREDICTION', stop: 0 },
    { state: 'p1_represent', progress: 'Part 1 of 2 · 2 of 6 · Represent', headline: 'REPRESENT', stop: 1 },
    { state: 'p1_mix_context', progress: 'Part 1 of 2 · 3 of 6 · Mix Context', headline: 'MIX CONTEXT', stop: 2 },
    { state: 'p1_transform', progress: 'Part 1 of 2 · 4 of 6 · Transform', headline: 'TRANSFORM', stop: 3 },
    { state: 'p1_score', progress: 'Part 1 of 2 · 5 of 6 · Score', headline: 'SCORE', stop: 4 },
    { state: 'p1_probabilities', progress: 'Part 1 of 2 · 6 of 6 · Probabilities', headline: 'PROBABILITIES', stop: 5 },
  ] as const;

  for (const exp of p1Expected) {
    const c = getPublicTourContent(exp.state);
    assert.equal(c.part, 1);
    assert.equal(c.progress, exp.progress);
    assert.equal(c.headline, exp.headline);
    assert.equal(c.selectionIntent.derivedShortStop, exp.stop);
    assert(c.primaryAction, `Primary action missing for ${exp.state}`);
  }

  // Advance sequence through all 6 Part 1 states leads to p1_complete
  let current: PublicTourState = 'p1_prediction_preview';
  current = advanceTour(current);
  assert.equal(current, 'p1_represent');
  current = advanceTour(current);
  assert.equal(current, 'p1_mix_context');
  current = advanceTour(current);
  assert.equal(current, 'p1_transform');
  current = advanceTour(current);
  assert.equal(current, 'p1_score');
  current = advanceTour(current);
  assert.equal(current, 'p1_probabilities');
  current = advanceTour(current);
  assert.equal(current, 'p1_complete');

  // p1_complete is a distinct non-numbered completion state with explicit transition actions
  const completeContent = getPublicTourContent('p1_complete');
  assert.equal(completeContent.part, 1);
  assert.equal(completeContent.progress, 'Part 1 Complete');
  assert.equal(completeContent.headline, 'PART 1 COMPLETE');
  assert.equal(completeContent.primaryAction?.id, 'short-teach');
  assert.equal(completeContent.optionalActions[0]?.id, 'start-reverse-learning');
});

test('Part 2 has 7 reverse learning states that advance visitor-by-visitor with truth guardrails', () => {
  const p2Expected = [
    { state: 'p2_objective', progress: 'Part 2 of 2 · 1 of 7 · Training Objective', stop: 0 },
    { state: 'p2_score_backward', progress: 'Part 2 of 2 · 2 of 7 · Score Backward', stop: 1 },
    { state: 'p2_transform_backward', progress: 'Part 2 of 2 · 3 of 7 · Transform Backward', stop: 2 },
    { state: 'p2_mix_context_backward', progress: 'Part 2 of 2 · 4 of 7 · Mix Context Backward', stop: 3 },
    { state: 'p2_represent_backward', progress: 'Part 2 of 2 · 5 of 7 · Represent Backward', stop: 4 },
    { state: 'p2_parameter_gradient', progress: 'Part 2 of 2 · 6 of 7 · Parameter Gradient', stop: 5 },
    { state: 'p2_adam_proposal', progress: 'Part 2 of 2 · 7 of 7 · Adam Proposal', stop: 6 },
  ] as const;

  assert.equal(startPart2(), 'p2_objective');

  for (const exp of p2Expected) {
    const c = getPublicTourContent(exp.state);
    assert.equal(c.part, 2);
    assert.equal(c.progress, exp.progress);
    assert.equal(c.selectionIntent.derivedReverseStop, exp.stop);
    assert(c.truthGuardrail, `Truth guardrail missing for ${exp.state}`);
    assert.match(c.truthGuardrail!, /Visual movement is not runtime timing/);
  }

  // Forward progression through Part 2
  let current: PublicTourState = 'p2_objective';
  for (let i = 1; i < p2Expected.length; i++) {
    current = advanceTour(current);
    assert.equal(current, p2Expected[i].state);
  }
  current = advanceTour(current);
  assert.equal(current, 'candidate_ready');

  // Backward progression through Part 2
  let back: PublicTourState = 'candidate_ready';
  for (let i = p2Expected.length - 1; i >= 0; i--) {
    back = previousTourState(back);
    assert.equal(back, p2Expected[i].state);
  }
});

test('Candidate Ready: peer decision actions and authoritative runtime transition', () => {
  const cr = getPublicTourContent('candidate_ready');
  assert.equal(cr.progress, 'Candidate Ready');
  assert.equal(cr.headline, 'CANDIDATE UPDATE READY');
  // advanceTour at candidate_ready does NOT auto-advance
  assert.equal(advanceTour('candidate_ready'), 'candidate_ready');

  // Outcome: Accepted
  const accepted = getPublicTourContent('tour_complete', 'accepted');
  assert.equal(accepted.progress, 'Tour Complete');
  assert.equal(accepted.headline, 'UPDATE ACCEPTED');
  assert.match(accepted.plainMeaning, /updated weights/);
  assert.match(accepted.routePurpose, /committed into the live accepted model/);
  assert.equal(accepted.primaryAction?.id, 'tour-restart');

  // Outcome: Discarded
  const discarded = getPublicTourContent('tour_complete', 'discarded');
  assert.equal(discarded.progress, 'Tour Complete');
  assert.equal(discarded.headline, 'UPDATE DISCARDED');
  assert.match(discarded.plainMeaning, /discarded without modifying model parameters/);
  assert.match(discarded.routePurpose, /remains in its prior accepted state/);
  assert.equal(discarded.primaryAction?.id, 'tour-restart');
});

test('Facilitator landmark mapping matches Part 1 and Part 2 states', () => {
  assert.equal(facilitatorTourStateForLandmark(0, false), 'p1_prediction_preview');
  assert.equal(facilitatorTourStateForLandmark(1, false), 'p1_represent');
  assert.equal(facilitatorTourStateForLandmark(2, false), 'p1_mix_context');
  assert.equal(facilitatorTourStateForLandmark(3, false), 'p1_transform');
  assert.equal(facilitatorTourStateForLandmark(4, false), 'p1_score');
  assert.equal(facilitatorTourStateForLandmark(5, false), 'p1_probabilities');

  assert.equal(facilitatorTourStateForLandmark(0, true), 'p2_objective');
  assert.equal(facilitatorTourStateForLandmark(1, true), 'p2_score_backward');
  assert.equal(facilitatorTourStateForLandmark(2, true), 'p2_transform_backward');
  assert.equal(facilitatorTourStateForLandmark(3, true), 'p2_mix_context_backward');
  assert.equal(facilitatorTourStateForLandmark(4, true), 'p2_represent_backward');
  assert.equal(facilitatorTourStateForLandmark(5, true), 'p2_parameter_gradient');
  assert.equal(facilitatorTourStateForLandmark(6, true), 'p2_adam_proposal');
});

test('Selection intents map exact causal graph kinds and tokens', () => {
  const p1Kinds = [
    { state: 'p1_prediction_preview', kind: 'probabilities', token: 3 },
    { state: 'p1_represent', kind: 'preAttentionNorm', token: 3, layer: 0 },
    { state: 'p1_mix_context', kind: 'attentionResidual', token: 3, layer: 0, head: 0 },
    { state: 'p1_transform', kind: 'mlpResidual', token: 3, layer: 0 },
    { state: 'p1_score', kind: 'logits', token: 3 },
    { state: 'p1_probabilities', kind: 'probabilities', token: 3 },
    { state: 'p1_complete', kind: 'probabilities', token: 3 },
  ] as const;

  for (const item of p1Kinds) {
    const c = getPublicTourContent(item.state);
    assert.equal(c.selectionIntent.kind, item.kind);
    assert.equal(c.selectionIntent.token, item.token);
    if ('layer' in item) assert.equal(c.selectionIntent.layer, item.layer);
    if ('head' in item) assert.equal(c.selectionIntent.head, item.head);
  }

  const p2Kinds = [
    { state: 'p2_objective', kind: 'probabilities', token: 3 },
    { state: 'p2_score_backward', kind: 'logits', token: 3 },
    { state: 'p2_transform_backward', kind: 'mlpResidual', token: 3, layer: 0 },
    { state: 'p2_mix_context_backward', kind: 'attentionResidual', token: 3, layer: 0 },
    { state: 'p2_represent_backward', kind: 'preAttentionNorm', token: 3, layer: 0 },
    { state: 'p2_parameter_gradient', kind: 'tokenEmbedding', token: 3 },
    { state: 'p2_adam_proposal', kind: 'wte', token: 3 },
    { state: 'candidate_ready', kind: 'wte', token: 3 },
    { state: 'tour_complete', kind: 'probabilities', token: 3 },
  ] as const;

  for (const item of p2Kinds) {
    const c = getPublicTourContent(item.state);
    assert.equal(c.selectionIntent.kind, item.kind);
    assert.equal(c.selectionIntent.token, item.token);
    if ('layer' in item) assert.equal(c.selectionIntent.layer, item.layer);
  }
});
