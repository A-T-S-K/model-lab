import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPublicLessonSession,
  getPublicLessonView,
  transitionPublicLesson,
  type PublicLessonSession,
  type PublicLessonTransitionContext,
} from '../../app/presentation/public-lesson-controller.js';
import { PUBLIC_TOUR_STATES, type PublicTourState, type TourEvidence } from '../../app/spatial/public-tour.js';

const emptyEvidence = (): TourEvidence => ({
  hasObjective: false,
  hasMatchingContribution: false,
  hasFinalGradient: false,
  hasPinnedProposal: false,
  hasCandidateComparison: false,
});

function context(
  evidence: Partial<TourEvidence> = {},
  driverPhase: PublicLessonTransitionContext['driverPhase'] = 'paused',
  trainingStarted = true,
): PublicLessonTransitionContext {
  return {
    evidence: { ...emptyEvidence(), ...evidence },
    driverPhase,
    trainingStarted,
  };
}

function sessionAt(
  current: PublicTourState,
  extra: Partial<PublicLessonSession> = {},
): PublicLessonSession {
  return {
    current,
    navigation: { mode: 'guided' },
    ...extra,
  };
}

test('ordinary Part 1 primary advancement follows the LS1 spine with no runtime effects', () => {
  const states: readonly PublicTourState[] = [
    'p1_prediction_preview',
    'p1_represent',
    'p1_qkv',
    'p1_attention_compare',
    'p1_attention_weights',
    'p1_value_mixture',
    'p1_attention_integration',
    'p1_transform',
    'p1_score',
    'p1_probabilities',
    'p1_complete',
  ];

  let session = sessionAt(states[0]);
  for (const expected of states.slice(1)) {
    const result = transitionPublicLesson(
      session,
      { type: 'PRIMARY_ACTION' },
      context({}, 'idle', false),
    );
    assert.equal(result.session.current, expected);
    assert.deepEqual(result.effects, [], `Part 1 navigation to ${expected} must not request execution`);
    session = result.session;
  }
});

test('MEASURE enters TRACE only with objective evidence and requests no runtime effect', () => {
  const objective = sessionAt('p2_objective');

  const unavailable = transitionPublicLesson(objective, { type: 'PRIMARY_ACTION' }, context());
  assert.equal(unavailable.session.current, 'p2_objective');
  assert.equal(unavailable.session.pending, undefined);
  assert.deepEqual(unavailable.effects, []);

  const measured = transitionPublicLesson(
    objective,
    { type: 'PRIMARY_ACTION' },
    context({ hasObjective: true }),
  );
  assert.equal(measured.session.current, 'p2_backward_trace');
  assert.equal(measured.session.pending, undefined);
  assert.deepEqual(measured.effects, []);
});

test('TRACE requests contribution execution and only matching contribution evidence completes it', () => {
  const trace = sessionAt('p2_backward_trace');
  const requested = transitionPublicLesson(
    trace,
    { type: 'PRIMARY_ACTION' },
    context({ hasObjective: true }),
  );
  assert.equal(requested.session.current, 'p2_backward_trace');
  assert.deepEqual(requested.session.pending, {
    target: 'p2_gradient_contribution',
    effect: 'RUN_TO_CONTRIBUTION',
  });
  assert.deepEqual(requested.effects, ['RUN_TO_CONTRIBUTION']);

  const waiting = transitionPublicLesson(
    requested.session,
    { type: 'TRAINING_PROGRESS' },
    context({ hasObjective: true }),
  );
  assert.equal(waiting.session.current, 'p2_backward_trace');

  const arrived = transitionPublicLesson(
    requested.session,
    { type: 'TRAINING_PROGRESS' },
    context({ hasObjective: true, hasMatchingContribution: true }),
  );
  assert.equal(arrived.session.current, 'p2_gradient_contribution');
  assert.equal(arrived.session.pending, undefined);
});

test('final-gradient transition continues normal backward instead of seeking an optimizer proposal', () => {
  const result = transitionPublicLesson(
    sessionAt('p2_gradient_contribution'),
    { type: 'PRIMARY_ACTION' },
    context({ hasObjective: true, hasMatchingContribution: true }),
  );
  assert.equal(result.session.current, 'p2_gradient_contribution');
  assert.deepEqual(result.session.pending, {
    target: 'p2_final_gradient',
    effect: 'CONTINUE',
  });
  assert.deepEqual(result.effects, ['CONTINUE']);
  assert(!result.effects.includes('RUN_TO_PROPOSAL'));
});

