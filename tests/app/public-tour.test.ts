import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_TOUR_STATES,
  getPublicTourContent,
  publicSupportActions,
  advanceTour,
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

test('IA1 support actions follow the current mechanism and leave completion uncluttered', () => {
  const qkv = publicSupportActions(getPublicTourContent('p1_qkv'));
  const objective = publicSupportActions(getPublicTourContent('p2_objective'));
  const candidate = publicSupportActions(getPublicTourContent('candidate_ready'));
  assert.deepEqual(qkv.map(action => action.label), ['Inspect Q/K/V', 'Show one projection']);
  assert.deepEqual(objective.map(action => action.label), ['See one loss', 'See all positions']);
  assert.deepEqual(candidate.map(action => action.label), ['Measurements', 'Compare candidate']);
  assert.equal(publicSupportActions(getPublicTourContent('tour_complete', 'accepted')).length, 0);
  assert(qkv.every(action => !['Values', 'Exact Math', 'Source', 'Compare'].includes(action.label)));
});
import { sceneSvg } from '../../app/spatial/scene.js';

test('PUBLIC_TOUR_STATES is a complete current UI representation without freezing a curriculum state count', () => {
  assert.equal(new Set(PUBLIC_TOUR_STATES).size, PUBLIC_TOUR_STATES.length);
  for (const required of ['cold', 'p1_complete', 'p2_backward_trace', 'candidate_ready', 'tour_complete'] as const) {
    assert(PUBLIC_TOUR_STATES.includes(required), `Missing required current UI anchor ${required}`);
  }
  for (const st of PUBLIC_TOUR_STATES) {
    const c = getPublicTourContent(st);
    assert.equal(c.state, st);
    assert(c.headline.length > 0, `Headline missing for ${st}`);
    assert(c.routePurpose.length > 0, `Route purpose missing for ${st}`);
    assert(c.plainMeaning.length > 0, `Plain meaning missing for ${st}`);
    assert(c.selectionIntent, `Selection intent missing for ${st}`);
  }
});

test('Part 1 current UI sequence follows the LS0 chapter spine without a global state counter', () => {
  const expected = [
    { state: 'p1_prediction_preview', next: 'p1_represent', progress: 'Part 1 · Make a Prediction · Opening', anchor: 'probabilities', action: 'See how it made the prediction', guardrail: /authentic prediction/ },
    { state: 'p1_represent', next: 'p1_qkv', progress: 'Part 1 · Represent · Representation', anchor: 'preAttentionNorm', action: 'Continue: Prepare attention', guardrail: /learned numerical features/ },
    { state: 'p1_qkv', next: 'p1_attention_compare', progress: 'Part 1 · Attend · Q / K / V', anchor: 'q', action: 'Continue: Compare positions', guardrail: /not literal human questions/ },
    { state: 'p1_attention_compare', next: 'p1_attention_weights', progress: 'Part 1 · Attend · Compare positions', anchor: 'attentionLogits', action: 'Continue: Attention weights', guardrail: /unavailable/ },
    { state: 'p1_attention_weights', next: 'p1_value_mixture', progress: 'Part 1 · Attend · Attention weights', anchor: 'attentionProbabilities', action: 'Continue: Mix Values', guardrail: /mixing coefficient/ },
    { state: 'p1_value_mixture', next: 'p1_attention_integration', progress: 'Part 1 · Attend · Value mixture', anchor: 'headOutput', action: 'Continue: Combine heads', guardrail: /Value vectors/ },
    { state: 'p1_attention_integration', next: 'p1_transform', progress: 'Part 1 · Attend · Combine heads + residual', anchor: 'attentionResidual', action: 'Continue: Transform', guardrail: /distinct operations/ },
    { state: 'p1_transform', next: 'p1_score', progress: 'Part 1 · Transform · MLP', anchor: 'mlpResidual', action: 'Continue: Logits', guardrail: /ReLU/ },
    { state: 'p1_score', next: 'p1_probabilities', progress: 'Part 1 · Output · Logits', anchor: 'logits', action: 'Continue: Probabilities', guardrail: /not a probability/ },
    { state: 'p1_probabilities', next: 'p1_complete', progress: 'Part 1 · Output · Probabilities', anchor: 'probabilities', action: 'Integrate Part 1', guardrail: /different objects/ },
  ] as const;

  for (const item of expected) {
    const content = getPublicTourContent(item.state);
    assert.equal(content.part, 1);
    assert.equal(content.progress, item.progress);
    assert(!/\d+ of \d+/.test(content.progress), 'Conceptual chapter location must dominate over a global counter');
    assert.equal(content.selectionIntent.kind, item.anchor);
    assert.equal(content.selectionIntent.key, 0, 'Part 1 must preserve the selected k0 causal witness');
    assert(content.focus, `Focus span missing for ${item.state}`);
    assert(content.learnerQuestion, `Learner question missing for ${item.state}`);
    assert(content.whyHere, `Why-here explanation missing for ${item.state}`);
    assert.match(content.truthGuardrail ?? '', item.guardrail);
    assert.equal(content.primaryAction?.label, item.action);
    assert.equal(content.optionalActions.length, 0, `Required Guided state ${item.state} must not expose a parallel attention mini-tour`);
    assert.equal(advanceTour(item.state), item.next);
  }

  const complete = getPublicTourContent('p1_complete');
  assert.equal(complete.progress, 'Part 1 · Forward integration');
  assert.equal(complete.headline, 'PART 1 COMPLETE · NOW SEE HOW IT LEARNS');
  assert.match(complete.truthGuardrail ?? '', /did not update them/);
  assert.equal(complete.primaryAction?.id, 'short-teach');
  assert.equal(complete.primaryAction?.label, 'Part 2 · learn from an example');
  assert.equal(advanceTour('p1_complete'), 'p1_complete');
});

