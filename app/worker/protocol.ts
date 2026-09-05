import type { RecordedRun } from '../../trace/types.js';
import type { TrainingSnapshot } from '../../model/state.js';
import type { TrainStepResult } from '../../model/training.js';

export interface RequestTag { sessionId: string; runId: string; generationId: number }
export type WorkerRequest = RequestTag & (
  { command: 'initialize' | 'reset' } |
  { command: 'predict' | 'train'; document: string } |
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
}
export type WorkerResponse = RequestTag & (
  { status: 'ready'; snapshot: TrainingSnapshot } |
  { status: 'result'; result: RunResult } |
  { status: 'detail'; detail: AttentionDetail } |
  { status: 'cancelled' } |
  { status: 'error'; error: string }
);