test('final gradient and Adam proposal advance only when their authentic evidence gates exist', () => {
  const waitingForFinal = transitionPublicLesson(
    {
      ...sessionAt('p2_gradient_contribution'),
      pending: { target: 'p2_final_gradient', effect: 'CONTINUE' },
    },
    { type: 'TRAINING_PROGRESS' },
    context({ hasObjective: true, hasMatchingContribution: true }),
  );
  assert.equal(waitingForFinal.session.current, 'p2_gradient_contribution');

  const final = transitionPublicLesson(
    waitingForFinal.session,
    { type: 'TRAINING_PROGRESS' },
    context({
      hasObjective: true,
      hasMatchingContribution: true,
      hasFinalGradient: true,
    }),
  );
  assert.equal(final.session.current, 'p2_final_gradient');

  const seekProposal = transitionPublicLesson(
    final.session,
    { type: 'PRIMARY_ACTION' },
    context({
      hasObjective: true,
      hasMatchingContribution: true,
      hasFinalGradient: true,
    }),
  );
  assert.deepEqual(seekProposal.effects, ['RUN_TO_PROPOSAL']);
  assert.equal(seekProposal.session.pending?.target, 'p2_adam_proposal');

  const proposal = transitionPublicLesson(
    seekProposal.session,
    { type: 'TRAINING_PROGRESS' },
    context({
      hasObjective: true,
      hasMatchingContribution: true,
      hasFinalGradient: true,
      hasPinnedProposal: true,
    }),
  );
  assert.equal(proposal.session.current, 'p2_adam_proposal');
});

test('Candidate Ready requires an authentic comparison and never follows proposal identity alone', () => {
  const adam = sessionAt('p2_adam_proposal');
  const evaluating = transitionPublicLesson(
    adam,
    { type: 'PRIMARY_ACTION' },
    context({
      hasObjective: true,
      hasMatchingContribution: true,
      hasFinalGradient: true,
      hasPinnedProposal: true,
    }),
  );
  assert.equal(evaluating.session.current, 'p2_adam_proposal');
  assert.equal(evaluating.session.pending?.target, 'candidate_ready');
  assert.deepEqual(evaluating.effects, ['CONTINUE']);

  const stillEvaluating = transitionPublicLesson(
    evaluating.session,
    { type: 'TRAINING_PROGRESS' },
    context({
      hasObjective: true,
      hasMatchingContribution: true,
      hasFinalGradient: true,
      hasPinnedProposal: true,
    }),
  );
  assert.equal(stillEvaluating.session.current, 'p2_adam_proposal');

  const ready = transitionPublicLesson(
    evaluating.session,
    { type: 'TRAINING_PROGRESS' },
    context({
      hasObjective: true,
      hasMatchingContribution: true,
      hasFinalGradient: true,
      hasPinnedProposal: true,
      hasCandidateComparison: true,
    }),
  );
  assert.equal(ready.session.current, 'candidate_ready');
});

test('failure and cancellation clear pending intent without fabricating lesson progress', () => {
  const pending: PublicLessonSession = {
    ...sessionAt('p2_gradient_contribution'),
    pending: { target: 'p2_final_gradient', effect: 'CONTINUE' },
  };
  const failed = transitionPublicLesson(pending, { type: 'EXECUTION_FAILED' }, context());
  assert.equal(failed.session.current, 'p2_gradient_contribution');
  assert.equal(failed.session.pending, undefined);
  assert.equal(failed.session.outcome, undefined);

  const cancelled = transitionPublicLesson(pending, { type: 'EXECUTION_CANCELLED' }, context());
  assert.equal(cancelled.session.current, 'p2_gradient_contribution');
  assert.equal(cancelled.session.pending, undefined);
  assert.equal(cancelled.session.outcome, undefined);
});

