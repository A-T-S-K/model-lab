import { compareRuns, type RunComparison } from './compare.js';
import { immutableCopy, type Artifact, type Availability, type ConceptRef, type RecordedRun } from './types.js';

function matchesConcept(actual: ConceptRef, selected: ConceptRef): boolean {
  return Object.entries(selected).every(([key, value]) => {
    if (key === 'binding') return actual.binding?.system === selected.binding?.system && actual.binding?.address === selected.binding?.address;
    return actual[key as keyof ConceptRef] === value;
  });
}

export interface ScalarDetail {
  readonly runId: string;
  readonly concept: ConceptRef;
  readonly availability: Availability;
  readonly artifacts: readonly Artifact[];
}

/** Replay reads saved evidence only. Reexecution belongs to the caller's runtime. */
export class TracePlayer {
  private run: RecordedRun;
  private position = -1;

  constructor(run: RecordedRun) {
    this.run = this.load(run);
  }

  load(run: RecordedRun): RecordedRun {
    if (run.formatVersion !== 1) throw new Error('Unsupported recorded run version');
    const ids = new Set<string>();
    for (const artifact of run.artifacts) {
      if (ids.has(artifact.id)) throw new Error('Duplicate artifact id');
      ids.add(artifact.id);
      if (artifact.shape.length !== artifact.axes.length) throw new Error('Artifact axes do not match shape');
      if (!artifact.shape.every(size => Number.isSafeInteger(size) && size >= 0)) throw new Error('Invalid artifact shape');
      if (artifact.availability === 'available') {
        if (artifact.values === null || artifact.shape.reduce((size, dimension) => size * dimension, 1) !== artifact.values.length || !artifact.values.every(Number.isFinite)) {
          throw new Error('Available artifact must contain valid numeric evidence');
        }
      } else if (artifact.values !== null) throw new Error('Unavailable artifact must have null values');
    }
    this.position = -1;
    this.run = immutableCopy(run);
    return this.run;
  }

  get recordedRun(): RecordedRun { return this.run; }
  get index(): number { return this.position; }
  get current(): Artifact | null { return this.run.artifacts[this.position] ?? null; }

  step(delta = 1): Artifact | null {
    if (!Number.isSafeInteger(delta)) throw new RangeError('Step must be an integer');
    if (this.run.artifacts.length === 0) return null;
    this.position = Math.max(0, Math.min(this.run.artifacts.length - 1, this.position + delta));
    return this.current;
  }

  seek(index: number): Artifact {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.run.artifacts.length) throw new RangeError('Seek position is outside the recording');
    this.position = index;
    return this.run.artifacts[index]!;
  }

  selectConcept(concept: ConceptRef): readonly Artifact[] {
    return Object.freeze(this.run.artifacts.filter(artifact => matchesConcept(artifact.concept, concept)));
  }

  getArtifact(id: string): Artifact | null {
    return this.run.artifacts.find(artifact => artifact.id === id) ?? null;
  }

  requestScalarDetail(concept: ConceptRef): ScalarDetail {
    const artifacts = this.selectConcept(concept).filter(artifact => artifact.captureLevel === 'scalar');
    const availability = artifacts.some(artifact => artifact.availability === 'available') ? 'available'
      : artifacts[0]?.availability ?? (this.run.capture.budgetExceeded ? 'budget_exceeded' : 'not_captured');
    return immutableCopy({ runId: this.run.manifest.runId, concept, availability, artifacts });
  }

  /** Resolve an explicit request with separately derived/reexecuted evidence.
   * This never changes the saved recording or invokes the model. The caller labels
   * provenance; observed artifacts from the original run are read via request above.
   */
  resolveScalarDetail(request: ScalarDetail, artifacts: readonly Artifact[]): ScalarDetail {
    if (request.runId !== this.run.manifest.runId) throw new Error('Scalar detail belongs to another run');
    if (artifacts.some(artifact => !matchesConcept(artifact.concept, request.concept) || artifact.captureLevel !== 'scalar' || artifact.provenance === 'observed')) {
      throw new Error('Resolved detail must match the requested concept and be derived or recomputed');
    }
    if (artifacts.length > this.run.manifest.capture.maxArtifacts || artifacts.reduce((sum, artifact) => sum + (artifact.values?.length ?? 0), 0) > this.run.manifest.capture.maxValues) {
      return immutableCopy({ ...request, availability: 'budget_exceeded', artifacts: [] });
    }
    // Reuse the recorded-evidence validator; no live runtime is needed here.
    const validated = new TracePlayer({ ...this.run, artifacts }).recordedRun.artifacts;
    const availability = validated.some(artifact => artifact.availability === 'available') ? 'available' : validated[0]?.availability ?? 'not_captured';
    return immutableCopy({ ...request, availability, artifacts: validated });
  }

  compare(other: RecordedRun | TracePlayer): RunComparison {
    return compareRuns(this.run, other instanceof TracePlayer ? other.recordedRun : other);
  }
}
