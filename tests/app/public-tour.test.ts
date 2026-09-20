import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_TOUR_STATES,
  getPublicTourContent,
  advanceTour,
  previousTourState,
  startPart2,
  facilitatorTourStateForLandmark,
  canAdvanceTour,
  type PublicTourState,
  type TourEvidence,
} from '../../app/spatial/public-tour.js';
import { renderContextualDock } from '../../app/spatial/contextual-dock.js';
import { ModelSession } from '../../app/worker/controller.js';
import { forwardReadModel } from '../../app/spatial/forward.js';

test('PUBLIC_TOUR_STATES defines exactly 14 authoritative narrative states', () => {
  assert.equal(PUBLIC_TOUR_STATES.length, 14);
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
    'p2_gradient_contribution',
    'p2_final_gradient',
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

test('Part 1 has 6 teaching states followed by an explicit Part 1 Complete state with truthful semantics', () => {
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

  // Truthful teaching semantics for Part 1
  const represent = getPublicTourContent('p1_represent');
  assert(!represent.plainMeaning.includes('in space'), 'p1_represent must not say position represents order in space');
  assert(represent.plainMeaning.includes('token') && represent.plainMeaning.includes('position'), 'p1_represent combines token and position');

  const mix = getPublicTourContent('p1_mix_context');
  assert(!mix.plainMeaning.includes('relevant'), 'p1_mix_context must not imply attention weight = relevance');
  assert(!mix.plainMeaning.includes('importance'), 'p1_mix_context must not imply attention weight = importance');
  assert(!mix.plainMeaning.includes('responsibility'), 'p1_mix_context must not imply causal responsibility');
  assert(mix.plainMeaning.includes('normalized attention weights'), 'p1_mix_context describes normalized attention weights');

  const transform = getPublicTourContent('p1_transform');
  assert(!transform.routePurpose.includes('higher-order features'), 'p1_transform must remove higher-order features');
  assert(!transform.plainMeaning.includes('higher-order features'), 'p1_transform must remove higher-order features');
  assert(transform.plainMeaning.includes('normalization') || transform.plainMeaning.includes('normalizes'), 'p1_transform describes normalization');
  assert(transform.plainMeaning.includes('ReLU') || transform.plainMeaning.includes('relu'), 'p1_transform describes ReLU');
  assert(transform.plainMeaning.includes('residual'), 'p1_transform describes residual stream');

  const score = getPublicTourContent('p1_score');
  assert(!score.plainMeaning.includes('likely') && !score.plainMeaning.includes('probability'), 'p1_score must not describe logits as likelihoods or probabilities');
  assert(score.plainMeaning.includes('unnormalized vocabulary scores'), 'p1_score describes raw unnormalized vocabulary scores');

  const probabilities = getPublicTourContent('p1_probabilities');
  assert(!probabilities.plainMeaning.includes('determining what comes next'), 'p1_probabilities must not say softmax determines what comes next');
  assert(probabilities.plainMeaning.includes('current prediction can be identified'), 'p1_probabilities explains prediction identified from resulting distribution');

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

  // p1_complete: One obvious Visitor action that starts real training
  const completeContent = getPublicTourContent('p1_complete');
  assert.equal(completeContent.part, 1);
  assert.equal(completeContent.progress, 'Part 1 Complete');
  assert.equal(completeContent.headline, 'PART 1 COMPLETE');
  assert.equal(completeContent.primaryAction?.id, 'short-teach');
  assert.equal(completeContent.primaryAction?.label, 'Start Part 2: See how learning works');
  assert.equal(completeContent.optionalActions.length, 0, 'Must not expose competing public Part 1 actions');
});

test('Part 2 has exactly 5 visitor teaching moments that advance with truth guardrails', () => {
  const p2Expected = [
    { state: 'p2_objective', progress: 'Part 2 of 2 · 1 of 5 · Measure error', headline: 'MEASURE ERROR' },
    { state: 'p2_gradient_contribution', progress: 'Part 2 of 2 · 2 of 5 · Trace gradient contribution', headline: 'TRACE ONE GRADIENT CONTRIBUTION' },
    { state: 'p2_final_gradient', progress: 'Part 2 of 2 · 3 of 5 · Finish gradient', headline: 'FINAL PARAMETER GRADIENT' },
    { state: 'p2_adam_proposal', progress: 'Part 2 of 2 · 4 of 5 · Adam proposal', headline: 'ADAM PROPOSES CANDIDATE' },
    { state: 'candidate_ready', progress: 'Part 2 of 2 · 5 of 5 · Compare and decide', headline: 'CANDIDATE UPDATE READY' },
  ] as const;

  assert.equal(startPart2(), 'p2_objective');

  for (const exp of p2Expected) {
    const c = getPublicTourContent(exp.state);
    assert.equal(c.part, 2);
    assert.equal(c.progress, exp.progress);
    assert.equal(c.headline, exp.headline);
    assert(c.truthGuardrail, `Truth guardrail missing for ${exp.state}`);
    assert.match(c.truthGuardrail!, /Visual movement is not runtime timing/);
  }

  // Forward nominal sequence through Part 2
  let current: PublicTourState = 'p2_objective';
  current = advanceTour(current);
  assert.equal(current, 'p2_gradient_contribution');
  current = advanceTour(current);
  assert.equal(current, 'p2_final_gradient');
  current = advanceTour(current);
  assert.equal(current, 'p2_adam_proposal');
  current = advanceTour(current);
  assert.equal(current, 'candidate_ready');
  // candidate_ready does NOT auto-advance
  assert.equal(advanceTour('candidate_ready'), 'candidate_ready');

  // Backward nominal sequence through Part 2
  let back: PublicTourState = 'candidate_ready';
  back = previousTourState(back);
  assert.equal(back, 'p2_adam_proposal');
  back = previousTourState(back);
  assert.equal(back, 'p2_final_gradient');
  back = previousTourState(back);
  assert.equal(back, 'p2_gradient_contribution');
  back = previousTourState(back);
  assert.equal(back, 'p2_objective');
  assert.equal(previousTourState('p2_objective'), 'p2_objective');
});

test('One authentic contribution is distinct from final gradient', () => {
  const contrib = getPublicTourContent('p2_gradient_contribution');
  assert.match(contrib.headline, /TRACE ONE GRADIENT CONTRIBUTION/);
  assert(!contrib.plainMeaning.includes('assigning responsibility'), 'Must not use causal-attribution language');
  assert(contrib.plainMeaning.includes('accumulator may still be partial'), 'Must make explicit that accumulator may still be partial');

  const finalGrad = getPublicTourContent('p2_final_gradient');
  assert.match(finalGrad.headline, /FINAL PARAMETER GRADIENT/);
  assert(finalGrad.plainMeaning.includes('loss sensitivity'), 'Gradient is loss sensitivity');
  assert(finalGrad.plainMeaning.includes('not the optimizer update'), 'Gradient is not optimizer update');
  assert(finalGrad.plainMeaning.includes('finished accumulating'), 'All contributions finished');

  const adam = getPublicTourContent('p2_adam_proposal');
  assert(adam.plainMeaning.includes('persistent moments') || adam.plainMeaning.includes('persistent optimizer'), 'Adam uses persistent optimizer state');
  assert(adam.plainMeaning.includes('provisional'), 'Proposal is provisional');
  assert(adam.plainMeaning.includes('accepted model has not changed'), 'Accepted model has not changed');

  const ready = getPublicTourContent('candidate_ready');
  assert(ready.plainMeaning.includes('not proof of general model improvement'), 'Candidate ready cautions against assuming general improvement');
});

test('Evidence gating protects all Part 2 transitions', () => {
  // 1. Objective state cannot advance before real objective evidence AND matching contribution
  const emptyEvidence: TourEvidence = {
    hasObjective: false,
    hasMatchingContribution: false,
    hasFinalGradient: false,
    hasPinnedProposal: false,
    hasCandidateComparison: false,
  };
  assert.equal(canAdvanceTour('p2_objective', emptyEvidence), false);

  const objectiveOnlyEvidence: TourEvidence = {
    ...emptyEvidence,
    hasObjective: true,
    hasMatchingContribution: false,
  };
  assert.equal(canAdvanceTour('p2_objective', objectiveOnlyEvidence), false);

  const objectiveAndContribEvidence: TourEvidence = {
    ...emptyEvidence,
    hasObjective: true,
    hasMatchingContribution: true,
  };
  assert.equal(canAdvanceTour('p2_objective', objectiveAndContribEvidence), true);

  // 2. Contribution state cannot advance while gradient is partial
  assert.equal(canAdvanceTour('p2_gradient_contribution', emptyEvidence), false);
  assert.equal(canAdvanceTour('p2_gradient_contribution', { ...emptyEvidence, hasFinalGradient: false }), false);
  assert.equal(canAdvanceTour('p2_gradient_contribution', { ...emptyEvidence, hasFinalGradient: true }), true);

  // 3. Final-gradient state cannot advance before authentic pinned proposal exists
  assert.equal(canAdvanceTour('p2_final_gradient', emptyEvidence), false);
  assert.equal(canAdvanceTour('p2_final_gradient', { ...emptyEvidence, hasPinnedProposal: false }), false);
  assert.equal(canAdvanceTour('p2_final_gradient', { ...emptyEvidence, hasPinnedProposal: true }), true);

  // 4. Adam state cannot advance before authentic candidate comparison evidence exists
  assert.equal(canAdvanceTour('p2_adam_proposal', emptyEvidence), false);
  assert.equal(canAdvanceTour('p2_adam_proposal', { ...emptyEvidence, hasCandidateComparison: false }), false);
  assert.equal(canAdvanceTour('p2_adam_proposal', { ...emptyEvidence, hasCandidateComparison: true }), true);

  // 5. Candidate Ready cannot advance via canAdvanceTour (only via authoritative accept/discard)
  assert.equal(canAdvanceTour('candidate_ready', {
    hasObjective: true,
    hasMatchingContribution: true,
    hasFinalGradient: true,
    hasPinnedProposal: true,
    hasCandidateComparison: true,
  }), false);

  // 6. Tour Complete cannot advance
  assert.equal(canAdvanceTour('tour_complete', {
    hasObjective: true,
    hasMatchingContribution: true,
    hasFinalGradient: true,
    hasPinnedProposal: true,
    hasCandidateComparison: true,
  }), false);
});

test('Selection intents map exact causal graph kinds and tokens with Candidate Ready at probabilities@q', () => {
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
    { state: 'p2_gradient_contribution', kind: 'tokenEmbedding', token: 3 },
    { state: 'p2_final_gradient', kind: 'tokenEmbedding', token: 3 },
    { state: 'p2_adam_proposal', kind: 'wte', token: 3 },
    { state: 'candidate_ready', kind: 'probabilities', token: 3 },
    { state: 'tour_complete', kind: 'probabilities', token: 3 },
  ] as const;

  for (const item of p2Kinds) {
    const c = getPublicTourContent(item.state);
    assert.equal(c.selectionIntent.kind, item.kind, `Mismatch for ${item.state}`);
    assert.equal(c.selectionIntent.token, item.token, `Token mismatch for ${item.state}`);
  }
});

test('Candidate Ready: peer decision actions, probabilities@q selection, and authoritative transitions', () => {
  const cr = getPublicTourContent('candidate_ready');
  assert.equal(cr.progress, 'Part 2 of 2 · 5 of 5 · Compare and decide');
  assert.equal(cr.headline, 'CANDIDATE UPDATE READY');
  assert.equal(cr.selectionIntent.kind, 'probabilities');
  assert.equal(cr.selectionIntent.token, 3);
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

test('Facilitator landmark mapping matches 14-state contract', () => {
  assert.equal(facilitatorTourStateForLandmark(0, false), 'p1_prediction_preview');
  assert.equal(facilitatorTourStateForLandmark(1, false), 'p1_represent');
  assert.equal(facilitatorTourStateForLandmark(2, false), 'p1_mix_context');
  assert.equal(facilitatorTourStateForLandmark(3, false), 'p1_transform');
  assert.equal(facilitatorTourStateForLandmark(4, false), 'p1_score');
  assert.equal(facilitatorTourStateForLandmark(5, false), 'p1_probabilities');

  assert.equal(facilitatorTourStateForLandmark(0, true), 'p2_objective');
  assert.equal(facilitatorTourStateForLandmark(1, true), 'p2_gradient_contribution');
  assert.equal(facilitatorTourStateForLandmark(2, true), 'p2_gradient_contribution');
  assert.equal(facilitatorTourStateForLandmark(3, true), 'p2_gradient_contribution');
  assert.equal(facilitatorTourStateForLandmark(4, true), 'p2_gradient_contribution');
  assert.equal(facilitatorTourStateForLandmark(5, true), 'p2_final_gradient');
  assert.equal(facilitatorTourStateForLandmark(6, true), 'p2_adam_proposal');
});

test('Dock rendering: missing numeric evidence is not rendered as observed result, Details is optional, Explore freely removed in guided mode', async () => {
  const session = new ModelSession();
  const tag = { sessionId: 'dock-test', generationId: 0 };
  await session.handle({ ...tag, runId: 'init', command: 'initialize' });
  const response = await session.handle({ ...tag, runId: 'test-pred', command: 'predict', document: 'abca' });
  assert.equal(response.status, 'result');
  if (response.status !== 'result') return;

  const r = response.result;
  const f = forwardReadModel(r.run, r.snapshots[0]);
  const defaultPin = { name: 'wte', row: 0, column: 0 };
  const addr = { kind: 'probabilities' as const, token: 3 };

  // 1. In p2_objective when mean loss is not computed: no fake observed result card
  const objectivePendingDock = renderContextualDock({
    model: { forward: f, source: { sourceRunId: 'test', relationship: 'OBSERVED' } } as any,
    address: addr,
    element: 0,
    row: 0,
    column: 0,
    pin: defaultPin,
    scalar: '',
    depth: 'explain',
    profile: 'visitor',
    freeExplore: false,
    lessonProgress: 'Part 2 of 2 · 1 of 5 · Measure error',
    routePurpose: 'Predictions are compared with known targets',
    primaryAction: '<button id="reverse-continue">Continue: Trace gradient contribution</button>',
    attentionAction: '',
    shortDetour: false,
    shortMessage: '',
    operatorControls: false,
    hasComparison: false,
    tourContent: getPublicTourContent('p2_objective'),
  });
  assert(!objectivePendingDock.includes('OBSERVED RESULT'), 'Must NOT fake OBSERVED RESULT card when mean loss is pending');
  assert(!objectivePendingDock.includes('dock-stage-result'), 'Must omit result card when evidence pending');
  assert(objectivePendingDock.includes('Details (optional)'), 'Public dock must rename inspect to Details (optional)');
  assert(!objectivePendingDock.includes('Explore freely'), 'Must NOT have Explore freely in ordinary guided action row');

  // 2. In p2_gradient_contribution with authentic contribution: surfaces child adjoint × local derivative and accumulator before + contribution = after
  const contributionDock = renderContextualDock({
    model: { forward: f, source: { sourceRunId: 'test', relationship: 'OBSERVED' } } as any,
    address: { kind: 'tokenEmbedding', token: 3 },
    element: 0,
    row: 0,
    column: 0,
    pin: defaultPin,
    scalar: '',
    depth: 'explain',
    profile: 'visitor',
    freeExplore: false,
    lessonProgress: 'Part 2 of 2 · 2 of 5 · Trace gradient contribution',
    routePurpose: 'Loss sensitivity propagates backward',
    primaryAction: '<button id="reverse-continue">Continue: Finish parameter gradient</button>',
    attentionAction: '',
    shortDetour: false,
    shortMessage: '',
    operatorControls: false,
    hasComparison: false,
    trainingProgress: {
      phase: 'backward',
      count: 1,
      processed: 1,
      acceptedStep: 0,
      startingSnapshotId: 'snap1234567890',
      pin: 0,
      gradient: -0.0125,
      final: false,
      losses: [],
      contributions: [{
        child: 10,
        operand: 0,
        childAdjoint: 0.5,
        localDerivative: -0.025,
        contribution: -0.0125,
        before: 0.0,
        after: -0.0125,
        ordinal: 1,
      }],
      old: { parameter: 0, m: 0, v: 0 },
      optimizer: { beta1: 0.9, beta2: 0.999, epsilon: 1e-8, effectiveLearningRate: 0.001 },
      stopped: true,
      gradientSourceRunId: 'run1',
      sourceRunId: 'run1',
      baselinePasses: 1,
    },
    tourContent: getPublicTourContent('p2_gradient_contribution'),
  });

  assert(contributionDock.includes('ONE GRADIENT CONTRIBUTION · PARTIAL ACCUMULATOR'), 'Must label as one contribution and partial accumulator');
  assert(contributionDock.includes('data-testid="live-contribution"'), 'Must render live contribution');
  assert(contributionDock.includes('data-testid="live-accumulator"'), 'Must render live accumulator');
  assert(contributionDock.includes('The accumulator is still partial'), 'Must state accumulator is still partial');
  assert(!contributionDock.includes('Explore freely'), 'Must NOT have Explore freely in guided action row');
});