test('Part 2 startup enters Objective only after training exists, then runs to a stable objective reading stop', () => {
  const requested = transitionPublicLesson(
    sessionAt('p1_complete'),
    { type: 'START_PART2' },
    context({}, 'idle', false),
  );
  assert.equal(requested.session.current, 'p1_complete');
  assert.equal(requested.session.pending?.target, 'p2_objective');
  assert.deepEqual(requested.effects, ['START_TRAINING']);

  const started = transitionPublicLesson(
    requested.session,
    { type: 'TRAINING_PROGRESS' },
    context({}, 'paused', true),
  );
  assert.equal(started.session.current, 'p2_objective');
  assert.equal(started.session.pending, undefined);
  assert.deepEqual(started.effects, ['CONTINUE']);

  const measured = transitionPublicLesson(
    started.session,
    { type: 'TRAINING_PROGRESS' },
    context({ hasObjective: true }, 'running', true),
  );
  assert.equal(measured.session.current, 'p2_objective');
  assert.deepEqual(measured.effects, ['PAUSE']);
});

test('detail and explore detours remember and restore the canonical Guided state', () => {
  const canonical = sessionAt('p1_attention_weights');

  const detail = transitionPublicLesson(
    canonical,
    { type: 'OPEN_DETAIL' },
    context({}, 'idle', false),
  );
  assert.deepEqual(detail.session.navigation, {
    mode: 'detail',
    returnState: 'p1_attention_weights',
  });
  assert.equal(detail.session.current, 'p1_attention_weights');

  const returned = transitionPublicLesson(
    detail.session,
    { type: 'RETURN_FROM_DETAIL' },
    context({}, 'idle', false),
  );
  assert.equal(returned.session.current, 'p1_attention_weights');
  assert.deepEqual(returned.session.navigation, { mode: 'guided' });
  assert.deepEqual(returned.effects, []);

  const pending: PublicLessonSession = {
    ...sessionAt('p2_gradient_contribution'),
    pending: { target: 'p2_final_gradient', effect: 'CONTINUE' },
  };
  const exploring = transitionPublicLesson(
    pending,
    { type: 'ENTER_EXPLORE' },
    context({ hasMatchingContribution: true }, 'running', true),
  );
  assert.equal(exploring.session.current, 'p2_gradient_contribution');
  assert.equal(exploring.session.pending, undefined);
  assert.deepEqual(exploring.session.navigation, {
    mode: 'explore',
    returnState: 'p2_gradient_contribution',
  });
  assert.deepEqual(exploring.effects, ['PAUSE']);

  const resumed = transitionPublicLesson(
    exploring.session,
    { type: 'RESUME_GUIDED' },
    context({ hasMatchingContribution: true }, 'paused', true),
  );
  assert.equal(resumed.session.current, 'p2_gradient_contribution');
  assert.deepEqual(resumed.session.navigation, { mode: 'guided' });
  assert.deepEqual(resumed.effects, []);
});

test('a prediction made during Explore does not replace the canonical Guided lesson', () => {
  const exploring: PublicLessonSession = {
    current: 'p1_transform',
    navigation: { mode: 'explore', returnState: 'p1_transform' },
  };
  const completed = transitionPublicLesson(
    exploring,
    { type: 'PREDICTION_COMPLETE' },
    context({}, 'idle', false),
  );
  assert.strictEqual(completed.session, exploring);
  assert.deepEqual(completed.effects, []);
});

test('Facilitator destinations use the shared lesson identities and refuse unavailable runtime evidence', () => {
  const canonical = sessionAt('p1_transform');
  const view = getPublicLessonView(canonical, context({}, 'idle', false));
  assert.deepEqual(
    view.facilitatorDestinations.map(destination => destination.state),
    PUBLIC_TOUR_STATES.filter(state => state !== 'cold' && state !== 'tour_complete'),
  );

  const refused = transitionPublicLesson(
    canonical,
    { type: 'FACILITATOR_GOTO', target: 'p2_final_gradient' },
    context({}, 'paused', true),
  );
  assert.strictEqual(refused.session, canonical);

  const traceUnavailable = transitionPublicLesson(
    canonical,
    { type: 'FACILITATOR_GOTO', target: 'p2_backward_trace' },
    context({}, 'paused', true),
  );
  assert.strictEqual(traceUnavailable.session, canonical);

  const traceContext = context({ hasObjective: true });
  const traceFocused = transitionPublicLesson(
    canonical,
    { type: 'FACILITATOR_GOTO', target: 'p2_backward_trace' },
    traceContext,
  );
  assert.equal(traceFocused.session.current, 'p1_transform');
  assert.deepEqual(traceFocused.session.navigation, {
    mode: 'facilitator',
    returnState: 'p1_transform',
    focusState: 'p2_backward_trace',
  });
  assert.equal(getPublicLessonView(traceFocused.session, traceContext).currentState, 'p2_backward_trace');

  const availableContext = context({
    hasObjective: true,
    hasMatchingContribution: true,
    hasFinalGradient: true,
  });
  const focused = transitionPublicLesson(
    canonical,
    { type: 'FACILITATOR_GOTO', target: 'p2_final_gradient' },
    availableContext,
  );
  assert.equal(focused.session.current, 'p1_transform');
  assert.deepEqual(focused.session.navigation, {
    mode: 'facilitator',
    returnState: 'p1_transform',
    focusState: 'p2_final_gradient',
  });
  assert.equal(getPublicLessonView(focused.session, availableContext).currentState, 'p2_final_gradient');

  const resumed = transitionPublicLesson(
    focused.session,
    { type: 'RESUME_GUIDED' },
    availableContext,
  );
  assert.equal(resumed.session.current, 'p1_transform');
  assert.deepEqual(resumed.session.navigation, { mode: 'guided' });
});

