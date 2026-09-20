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
  computeLiveTourEvidence,
  formatAdamGlanceNote,
  formatCandidateOutcomeMeanLoss,
  formatCandidateTargetTokenProbability,
  getPendingTourActionLabel,
  getPublicExecutionStatus,
  type PublicTourState,
  type TourEvidence,
} from '../../app/spatial/public-tour.js';
import { SpatialPresenter, computeTrainingActionState } from '../../app/spatial/presenter.js';

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

test('Part 2 does not begin before successful runtime startup and authentic progress', () => {
  // While startup is pending (or before startup acknowledges), no training progress exists
  const unstarted = computeLiveTourEvidence(undefined);
  assert.equal(unstarted.hasObjective, false);
  assert.equal(unstarted.hasMatchingContribution, false);
  assert.equal(unstarted.hasFinalGradient, false);
  assert.equal(unstarted.hasPinnedProposal, false);
  assert.equal(unstarted.hasCandidateComparison, false);

  // canAdvanceTour ensures p1_complete never auto-advances
  assert.equal(canAdvanceTour('p1_complete', unstarted), false);

  // Even if some evidence is passed, p1_complete cannot advance without runtime controller starting Part 2
  assert.equal(canAdvanceTour('p1_complete', {
    hasObjective: true,
    hasMatchingContribution: true,
    hasFinalGradient: true,
    hasPinnedProposal: true,
    hasCandidateComparison: true,
  }), false);

  // p2_objective requires current training progress with mean loss and matching pin contribution
  const pendingObjective = computeLiveTourEvidence({ phase: 'baseline forward' });
  assert.equal(pendingObjective.hasObjective, false);
  assert.equal(canAdvanceTour('p2_objective', pendingObjective), false);
});

test('Live tour evidence gates: Candidate Ready requires current readyOutputs, not candidateId alone', () => {
  // candidateId alone is NOT sufficient comparison evidence
  const candidateIdOnly = computeLiveTourEvidence({
    phase: 'ready',
    candidateId: 'snap-cand-123',
    readyOutputs: undefined,
  });
  assert.equal(candidateIdOnly.hasCandidateComparison, false, 'candidateId alone must NOT satisfy comparison evidence');
  assert.equal(canAdvanceTour('p2_adam_proposal', candidateIdOnly), false);

  // Phase ready with readyOutputs satisfies candidate comparison evidence
  const readyOutputsPresent = computeLiveTourEvidence({
    phase: 'ready',
    candidateId: 'snap-cand-123',
    readyOutputs: { before: {} as any, after: {} as any, starting: {} as any },
  });
  assert.equal(readyOutputsPresent.hasCandidateComparison, true, 'readyOutputs satisfies candidate comparison evidence');
  assert.equal(canAdvanceTour('p2_adam_proposal', readyOutputsPresent), true);

  // Selected pin must match for gradient contribution
  const pinMismatch = computeLiveTourEvidence({
    contributions: [{ child: 1 }],
    pin: 5,
  }, 0);
  assert.equal(pinMismatch.hasMatchingContribution, false, 'Contributions for unselected pin must not satisfy matching contribution');

  const pinMatch = computeLiveTourEvidence({
    contributions: [{ child: 1 }],
    pin: 0,
  }, 0);
  assert.equal(pinMatch.hasMatchingContribution, true, 'Contributions for selected pin satisfy matching contribution');
});

test('Candidate Ready wording truthfully reports target-token probability and derived mean loss', () => {
  const targetProb = formatCandidateTargetTokenProbability('a', 3, 0.45, 0.62, n => (n !== undefined ? n.toFixed(2) : ''));
  assert(!targetProb.includes('Prediction for character'), 'Must NOT call target-token probability "Prediction for character"');
  assert(targetProb.includes("Target-token probability for 'a' at position 3: accepted 0.45 → provisional candidate 0.62"));

  const meanLoss = formatCandidateOutcomeMeanLoss(1.85, 1.42, n => (n !== undefined ? n.toFixed(2) : ''));
  assert(meanLoss.includes('Mean loss on this training example, derived from observed target probabilities: 1.85 → 1.42'));

  const readyContent = getPublicTourContent('candidate_ready');
  assert(readyContent.plainMeaning.includes('A changed result or lower loss on this training example is not proof of general model improvement.'));
});

test('Adam wording distinguishes stored optimizer state from proposed updated moments', () => {
  const glanceNote = formatAdamGlanceNote({
    gradient: -0.05,
    mBefore: 0.01,
    vBefore: 0.002,
    mAfter: -0.005,
    vAfter: 0.0024,
    fmt: n => (n !== undefined ? String(n) : ''),
  });

  // Stored optimizer state entering Adam: mBefore, vBefore
  assert(glanceNote.includes('stored optimizer state (m=0.01, v=0.002)'));
  // Final gradient: g
  assert(glanceNote.includes('final gradient g=-0.05'));
  // Proposed updated moments: mAfter, vAfter
  assert(glanceNote.includes('updated moments (m′=-0.005, v′=0.0024)'));
  // Provisional parameter: θ′
  assert(glanceNote.includes('provisional parameter θ′'));
  // Must NOT describe mAfter / vAfter as the stored or entering state
  assert(!glanceNote.includes('persistent optimizer state (m=-0.005'));
});

