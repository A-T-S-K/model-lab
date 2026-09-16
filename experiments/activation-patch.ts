import fixture from '../fixtures/canonical.initial.json';
import { snapshotId, type ArchivedSnapshot } from '../archive/snapshot.js';
import {
  HEAD_OUTPUT_BOUNDARY,
  HEAD_OUTPUT_COORDINATE_SPACE,
  predict,
  type HeadActivationPatch,
} from '../model/microgpt.js';
import { restoreTraining } from '../model/state.js';
import { canonicalIdentity, compareMatchedInterventionArms } from '../trace/compare.js';
import { TraceRecorder } from '../trace/recorder.js';
import { immutableCopy, type Artifact, type JsonValue, type RecordedRun } from '../trace/types.js';
import { experimentManifest, type ExperimentTag } from './common.js';
import type { InterventionExperiment, InterventionReceipt, InterventionRecipeContribution, InterventionValidationContext } from './intervention.js';

export const ACTIVATION_PATCH_RECIPE = { id: 'microgpt.donor-activation-patch', version: 1 } as const;

export interface HeadOutputOccurrence {
  readonly runId: string;
  readonly modelDefinitionId: string;
  readonly modelDefinitionVersion: string;
  readonly checkpointId: string;
  readonly snapshotId: string;
  readonly invocation: number;
  readonly token: number;
  readonly layer: number;
  readonly head: number;
  readonly boundary: string;
  readonly coordinateSpace: {
    readonly id: string;
    readonly axes: readonly string[];
    readonly shape: readonly number[];
    readonly dtype: string;
  };
}

export interface ActivationPatchDeclaration {
  readonly kind: 'donor_activation_patch';
  readonly recipe: typeof ACTIVATION_PATCH_RECIPE;
  readonly donor: HeadOutputOccurrence;
  readonly target: HeadOutputOccurrence;
  readonly gradient: 'detached';
}

export interface ActivationPatchReceipt extends InterventionReceipt {
  readonly status: 'applied';
  readonly recipe: typeof ACTIVATION_PATCH_RECIPE;
  readonly sourceCheckpointId: string;
  readonly donorRunId: string;
  readonly baselineRunId: string;
  readonly interventionRunId: string;
  readonly donor: HeadOutputOccurrence;
  readonly baselineTarget: HeadOutputOccurrence;
  readonly target: HeadOutputOccurrence;
  readonly donorVector: readonly number[];
  readonly originalTargetVector: readonly number[];
  readonly effectiveReplacement: readonly number[];
  readonly noOp: boolean;
}

export interface ActivationPatchExperiment extends InterventionExperiment {
  readonly recipe: typeof ACTIVATION_PATCH_RECIPE;
  readonly declaration: JsonValue & ActivationPatchDeclaration;
  readonly receipt: ActivationPatchReceipt;
  readonly donorRun: RecordedRun;
}

export interface ActivationPatchExecutionRequest {
  readonly snapshot: ArchivedSnapshot;
  readonly donorInputIds: readonly number[];
  readonly donorTargetIds: readonly number[];
  readonly targetInputIds: readonly number[];
  readonly targetTargetIds: readonly number[];
  readonly donor: HeadOutputOccurrence;
  readonly target: HeadOutputOccurrence;
  readonly tag?: ExperimentTag;
}

export function isActivationPatchExperiment(experiment: InterventionExperiment): experiment is ActivationPatchExperiment {
  return experiment.recipe.id === ACTIVATION_PATCH_RECIPE.id && experiment.recipe.version === ACTIVATION_PATCH_RECIPE.version;
}

export function headOutputOccurrence(snapshot: ArchivedSnapshot, runId: string, token: number, layer: number, head: number): HeadOutputOccurrence {
  return immutableCopy({
    runId, modelDefinitionId: 'microgpt', modelDefinitionVersion: fixture.reference.revision,
    checkpointId: snapshot.id, snapshotId: snapshot.id, invocation: 0, token, layer, head,
    boundary: HEAD_OUTPUT_BOUNDARY,
    coordinateSpace: { id: HEAD_OUTPUT_COORDINATE_SPACE, axes: ['feature'],
      shape: [snapshot.state.config.nEmbd / snapshot.state.config.nHead], dtype: 'float64' },
  });
}

function validateTargets(input: readonly number[], targets: readonly number[], snapshot: ArchivedSnapshot, label: string): void {
  if (!input.length || input.length !== targets.length || input.length > snapshot.state.config.blockSize ||
      input.some(id => !Number.isInteger(id) || id < 0 || id > snapshot.state.config.bosTokenId) ||
      targets.some(id => !Number.isInteger(id) || id < 0 || id > snapshot.state.config.bosTokenId))
    throw new Error(`Invalid activation-patch ${label} input or targets`);
}