test('Accept and Discard are peer decisions and ordinary failure never masquerades as Discard', () => {
  const ready = sessionAt('candidate_ready');
  const readyContext = context({ hasCandidateComparison: true });

  const acceptRequested = transitionPublicLesson(
    ready,
    { type: 'ACCEPT_REQUESTED' },
    readyContext,
  );
  assert.equal(acceptRequested.session.decisionPending, 'accepted');
  assert.deepEqual(acceptRequested.effects, ['ACCEPT_CANDIDATE']);

  const accepted = transitionPublicLesson(
    acceptRequested.session,
    { type: 'ACCEPT_COMPLETE' },
    context({}, 'idle', false),
  );
  assert.equal(accepted.session.current, 'tour_complete');
  assert.equal(accepted.session.outcome, 'accepted');

  const discardRequested = transitionPublicLesson(
    ready,
    { type: 'DISCARD_REQUESTED' },
    readyContext,
  );
  assert.equal(discardRequested.session.decisionPending, 'discarded');
  assert.deepEqual(discardRequested.effects, ['DISCARD_CANDIDATE']);

  const discarded = transitionPublicLesson(
    discardRequested.session,
    { type: 'DISCARD_COMPLETE' },
    context({}, 'idle', false),
  );
  assert.equal(discarded.session.current, 'tour_complete');
  assert.equal(discarded.session.outcome, 'discarded');

  const failed = transitionPublicLesson(
    acceptRequested.session,
    { type: 'EXECUTION_FAILED' },
    readyContext,
  );
  assert.equal(failed.session.current, 'candidate_ready');
  assert.equal(failed.session.outcome, undefined);
  assert.equal(failed.session.decisionPending, undefined);
});

test('restart keeps the terminal outcome until a fresh prediction really completes', () => {
  const complete = sessionAt('tour_complete', { outcome: 'accepted' });
  const requested = transitionPublicLesson(
    complete,
    { type: 'RESTART_REQUESTED' },
    context({}, 'idle', false),
  );
  assert.equal(requested.session.current, 'tour_complete');
  assert.equal(requested.session.outcome, 'accepted');
  assert.equal(requested.session.pending?.target, 'p1_prediction_preview');
  assert.deepEqual(requested.effects, ['START_PREDICTION']);

  const failed = transitionPublicLesson(
    requested.session,
    { type: 'EXECUTION_FAILED' },
    context({}, 'idle', false),
  );
  assert.equal(failed.session.current, 'tour_complete');
  assert.equal(failed.session.outcome, 'accepted');

  const completed = transitionPublicLesson(
    requested.session,
    { type: 'PREDICTION_COMPLETE' },
    context({}, 'idle', false),
  );
  assert.equal(completed.session.current, 'p1_prediction_preview');
  assert.equal(completed.session.outcome, undefined);
});

test('reset clears pending intent, detours, and terminal outcome back to cold', () => {
  const detoured: PublicLessonSession = {
    current: 'tour_complete',
    outcome: 'discarded',
    pending: { target: 'p1_prediction_preview', effect: 'START_PREDICTION' },
    navigation: { mode: 'explore', returnState: 'tour_complete' },
  };
  const reset = transitionPublicLesson(
    detoured,
    { type: 'RESET' },
    context({}, 'idle', false),
  );
  assert.deepEqual(reset.session, createPublicLessonSession());
  assert.deepEqual(reset.effects, []);
});
