import { modelDefinitions, type VariantPointMapping } from '../model/definitions.js';
import { canonicalIdentity, type ArtifactComparison, type RunComparison } from '../trace/compare.js';
import { immutableCopy, type Artifact, type RecordedRun } from '../trace/types.js';
import type { VariantInitializationRecord } from './variant-initialization.js';

export interface MatchedVariantArtifactComparison extends ArtifactComparison {
  readonly mapping: VariantPointMapping;
}

export interface MatchedVariantComparison extends Omit<RunComparison, 'artifacts'> {
  readonly policy: { readonly id: 'matched-variant'; readonly version: 1 };
  readonly basis: {
    readonly sourceState: 'explicit registered checkpoint initialization mapping';
    readonly execution: 'same input, targets, numeric policy, and runtime';
    readonly controlledDifference: 'registered model-definition replacement only';
  };
  readonly sourceDefinition: { readonly id: string; readonly version: string };
  readonly targetDefinition: { readonly id: string; readonly version: string };
  readonly initializationId: string | null;
  readonly artifacts: readonly MatchedVariantArtifactComparison[];
  readonly variantOnly: readonly { readonly mapping: VariantPointMapping; readonly artifacts: readonly Artifact[] }[];
}

/** Cross-definition comparison is admitted only through the target definition's
 * registered relationship and explicit semantic-point correspondence.
 */
export function compareMatchedVariantRuns(baseline: RecordedRun, variant: RecordedRun): MatchedVariantComparison {
  const target = modelDefinitions.require(variant.manifest.model);
  const reasons: string[] = [];
  if (!target.base || !target.comparison || !target.initialization) reasons.push('target is not a registered model variant');
  const sourceDefinition = target.base ?? baseline.manifest.model;
  if (canonicalIdentity({ id: baseline.manifest.model.id, version: baseline.manifest.model.version }) !== canonicalIdentity(sourceDefinition)) reasons.push('source model definition differs');
  if (canonicalIdentity({ id: variant.manifest.model.id, version: variant.manifest.model.version }) !== canonicalIdentity(target.identity)) reasons.push('target model definition differs');
  for (const key of ['input', 'targets', 'numeric', 'runtimeVersion', 'runtimeRevision'] as const) {
    if (canonicalIdentity(baseline.manifest[key]) !== canonicalIdentity(variant.manifest[key])) reasons.push(`${key} differs`);
  }
  const initialization = variant.manifest.modelInitialization as unknown as (VariantInitializationRecord & { readonly currentVariantStateId?: string }) | undefined;
  if (!initialization || initialization.formatVersion !== 1) reasons.push('variant initialization record is missing');
  else {
    if (canonicalIdentity(initialization.sourceDefinition) !== canonicalIdentity(sourceDefinition) ||
        canonicalIdentity(initialization.targetDefinition) !== canonicalIdentity(target.identity)) reasons.push('initialization definition mapping differs');
    if (initialization.sourceCheckpointId !== baseline.manifest.startingCheckpointId ||
        initialization.sourceSnapshotId !== baseline.manifest.startingSnapshotId) reasons.push('base checkpoint or snapshot mapping differs');
    if (initialization.id !== variant.manifest.startingCheckpointId && initialization.currentVariantStateId !== variant.manifest.startingCheckpointId)
      reasons.push('variant checkpoint does not identify the mapped initialization or declared same-variant state');
    if (initialization.mapping.id !== target.initialization?.id || initialization.mapping.version !== target.initialization?.version ||
        initialization.checkpointUse !== 'parameter-initialization-only' || initialization.exactTrainingResume !== false)
      reasons.push('initialization policy differs');
  }
  const artifacts: MatchedVariantArtifactComparison[] = [];
  const variantOnly: { mapping: VariantPointMapping; artifacts: Artifact[] }[] = [];
  if (!reasons.length) {
    const pending = new Map<string, Artifact[]>();
    for (const artifact of variant.artifacts) {
      const key = canonicalIdentity(artifact.concept);
      const queue = pending.get(key) ?? []; queue.push(artifact); pending.set(key, queue);
    }
    for (const mapping of target.comparison!.pointMappings) {
      if (mapping.relationship === 'variant-only') {
        const internals = variant.artifacts.filter(artifact => artifact.kind === mapping.targetKind);
        if (!internals.length) reasons.push(`Variant-only point absent: ${mapping.targetKind}`);
        else variantOnly.push({ mapping, artifacts: internals });
        continue;
      }
      for (const first of baseline.artifacts.filter(artifact => artifact.kind === mapping.sourceKind)) {
        const targetConcept = { ...first.concept, kind: mapping.targetKind };
        const second = pending.get(canonicalIdentity(targetConcept))?.shift() ?? null;
        let reason: string | null = null;
        if (!second) reason = 'Mapped artifact absent from variant run';
        else if (first.availability !== 'available' || second.availability !== 'available') reason = `Evidence unavailable: ${first.availability} / ${second.availability}`;
        else if (canonicalIdentity([first.shape, first.axes, first.dtype]) !== canonicalIdentity([second.shape, second.axes, second.dtype]))
          reason = 'Mapped artifact shape, semantic axes, or dtype differs';
        const deltas = reason === null && first.values && second?.values ? second.values.map((value, index) => value - first.values![index]!) : null;
        artifacts.push({ before: first, after: second, deltas, reason, mapping });
      }
    }
  }
  return immutableCopy({
    policy: { id: 'matched-variant' as const, version: 1 as const },
    basis: { sourceState: 'explicit registered checkpoint initialization mapping' as const,
      execution: 'same input, targets, numeric policy, and runtime' as const,
      controlledDifference: 'registered model-definition replacement only' as const },
    sourceDefinition, targetDefinition: target.identity, initializationId: initialization?.id ?? null,
    compatible: reasons.length === 0 && artifacts.every(artifact => artifact.reason === null), reasons,
    artifacts: reasons.length ? [] : artifacts, variantOnly: reasons.length ? [] : variantOnly,
  });
}
