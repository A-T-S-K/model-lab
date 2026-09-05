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

/** Checkpoints may differ: fixed-input before/after training is a supported comparison. */
export function compareRuns(before: RecordedRun, after: RecordedRun): RunComparison {
  const reasons: string[] = [];
  for (const key of ['model', 'input', 'targets', 'numeric', 'runtimeVersion'] as const) {
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