test('Part 1 grouped mechanisms declare the required connected focus spans', () => {
  const nodeKeys = (state: PublicTourState) => {
    const focus = getPublicTourContent(state).focus;
    assert(focus, `Focus missing for ${state}`);
    return new Set(focus.nodes.map(node => `${node.kind}:${node.head ?? '*'}`));
  };
  const edgeKeys = (state: PublicTourState) => {
    const focus = getPublicTourContent(state).focus;
    assert(focus, `Focus missing for ${state}`);
    return new Set(focus.edges.map(edge => `${edge.from}->${edge.to}:${edge.head ?? '*'}:${edge.selected ?? ''}`));
  };

  const represent = nodeKeys('p1_represent');
  for (const kind of ['tokenEmbedding', 'positionEmbedding', 'embeddingSum', 'embeddingNorm', 'preAttentionNorm']) {
    assert(represent.has(`${kind}:*`), `Representation focus missing ${kind}`);
  }
  const representEdges = edgeKeys('p1_represent');
  assert(representEdges.has('embeddingNorm->preAttentionNorm:*:'), 'Representation must include the second rescaling before attention');
  assert(representEdges.has('embeddingNorm->attentionResidual:*:'), 'Representation must establish the saved attention bypass');

  const qkv = nodeKeys('p1_qkv');
  for (const kind of ['preAttentionNorm', 'q', 'k', 'v']) {
    assert([...qkv].some(key => key.startsWith(`${kind}:`)), `Q/K/V focus missing ${kind}`);
  }
  const qkvEdges = edgeKeys('p1_qkv');
  for (const kind of ['q', 'k', 'v']) {
    assert(qkvEdges.has(`preAttentionNorm->${kind}:0:`), `Q/K/V focus missing preAttentionNorm -> ${kind} for head 0`);
  }

  const attention = nodeKeys('p1_attention_integration');
  assert(attention.has('headOutput:0'));
  assert(attention.has('headOutput:1'));
  for (const kind of ['attentionOutput', 'attentionProjection', 'attentionResidual']) {
    assert([...attention].some(key => key.startsWith(`${kind}:`)), `Attention integration focus missing ${kind}`);
  }
  assert(edgeKeys('p1_attention_integration').has('embeddingNorm->attentionResidual:*:'), 'Attention residual bypass must be explicit');

  const mlp = nodeKeys('p1_transform');
  for (const kind of ['preMlpNorm', 'mlpUp', 'mlpRelu', 'mlpDown', 'mlpResidual']) {
    assert([...mlp].some(key => key.startsWith(`${kind}:`)), `MLP focus missing ${kind}`);
  }
  assert(edgeKeys('p1_transform').has('attentionResidual->mlpResidual:*:'), 'MLP residual bypass must be explicit');
});

