import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcilePublicGuidedComputation,
  type PublicGuidedComputationBinding,
} from '../../app/presentation/public-guided-computation.js';
import {
  transitionPublicLesson,
  type PublicLessonSession,
  type PublicLessonTransitionContext,
} from '../../app/presentation/public-lesson-controller.js';
import type { PublicTourState, TourEvidence } from '../../app/spatial/public-tour.js';
import type { RunResult } from '../../app/worker/protocol.js';

const vocabulary = ['<BOS>', 'a', 'b', 'c'] as const;

const emptyEvidence = (): TourEvidence => ({
  hasObjective: false,
  hasMatchingContribution: false,
  hasFinalGradient: false,
  hasPinnedProposal: false,
  hasCandidateComparison: false,
});

function context(
  driverPhase: PublicLessonTransitionContext['driverPhase'] = 'idle',
  trainingStarted = false,
): PublicLessonTransitionContext {
  return { evidence: emptyEvidence(), driverPhase, trainingStarted };
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

function prediction(runId: string, document: string): RunResult {
  const ids = document.split('').map((token) => vocabulary.indexOf(token as typeof vocabulary[number]));
  assert(ids.every((id) => id > 0));
  return {
    run: {
      manifest: {
        runId,
        input: [0, ...ids],
      },
    },
    tokenIds: [0, ...ids],
  } as unknown as RunResult;
}

function reconcile(
  binding: PublicGuidedComputationBinding | undefined,
  before: PublicLessonSession,
  event: Parameters<typeof transitionPublicLesson>[1],
  candidate?: RunResult,
  ctx: PublicLessonTransitionContext = context(),
) {
  const transition = transitionPublicLesson(before, event, ctx);
  return {
    transition,
    computation: reconcilePublicGuidedComputation(
      binding,
      before,
      event,
      transition,
      candidate,
      vocabulary,
    ),
  };
}

test('adopted prediction binds the exact Guided run and captured input', () => {
  const a = prediction('run-a', 'abca');
  const cold = sessionAt('cold');
  const completed = reconcile(undefined, cold, { type: 'PREDICTION_COMPLETE' }, a);

  assert.equal(completed.transition.session.current, 'p1_prediction_preview');
  assert.equal(completed.computation.binding?.result, a);
  assert.equal(completed.computation.binding?.runId, 'run-a');
  assert.equal(completed.computation.binding?.capturedDocument, 'abca');
  assert.equal(completed.computation.binding?.lessonPosition, 3);
});

test('explicit Guided Predict replaces the occurrence only after the new run completes', () => {
  const a = prediction('run-a', 'abca');
  const short = prediction('run-short', 'abc');
  const initial = reconcile(undefined, sessionAt('cold'), { type: 'PREDICTION_COMPLETE' }, a);
  const next = reconcile(initial.computation.binding, sessionAt('p1_qkv'), { type: 'PREDICTION_COMPLETE' }, short);
  assert.equal(next.transition.session.current, 'p1_prediction_preview');
  assert.equal(next.computation.binding?.runId, 'run-short');
  assert.equal(next.computation.binding?.lessonPosition, 2);
});

test('Explore prediction does not replace the canonical binding and Resume restores A without rewriting live B', () => {
  const a = prediction('run-a', 'abca');
  const b = prediction('run-b', 'caba');
  const binding: PublicGuidedComputationBinding = {
    result: a,
    runId: 'run-a',
    capturedDocument: 'abca',
    lessonPosition: 3,
  };
  const guided = sessionAt('p1_represent');

  const entered = reconcile(binding, guided, { type: 'ENTER_EXPLORE' });
  assert.equal(entered.transition.session.navigation.mode, 'explore');

  const explored = reconcile(
    binding,
    entered.transition.session,
    { type: 'PREDICTION_COMPLETE' },
    b,
  );
  assert.strictEqual(explored.computation.binding, binding);
  assert.equal(explored.computation.restore, undefined);

  const liveRunId = 'run-b';
  const resumed = reconcile(
    binding,
    explored.transition.session,
    { type: 'RESUME_GUIDED' },
  );

  assert.equal(resumed.transition.session.current, 'p1_represent');
  assert.deepEqual(resumed.transition.effects, []);
  assert.equal(resumed.computation.restore?.result, a);
  assert.equal(resumed.computation.restore?.runId, 'run-a');
  assert.equal(resumed.computation.restore?.capturedDocument, 'abca');
  assert.equal(liveRunId, 'run-b');
});

test('reset clears the binding and restart replaces it only after an adopted completion', () => {
  const a = prediction('run-a', 'abca');
  const c = prediction('run-c', 'bcab');
  const binding: PublicGuidedComputationBinding = {
    result: a,
    runId: 'run-a',
    capturedDocument: 'abca',
    lessonPosition: 3,
  };
  const complete = sessionAt('tour_complete', { outcome: 'accepted' });

  const requested = reconcile(binding, complete, { type: 'RESTART_REQUESTED' });
  assert.strictEqual(requested.computation.binding, binding);

  const failed = reconcile(
    binding,
    requested.transition.session,
    { type: 'EXECUTION_FAILED' },
  );
  assert.strictEqual(failed.computation.binding, binding);

  const requestedAgain = reconcile(binding, complete, { type: 'RESTART_REQUESTED' });
  const succeeded = reconcile(
    binding,
    requestedAgain.transition.session,
    { type: 'PREDICTION_COMPLETE' },
    c,
  );
  assert.equal(succeeded.computation.binding?.result, c);
  assert.equal(succeeded.computation.binding?.runId, 'run-c');
  assert.equal(succeeded.computation.binding?.capturedDocument, 'bcab');

  const reset = reconcile(
    succeeded.computation.binding,
    succeeded.transition.session,
    { type: 'RESET' },
  );
  assert.equal(reset.computation.binding, undefined);
});

test('Resume never restores the Part 1 binding over an active Part 2 transaction', () => {
  const a = prediction('run-a', 'abca');
  const binding: PublicGuidedComputationBinding = {
    result: a,
    runId: 'run-a',
    capturedDocument: 'abca',
    lessonPosition: 3,
  };
  const exploringPart2: PublicLessonSession = {
    current: 'p2_gradient_contribution',
    navigation: { mode: 'explore', returnState: 'p2_gradient_contribution' },
  };

  const resumed = reconcile(
    binding,
    exploringPart2,
    { type: 'RESUME_GUIDED' },
    undefined,
    context('paused', true),
  );

  assert.equal(resumed.transition.session.current, 'p2_gradient_contribution');
  assert.deepEqual(resumed.transition.effects, []);
  assert.strictEqual(resumed.computation.binding, binding);
  assert.equal(resumed.computation.restore, undefined);
});
