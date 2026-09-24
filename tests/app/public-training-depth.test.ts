import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, type ViteDevServer } from 'vite';
import type { ArchivedSnapshot } from '../../archive/session.js';
import type { InspectionResult, ParameterRef } from '../../inspect/types.js';
import { sourceBinding } from '../../app/presentation/source-binding.js';
import {
  transitionPublicLesson,
  type PublicLessonSession,
  type PublicLessonTransitionContext,
} from '../../app/presentation/public-lesson-controller.js';
import { spatialReadModel, type SpatialReadModel } from '../../app/spatial/bindings.js';
import type { ContextualDockOptions, DockDepth } from '../../app/spatial/contextual-dock.js';
import { forwardReadModel } from '../../app/spatial/forward.js';
import { resolveParameter, resolveParameterIndex, type ParameterPin } from '../../app/spatial/learning.js';
import {
  isPublicPart2DetailRenderOnly,
  isPublicTrainingSourceInspectable,
  resolvePublicTrainingDepthContext,
  resolvePublicTrainingParameter,
  type PublicTrainingDepthSelection,
} from '../../app/spatial/public-training-depth.js';
import { getPublicTourContent, type PublicTourState } from '../../app/spatial/public-tour.js';
import { ModelSession } from '../../app/worker/controller.js';
import type { ForwardProgress, RunResult } from '../../app/worker/protocol.js';
import type { TrainingProgress } from '../../app/worker/training-execution.js';
import type { Artifact, RecordedRun } from '../../trace/types.js';

class LiveTrainingHarness {
  readonly session = new ModelSession();
  readonly tag: { sessionId: string; generationId: number };
  readonly executionId: string;
  progress!: ForwardProgress;
  preview?: RunResult;
  starting!: ArchivedSnapshot;
  parameter!: ParameterRef;
  private artifacts: Artifact[] = [];
  private requests = 0;

  private constructor(name: string) {
    this.tag = { sessionId: name, generationId: 0 };
    this.executionId = name + ':training';
  }

  static async create(name: string, pin: ParameterPin): Promise<LiveTrainingHarness> {
    const harness = new LiveTrainingHarness(name);
    const initialized = await harness.session.handle({ ...harness.tag, runId: name + ':init', command: 'initialize' });
    assert.equal(initialized.status, 'ready');

    const started = await harness.session.handle({
      ...harness.tag,
      runId: harness.executionId,
      command: 'startTraining',
      document: 'abca',
    });
    assert.equal(started.status, 'forward');
    if (started.status !== 'forward' || !started.progress.start) throw new Error('live training start unavailable');
    harness.accept(started.progress);
    harness.starting = started.progress.start.snapshot;
    harness.parameter = resolveParameter(harness.starting, pin)!;
    assert(harness.parameter, 'requested parameter must resolve in the authentic starting snapshot');

    if (harness.progress.training?.pin !== harness.parameter.index) {
      const focused = await harness.session.handle({
        ...harness.tag,
        runId: name + ':focus',
        command: 'inspectTraining',
        executionId: harness.executionId,
        pin: harness.parameter.index,
      });
      assert.equal(focused.status, 'forward');
      if (focused.status !== 'forward') throw new Error('live parameter focus unavailable');
      harness.accept(focused.progress);
    }
    assert.equal(harness.progress.training?.pin, harness.parameter.index);
    return harness;
  }

  private accept(progress: ForwardProgress): void {
    this.progress = progress;
    if (progress.start) {
      this.artifacts = [...progress.artifacts];
      this.preview = {
        run: {
          formatVersion: 1,
          manifest: progress.start.manifest,
          artifacts: [],
          capture: progress.capture,
        },
        tokenIds: [...progress.start.tokenIds],
        targetIds: [...progress.start.targetIds],
        trainingStep: progress.start.trainingStep,
        snapshots: [progress.start.snapshot],
        runs: [],
        logits: [],
        probabilities: [],
      };
    } else {
      this.artifacts.push(...progress.artifacts);
    }
    if (this.preview) {
      this.preview = {
        ...this.preview,
        run: {
          ...this.preview.run,
          artifacts: [...this.artifacts],
          capture: progress.capture,
        },
      };
    }
  }

  async advance(stop = false, budget = 128): Promise<void> {
    const training = this.progress.training;
    assert(training, 'live training progress required');
    const response = await this.session.handle({
      ...this.tag,
      runId: this.executionId + ':request:' + (++this.requests),
      command: 'advanceTraining',
      executionId: this.executionId,
      permit: this.progress.sequence + 1,
      budget,
      pin: training.pin,
      stop,
    });
    assert.equal(response.status, 'forward');
    if (response.status !== 'forward') throw new Error('unexpected training completion');
    this.accept(response.progress);
  }

  async until(check: (training: TrainingProgress) => boolean, stop = false): Promise<void> {
    for (let i = 0; i < 1000; i++) {
      const training = this.progress.training;
      assert(training);
      if (check(training)) return;
      await this.advance(stop);
    }
    assert.fail('training transaction did not reach requested evidence boundary');
  }

  async objective(): Promise<void> {
    await this.until(training => training.mean !== undefined);
  }

  async backward(): Promise<void> {
    await this.objective();
    if (this.progress.training?.phase === 'backward') return;
    await this.until(training => training.phase === 'backward');
  }

  async contribution(): Promise<void> {
    await this.objective();
    if (this.progress.training!.contributions.length > 0) return;
    if (this.progress.training?.phase !== 'backward') await this.until(training => training.phase === 'backward');
    for (let i = 0; i < 1000; i++) {
      const training = this.progress.training!;
      if (training.contributions.length > 0 && training.stopped) return;
      assert.equal(training.phase, 'backward', 'selected test pin must receive a live backward contribution');
      await this.advance(true);
    }
    assert.fail('matching contribution not retained');
  }

  async finalGradient(): Promise<void> {
    await this.objective();
    if (this.progress.training!.final) return;
    await this.until(training => training.final);
  }

