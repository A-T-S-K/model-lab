import type { RecordedRun } from '../../trace/types.js';
import type { TrainingSnapshot } from '../../model/state.js';
import type { TrainStepResult } from '../../model/training.js';
import type { ArchivedSnapshot, LearningExperiment } from '../../archive/session.js';
import type { InspectionTarget, InspectionResult } from '../../inspect/types.js';
import type { HeadAblationExperiment } from '../../experiments/ablation.js';

export interface RequestTag { sessionId: string; runId: string; generationId: number }
export type WorkerRequest = RequestTag & (
  { command: 'initialize' | 'reset' } |
  { command: 'restore'; snapshot: ArchivedSnapshot } |
  { command: 'predict' | 'train'; document: string } |
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
export type WorkerResponse = RequestTag & (
  { status: 'ready'; snapshot: TrainingSnapshot; archivedSnapshot: ArchivedSnapshot } |
  { status: 'result'; result: RunResult } |
  { status: 'detail'; detail: AttentionDetail } |
  { status: 'inspection'; inspection: InspectionResult } |
  { status: 'ablation'; experiment: HeadAblationExperiment } |
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
