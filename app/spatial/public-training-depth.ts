import type { ArchivedSnapshot } from '../../archive/session.js';
import type { InspectionResult, ParameterRef } from '../../inspect/types.js';
import type { ParameterUpdate } from '../../model/training.js';
import type { RecordedRun } from '../../trace/types.js';
import type { ForwardProgress, RunResult } from '../worker/protocol.js';
import type { LiveContribution, TrainingProgress } from '../worker/training-execution.js';
import { resolveParameterIndex } from './learning.js';
import type { PublicDepthKind, PublicTourContent, PublicTourState } from './public-tour.js';

export type PublicTrainingDepthKind = Extract<PublicDepthKind,
  'objective' | 'backward-trace' | 'gradient-contribution' | 'final-gradient' | 'adam' | 'candidate'>;

export interface PublicTrainingDepthSelection {
  objectivePosition?: number;
  contributionOrdinal?: number;
  candidatePosition?: number;
}

export interface PublicObjectiveDepthRow {
  readonly position: number;
  readonly input?: number;
  readonly inputLabel: string;
  readonly target: number;
  readonly targetLabel: string;
  readonly probability?: number;
  readonly recordedLoss?: number;
  readonly derivedLoss?: number;
}

export interface PublicCandidateDepthRow {
  readonly position: number;
  readonly input: number;
  readonly inputLabel: string;
  readonly target: number;
  readonly targetLabel: string;
  readonly baselineDistribution: readonly number[];
  readonly candidateDistribution: readonly number[];
  readonly baselineTargetProbability: number;
  readonly candidateTargetProbability: number;
  readonly baselineDerivedLoss?: number;
  readonly candidateDerivedLoss?: number;
}

export interface PublicCandidateDepth {
  readonly startingSnapshotId: string;
  readonly candidateSnapshotId: string;
  readonly baselineRunId: string;
  readonly trainingRunId: string;
  readonly candidateRunId: string;
  readonly baselineRuntimeVersion: string;
  readonly candidateRuntimeVersion: string;
  readonly baselineRuntimeRevision: string;
  readonly candidateRuntimeRevision: string;
  readonly outputLabels: readonly string[];
  readonly rows: readonly PublicCandidateDepthRow[];
  readonly selectedPosition: number;
  readonly baselineDerivedMean?: number;
  readonly candidateDerivedMean?: number;
}

export interface ResolvedPublicTrainingDepthContext {
  readonly available: boolean;
  readonly reason?: string;
  readonly state: PublicTourState;
  readonly kind: PublicTrainingDepthKind;
  readonly executionId?: string;
  readonly phase?: TrainingProgress['phase'];
  readonly startingSnapshotId?: string;
  readonly parameter?: ParameterRef;
  readonly gradientSourceRunId?: string;
  readonly sourceRunId?: string;
  readonly candidateId?: string;
  readonly trainingRun?: RecordedRun;
  readonly runtimeVersion?: string;
  readonly runtimeRevision?: string;
  readonly objective?: {
    readonly rows: readonly PublicObjectiveDepthRow[];
    readonly selectedPosition: number;
    readonly observedMean?: number;
    readonly derivedMean?: number;
  };
  readonly numericAdjointsAvailable: boolean;
  readonly verifiedInspection?: InspectionResult;
  readonly retainedContributions: readonly LiveContribution[];
  readonly selectedContribution?: LiveContribution;
  readonly fanInCompleteness: 'retained-subset';
  readonly finalGradient?: number;
  readonly backwardComplete: boolean;
  readonly proposal?: ParameterUpdate;
  readonly optimizer?: TrainingProgress['optimizer'];
  readonly acceptedStep?: number;
  readonly candidate?: PublicCandidateDepth;
}

const TRAINING_DEPTH_KINDS = new Set<PublicTrainingDepthKind>([
  'objective',
  'backward-trace',
  'gradient-contribution',
  'final-gradient',
  'adam',
  'candidate',
]);

function trainingDepthKind(content: PublicTourContent): PublicTrainingDepthKind | undefined {
  const kind = content.depthSpec?.kind as PublicTrainingDepthKind | undefined;
  return content.part === 2 && kind && TRAINING_DEPTH_KINDS.has(kind) ? kind : undefined;
}

function numericArray(value: unknown): readonly number[] | undefined {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'number' && Number.isFinite(item))) return undefined;
  return value as readonly number[];
}