  async adamProposal(): Promise<void> {
    await this.finalGradient();
    for (let i = 0; i < 1000; i++) {
      const training = this.progress.training!;
      if (training.proposal) return;
      assert.equal(training.phase, 'optimizer proposal');
      await this.advance(true);
    }
    assert.fail('matching Adam proposal not retained');
  }

  async ready(): Promise<void> {
    if (this.progress.training?.phase === 'ready') return;
    await this.adamProposal();
    await this.until(training => training.phase === 'ready');
  }
}

function context(
  state: PublicTourState,
  harness: LiveTrainingHarness,
  selection: PublicTrainingDepthSelection = {},
  progress = harness.progress,
  preview = harness.preview,
  inspection?: InspectionResult,
) {
  const resolved = resolvePublicTrainingDepthContext(
    getPublicTourContent(state),
    progress,
    harness.starting,
    preview,
    selection,
    inspection,
  );
  assert(resolved, state + ' must own Part 2 depth');
  return resolved;
}

function withTraining(progress: ForwardProgress, training: TrainingProgress): ForwardProgress {
  return { ...progress, training };
}

test('PD1-2 Part 2 depth ownership remains canonical lesson content and contains no evidence values', () => {
  const expected: readonly [PublicTourState, string][] = [
    ['p2_objective', 'objective'],
    ['p2_backward_trace', 'backward-trace'],
    ['p2_gradient_contribution', 'gradient-contribution'],
    ['p2_final_gradient', 'final-gradient'],
    ['p2_adam_proposal', 'adam'],
    ['candidate_ready', 'candidate'],
  ];
  for (const [state, kind] of expected) {
    const spec = getPublicTourContent(state).depthSpec;
    assert(spec, state);
    assert.equal(spec.kind, kind);
    assert(spec.members.some(member => member.id === spec.defaultMember));
    const visit = (value: unknown): void => {
      if (typeof value === 'number') assert.fail(state + ' depthSpec must not own numerical evidence/configuration');
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(visit);
    };
    visit(spec);
  }
});

test('PD1-2 inverse parameter resolution exactly round-trips runtime flattening order for distinct coordinates', async () => {
  const session = new ModelSession();
  const tag = { sessionId: 'pd1-2-roundtrip', generationId: 0 };
  const response = await session.handle({ ...tag, runId: 'init', command: 'initialize' });
  assert.equal(response.status, 'ready');
  if (response.status !== 'ready') return;
  for (const pin of [
    { name: 'wte', row: 0, column: 0 },
    { name: 'wpe', row: 3, column: 0 },
    { name: 'layer0.attn_wq', row: 2, column: 3 },
  ]) {
    const forward: ParameterRef = resolveParameter(response.archivedSnapshot, pin)!;
    assert(forward);
    assert.deepEqual(resolveParameterIndex(response.archivedSnapshot, forward.index), forward);
  }
  assert.equal(resolveParameterIndex(response.archivedSnapshot, -1), undefined);
  assert.equal(resolveParameterIndex(response.archivedSnapshot, Number.MAX_SAFE_INTEGER), undefined);
});

test('PD1-2 objective binds all authentic positions, observed losses, target probabilities, and separate derived arithmetic', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-objective', { name: 'wte', row: 0, column: 0 });
  await harness.objective();
  const resolved = context('p2_objective', harness);
  assert(resolved.available);
  assert.equal(resolved.executionId, harness.executionId);
  assert.equal(resolved.startingSnapshotId, harness.starting.id);
  assert.equal(resolved.gradientSourceRunId, harness.progress.training!.gradientSourceRunId);
  assert.equal(resolved.trainingRun?.manifest.runId, harness.progress.training!.gradientSourceRunId);
  assert.deepEqual(resolved.parameter, harness.parameter);
  const objective = resolved.objective!;
  assert.equal(objective.rows.length, harness.progress.training!.losses.length);
  assert.equal(objective.observedMean, harness.progress.training!.mean);
  assert.notEqual(objective.observedMean, undefined);
  for (const row of objective.rows) {
    assert.equal(row.recordedLoss, harness.progress.training!.losses[row.position].value);
    assert.notEqual(row.recordedLoss, undefined);
    if (row.probability !== undefined) {
      assert.equal(row.derivedLoss, -Math.log(row.probability));
    } else {
      assert.equal(row.derivedLoss, undefined);
    }
  }
  assert.notEqual(objective.derivedMean, undefined);
});

test('PD1-2 refuses a convenient preview from another run instead of merging transaction evidence', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-run-binding', { name: 'wte', row: 0, column: 0 });
  await harness.objective();
  const badPreview: RunResult = {
    ...harness.preview!,
    run: {
      ...harness.preview!.run,
      manifest: { ...harness.preview!.run.manifest, runId: 'other:training' },
    },
  };
  const resolved = context('p2_objective', harness, {}, harness.progress, badPreview);
  assert.equal(resolved.available, false);
  assert.match(resolved.reason ?? '', /does not match the transaction training source/);
});

test('PD1-2 backward trace keeps structural dependency distinct from unavailable numeric adjoints', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-backward', { name: 'wte', row: 0, column: 0 });
  await harness.backward();
  const resolved = context('p2_backward_trace', harness);
  assert(resolved.available);
  assert.equal(resolved.numericAdjointsAvailable, false);
  assert.equal(resolved.verifiedInspection, undefined);
  assert.deepEqual(resolved.parameter, harness.parameter);
});

