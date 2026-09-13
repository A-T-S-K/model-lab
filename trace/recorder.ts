import { immutableCopy, type Artifact, type CaptureLevel, type Observation, type RecordedRun, type RunManifest } from './types.js';

const levels: Record<CaptureLevel, number> = { summary: 0, semantic: 1, scalar: 2 };

function defaultLevel(kind: string): CaptureLevel {
  return /^(logits|probabilities|loss|meanLoss|gradient|adam|parameter)/.test(kind) ? 'summary' : 'semantic';
}

function defaultAxes(kind: string, dimensions: number): string[] {
  if (dimensions === 0) return [];
  if (dimensions === 1) {
    if (/^attention(Logits|Probabilities)$/.test(kind)) return ['key_position'];
    if (/^(logits|probabilities)$/.test(kind)) return ['vocabulary'];
    return ['feature'];
  }
  return Array.from({ length: dimensions }, (_, index) => `dimension_${index}`);
}

export class TraceRecorder {
  readonly manifest: RunManifest;
  private artifacts: Artifact[] = [];
  private storedValues = 0;
  private droppedArtifacts = 0;
  private budgetExceeded = false;
  private finished: RecordedRun | undefined;

  constructor(manifest: RunManifest) {
    for (const budget of [manifest.capture.maxArtifacts, manifest.capture.maxValues]) {
      if (!Number.isSafeInteger(budget) || budget < 0) throw new RangeError('Capture budgets must be nonnegative safe integers');
    }
    if (!(manifest.capture.level in levels)) throw new TypeError('Unknown capture level');
    this.manifest = immutableCopy(manifest);
  }

  /** Copies numeric values immediately, retaining no runtime values or parent nodes. */
  observe(event: Observation): void {
    if (this.finished) throw new Error('Cannot append to a finished run');
    if (this.artifacts.length >= this.manifest.capture.maxArtifacts) {
      this.droppedArtifacts++;
      this.budgetExceeded = true;
      return;
    }
    const level = event.captureLevel ?? defaultLevel(event.kind);
    if (!(level in levels)) throw new TypeError('Unknown capture level');
    if (!event.shape.every(size => Number.isSafeInteger(size) && size >= 0)) throw new RangeError('Invalid shape');
    const shapeSize = event.shape.reduce((size, dimension) => size * dimension, 1);
    const axes = event.axes ?? defaultAxes(event.kind, event.shape.length);
    if (axes.length !== event.shape.length) throw new RangeError('One semantic axis is required per shape dimension');
    let availability = event.availability ?? 'available';
    if (availability === 'available' && levels[level] > levels[this.manifest.capture.level]) availability = 'not_captured';
    if (availability === 'available' && shapeSize !== event.values.length) throw new RangeError('Shape does not match value count');
    if (availability === 'available' && !event.values.every(value => typeof value === 'number' && Number.isFinite(value))) {
      throw new TypeError('Captured values must be finite numbers, not runtime nodes');
    }
    if (availability === 'available' && this.storedValues + event.values.length > this.manifest.capture.maxValues) {
      availability = 'budget_exceeded';
      this.budgetExceeded = true;
    }
    const concept = {
      kind: event.kind,
      ...(event.layer === undefined ? {} : { layer: event.layer }),
      ...(event.head === undefined ? {} : { head: event.head }),
      ...(event.token === undefined ? {} : { token: event.token }),
      ...(event.feature === undefined ? {} : { feature: event.feature }),
    };
    const values = availability === 'available' ? Array.from(event.values) : null;
    this.storedValues += values?.length ?? 0;
    this.artifacts.push(immutableCopy({
      id: `${this.manifest.runId}:${this.artifacts.length}`,
      concept, kind: event.kind, shape: Array.from(event.shape), axes: Array.from(axes),
      dtype: this.manifest.numeric.dtype, values,
      provenance: event.provenance ?? 'observed', availability, captureLevel: level,
    }));
  }

  /** Immutable newly produced artifacts only; never finalize or retain partial frames. */
  delta(from: number): { artifacts: readonly Artifact[]; capture: RecordedRun['capture'] } {
    return { artifacts: this.artifacts.slice(from), capture: {
      storedValues: this.storedValues, droppedArtifacts: this.droppedArtifacts, budgetExceeded: this.budgetExceeded,
    } };
  }

  finish(): RecordedRun {
    this.finished ??= immutableCopy({
      formatVersion: 1 as const, manifest: this.manifest, artifacts: this.artifacts,
      capture: { storedValues: this.storedValues, droppedArtifacts: this.droppedArtifacts, budgetExceeded: this.budgetExceeded },
    });
    return this.finished;
  }
}
