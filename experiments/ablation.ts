import { snapshotId, type ArchivedSnapshot } from '../archive/snapshot.js';
import { restoreTraining } from '../model/state.js';
import { HEAD_OUTPUT_BOUNDARY, predict, type HeadAblation } from '../model/microgpt.js';
import { TraceRecorder } from '../trace/recorder.js';
import { canonicalIdentity, compareMatchedInterventionArms } from '../trace/compare.js';
import { immutableCopy, type JsonValue } from '../trace/types.js';
import { experimentManifest, type ExperimentTag } from './common.js';
import type { InterventionExperiment, InterventionRecipeContribution, InterventionValidationContext } from './intervention.js';

export const HEAD_ABLATION_RECIPE = { id: 'microgpt.head-ablation', version: 1 } as const;

export interface HeadAblationExperiment extends InterventionExperiment {
  readonly recipe: typeof HEAD_ABLATION_RECIPE;
  readonly selection: HeadAblation;
  readonly boundary: typeof HEAD_OUTPUT_BOUNDARY;
  readonly provenance: 'observed';
  readonly declaration: JsonValue & {
    readonly kind: 'head_ablation';
    readonly layer: number;
    readonly head: number;
    readonly boundary: typeof HEAD_OUTPUT_BOUNDARY;
    readonly replacement: 0;
  };
}

export interface HeadAblationExecutionRequest {
  readonly snapshot: ArchivedSnapshot;
  readonly inputIds: readonly number[];
  readonly targetIds: readonly number[];
  readonly selection: HeadAblation;
  readonly tag?: ExperimentTag;
}

export function isHeadAblationExperiment(experiment: InterventionExperiment): experiment is HeadAblationExperiment {
  return experiment.recipe.id === HEAD_ABLATION_RECIPE.id && experiment.recipe.version === HEAD_ABLATION_RECIPE.version;
}

function validateHeadAblationReceipt(experiment: InterventionExperiment, context: InterventionValidationContext): void {
  const candidate = experiment as HeadAblationExperiment;
  const { layer, head } = candidate.selection ?? {} as HeadAblation;
  const declaration = { kind: 'head_ablation', layer, head, boundary: HEAD_OUTPUT_BOUNDARY, replacement: 0 } as const;
  const expectedReceipt = {
    status: 'applied', recipe: HEAD_ABLATION_RECIPE, sourceCheckpointId: context.snapshot.id,
    baselineRunId: candidate.baselineRun.manifest.runId, interventionRunId: candidate.interventionRun.manifest.runId,
    target: { layer, head, boundary: HEAD_OUTPUT_BOUNDARY, scope: 'all positions' }, effectiveReplacement: 0,
  };
  if (!Number.isInteger(layer) || !Number.isInteger(head) || layer < 0 || head < 0 ||
      layer >= context.snapshot.state.config.nLayer || head >= context.snapshot.state.config.nHead ||
      candidate.boundary !== HEAD_OUTPUT_BOUNDARY || candidate.provenance !== 'observed' ||
      canonicalIdentity(candidate.declaration) !== canonicalIdentity(declaration) ||
      canonicalIdentity(candidate.receipt) !== canonicalIdentity(expectedReceipt)) {
    throw new Error('Invalid head-ablation recipe receipt');
  }
  const applied = candidate.interventionRun.artifacts.filter(artifact => artifact.kind === 'headOutput' && artifact.concept.layer === layer && artifact.concept.head === head);
  if (!applied.length || applied.some(artifact => artifact.availability !== 'available' || !artifact.values?.every(value => value === 0)))
    throw new Error('Head-ablation receipt lacks observed zeroed head output');
}

/** Disposable matched arms: same exact state and input, one declared head zeroed. */
export async function runHeadAblation(snapshot: ArchivedSnapshot, inputIds: readonly number[], targetIds: readonly number[], selection: HeadAblation,
  tag: ExperimentTag = { sessionId: 'ablation', generationId: 0, runId: 'ablation' }): Promise<HeadAblationExperiment> {
  const source = immutableCopy(snapshot); const input = [...inputIds]; const targets = [...targetIds]; const head = immutableCopy(selection);
  if (await snapshotId(source.state) !== source.id) throw new Error('Ablation source snapshot hash mismatch');
  if (input.length !== targets.length || targets.some(id => !Number.isInteger(id) || id < 0 || id > source.state.config.bosTokenId)) throw new Error('Invalid ablation targets');
  if (!Number.isInteger(head.layer) || !Number.isInteger(head.head) || head.layer < 0 || head.head < 0 ||
      head.layer >= source.state.config.nLayer || head.head >= source.state.config.nHead) throw new Error('Head ablation must select a valid layer and head');
  const declaration = { kind: 'head_ablation', layer: head.layer, head: head.head, boundary: HEAD_OUTPUT_BOUNDARY, replacement: 0 } as const;
  const baseline = restoreTraining(source.state); const intervention = restoreTraining(source.state);
  const before = new TraceRecorder(experimentManifest({ ...tag, runId: `${tag.runId}:baseline` }, source, input, targets));
  const after = new TraceRecorder(experimentManifest({ ...tag, runId: `${tag.runId}:intervention` }, source, input, targets, declaration));
  predict(baseline.model, input, before);
  predict(intervention.model, input, after, head);
  const baselineRun = before.finish(); const interventionRun = after.finish();
  return immutableCopy({
    id: tag.runId, recipe: HEAD_ABLATION_RECIPE, startingSnapshotId: source.id,
    source: { modelDefinitionId: baselineRun.manifest.model.id, modelDefinitionVersion: baselineRun.manifest.model.version,
      checkpointId: source.id, snapshotId: source.id },
    inputs: { baseline: { input, targets }, intervention: { input, targets } },
    arms: { baseline: { runId: baselineRun.manifest.runId, status: 'succeeded' }, intervention: { runId: interventionRun.manifest.runId, status: 'succeeded' } },
    declaration, receipt: { status: 'applied', recipe: HEAD_ABLATION_RECIPE, sourceCheckpointId: source.id,
      baselineRunId: baselineRun.manifest.runId, interventionRunId: interventionRun.manifest.runId,
      target: { layer: head.layer, head: head.head, boundary: HEAD_OUTPUT_BOUNDARY, scope: 'all positions' }, effectiveReplacement: 0 },
    lifecycle: { status: 'succeeded', sessionId: tag.sessionId, generationId: tag.generationId },
    selection: head, boundary: HEAD_OUTPUT_BOUNDARY, provenance: 'observed', baselineRun, interventionRun,
    comparison: compareMatchedInterventionArms(baselineRun, interventionRun, declaration),
  });
}

export const headAblationRecipe: InterventionRecipeContribution = {
  identity: HEAD_ABLATION_RECIPE,
  comparisonPolicy: 'matched-intervention',
  writablePoints: [HEAD_OUTPUT_BOUNDARY],
  presentation: { title: 'Head ablation', sourceLabel: 'MicroGPT head output' },
  execute: async request => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Invalid head-ablation execution request');
    const typed = request as HeadAblationExecutionRequest;
    return runHeadAblation(typed.snapshot, typed.inputIds, typed.targetIds, typed.selection, typed.tag);
  },
  validateReceipt: validateHeadAblationReceipt,
};