function preflightOccurrence(point: HeadOutputOccurrence, snapshot: ArchivedSnapshot, runId: string, inputLength: number, role: string): void {
  const expected = headOutputOccurrence(snapshot, runId, point.token, point.layer, point.head);
  if (point.runId !== runId) throw new Error(`${role} run identity is stale or incompatible`);
  if (point.invocation !== 0) throw new Error(`${role} invocation is stale or unsupported`);
  if (point.boundary !== HEAD_OUTPUT_BOUNDARY) throw new Error(`${role} boundary is not a registered writable point`);
  if (point.coordinateSpace.id !== HEAD_OUTPUT_COORDINATE_SPACE || canonicalIdentity(point.coordinateSpace.axes) !== canonicalIdentity(['feature']) ||
      canonicalIdentity(point.coordinateSpace.shape) !== canonicalIdentity(expected.coordinateSpace.shape) || point.coordinateSpace.dtype !== 'float64')
    throw new Error(`${role} coordinate basis is incompatible; shape equality alone is insufficient`);
  if (point.modelDefinitionId !== expected.modelDefinitionId || point.modelDefinitionVersion !== expected.modelDefinitionVersion ||
      point.checkpointId !== snapshot.id || point.snapshotId !== snapshot.id)
    throw new Error(`${role} model or checkpoint identity is incompatible`);
  if (!Number.isInteger(point.token) || point.token < 0 || point.token >= inputLength ||
      !Number.isInteger(point.layer) || point.layer < 0 || point.layer >= snapshot.state.config.nLayer ||
      !Number.isInteger(point.head) || point.head < 0 || point.head >= snapshot.state.config.nHead)
    throw new Error(`${role} selects an invalid token, layer, or head`);
}

function occurrenceArtifact(run: RecordedRun, point: HeadOutputOccurrence): Artifact & { readonly values: readonly number[] } {
  const matches = run.artifacts.filter(artifact => artifact.kind === 'headOutput' && artifact.concept.token === point.token &&
    artifact.concept.layer === point.layer && artifact.concept.head === point.head);
  if (matches.length !== 1 || matches[0]!.availability !== 'available' || !matches[0]!.values)
    throw new Error('Activation-patch occurrence does not resolve to one retained observed vector');
  return matches[0] as Artifact & { readonly values: readonly number[] };
}

function validateActivationPatchReceipt(experiment: InterventionExperiment, context: InterventionValidationContext): void {
  const candidate = experiment as ActivationPatchExperiment;
  const declaration = candidate.declaration;
  if (declaration?.kind !== 'donor_activation_patch' || canonicalIdentity(declaration.recipe) !== canonicalIdentity(ACTIVATION_PATCH_RECIPE) ||
      declaration.gradient !== 'detached' || !candidate.donorRun) throw new Error('Invalid activation-patch declaration');
  preflightOccurrence(declaration.donor, context.snapshot, candidate.donorRun.manifest.runId,
    Array.isArray(candidate.donorRun.manifest.input) ? candidate.donorRun.manifest.input.length : -1, 'Donor');
  preflightOccurrence(declaration.target, context.snapshot, candidate.interventionRun.manifest.runId,
    Array.isArray(candidate.interventionRun.manifest.input) ? candidate.interventionRun.manifest.input.length : -1, 'Target');
  const donor = occurrenceArtifact(candidate.donorRun, declaration.donor);
  const patched = occurrenceArtifact(candidate.interventionRun, declaration.target);
  const baselineTargetPoint = { ...declaration.target, runId: candidate.baselineRun.manifest.runId };
  const original = occurrenceArtifact(candidate.baselineRun, baselineTargetPoint);
  const beforePatch = candidate.interventionRun.artifacts.find(artifact => artifact.kind === 'headOutputBeforePatch' &&
    artifact.concept.token === declaration.target.token && artifact.concept.layer === declaration.target.layer && artifact.concept.head === declaration.target.head);
  const expectedReceipt = {
    status: 'applied', recipe: ACTIVATION_PATCH_RECIPE, sourceCheckpointId: context.snapshot.id,
    donorRunId: candidate.donorRun.manifest.runId, baselineRunId: candidate.baselineRun.manifest.runId,
    interventionRunId: candidate.interventionRun.manifest.runId, donor: declaration.donor,
    baselineTarget: baselineTargetPoint, target: declaration.target,
    donorVector: donor.values, originalTargetVector: original.values, effectiveReplacement: donor.values,
    noOp: canonicalIdentity(donor.values) === canonicalIdentity(original.values),
  };
  if (canonicalIdentity(patched.values) !== canonicalIdentity(donor.values) ||
      canonicalIdentity(beforePatch?.values) !== canonicalIdentity(original.values) ||
      canonicalIdentity(candidate.receipt) !== canonicalIdentity(expectedReceipt))
    throw new Error('Activation-patch receipt does not match retained donor, target, and applied evidence');
}