function backwardInspection(
  harness: LiveTrainingHarness,
  parameter: ParameterRef,
  provenance: InspectionResult['provenance'],
  verified?: boolean,
): InspectionResult {
  return {
    sourceRunId: harness.progress.training!.gradientSourceRunId,
    provenance,
    availability: 'available',
    graph: {
      roots: [1],
      nodes: [
        { id: 1, operation: 'parameter', value: 0, gradient: 0.125, parameter },
        { id: 2, operation: 'child', value: 0.5 },
      ],
      edges: [{
        id: 1,
        child: 2,
        parent: 1,
        inputIndex: 0,
        localDerivative: 0.5,
        childAdjoint: 0.25,
        contribution: 0.125,
      }],
      structural: [],
    },
    ...(provenance === 'recomputed' && verified !== undefined ? {
      verification: {
        sourceArtifactId: 'test-artifact',
        observedValues: [0.125],
        recomputedValues: [0.125],
        maxAbsoluteError: 0,
        maxRelativeError: 0,
        tolerancePolicy: 'test exact identity fixture',
        verified,
      },
    } : {}),
  };
}

test('PD1-2-R1 admits observed backward evidence only for the exact runtime parameter root', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-r1-observed', { name: 'wte', row: 0, column: 0 });
  await harness.backward();
  const inspection = backwardInspection(harness, harness.parameter, 'observed');
  const resolved = context('p2_backward_trace', harness, {}, harness.progress, harness.preview, inspection);
  assert.equal(resolved.available, true);
  assert.deepEqual(resolved.parameter, harness.parameter);
  assert.strictEqual(resolved.verifiedInspection, inspection);
  assert.equal(resolved.numericAdjointsAvailable, true);
});

test('PD1-2-R1 admits recomputed backward evidence only when verification succeeded', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-r1-recomputed', { name: 'wte', row: 0, column: 0 });
  await harness.backward();

  const verified = backwardInspection(harness, harness.parameter, 'recomputed', true);
  const admitted = context('p2_backward_trace', harness, {}, harness.progress, harness.preview, verified);
  assert.strictEqual(admitted.verifiedInspection, verified);
  assert.equal(admitted.numericAdjointsAvailable, true);

  const unverified = backwardInspection(harness, harness.parameter, 'recomputed');
  const rejectedMissing = context('p2_backward_trace', harness, {}, harness.progress, harness.preview, unverified);
  assert.equal(rejectedMissing.available, true);
  assert.equal(rejectedMissing.kind, 'backward-trace');
  assert.deepEqual(rejectedMissing.parameter, harness.parameter);
  assert.equal(rejectedMissing.verifiedInspection, undefined);
  assert.equal(rejectedMissing.numericAdjointsAvailable, false);

  const failed = backwardInspection(harness, harness.parameter, 'recomputed', false);
  const rejectedFailed = context('p2_backward_trace', harness, {}, harness.progress, harness.preview, failed);
  assert.equal(rejectedFailed.available, true);
  assert.equal(rejectedFailed.verifiedInspection, undefined);
  assert.equal(rejectedFailed.numericAdjointsAvailable, false);
});

test('PD1-2-R1 rejects same-run inspection rooted at another parameter without invalidating structural trace', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-r1-wrong-parameter', { name: 'wte', row: 0, column: 0 });
  await harness.backward();
  const other = resolveParameter(harness.starting, { name: 'wpe', row: 0, column: 0 })!;
  assert(other);
  const inspection = backwardInspection(harness, other, 'observed');
  const resolved = context('p2_backward_trace', harness, {}, harness.progress, harness.preview, inspection);
  assert.equal(resolved.available, true);
  assert.equal(resolved.kind, 'backward-trace');
  assert.deepEqual(resolved.parameter, harness.parameter);
  assert.equal(resolved.verifiedInspection, undefined);
  assert.equal(resolved.numericAdjointsAvailable, false);
});

test('PD1-2-R1 rejects wrong-run or unavailable inspections without invalidating structural trace', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-r1-run-availability', { name: 'wte', row: 0, column: 0 });
  await harness.backward();
  const exact = backwardInspection(harness, harness.parameter, 'observed');

  for (const inspection of [
    { ...exact, sourceRunId: 'other:training' },
    { ...exact, availability: 'not_captured' as const },
  ]) {
    const resolved = context('p2_backward_trace', harness, {}, harness.progress, harness.preview, inspection);
    assert.equal(resolved.available, true);
    assert.equal(resolved.kind, 'backward-trace');
    assert.deepEqual(resolved.parameter, harness.parameter);
    assert.equal(resolved.verifiedInspection, undefined);
    assert.equal(resolved.numericAdjointsAvailable, false);
  }
});

test('PD1-2-R1 rejects matching flat index when semantic parameter coordinates disagree', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-r1-coordinate-mismatch', { name: 'wte', row: 0, column: 0 });
  await harness.backward();
  for (const mismatched of [
    { ...harness.parameter, name: 'wpe' },
    { ...harness.parameter, row: harness.parameter.row + 1 },
    { ...harness.parameter, column: harness.parameter.column + 1 },
  ]) {
    const inspection = backwardInspection(harness, mismatched, 'observed');
    const resolved = context('p2_backward_trace', harness, {}, harness.progress, harness.preview, inspection);
    assert.equal(resolved.available, true);
    assert.deepEqual(resolved.parameter, harness.parameter);
    assert.equal(resolved.verifiedInspection, undefined);
    assert.equal(resolved.numericAdjointsAvailable, false);
  }
});

test('PD1-2 one contribution exposes the exact retained event and never upgrades the retained list to complete fan-in', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-contribution', { name: 'wte', row: 0, column: 0 });
  await harness.contribution();
  const training = harness.progress.training!;
  const event = training.contributions.at(-1)!;
  const resolved = context('p2_gradient_contribution', harness, { contributionOrdinal: event.ordinal });
  assert(resolved.available);
  assert.deepEqual(resolved.parameter, harness.parameter);
  assert.deepEqual(resolved.selectedContribution, event);
  assert.equal(resolved.fanInCompleteness, 'retained-subset');
  assert.equal(resolved.selectedContribution?.after, resolved.selectedContribution!.before + resolved.selectedContribution!.contribution);

  await harness.finalGradient();
  const finalTraining = harness.progress.training!;
  assert(finalTraining.contributions.length >= 1);
  const retainedOnly = { ...finalTraining, contributions: finalTraining.contributions.slice(-1) };
  const subset = context(
    'p2_final_gradient',
    harness,
    {},
    withTraining(harness.progress, retainedOnly),
    harness.preview,
  );
  assert.equal(subset.fanInCompleteness, 'retained-subset');
  assert.equal(subset.retainedContributions.length, 1);
});

