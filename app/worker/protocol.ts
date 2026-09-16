import type { ForwardBoundary } from '../../model/microgpt.js';
import type { Artifact, RecordedRun } from '../../trace/types.js';
import type { TrainingSnapshot } from '../../model/state.js';
import type { TrainStepResult } from '../../model/training.js';
import type { ArchivedSnapshot, LearningExperiment } from '../../archive/session.js';
import type { InspectionTarget, InspectionResult } from '../../inspect/types.js';
import type { HeadAblationExperiment } from '../../experiments/ablation.js';
import type { ActivationPatchExperiment } from '../../experiments/activation-patch.js';

export interface RequestTag { sessionId: string; runId: string; generationId: number; intent?: import("../../trace/evidence.js").ExecutionRequest }
export type WorkerRequest = RequestTag & (
  { command: 'initialize' | 'reset' } |
  { command: 'restore'; snapshot: ArchivedSnapshot } |
  { command: 'predict' | 'train'; document: string } |
  { command: 'startForward' | 'startTraining'; document: string } |
  { command: 'advanceTraining'; executionId: string; permit: number; budget: number; pin: number; stop: boolean } |
  { command: 'inspectTraining'; executionId: string; pin: number } |
  { command: 'acceptTraining'; executionId: string; candidateId: string } |
  { command: 'advanceForward'; executionId: string; permit: number } |
  { command: 'cancelForward'; executionId: string } |
  { command: 'inspect'; sourceRunId: string; target: InspectionTarget } |
  { command: 'detail'; layer: number; head: number; query: number; key: number } |
  { command: 'cancel' }
);
export interface AttentionDetail {
  provenance: 'derived'; availability: 'available' | 'not_applicable' | 'not_captured';
  q: number[]; k: number[]; products: number[]; sum: number | null; scale: number | null;
  scaled: number | null; observedLogit: number | null; probability: number | null;
  logits: number[]; sourceRunId: string;
}
export interface RunResult {
  run: RecordedRun; tokenIds: number[]; targetIds: number[];
  logits: number[][]; probabilities: number[][]; trainingStep: number;
  learn?: TrainStepResult;
  snapshots: ArchivedSnapshot[];
  runs: RecordedRun[];
  experiment?: LearningExperiment;
}
/** Transient envelope: artifacts retain the ordinary vocabulary, never enter history until finish. */
export interface ForwardProgress {
  training?: import('./training-execution.js').TrainingProgress;
  executionId: string; sequence: number; total: number;
  last?: ForwardBoundary; next?: ForwardBoundary;
  artifacts: readonly Artifact[]; capture: RecordedRun['capture'];
  start?: { manifest: RecordedRun['manifest']; snapshot: ArchivedSnapshot; tokenIds: number[]; targetIds: number[]; trainingStep: number };
}
export type WorkerResponse = RequestTag & (
  { status: 'ready'; snapshot: TrainingSnapshot; archivedSnapshot: ArchivedSnapshot } |
  { status: 'forward'; progress: ForwardProgress } |
  { status: 'result'; result: RunResult } |
  { status: 'detail'; detail: AttentionDetail } |
  { status: 'inspection'; inspection: InspectionResult } |
  { status: 'ablation'; experiment: HeadAblationExperiment } |
  { status: 'activationPatch'; experiment: ActivationPatchExperiment } |
  { status: 'cancelled' } |
  { status: 'error'; error: string }
);

export interface HistoricalRequest extends RequestTag {
  command: 'inspect'; snapshot: ArchivedSnapshot; run: RecordedRun; target: InspectionTarget;
  /** Training runs need backward replay; never infer this from artifact names. */
  backward: boolean;
}
export interface AblationRequest extends RequestTag {
  command: 'ablate'; snapshot: ArchivedSnapshot; inputIds: number[]; targetIds: number[];
  selection: { layer: number; head: number };
}
export interface ActivationPatchRequest extends RequestTag {
  command: 'activationPatch'; snapshot: ArchivedSnapshot; inputIds: number[]; targetIds: number[];
  donor: { token: number; layer: number; head: number };
  target: { token: number; layer: number; head: number };
}
