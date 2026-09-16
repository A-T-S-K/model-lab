import { immutableCopy, type Artifact, type RecordedRun } from './types.js';

/** Object key ordering is not part of model/input identity. */
export function canonicalIdentity(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalIdentity).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalIdentity(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

export interface ArtifactComparison {
  readonly before: Artifact | null;
  readonly after: Artifact | null;
  readonly deltas: readonly number[] | null;
  readonly reason: string | null;
}

export interface RunComparison {
  readonly compatible: boolean;
  readonly reasons: readonly string[];
  readonly artifacts: readonly ArtifactComparison[];
}

export interface MatchedInterventionComparison extends RunComparison {
  readonly policy: {
    readonly id: 'matched-intervention';
    readonly version: 1;
  };
  readonly basis: {
    readonly sourceState: 'exact starting checkpoint and snapshot';
    readonly execution: 'exact model, input, targets, numeric policy, and runtime';
    readonly controlledDifference: 'declared intervention only';
  };
}

/** Checkpoints may differ: fixed-input before/after training is a supported comparison. */
export function compareRuns(before: RecordedRun, after: RecordedRun): RunComparison {
  const reasons: string[] = [];
  for (const key of ['model', 'input', 'targets', 'numeric', 'runtimeVersion', 'runtimeRevision'] as const) {
    if (canonicalIdentity(before.manifest[key]) !== canonicalIdentity(after.manifest[key])) reasons.push(`${key} differs`);
  }
  if (reasons.length) return immutableCopy({ compatible: false, reasons, artifacts: [] });

  // A kind can occur repeatedly (for example two forwards in a training run).
  // Match each occurrence once rather than silently overwriting evidence in a map.
  const pending = new Map<string, Artifact[]>();
  for (const artifact of after.artifacts) {
    const key = canonicalIdentity(artifact.concept);
    const queue = pending.get(key) ?? [];
    queue.push(artifact);
    pending.set(key, queue);
  }
  const artifacts: ArtifactComparison[] = [];
  for (const first of before.artifacts) {
    const second = pending.get(canonicalIdentity(first.concept))?.shift() ?? null;
    let reason: string | null = null;
    if (!second) reason = 'Artifact absent from after run';
    else if (first.availability !== 'available' || second.availability !== 'available') reason = `Evidence unavailable: ${first.availability} / ${second.availability}`;
    else if (canonicalIdentity([first.shape, first.axes, first.dtype, first.kind]) !== canonicalIdentity([second.shape, second.axes, second.dtype, second.kind])) reason = 'Artifact shape, semantic axes, dtype, or kind differs';
    const deltas = reason === null && first.values && second?.values ? second.values.map((value, index) => value - first.values![index]!) : null;
    artifacts.push({ before: first, after: second, deltas, reason });
  }
  for (const queue of pending.values()) {
    for (const artifact of queue) artifacts.push({ before: null, after: artifact, deltas: null, reason: 'Artifact absent from before run' });
  }
  return immutableCopy({ compatible: true, reasons, artifacts });
}

/**
 * Purpose-specific comparison for disposable baseline/intervention arms.
 * `compareRuns` remains the strict artifact comparison primitive; this policy
 * additionally requires the same immutable source state and exactly one declared
 * intervention difference.
 */
export function compareMatchedInterventionArms(
  baseline: RecordedRun,
  intervention: RecordedRun,
  declaration: unknown,
): MatchedInterventionComparison {
  const strict = compareRuns(baseline, intervention);
  const reasons = [...strict.reasons];
  if (baseline.manifest.startingCheckpointId !== intervention.manifest.startingCheckpointId)
    reasons.push('starting checkpoint differs');
  if (baseline.manifest.startingSnapshotId !== intervention.manifest.startingSnapshotId)
    reasons.push('starting snapshot differs');
  if (baseline.manifest.intervention !== undefined)
    reasons.push('baseline declares an intervention');
  if (canonicalIdentity(intervention.manifest.intervention) !== canonicalIdentity(declaration))
    reasons.push('intervention declaration differs');
  return immutableCopy({
    policy: { id: 'matched-intervention' as const, version: 1 as const },
    basis: {
      sourceState: 'exact starting checkpoint and snapshot' as const,
      execution: 'exact model, input, targets, numeric policy, and runtime' as const,
      controlledDifference: 'declared intervention only' as const,
    },
    compatible: strict.compatible && reasons.length === 0,
    reasons,
    artifacts: strict.compatible && reasons.length === 0 ? strict.artifacts : [],
  });
}