test('PD1-2 final gradient is the authentic completed backward result, not a retained contribution sum', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-final', { name: 'wte', row: 0, column: 0 });
  await harness.contribution();
  const contribution = harness.progress.training!.contributions.at(-1)!;
  await harness.finalGradient();
  const resolved = context('p2_final_gradient', harness, { contributionOrdinal: contribution.ordinal });
  assert(resolved.available);
  assert.equal(resolved.backwardComplete, true);
  assert.equal(resolved.finalGradient, harness.progress.training!.gradient);
  assert.equal(resolved.fanInCompleteness, 'retained-subset');
  assert.equal('summedRetainedGradient' in resolved, false);
  assert.equal(resolved.selectedContribution?.ordinal, contribution.ordinal);
});

test('PD1-2 Adam binds every proposal field to the exact runtime witness and rejects index or coordinate mismatches', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-adam', { name: 'wte', row: 0, column: 0 });
  await harness.adamProposal();
  const training = harness.progress.training!;
  const resolved = context('p2_adam_proposal', harness);
  assert(resolved.available);
  assert.deepEqual(resolved.parameter, harness.parameter);
  assert.deepEqual(resolved.proposal, training.proposal);
  assert.equal(resolved.acceptedStep, harness.starting.state.optimizer.step);
  assert.equal(resolved.optimizer?.beta1, harness.starting.state.optimizer.beta1);
  assert.equal(resolved.optimizer?.beta2, harness.starting.state.optimizer.beta2);
  assert.equal(resolved.optimizer?.epsilon, harness.starting.state.optimizer.epsilon);

  const proposal = training.proposal!;
  const wrongIndex = withTraining(harness.progress, {
    ...training,
    proposal: { ...proposal, index: proposal.index + 1 },
  });
  assert.equal(context('p2_adam_proposal', harness, {}, wrongIndex).available, false);

  const wrongCoordinates = withTraining(harness.progress, {
    ...training,
    proposal: { ...proposal, name: proposal.name === 'wte' ? 'wpe' : 'wte' },
  });
  assert.equal(context('p2_adam_proposal', harness, {}, wrongCoordinates).available, false);
});

test('PD1-2 Candidate Ready requires compatible snapshots, runs, input, targets, and runtime identity', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-candidate', { name: 'wte', row: 0, column: 0 });
  await harness.ready();
  const training = harness.progress.training!;
  const ready = training.readyOutputs!;
  const resolved = context('candidate_ready', harness);
  assert(resolved.available);
  const candidate = resolved.candidate!;
  assert.equal(candidate.startingSnapshotId, training.startingSnapshotId);
  assert.equal(candidate.candidateSnapshotId, training.candidateId);
  assert.equal(candidate.baselineRunId, ready.before.manifest.runId);
  assert.equal(candidate.trainingRunId, training.gradientSourceRunId);
  assert.equal(candidate.candidateRunId, ready.after.manifest.runId);
  assert(candidate.outputLabels.includes('END'));
  assert.equal(candidate.rows.length, (ready.before.manifest.targets as readonly number[]).length);
  for (const row of candidate.rows) {
    assert.equal(row.baselineDistribution.length, candidate.outputLabels.length);
    assert.equal(row.candidateDistribution.length, candidate.outputLabels.length);
    assert.equal(row.baselineDerivedLoss, -Math.log(row.baselineTargetProbability));
    assert.equal(row.candidateDerivedLoss, -Math.log(row.candidateTargetProbability));
  }
  assert.notEqual(candidate.baselineDerivedMean, undefined);
  assert.notEqual(candidate.candidateDerivedMean, undefined);

  const badStart = withTraining(harness.progress, {
    ...training,
    readyOutputs: { ...ready, starting: { ...ready.starting, id: 'mismatched-start' } },
  });
  assert.equal(context('candidate_ready', harness, {}, badStart).available, false);

  const badCandidateRun = withTraining(harness.progress, {
    ...training,
    readyOutputs: {
      ...ready,
      after: {
        ...ready.after,
        manifest: { ...ready.after.manifest, startingSnapshotId: 'mismatched-candidate' },
      },
    },
  });
  assert.equal(context('candidate_ready', harness, {}, badCandidateRun).available, false);

  const afterInput = ready.after.manifest.input as readonly number[];
  const badInput = withTraining(harness.progress, {
    ...training,
    readyOutputs: {
      ...ready,
      after: {
        ...ready.after,
        manifest: { ...ready.after.manifest, input: [...afterInput, 0] },
      },
    },
  });
  assert.equal(context('candidate_ready', harness, {}, badInput).available, false);

  const badRuntime = withTraining(harness.progress, {
    ...training,
    readyOutputs: {
      ...ready,
      after: {
        ...ready.after,
        manifest: { ...ready.after.manifest, runtimeRevision: ready.after.manifest.runtimeRevision + ':other' },
      },
    },
  });
  assert.equal(context('candidate_ready', harness, {}, badRuntime).available, false);

  const badPreview: RunResult = {
    ...harness.preview!,
    snapshots: [{ ...harness.preview!.snapshots[0], id: 'different-candidate-snapshot' }],
  };
  assert.equal(context('candidate_ready', harness, {}, harness.progress, badPreview).available, false);
});