test('C3: Teaching content remains stable across states and is never overwritten by runtime execution phase', () => {
  for (const st of PUBLIC_TOUR_STATES) {
    const c1 = getPublicTourContent(st);
    const c2 = getPublicTourContent(st);
    assert.equal(c1.headline, c2.headline);
    assert.equal(c1.routePurpose, c2.routePurpose);
    assert.equal(c1.plainMeaning, c2.plainMeaning);
    assert.equal(c1.progress, c2.progress);
    if (c1.truthGuardrail) {
      assert.equal(c1.truthGuardrail, c2.truthGuardrail);
    }
  }

  const p2States: PublicTourState[] = [
    'p2_objective',
    'p2_gradient_contribution',
    'p2_final_gradient',
    'p2_adam_proposal',
    'candidate_ready',
  ];
  const expectedHeadlines = [
    'MEASURE ERROR',
    'TRACE ONE GRADIENT CONTRIBUTION',
    'FINAL PARAMETER GRADIENT',
    'ADAM PROPOSES CANDIDATE',
    'CANDIDATE UPDATE READY',
  ];
  for (let i = 0; i < p2States.length; i++) {
    const c = getPublicTourContent(p2States[i]);
    assert.equal(c.headline, expectedHeadlines[i]);
    assert(c.plainMeaning.length > 20);
    assert(c.routePurpose.length > 10);
  }
});

test('C3: getPendingTourActionLabel maps pending tour states to distinct working indicators', () => {
  assert.equal(getPendingTourActionLabel('p2_objective'), 'Tracing contribution...');
  assert.equal(getPendingTourActionLabel('p2_gradient_contribution'), 'Finishing gradient...');
  assert.equal(getPendingTourActionLabel('p2_final_gradient'), 'Computing Adam proposal...');
  assert.equal(getPendingTourActionLabel('p2_adam_proposal'), 'Evaluating candidate...');
  assert.equal(getPendingTourActionLabel('p1_complete'), 'Starting learning...');
  assert.equal(getPendingTourActionLabel('cold'), 'Working...');
  assert.equal(getPendingTourActionLabel('p1_prediction_preview'), 'Working...');
});

test('C3: getPublicExecutionStatus provides truthful secondary status answering what model is doing without worker jargon', () => {
  const statusForward = getPublicExecutionStatus({
    currentState: 'p2_objective',
    targetState: 'p2_gradient_contribution',
    phase: 'training forward',
    driverPhase: 'running',
  });
  assert.equal(statusForward, 'Preparing training objective...');

  const statusLoss = getPublicExecutionStatus({
    currentState: 'p2_objective',
    targetState: 'p2_gradient_contribution',
    phase: 'loss',
    driverPhase: 'running',
  });
  assert.equal(statusLoss, 'Measuring error across target positions...');

  const statusContrib = getPublicExecutionStatus({
    currentState: 'p2_objective',
    targetState: 'p2_gradient_contribution',
    phase: 'backward',
    driverPhase: 'running',
  });
  assert.equal(statusContrib, "Finding the selected parameter's gradient contribution...");

  const statusFinishing = getPublicExecutionStatus({
    currentState: 'p2_gradient_contribution',
    targetState: 'p2_final_gradient',
    phase: 'backward',
    driverPhase: 'running',
    final: false,
  });
  assert.equal(statusFinishing, 'Finishing backward pass...');

  const statusFinal = getPublicExecutionStatus({
    currentState: 'p2_gradient_contribution',
    targetState: 'p2_final_gradient',
    phase: 'backward',
    driverPhase: 'running',
    final: true,
  });
  assert.equal(statusFinal, "Finding the selected parameter's final gradient...");

  const statusAdam = getPublicExecutionStatus({
    currentState: 'p2_final_gradient',
    targetState: 'p2_adam_proposal',
    phase: 'optimizer proposal',
    driverPhase: 'running',
  });
  assert.equal(statusAdam, 'Computing Adam proposal...');

  const statusCand = getPublicExecutionStatus({
    currentState: 'p2_adam_proposal',
    targetState: 'candidate_ready',
    phase: 'candidate forward',
    driverPhase: 'running',
  });
  assert.equal(statusCand, 'Evaluating provisional candidate...');

  const statusReady = getPublicExecutionStatus({
    currentState: 'candidate_ready',
    phase: 'ready',
    driverPhase: 'paused',
  });
  assert.equal(statusReady, 'Candidate ready — not accepted');

  const statusCancel = getPublicExecutionStatus({
    currentState: 'p2_gradient_contribution',
    targetState: 'p2_final_gradient',
    driverPhase: 'cancelling',
  });
  assert.equal(statusCancel, 'Cancelling execution...');

  const statusIdle = getPublicExecutionStatus({
    currentState: 'p2_objective',
    targetState: undefined,
    driverPhase: 'paused',
  });
  assert.equal(statusIdle, '');

  const allStatuses = [
    statusForward,
    statusLoss,
    statusContrib,
    statusFinishing,
    statusFinal,
    statusAdam,
    statusCand,
    statusReady,
    statusCancel,
  ];
  const forbiddenJargon = [
    /permit/i,
    /sequence/i,
    /admitted operator/i,
    /wave\s*2/i,
    /wave\s*1/i,
    /internal phase/i,
  ];
  for (const s of allStatuses) {
    for (const pattern of forbiddenJargon) {
      assert(!pattern.test(s), `Status "${s}" matches forbidden jargon pattern ${pattern}`);
    }
  }
});