test('canonical scene emits the three-way pre-attention input branch for both heads', () => {
  const visibleKinds = ['preAttentionNorm', 'q', 'k', 'v'];
  const forward = {
    descriptor: {
      presentation: 'microgpt-canonical-curated',
      nodes: visibleKinds.map(operation => ({ operation })),
    },
    activationKind: 'mlpRelu',
    width: 4,
    input: [0, 1, 2, 3],
    values: () => Array(8).fill(0),
    executionState: () => 'available',
    operations: [],
    vocabulary: ['a', 'b', 'c', 'BOS'],
    matrix: () => undefined,
  } as any;
  const svg = sceneSvg(
    forward,
    { kind: 'preAttentionNorm', token: 3 },
    0,
    undefined,
    ['a · 0', 'b · 1', 'c · 2', 'a · 3'],
    3,
  );

  for (const head of [0, 1]) {
    for (const kind of ['q', 'k', 'v']) {
      const edge = `data-edge-from="preAttentionNorm" data-edge-to="${kind}" data-edge-head="${head}"`;
      assert(svg.includes(edge), `Canonical scene missing ${edge}`);
    }
  }
});

test('One authentic contribution is distinct from final gradient', () => {
  const contrib = getPublicTourContent('p2_gradient_contribution');
  assert.match(contrib.headline, /ONE PIECE OF A PARAMETER’S GRADIENT/);
  assert(contrib.plainMeaning.includes('running total, still a partial gradient'));
  assert.match(contrib.truthGuardrail ?? '', /not the final parameter gradient/i);
  assert.match(contrib.truthGuardrail ?? '', /serial arrival chronology/i);

  const finalGrad = getPublicTourContent('p2_final_gradient');
  assert.match(finalGrad.headline, /THE PARAMETER’S FINAL GRADIENT/);
  assert(finalGrad.plainMeaning.includes('completed parameter gradient'));
  assert.match(finalGrad.truthGuardrail ?? '', /measures sensitivity/i);
  assert.match(finalGrad.truthGuardrail ?? '', /not the parameter update/i);

  const adam = getPublicTourContent('p2_adam_proposal');
  assert(adam.plainMeaning.includes('Final gradient + persistent optimizer history/state → Adam'));
  assert(adam.plainMeaning.includes('provisional'));
  assert(adam.plainMeaning.includes('accepted model has not changed'));

  const ready = getPublicTourContent('candidate_ready');
  assert.match(ready.truthGuardrail ?? '', /not proof of general model improvement/i);
});

test('Part 2 selection intents remain unchanged while LS1 expands only Part 1', () => {
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
  assert.equal(cr.progress, 'Part 2 · Decide · Candidate');
  assert.equal(cr.headline, 'DECIDE WHETHER TO APPLY THE PROPOSED UPDATE');
  assert.equal(cr.selectionIntent.kind, 'probabilities');
  assert.equal(cr.selectionIntent.token, 3);
  assert.equal(advanceTour('candidate_ready'), 'candidate_ready');

  // Outcome: Accepted
  const accepted = getPublicTourContent('tour_complete', 'accepted');
  assert.equal(accepted.progress, 'Tour Complete');
  assert.equal(accepted.headline, 'MODEL LAB COMPLETE · UPDATE ACCEPTED');
  assert.match(accepted.plainMeaning, /subsequent predictions use them/);
  assert.match(accepted.routePurpose, /committed into the live accepted model/);
  assert.equal(accepted.primaryAction?.id, 'tour-restart');

  // Outcome: Discarded
  const discarded = getPublicTourContent('tour_complete', 'discarded');
  assert.equal(discarded.progress, 'Tour Complete');
  assert.equal(discarded.headline, 'MODEL LAB COMPLETE · UPDATE DISCARDED');
  assert.match(discarded.plainMeaning, /previously accepted parameters remain authoritative/);
  assert.match(discarded.routePurpose, /remains in its prior accepted state/);
  assert.equal(discarded.primaryAction?.id, 'tour-restart');
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
  assert.match(
    readyContent.truthGuardrail ?? '',
    /not proof of general model improvement/i,
  );
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
});