test('PD1-2 runtime parameter witness follows TrainingProgress.pin for two distinct authentic parameters', async () => {
  for (const [name, pin] of [
    ['token embedding', { name: 'wte', row: 0, column: 0 }],
    ['position embedding', { name: 'wpe', row: 3, column: 0 }],
  ] as const) {
    const harness = await LiveTrainingHarness.create('pd1-2-dynamic-' + name.replaceAll(' ', '-'), pin);
    await harness.objective();
    assert.deepEqual(resolvePublicTrainingParameter(harness.progress.training, harness.starting), harness.parameter);
    const resolved = context('p2_backward_trace', harness);
    assert.deepEqual(resolved.parameter, harness.parameter);
    assert.equal(resolved.parameter?.index, harness.progress.training?.pin);
  }
});

test('PD1-2 temporary detail selection is render-only identity selection and public Part 2 Detail blocks execution repinning policy', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-render-only', { name: 'wte', row: 0, column: 0 });
  await harness.contribution();
  const before = harness.progress.training!;
  const execution = harness.progress.executionId;
  const pin = before.pin;
  const candidateId = before.candidateId;
  const events = before.contributions;
  const first = context('p2_gradient_contribution', harness, { contributionOrdinal: events[0]?.ordinal });
  const last = context('p2_gradient_contribution', harness, { contributionOrdinal: events.at(-1)?.ordinal });
  assert.equal(first.executionId, execution);
  assert.equal(last.executionId, execution);
  assert.equal(first.parameter?.index, pin);
  assert.equal(last.parameter?.index, pin);
  assert.equal(harness.progress.training?.pin, pin);
  assert.equal(harness.progress.training?.candidateId, candidateId);
  assert.equal(isPublicPart2DetailRenderOnly('visitor', getPublicTourContent('p2_gradient_contribution'), 'detail'), true);
  assert.equal(isPublicPart2DetailRenderOnly('facilitator', getPublicTourContent('p2_adam_proposal'), 'detail'), true);
  assert.equal(isPublicPart2DetailRenderOnly('workbench', getPublicTourContent('p2_gradient_contribution'), 'detail'), false);
  assert.equal(isPublicPart2DetailRenderOnly('visitor', getPublicTourContent('p1_qkv'), 'detail'), false);
});