function sameNumbers(left: readonly number[] | undefined, right: readonly number[] | undefined): boolean {
  return Boolean(left && right && left.length === right.length && left.every((value, index) => value === right[index]));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function probabilityRow(run: RecordedRun, position: number): readonly number[] | undefined {
  const artifact = run.artifacts.find(candidate =>
    candidate.concept.kind === 'probabilities'
    && candidate.concept.token === position
    && candidate.availability === 'available'
    && candidate.values !== null
  );
  return artifact?.values ?? undefined;
}

function inputTokenLabel(id: number | undefined, snapshot: ArchivedSnapshot): string {
  if (id === undefined) return 'unavailable';
  if (id === snapshot.state.config.bosTokenId) return 'START';
  return snapshot.state.config.vocabulary[id] ?? String(id);
}

function targetTokenLabel(id: number, snapshot: ArchivedSnapshot): string {
  if (id === snapshot.state.config.bosTokenId) return 'END';
  return snapshot.state.config.vocabulary[id] ?? String(id);
}

function derivedNegativeLog(probability: number | undefined): number | undefined {
  return probability !== undefined && probability > 0 && Number.isFinite(probability) ? -Math.log(probability) : undefined;
}

function completeMean(values: readonly (number | undefined)[]): number | undefined {
  if (!values.length || values.some(value => value === undefined)) return undefined;
  return (values as readonly number[]).reduce((sum, value) => sum + value, 0) / values.length;
}

function unavailable(
  content: PublicTourContent,
  kind: PublicTrainingDepthKind,
  reason: string,
  progress?: ForwardProgress,
): ResolvedPublicTrainingDepthContext {
  const training = progress?.training;
  return {
    available: false,
    reason,
    state: content.state,
    kind,
    executionId: progress?.executionId,
    phase: training?.phase,
    startingSnapshotId: training?.startingSnapshotId,
    gradientSourceRunId: training?.gradientSourceRunId,
    sourceRunId: training?.sourceRunId,
    candidateId: training?.candidateId,
    numericAdjointsAvailable: false,
    retainedContributions: training?.contributions ?? [],
    fanInCompleteness: 'retained-subset',
    backwardComplete: Boolean(training?.final),
    optimizer: training?.optimizer,
    acceptedStep: training?.acceptedStep,
  };
}

export function resolvePublicTrainingParameter(
  training: TrainingProgress | undefined,
  startingSnapshot: ArchivedSnapshot | undefined,
): ParameterRef | undefined {
  if (!training || !startingSnapshot || startingSnapshot.id !== training.startingSnapshotId) return undefined;
  return resolveParameterIndex(startingSnapshot, training.pin);
}

export function isPublicPart2DetailRenderOnly(
  profile: string | undefined,
  content: PublicTourContent | undefined,
  navigationMode: string | undefined,
): boolean {
  return profile !== 'workbench' && content?.part === 2 && navigationMode === 'detail';
}

function boundBackwardInspection(
  inspection: InspectionResult | undefined,
  sourceRunId: string,
  parameter: ParameterRef,
): InspectionResult | undefined {
  if (!inspection || inspection.availability !== 'available' || inspection.sourceRunId !== sourceRunId) return undefined;
  if (inspection.provenance === 'recomputed' && inspection.verification?.verified !== true) return undefined;
  const graph = inspection.graph;
  if (!graph) return undefined;
  const root = graph.nodes.find(node => {
    const candidate = node.parameter;
    return graph.roots.includes(node.id)
      && candidate?.index === parameter.index
      && candidate.name === parameter.name
      && candidate.row === parameter.row
      && candidate.column === parameter.column;
  });
  return root ? inspection : undefined;
}

export function resolvePublicTrainingDepthContext(
  content: PublicTourContent,
  progress: ForwardProgress | undefined,
  startingSnapshot: ArchivedSnapshot | undefined,
  livePreview?: RunResult,
  selection: PublicTrainingDepthSelection = {},
  inspection?: InspectionResult,
): ResolvedPublicTrainingDepthContext | undefined {
  const kind = trainingDepthKind(content);
  if (!kind) return undefined;
  const training = progress?.training;
  if (!progress || !training) return unavailable(content, kind, 'Live training transaction unavailable.', progress);
  if (!startingSnapshot) return unavailable(content, kind, 'Starting snapshot unavailable.', progress);
  if (startingSnapshot.id !== training.startingSnapshotId) {
    return unavailable(content, kind, 'Starting snapshot identity does not match the live training transaction.', progress);
  }

  const parameter = resolveParameterIndex(startingSnapshot, training.pin);
  if (!parameter) return unavailable(content, kind, 'Runtime parameter index is not resolvable in the starting snapshot.', progress);

  if (training.proposal && (
    training.proposal.index !== training.pin
    || training.proposal.name !== parameter.name
    || training.proposal.row !== parameter.row
    || training.proposal.column !== parameter.column
  )) {
    return unavailable(content, kind, 'Adam proposal identity does not match the runtime parameter witness.', progress);
  }

  let trainingRun: RecordedRun | undefined;
  if (kind !== 'candidate' && livePreview) {
    if (livePreview.run.manifest.runId !== training.gradientSourceRunId) {
      return unavailable(content, kind, 'Displayed live run does not match the transaction training source.', progress);
    }
    if (livePreview.run.manifest.startingSnapshotId !== training.startingSnapshotId) {
      return unavailable(content, kind, 'Live training run starts from a different snapshot.', progress);
    }
    trainingRun = livePreview.run;
  }

  const verifiedInspection = boundBackwardInspection(
    inspection,
    training.gradientSourceRunId,
    parameter,
  );
  const numericAdjointsAvailable = Boolean(verifiedInspection?.graph?.edges.some(edge =>
    edge.childAdjoint !== undefined || edge.contribution !== undefined
  ));
  const retainedContributions = training.contributions;
  const selectedContribution = (selection.contributionOrdinal === undefined
    ? retainedContributions.at(-1)
    : retainedContributions.find(event => event.ordinal === selection.contributionOrdinal))
    ?? retainedContributions.at(-1);

  const base: ResolvedPublicTrainingDepthContext = {
    available: true,
    state: content.state,
    kind,
    executionId: progress.executionId,
    phase: training.phase,
    startingSnapshotId: training.startingSnapshotId,
    parameter,
    gradientSourceRunId: training.gradientSourceRunId,
    sourceRunId: training.sourceRunId,
    candidateId: training.candidateId,
    trainingRun,
    runtimeVersion: trainingRun?.manifest.runtimeVersion,
    runtimeRevision: trainingRun?.manifest.runtimeRevision,
    numericAdjointsAvailable,
    verifiedInspection,
    retainedContributions,
    selectedContribution,
    fanInCompleteness: 'retained-subset',
    finalGradient: training.final ? training.gradient : undefined,
    backwardComplete: training.final,
    proposal: training.proposal,
    optimizer: training.optimizer,
    acceptedStep: training.acceptedStep,
  };

  if (kind === 'objective') {
    const input = trainingRun ? numericArray(trainingRun.manifest.input) : undefined;
    const targets = trainingRun ? numericArray(trainingRun.manifest.targets) : undefined;
    if (trainingRun && (!input || !targets || input.length !== training.losses.length || targets.length !== training.losses.length)) {
      return unavailable(content, kind, 'Training run input/target shape does not match retained objective evidence.', progress);
    }
    if (targets && training.losses.some((loss, index) => loss.target !== targets[index])) {
      return unavailable(content, kind, 'Training run targets do not match retained objective losses.', progress);
    }
    const rows = training.losses.map((loss, position): PublicObjectiveDepthRow => {
      const distribution = trainingRun ? probabilityRow(trainingRun, position) : undefined;
      const probability = distribution && loss.target >= 0 && loss.target < distribution.length
        ? distribution[loss.target]
        : undefined;
      return {
        position,
        input: input?.[position],
        inputLabel: inputTokenLabel(input?.[position], startingSnapshot),
        target: loss.target,
        targetLabel: targetTokenLabel(loss.target, startingSnapshot),
        probability,
        recordedLoss: loss.value,
        derivedLoss: derivedNegativeLog(probability),
      };
    });
    const requested = selection.objectivePosition;
    const selectedPosition = rows.some(row => row.position === requested) ? requested! : (rows.at(-1)?.position ?? 0);
    return {
      ...base,
      objective: {
        rows,
        selectedPosition,
        observedMean: training.mean,
        derivedMean: completeMean(rows.map(row => row.recordedLoss)),
      },
    };
  }

  if (kind === 'adam' && !training.proposal) {
    return unavailable(content, kind, 'No authentic Adam proposal exists for the runtime parameter witness.', progress);
  }

  if (kind === 'candidate') {
    const ready = training.readyOutputs;
    if (!ready || !training.candidateId) {
      return unavailable(content, kind, 'Candidate comparison evidence is not ready.', progress);
    }
    const before = ready.before.manifest;
    const after = ready.after.manifest;
    if (ready.starting.id !== training.startingSnapshotId) {
      return unavailable(content, kind, 'Candidate receipt starting snapshot does not match the training transaction.', progress);
    }
    if (before.startingSnapshotId !== training.startingSnapshotId) {
      return unavailable(content, kind, 'Baseline run starts from a different snapshot.', progress);
    }
    if (after.startingSnapshotId !== training.candidateId) {
      return unavailable(content, kind, 'Candidate run does not start from the provisional candidate snapshot.', progress);
    }
    if (after.runId !== training.sourceRunId) {
      return unavailable(content, kind, 'Candidate run does not match the transaction current source run.', progress);
    }
    if (livePreview && (
      livePreview.run.manifest.runId !== after.runId
      || livePreview.snapshots[0]?.id !== training.candidateId
    )) {
      return unavailable(content, kind, 'Live candidate preview identity does not match the provisional candidate.', progress);
    }
    const beforeInput = numericArray(before.input), afterInput = numericArray(after.input);
    const beforeTargets = numericArray(before.targets), afterTargets = numericArray(after.targets);
    if (!sameNumbers(beforeInput, afterInput) || !sameNumbers(beforeTargets, afterTargets)) {
      return unavailable(content, kind, 'Baseline and candidate inputs or targets do not match.', progress);
    }
    if (!sameJson(before.model, after.model)
      || before.runtimeVersion !== after.runtimeVersion
      || before.runtimeRevision !== after.runtimeRevision) {
      return unavailable(content, kind, 'Baseline and candidate model/runtime identities are incompatible.', progress);
    }
    if (!beforeInput || !beforeTargets || beforeInput.length !== beforeTargets.length) {
      return unavailable(content, kind, 'Candidate comparison input/target evidence is unavailable.', progress);
    }
    const outputLabels = [...startingSnapshot.state.config.vocabulary, 'END'];
    const rows: PublicCandidateDepthRow[] = [];
    for (let position = 0; position < beforeTargets.length; position++) {
      const baselineDistribution = probabilityRow(ready.before, position);
      const candidateDistribution = probabilityRow(ready.after, position);
      const target = beforeTargets[position];
      if (!baselineDistribution || !candidateDistribution
        || baselineDistribution.length !== outputLabels.length
        || candidateDistribution.length !== outputLabels.length
        || target < 0 || target >= outputLabels.length) {
        return unavailable(content, kind, 'Complete baseline/candidate probability support is unavailable.', progress);
      }
      const baselineTargetProbability = baselineDistribution[target];
      const candidateTargetProbability = candidateDistribution[target];
      rows.push({
        position,
        input: beforeInput[position],
        inputLabel: inputTokenLabel(beforeInput[position], startingSnapshot),
        target,
        targetLabel: targetTokenLabel(target, startingSnapshot),
        baselineDistribution,
        candidateDistribution,
        baselineTargetProbability,
        candidateTargetProbability,
        baselineDerivedLoss: derivedNegativeLog(baselineTargetProbability),
        candidateDerivedLoss: derivedNegativeLog(candidateTargetProbability),
      });
    }
    const requested = selection.candidatePosition;
    const selectedPosition = rows.some(row => row.position === requested) ? requested! : (rows.at(-1)?.position ?? 0);
    return {
      ...base,
      runtimeVersion: before.runtimeVersion,
      runtimeRevision: before.runtimeRevision,
      candidate: {
        startingSnapshotId: training.startingSnapshotId,
        candidateSnapshotId: training.candidateId,
        baselineRunId: before.runId,
        trainingRunId: training.gradientSourceRunId,
        candidateRunId: after.runId,
        baselineRuntimeVersion: before.runtimeVersion,
        candidateRuntimeVersion: after.runtimeVersion,
        baselineRuntimeRevision: before.runtimeRevision,
        candidateRuntimeRevision: after.runtimeRevision,
        outputLabels,
        rows,
        selectedPosition,
        baselineDerivedMean: completeMean(rows.map(row => row.baselineDerivedLoss)),
        candidateDerivedMean: completeMean(rows.map(row => row.candidateDerivedLoss)),
      },
    };
  }

  return base;
}