test('Part 2 current UI sequence follows Measure / Trace / Accumulate / Propose / Decide without a global state counter', () => {
  const expected = [
    { state: 'p2_objective', next: 'p2_backward_trace', progress: 'Part 2 · Measure · Training objective', headline: 'MEASURE THE ERROR' },
    { state: 'p2_backward_trace', next: 'p2_gradient_contribution', progress: 'Part 2 · Trace · Backward sensitivity', headline: 'WORK BACKWARD FROM THE ERROR' },
    { state: 'p2_gradient_contribution', next: 'p2_final_gradient', progress: 'Part 2 · Trace · One contribution', headline: 'ONE PIECE OF A PARAMETER’S GRADIENT' },
    { state: 'p2_final_gradient', next: 'p2_adam_proposal', progress: 'Part 2 · Accumulate · Final gradient', headline: 'THE PARAMETER’S FINAL GRADIENT' },
    { state: 'p2_adam_proposal', next: 'candidate_ready', progress: 'Part 2 · Propose · Adam', headline: 'THE OPTIMIZER PROPOSES A CHANGE' },
  ] as const;

  for (const item of expected) {
    const c = getPublicTourContent(item.state);
    assert.equal(c.progress, item.progress);
    assert.equal(c.headline, item.headline);
    assert.equal(advanceTour(item.state), item.next);
    assert(!/\d+ of \d+/.test(c.progress), 'Conceptual Part 2 chapter must dominate over a global state counter');
    assert(c.learnerQuestion);
    assert(c.whyHere);
  }

  const trace = getPublicTourContent('p2_backward_trace');
  assert.match(trace.truthGuardrail ?? '', /not measured runtime timing/i);
  assert.match(trace.truthGuardrail ?? '', /text flowing backward/i);
  assert.match(trace.plainMeaning, /calculation dependencies backward/i);

  const measure = getPublicTourContent('p2_objective');
  assert.match(measure.truthGuardrail ?? '', /multiple target positions/i);

  const candidate = getPublicTourContent('candidate_ready');
  assert.equal(candidate.progress, 'Part 2 · Decide · Candidate');
  assert.equal(candidate.headline, 'DECIDE WHETHER TO APPLY THE PROPOSED UPDATE');
  assert.match(candidate.plainMeaning, /remains separate from the accepted model/i);
  assert.match(candidate.plainMeaning, /Discard leaves the accepted model unchanged/i);
  assert.match(candidate.truthGuardrail ?? '', /not proof of general model improvement/i);
});

test('C3: getPendingTourActionLabel maps pending tour states to distinct working indicators', () => {
  assert.equal(getPendingTourActionLabel('p2_objective'), 'Measuring training objective...');
  assert.equal(getPendingTourActionLabel('p2_backward_trace'), 'Finding gradient contribution...');
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
    targetState: undefined,
    phase: 'training forward',
    driverPhase: 'running',
  });
  assert.equal(statusForward, 'Preparing training objective...');

  const statusLoss = getPublicExecutionStatus({
    currentState: 'p2_objective',
    targetState: undefined,
    phase: 'loss',
    driverPhase: 'running',
  });
  assert.equal(statusLoss, 'Measuring error across target positions...');

  const statusContrib = getPublicExecutionStatus({
    currentState: 'p2_backward_trace',
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

test('Part 2 evidence gates separate objective, trace, contribution, final gradient, Adam, and candidate', () => {
  const ev1: TourEvidence = {
    hasObjective: true,
    hasMatchingContribution: false,
    hasFinalGradient: false,
    hasPinnedProposal: false,
    hasCandidateComparison: false,
  };
  assert.equal(canAdvanceTour('p2_objective', ev1), true);
  assert.equal(canAdvanceTour('p2_backward_trace', ev1), false);

  const ev2: TourEvidence = { ...ev1, hasMatchingContribution: true };
  assert.equal(canAdvanceTour('p2_backward_trace', ev2), true);

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