test('PD1-2 main public lesson effects preserve the live runtime pin while Workbench explicit controls retain intentional repinning', async () => {
  const source = await readFile(new URL('../../app/main.ts', import.meta.url), 'utf8');
  const effectBody = source.slice(
    source.indexOf('function interpretPublicLessonEffect'),
    source.indexOf('let inspectedExecutionRevision'),
  );
  for (const effect of ['CONTINUE', 'RUN_TO_CONTRIBUTION', 'RUN_TO_PROPOSAL']) {
    const start = effectBody.indexOf("case '" + effect + "'");
    assert(start >= 0, effect);
    const end = effectBody.indexOf('break;', start);
    const branch = effectBody.slice(start, end);
    assert.doesNotMatch(branch, /syncTrainingPin\s*\(/, effect + ' must use the already-established ForwardDriver pin');
  }
  assert.match(source, /function startForward\(training = false\)[\s\S]*?syncTrainingPin\(\); await forwardDriver\.start/, 'initial training may still source the explicit presenter pin');
  assert.match(source, /#execution-pin[\s\S]{0,400}syncTrainingPin\(\)/, 'explicit execution pin control keeps intentional Workbench repinning');
});

test('PD1-2 presenter-local Part 2 selectors are render-only and do not route through selection/execution callbacks', async () => {
  const source = await readFile(new URL('../../app/spatial/presenter.ts', import.meta.url), 'utf8');
  const start = source.indexOf("root.querySelectorAll<HTMLElement>('[data-training-objective-position]");
  const end = source.indexOf('    const select=', start);
  assert(start >= 0 && end > start);
  const selectorBody = source.slice(start, end);
  assert.match(selectorBody, /this\.publicTrainingDepthSelection=next;/);
  assert.match(selectorBody, /render\(\);/);
  assert.doesNotMatch(selectorBody, /changed\(|inspectPin|dispatchPublicLesson|\.go\(|camera\./);

  const main = await readFile(new URL('../../app/main.ts', import.meta.url), 'utf8');
  const selectionStart = main.indexOf('function spatialSelectionChanged()');
  const selectionEnd = main.indexOf('function selectExplanationPhase', selectionStart);
  const selectionBody = main.slice(selectionStart, selectionEnd);
  assert.match(selectionBody, /isPublicPart2DetailRenderOnly/);
  assert.match(selectionBody, /forwardDriver\.active&&!renderOnlyDetail/);
  assert.match(selectionBody, /if\(!renderOnlyDetail\)clearDisplayedInspection/);
});

test('PD1-2 Guided to Detail to Return preserves representative Part 2 canonical states without execution effects', () => {
  const runtime: PublicLessonTransitionContext = {
    evidence: {
      hasObjective: true,
      hasMatchingContribution: true,
      hasFinalGradient: true,
      hasPinnedProposal: true,
      hasCandidateComparison: true,
    },
    driverPhase: 'paused',
    trainingStarted: true,
  };
  for (const state of [
    'p2_objective',
    'p2_gradient_contribution',
    'p2_final_gradient',
    'p2_adam_proposal',
    'candidate_ready',
  ] as const) {
    const session: PublicLessonSession = { current: state, navigation: { mode: 'guided' } };
    const opened = transitionPublicLesson(session, { type: 'OPEN_DETAIL' }, runtime);
    assert.equal(opened.session.current, state);
    assert.deepEqual(opened.session.navigation, { mode: 'detail', returnState: state });
    assert.deepEqual(opened.effects, []);

    const returned = transitionPublicLesson(opened.session, { type: 'RETURN_FROM_DETAIL' }, runtime);
    assert.equal(returned.session.current, state);
    assert.deepEqual(returned.session.navigation, { mode: 'guided' });
    assert.deepEqual(returned.effects, []);
  }
});

let vite: ViteDevServer | undefined;

async function renderContextualDockForTest(opts: ContextualDockOptions): Promise<string> {
  vite ??= await createServer({
    root: process.cwd(),
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  const module = await vite.ssrLoadModule('/app/spatial/contextual-dock.ts') as {
    renderContextualDock(options: ContextualDockOptions): string;
  };
  return module.renderContextualDock(opts);
}

after(async () => {
  await vite?.close();
  vite = undefined;
});

function spatialModel(harness: LiveTrainingHarness): SpatialReadModel {
  assert(harness.preview);
  const run = harness.preview.run;
  const snapshot = harness.preview.snapshots[0];
  const forward = forwardReadModel(run, snapshot);
  const source = sourceBinding(run, forward.vocabulary, undefined, run.manifest.runId, 'abca', 'forward');
  return spatialReadModel(run, snapshot, source, { layer: 0, query: 3, key: 0, head: 0, feature: 0 });
}

async function publicTrainingDock(
  harness: LiveTrainingHarness,
  state: Extract<PublicTourState, `p2_${string}`> | 'candidate_ready',
  depth: DockDepth,
  selection: PublicTrainingDepthSelection = {},
): Promise<string> {
  const tourContent = getPublicTourContent(state);
  const model = spatialModel(harness);
  const pin = resolvePublicTrainingParameter(harness.progress.training, harness.starting) ?? harness.parameter;
  return renderContextualDockForTest({
    model,
    address: { kind: tourContent.selectionIntent.kind, token: tourContent.selectionIntent.token },
    element: 0,
    row: pin.row,
    column: pin.column,
    pin: { name: pin.name, row: pin.row, column: pin.column },
    scalar: 'EXPLICIT SCALAR HANDOFF',
    depth,
    profile: 'visitor',
    freeExplore: false,
    lessonProgress: tourContent.progress,
    routePurpose: tourContent.routePurpose,
    primaryAction: '',
    attentionAction: '',
    shortDetour: true,
    shortMessage: '',
    operatorControls: false,
    executionProgress: harness.progress,
    trainingProgress: harness.progress.training,
    hasComparison: false,
    tourContent,
    publicTrainingDepthSelection: selection,
    trainingStartingSnapshot: harness.starting,
    trainingPreview: harness.preview,
  });
}

test('PD1-2 contextual dock dispatches canonical Part 2 Values Math and Source before generic training renderers', async () => {
  const harness = await LiveTrainingHarness.create('pd1-2-dock', { name: 'wte', row: 0, column: 0 });

  await harness.objective();
  const objectiveValues = await publicTrainingDock(harness, 'p2_objective', 'values');
  assert.match(objectiveValues, /data-public-training-depth-kind="objective"/);
  assert.match(objectiveValues, /P\(target\).*origin/);
  assert.match(objectiveValues, /\[OBSERVED\]/);
  const objectiveMath = await publicTrainingDock(harness, 'p2_objective', 'math');
  assert.match(objectiveMath, /DERIVED:/);
  assert.match(objectiveMath, /Observed runtime mean/);
  const objectiveSource = await publicTrainingDock(harness, 'p2_objective', 'source');
  assert.match(objectiveSource, /LIVE TRAINING TRANSACTION/);
  assert.match(objectiveSource, new RegExp(harness.progress.training!.gradientSourceRunId.replace(/[.*+?^$()|[\]\\]/g, '\\$&')));

  await harness.contribution();
  const event = harness.progress.training!.contributions.at(-1)!;
  const contributionValues = await publicTrainingDock(harness, 'p2_gradient_contribution', 'values', { contributionOrdinal: event.ordinal });
  assert.match(contributionValues, /retained matching subset/i);
  assert.match(contributionValues, /Child adjoint/);
  const contributionMath = await publicTrainingDock(harness, 'p2_gradient_contribution', 'math', { contributionOrdinal: event.ordinal });
  assert.match(contributionMath, /data-testid="public-contribution-math"/);
  assert.match(contributionMath, /EXPLICIT SCALAR HANDOFF/);
  if (event.child !== undefined) assert.match(contributionMath, /data-live-child=/);

  await harness.finalGradient();
  const finalMath = await publicTrainingDock(harness, 'p2_final_gradient', 'math');
  assert.match(finalMath, /OBSERVED COMPLETED BACKWARD RESULT/);
  assert.match(finalMath, /data-testid="no-retained-sum"/);

  await harness.adamProposal();
  const adamValues = await publicTrainingDock(harness, 'p2_adam_proposal', 'values');
  assert.match(adamValues, /Starting accepted optimizer step/);
  assert.match(adamValues, /stored delta/);
  assert.match(adamValues, /PROVISIONAL/);
  assert.match(adamValues, /ACCEPTED MODEL UNCHANGED/);
  const adamMath = await publicTrainingDock(harness, 'p2_adam_proposal', 'math');
  assert.match(adamMath, /symbolic step quantity/);
  assert.match(adamMath, /actual representable/);

  await harness.ready();
  const candidateValues = await publicTrainingDock(harness, 'candidate_ready', 'values');
  assert.match(candidateValues, /Baseline full distribution/);
  assert.match(candidateValues, /Candidate full distribution/);
  assert.match(candidateValues, /END/);
  assert.match(candidateValues, /candidate provisional/);
  assert.doesNotMatch(candidateValues, /better model|successful training|improved/i);
  const candidateMath = await publicTrainingDock(harness, 'candidate_ready', 'math');
  assert.match(candidateMath, /DERIVED baseline loss/);
  assert.match(candidateMath, /one fixed training example only/);
  const candidateSource = await publicTrainingDock(harness, 'candidate_ready', 'source');
  assert.match(candidateSource, /Comparison compatibility: COMPATIBLE/);
  assert.match(candidateSource, /candidate not live/);
});

test('NL1-B Guided witnesses retain source identity and separate partial, completed, provisional, and derived evidence', async () => {
  const harness = await LiveTrainingHarness.create('nl1-b-guided', { name: 'wte', row: 0, column: 0 });
  await harness.objective();
  const objective = await publicTrainingDock(harness, 'p2_objective', 'explain');
  assert.match(objective, /data-testid="part2-numerical-witness"/);
  assert.match(objective, /data-witness-field="target-probability" data-evidence-origin="observed"/);
  assert.match(objective, /data-witness-field="derived-loss" data-evidence-origin="derived"/);
  assert.match(objective, /data-witness-field="observed-mean" data-evidence-origin="observed"/);
  assert.match(objective, /All \d+ target positions/);
  const backward = await publicTrainingDock(harness, 'p2_backward_trace', 'explain');
  assert.match(backward, /Dependency \/ sensitivity · STRUCTURAL/);
  assert.match(backward, /Numerical adjoint unavailable in retained evidence/);
  assert.match(backward, /not runtime timing/);

  await harness.contribution();
  const event = harness.progress.training!.contributions.at(-1)!;
  const contribution = await publicTrainingDock(harness, 'p2_gradient_contribution', 'explain');
  assert.match(contribution, new RegExp(`data-contribution-ordinal="${event.ordinal}"`));
  assert.match(contribution, new RegExp(`data-witness-field="contribution" data-evidence-origin="observed" data-value="${event.contribution}"`));
  assert.match(contribution, /CURRENT TOTAL IS PARTIAL/);

  await harness.finalGradient();
  const final = await publicTrainingDock(harness, 'p2_final_gradient', 'explain');
  assert.match(final, new RegExp(`data-witness-field="final-gradient" data-evidence-origin="observed" data-value="${harness.progress.training!.gradient}"`));
  assert.match(final, /Retained rows are only a subset/);
  await harness.adamProposal();
  const adam = await publicTrainingDock(harness, 'p2_adam_proposal', 'explain');
  assert.match(adam, /data-witness-field="m-hat" data-evidence-origin="observed"/);
  assert.match(adam, /ACCEPTED MODEL UNCHANGED/);
  await harness.ready();
  const candidate = await publicTrainingDock(harness, 'candidate_ready', 'explain');
  assert.match(candidate, /data-baseline-run-id="[^"]+"/);
  assert.match(candidate, /data-candidate-run-id="[^"]+"/);
  assert.match(candidate, /data-witness-field="baseline-target-probability" data-evidence-origin="observed"/);
  assert.match(candidate, /data-witness-field="candidate-mean" data-evidence-origin="derived"/);
  assert.match(candidate, /One-example comparison only/);
});


function exactPublicArtifact(run: RecordedRun, kind: string, token?: number): Artifact {
  const artifact = run.artifacts.find(candidate =>
    candidate.kind === kind
    && candidate.concept.kind === kind
    && (token === undefined ? candidate.concept.token === undefined : candidate.concept.token === token)
    && candidate.availability === 'available'
    && candidate.values !== null
  );
  assert(artifact, `authentic ${kind} artifact must exist`);
  return artifact;
}

test('PD1-3C Objective microscope handoffs bind exact training artifacts and selected scalar elements', async () => {
  const harness = await LiveTrainingHarness.create('pd1-3c-objective-inspection', { name: 'wte', row: 0, column: 0 });
  await harness.objective();
  const position = 2;
  const resolved = context('p2_objective', harness, { objectivePosition: position });
  assert(resolved.available);
  const objective = resolved.objective!;
  const row = objective.rows.find(candidate => candidate.position === position)!;
  const sourceRunId = harness.progress.training!.gradientSourceRunId;
  const run = harness.preview!.run;
  const probability = exactPublicArtifact(run, 'probabilities', position);
  const loss = exactPublicArtifact(run, 'loss', position);
  const meanLoss = exactPublicArtifact(run, 'meanLoss');

  assert.deepEqual(objective.probabilityInspection, {
    sourceRunId,
    artifactId: probability.id,
    element: row.target,
  });
  assert.deepEqual(objective.lossInspection, {
    sourceRunId,
    artifactId: loss.id,
    element: 0,
  });
  assert.deepEqual(objective.meanInspection, {
    sourceRunId,
    artifactId: meanLoss.id,
    element: 0,
  });

  const html = await publicTrainingDock(harness, 'p2_objective', 'math', { objectivePosition: position });
  for (const target of [objective.probabilityInspection!, objective.lossInspection!, objective.meanInspection!]) {
    assert(html.includes(
      `data-source-run="${target.sourceRunId}" data-artifact="${target.artifactId}" data-element="${target.element}"`,
    ));
  }
});

test('PD1-3C Objective omits microscope handoffs when the exact captured artifact is absent', async () => {
  const harness = await LiveTrainingHarness.create('pd1-3c-objective-missing', { name: 'wte', row: 0, column: 0 });
  await harness.objective();
  const position = 2;
  const original = harness.preview!;
  const probability = exactPublicArtifact(original.run, 'probabilities', position);
  const loss = exactPublicArtifact(original.run, 'loss', position);
  const meanLoss = exactPublicArtifact(original.run, 'meanLoss');
  const removed = new Set([probability.id, loss.id, meanLoss.id]);
  const preview: RunResult = {
    ...original,
    run: { ...original.run, artifacts: original.run.artifacts.filter(artifact => !removed.has(artifact.id)) },
  };
  const resolved = context('p2_objective', harness, { objectivePosition: position }, harness.progress, preview);
  assert(resolved.available);
  assert.equal(resolved.objective?.probabilityInspection, undefined);
  assert.equal(resolved.objective?.lossInspection, undefined);
  assert.equal(resolved.objective?.meanInspection, undefined);
});

test('PD1-3C Contribution child handoff remains bound to the exact training source and retained child node', async () => {
  const harness = await LiveTrainingHarness.create('pd1-3c-contribution-inspection', { name: 'wte', row: 0, column: 0 });
  await harness.contribution();
  const event = harness.progress.training!.contributions.at(-1)!;
  assert.notEqual(event.child, undefined);
  const sourceRunId = harness.progress.training!.gradientSourceRunId;
  const html = await publicTrainingDock(harness, 'p2_gradient_contribution', 'math', { contributionOrdinal: event.ordinal });
  assert(html.includes(`data-live-child="${event.child}" data-live-source="${sourceRunId}"`));
});

test('PD1-3C Final Gradient and Adam expose the same exact completed-gradient ancestry target only', async () => {
  const harness = await LiveTrainingHarness.create('pd1-3c-gradient-inspection', { name: 'wte', row: 0, column: 0 });
  await harness.finalGradient();
  const sourceRunId = harness.progress.training!.gradientSourceRunId;
  const expected = { sourceRunId, parameterIndex: harness.parameter.index };

  const final = context('p2_final_gradient', harness);
  assert(final.available);
  assert.equal(final.backwardComplete, true);
  assert.deepEqual(final.gradientInspection, expected);
  const finalHtml = await publicTrainingDock(harness, 'p2_final_gradient', 'math');
  assert(finalHtml.includes(`data-source-run="${sourceRunId}" data-gradient-parameter="${harness.parameter.index}"`));
  assert.match(finalHtml, /data-testid="no-retained-sum"/);

  await harness.adamProposal();
  const adam = context('p2_adam_proposal', harness);
  assert(adam.available);
  assert.deepEqual(adam.gradientInspection, expected);
  const adamHtml = await publicTrainingDock(harness, 'p2_adam_proposal', 'math');
  assert(adamHtml.includes(`data-source-run="${sourceRunId}" data-gradient-parameter="${harness.parameter.index}"`));
  assert.doesNotMatch(adamHtml, /data-artifact=/, 'optimizer transition fields must not become scalar artifact actions');
  assert.equal((adamHtml.match(/data-gradient-parameter=/g) ?? []).length, 1);
});

test('PD1-3C Candidate inspection is live-source asymmetric: candidate target probability only, never baseline ancestry', async () => {
  const harness = await LiveTrainingHarness.create('pd1-3c-candidate-inspection', { name: 'wte', row: 0, column: 0 });
  await harness.ready();
  const position = 2;
  const training = harness.progress.training!;
  const ready = training.readyOutputs!;
  const resolved = context('candidate_ready', harness, { candidatePosition: position });
  assert(resolved.available);
  const candidate = resolved.candidate!;
  const row = candidate.rows.find(item => item.position === position)!;
  const artifact = exactPublicArtifact(ready.after, 'probabilities', position);

  assert.equal(isPublicTrainingSourceInspectable(harness.progress, ready.after.manifest.runId), true);
  assert.equal(isPublicTrainingSourceInspectable(harness.progress, ready.before.manifest.runId), false);
  assert.deepEqual(candidate.candidateProbabilityInspection, {
    sourceRunId: ready.after.manifest.runId,
    artifactId: artifact.id,
    element: row.target,
  });
  assert.equal('baselineProbabilityInspection' in candidate, false);

  const html = await publicTrainingDock(harness, 'candidate_ready', 'math', { candidatePosition: position });
  assert(html.includes(
    `data-source-run="${ready.after.manifest.runId}" data-artifact="${artifact.id}" data-element="${row.target}"`,
  ));
  assert(!html.includes(`data-source-run="${ready.before.manifest.runId}"`));
  assert.match(html, /live baseline scalar ancestry is unavailable/i);

  const retainedOnly = resolvePublicTrainingDepthContext(
    getPublicTourContent('candidate_ready'),
    harness.progress,
    harness.starting,
    undefined,
    { candidatePosition: position },
  );
  assert(retainedOnly?.available, 'retained candidate comparison evidence remains authentic without a live preview');
  assert.equal(retainedOnly.candidate?.candidateProbabilityInspection, undefined);
});

test('PD1-3C public inspection handlers are explicit-source read-only handoffs with no execution or candidate effects', async () => {
  const source = await readFile(new URL('../../app/main.ts', import.meta.url), 'utf8');

  const artifactStart = source.indexOf('.querySelectorAll<HTMLButtonElement>("[data-artifact]")');
  const gradientStart = source.indexOf('.querySelectorAll<HTMLButtonElement>("[data-gradient-parameter]")', artifactStart);
  const nodeStart = source.indexOf('.querySelectorAll<HTMLButtonElement>("[data-node]")', gradientStart);
  assert(artifactStart >= 0 && gradientStart > artifactStart && nodeStart > gradientStart);
  const artifactHandler = source.slice(artifactStart, gradientStart);
  const gradientHandler = source.slice(gradientStart, nodeStart);

  const childStart = source.indexOf("mount.querySelectorAll<HTMLButtonElement>('[data-live-child]')");
  const childEnd = source.indexOf("mount.querySelector('#step-learning')", childStart);
  assert(childStart >= 0 && childEnd > childStart);
  const childHandler = source.slice(childStart, childEnd);

  assert.match(artifactHandler, /void inspect\(\s*sourceRunId,/);
  assert.match(gradientHandler, /button\.dataset\.sourceRun/);
  assert.match(gradientHandler, /kind:\s*"gradient",\s*parameterIndex/);
  assert.match(gradientHandler, /void inspect\(\s*sourceRunId,/);
  assert.match(childHandler, /void inspect\(source, \{ kind: 'node', nodeId:/);

  const prohibited = /syncTrainingPin|inspectPin|forwardDriver\.(?:continue|runToContribution|runToProposal|acceptUpdate)|dispatchPublicLesson|selectRun\(|liveRunId\s*=|ACCEPT_REQUESTED|DISCARD_REQUESTED/;
  for (const [label, handler] of [
    ['artifact', artifactHandler],
    ['gradient', gradientHandler],
    ['child', childHandler],
  ] as const) {
    assert.doesNotMatch(handler, prohibited, label + ' inspection handler must remain read-only');
  }
});