export async function runActivationPatch(request: ActivationPatchExecutionRequest): Promise<ActivationPatchExperiment> {
  const source = immutableCopy(request.snapshot);
  const tag = request.tag ?? { sessionId: 'activation-patch', generationId: 0, runId: 'activation-patch' };
  const donorInput = [...request.donorInputIds], donorTargets = [...request.donorTargetIds];
  const targetInput = [...request.targetInputIds], targetTargets = [...request.targetTargetIds];
  if (await snapshotId(source.state) !== source.id) throw new Error('Activation-patch source snapshot hash mismatch');
  validateTargets(donorInput, donorTargets, source, 'donor'); validateTargets(targetInput, targetTargets, source, 'target');
  const donorRunId = `${tag.runId}:donor`, baselineRunId = `${tag.runId}:baseline`, interventionRunId = `${tag.runId}:intervention`;
  preflightOccurrence(request.donor, source, donorRunId, donorInput.length, 'Donor');
  preflightOccurrence(request.target, source, interventionRunId, targetInput.length, 'Target');

  const donorRecorder = new TraceRecorder(experimentManifest({ ...tag, runId: donorRunId }, source, donorInput, donorTargets));
  predict(restoreTraining(source.state).model, donorInput, donorRecorder);
  const donorRun = donorRecorder.finish(); const donorArtifact = occurrenceArtifact(donorRun, request.donor);

  const baselineRecorder = new TraceRecorder(experimentManifest({ ...tag, runId: baselineRunId }, source, targetInput, targetTargets));
  predict(restoreTraining(source.state).model, targetInput, baselineRecorder);
  const baselineRun = baselineRecorder.finish();
  const baselineTargetPoint = { ...request.target, runId: baselineRunId };
  const originalTarget = occurrenceArtifact(baselineRun, baselineTargetPoint);

  const declaration: ActivationPatchDeclaration = { kind: 'donor_activation_patch', recipe: ACTIVATION_PATCH_RECIPE,
    donor: request.donor, target: request.target, gradient: 'detached' };
  const interventionRecorder = new TraceRecorder(experimentManifest({ ...tag, runId: interventionRunId }, source, targetInput, targetTargets, declaration as unknown as JsonValue));
  const patch: HeadActivationPatch = { kind: 'activation_patch', target: {
    invocation: 0, token: request.target.token, layer: request.target.layer, head: request.target.head,
    boundary: HEAD_OUTPUT_BOUNDARY, coordinateSpace: { id: HEAD_OUTPUT_COORDINATE_SPACE, axes: ['feature'],
      shape: [source.state.config.nEmbd / source.state.config.nHead], dtype: 'float64' },
  }, replacement: donorArtifact.values! };
  predict(restoreTraining(source.state).model, targetInput, interventionRecorder, patch);
  const interventionRun = interventionRecorder.finish();
  const patched = occurrenceArtifact(interventionRun, request.target);
  if (canonicalIdentity(patched.values) !== canonicalIdentity(donorArtifact.values)) throw new Error('Activation patch did not apply donor evidence exactly');
  if (await snapshotId(source.state) !== source.id) throw new Error('Activation patch mutated its source snapshot');
  const receipt: ActivationPatchReceipt = {
    status: 'applied', recipe: ACTIVATION_PATCH_RECIPE, sourceCheckpointId: source.id,
    donorRunId, baselineRunId, interventionRunId, donor: request.donor, baselineTarget: baselineTargetPoint, target: request.target,
    donorVector: donorArtifact.values, originalTargetVector: originalTarget.values, effectiveReplacement: donorArtifact.values,
    noOp: canonicalIdentity(donorArtifact.values) === canonicalIdentity(originalTarget.values),
  };
  return immutableCopy({
    id: tag.runId, recipe: ACTIVATION_PATCH_RECIPE, startingSnapshotId: source.id,
    source: { modelDefinitionId: donorRun.manifest.model.id, modelDefinitionVersion: donorRun.manifest.model.version,
      checkpointId: source.id, snapshotId: source.id },
    inputs: { donor: { input: donorInput, targets: donorTargets }, baseline: { input: targetInput, targets: targetTargets },
      intervention: { input: targetInput, targets: targetTargets } },
    arms: { donor: { runId: donorRunId, status: 'succeeded' }, baseline: { runId: baselineRunId, status: 'succeeded' },
      intervention: { runId: interventionRunId, status: 'succeeded' } },
    declaration: declaration as unknown as JsonValue & ActivationPatchDeclaration, receipt,
    comparison: compareMatchedInterventionArms(baselineRun, interventionRun, declaration),
    lifecycle: { status: 'succeeded', sessionId: tag.sessionId, generationId: tag.generationId },
    donorRun, baselineRun, interventionRun,
  });
}

export const activationPatchRecipe: InterventionRecipeContribution = {
  identity: ACTIVATION_PATCH_RECIPE,
  comparisonPolicy: 'matched-intervention',
  writablePoints: [HEAD_OUTPUT_BOUNDARY],
  presentation: { title: 'Donor activation patch', sourceLabel: 'Observed donor head output' },
  execute: async request => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Invalid activation-patch execution request');
    return runActivationPatch(request as ActivationPatchExecutionRequest);
  },
  validateReceipt: validateActivationPatchReceipt,
};