test('C3: Gated transitions advance exactly once to the target state and pause until explicit visitor advancement', () => {
  const ev1: TourEvidence = {
    hasObjective: true,
    hasMatchingContribution: false,
    hasFinalGradient: false,
    hasPinnedProposal: false,
    hasCandidateComparison: false,
  };
  assert.equal(canAdvanceTour('p2_objective', ev1), false);

  const ev2: TourEvidence = { ...ev1, hasMatchingContribution: true };
  assert.equal(canAdvanceTour('p2_objective', ev2), true);

  assert.equal(canAdvanceTour('p2_gradient_contribution', ev2), false);
  const ev3: TourEvidence = { ...ev2, hasFinalGradient: true };
  assert.equal(canAdvanceTour('p2_gradient_contribution', ev3), true);

  assert.equal(canAdvanceTour('p2_final_gradient', ev3), false);
  const ev4: TourEvidence = { ...ev3, hasPinnedProposal: true };
  assert.equal(canAdvanceTour('p2_final_gradient', ev4), true);

  assert.equal(canAdvanceTour('p2_adam_proposal', ev4), false);
  const ev5: TourEvidence = { ...ev4, hasCandidateComparison: true };
  assert.equal(canAdvanceTour('p2_adam_proposal', ev5), true);

  assert.equal(canAdvanceTour('candidate_ready', ev5), false);
});


test('C3-R1: final-gradient transition continues normal backward without proposal stop-at-pin', () => {
  const calls: string[] = [];
  const presenter = Object.create(SpatialPresenter.prototype) as SpatialPresenter;
  presenter.profile = 'visitor';
  presenter.publicTourState = 'p2_gradient_contribution';
  presenter.tourTargetState = undefined;
  (presenter as any).state = {
    profile: 'visitor',
    execution: {
      active: true,
      phase: 'paused',
      pending: false,
      pin: 0,
      progress: {
        executionId: 'c3-r1-final-gradient',
        sequence: 1,
        training: {
          phase: 'backward',
          mean: 1,
          contributions: [{}],
          final: false,
          gradient: 0,
        },
      },
      continue: () => calls.push('continue'),
      runToContribution: () => calls.push('runToContribution'),
      runToProposal: () => calls.push('runToProposal'),
    },
  };

  presenter.advanceTour();

  assert.equal(presenter.publicTourState, 'p2_gradient_contribution');
  assert.equal(presenter.tourTargetState, 'p2_final_gradient');
  assert.deepEqual(calls, ['continue']);
});

test('C3-R1: objective mean pauses in place and unlocks its CTA only after measurement', () => {
  const presenter = Object.create(SpatialPresenter.prototype) as SpatialPresenter;
  presenter.profile = 'visitor';
  presenter.publicTourState = 'p2_objective';
  presenter.tourTargetState = undefined;
  let pauseCalls = 0;
  const execution = {
    active: true,
    phase: 'running',
    pending: false,
    pin: 0,
    progress: {
      executionId: 'c3-r1-objective',
      sequence: 2,
      training: {
        phase: 'backward seed',
        mean: 0.25,
        contributions: [],
        final: false,
        gradient: 0,
      },
    },
    pause: () => {
      pauseCalls++;
      execution.phase = 'paused';
    },
  };
  (presenter as any).state = { profile: 'visitor', execution };

  presenter.checkEvidenceGates();

  assert.equal(pauseCalls, 1);
  assert.equal(presenter.publicTourState, 'p2_objective');
  assert.equal(presenter.tourTargetState, undefined);

  const pin = { name: 'wte', row: 0, column: 0 } as any;
  const pendingAction = computeTrainingActionState({
    ...execution,
    phase: 'paused',
    progress: {
      ...execution.progress,
      training: { ...execution.progress.training, mean: undefined },
    },
  } as any, pin, true, undefined, 'p2_objective');
  const readyAction = computeTrainingActionState({
    ...execution,
    phase: 'paused',
  } as any, pin, true, undefined, 'p2_objective');

  assert.equal(pendingAction?.disabled, true);
  assert.equal(readyAction?.disabled, false);
  assert.equal(getPublicTourContent('p2_objective').primaryAction?.label, 'Continue: Trace gradient contribution');
});

