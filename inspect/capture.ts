import type { Observation, Observer, StructuralObservation } from '../model/microgpt.js';
import type { Model } from '../model/state.js';
import type { Value } from '../model/value.js';
import { TraceRecorder } from '../trace/recorder.js';
import { immutableCopy } from '../trace/types.js';
import type { InspectionResult, InspectionTarget, ParameterRef, ScalarEdge, ScalarGraph, ScalarNode, StructuralEvent } from './types.js';

/** Owned by one execution worker. Only inspect() results may cross its boundary.
 * Numeric forward snapshots are taken when first observed, so later Adam mutation
 * cannot change either previously requested or as-yet unrequested evidence.
 */
export class CaptureContext implements Observer {
  private readonly parameterRefs = new WeakMap<Value, ParameterRef>();
  private readonly ids = new WeakMap<Value, number>();
  private readonly live: Value[] = [];
  private readonly nodes: ScalarNode[] = [];
  private readonly edges: ScalarEdge[] = [];
  private readonly parentEdges = new Map<number, ScalarEdge[]>();
  private readonly consumerEdges = new Map<number, ScalarEdge[]>();
  private readonly parameterIds = new Map<number, number>();
  private readonly artifactRoots = new Map<string, number[]>();
  private readonly events: StructuralEvent[] = [];
  private observationCount = 0;
  private pendingArtifactId: string | undefined;
  private backwardRoot: number | undefined;

  constructor(model: Model, private readonly recorder: TraceRecorder) {
    let index = 0;
    for (const name of model.parameterOrder) {
      model.parameters[name].forEach((rowValues, row) => rowValues.forEach((value, column) => {
        this.parameterRefs.set(value, Object.freeze({ index, name, row, column }));
        this.parameterIds.set(index++, this.register(value));
      }));
    }
  }

  observe(event: Observation): void {
    this.recorder.observe(event);
    this.pendingArtifactId = this.observationCount < this.recorder.manifest.capture.maxArtifacts
      ? `${this.recorder.manifest.runId}:${this.observationCount}` : undefined;
    this.observationCount++;
  }

  roots(_event: Observation, values: readonly Value[]): void {
    if (this.pendingArtifactId !== undefined) {
      this.artifactRoots.set(this.pendingArtifactId, values.map(value => this.register(value)));
    }
    this.pendingArtifactId = undefined;
  }

  structural(event: StructuralObservation, values: readonly Value[]): void {
    this.events.push(immutableCopy({ ...event, nodeIds: values.map(value => this.register(value)) }));
  }

  /** Freeze real adjoints and edge contributions before Adam reads and clears them. */
  captureBackward(loss: Value): void {
    if (this.backwardRoot !== undefined) throw new Error('Backward evidence is already frozen');
    this.backwardRoot = this.register(loss);
    this.events.push(immutableCopy({ operation: 'backward_seed', description: 'Backward seeds dLoss/dLoss = 1 before accumulating the chain rule.',
      values: [loss.grad], nodeIds: [this.backwardRoot] }));
    for (let id = 0; id < this.nodes.length; id++) {
      this.nodes[id] = Object.freeze({ ...this.nodes[id], gradient: this.live[id].grad });
    }
    for (let index = 0; index < this.edges.length; index++) {
      const edge = this.edges[index];
      const childAdjoint = this.nodes[edge.child].gradient!;
      this.edges[index] = Object.freeze({ ...edge, childAdjoint, contribution: childAdjoint * edge.localDerivative });
    }
    // Adjacency stores edge identities; refresh it to the frozen backward versions.
    this.parentEdges.clear(); this.consumerEdges.clear();
    for (const edge of this.edges) this.indexEdge(edge);
    const parameterRoots = [...this.parameterIds.values()];
    this.observe({ kind: 'gradient', values: parameterRoots.map(id => this.nodes[id].gradient!),
      shape: [parameterRoots.length], axes: ['parameter'], captureLevel: 'summary' });
    if (this.pendingArtifactId !== undefined) this.artifactRoots.set(this.pendingArtifactId, parameterRoots);
    this.pendingArtifactId = undefined;
    this.live.length = 0;
  }

  nodeId(value: Value): number | undefined { return this.ids.get(value); }

  inspect(target: InspectionTarget): InspectionResult {
    const unavailable = (reason: string): InspectionResult => immutableCopy({
      sourceRunId: this.recorder.manifest.runId, provenance: 'observed', availability: 'not_captured', graph: null, reason,
    });
    let roots: number[];
    if (target.kind === 'whole') {
      roots = this.backwardRoot === undefined ? [...new Set([...this.artifactRoots.values()].flat())] : [this.backwardRoot];
      return this.result({ roots, nodes: this.nodes, edges: this.edges, structural: this.events,
        semanticRoots: [...this.artifactRoots].map(([artifactId, nodeIds]) => ({ artifactId, nodeIds })) });
    }
    if (target.kind === 'artifact') {
      const root = Number.isInteger(target.index) && target.index >= 0 ? this.artifactRoots.get(target.artifactId)?.[target.index] : undefined;
      if (root === undefined) return unavailable('No captured scalar root exists for that artifact element.');
      roots = [root];
    } else if (target.kind === 'gradient') {
      if (this.backwardRoot === undefined) return unavailable('This execution has no captured backward pass.');
      const root = this.parameterIds.get(target.parameterIndex);
      if (root === undefined) return unavailable('Parameter index does not exist in this model.');
      roots = [root];
    } else {
      if (!Number.isInteger(target.nodeId) || !this.nodes[target.nodeId]) return unavailable('Scalar node does not belong to this execution.');
      roots = [target.nodeId];
    }
    // One recursive navigation step: operands explain forward values; consumers
    // explain every incoming adjoint contribution, including repeated operands.
    const edges = [...(this.parentEdges.get(roots[0]) ?? []), ...(this.consumerEdges.get(roots[0]) ?? [])];
    const included = new Set([...roots, ...edges.flatMap(edge => [edge.child, edge.parent])]);
    return this.result({ roots, nodes: [...included].map(id => this.nodes[id]), edges,
      structural: this.events.filter(event => event.nodeIds?.some(id => roots.includes(id))) });
  }

  private result(graph: ScalarGraph): InspectionResult {
    return immutableCopy({ sourceRunId: this.recorder.manifest.runId, provenance: 'observed', availability: 'available', graph });
  }

  private register(root: Value): number {
    const existing = this.ids.get(root);
    if (existing !== undefined) return existing;
    if (this.backwardRoot !== undefined) throw new Error('Cannot append to frozen backward evidence');
    // Iterative traversal also handles deep scalar chains without stack overflow.
    const pending: Value[] = [root];
    const added: Value[] = [];
    while (pending.length) {
      const value = pending.pop()!;
      if (this.ids.has(value)) continue;
      const id = this.nodes.length;
      this.ids.set(value, id);
      this.live[id] = value;
      const parameter = this.parameterRefs.get(value);
      this.nodes.push(Object.freeze({ id, operation: value.operation, value: value.data,
        ...(parameter ? { parameter } : {}),
        ...(value.detail.constant ? { constant: value.detail.constant } : {}),
        ...(value.detail.exponent === undefined ? {} : { exponent: value.detail.exponent }),
      }));
      added.push(value);
      for (let index = value.parents.length - 1; index >= 0; index--) pending.push(value.parents[index]);
    }
    for (const value of added) value.parents.forEach((parent, inputIndex) => {
      const edge = Object.freeze({ id: this.edges.length, child: this.ids.get(value)!, parent: this.ids.get(parent)!,
        inputIndex, localDerivative: value.localDerivatives[inputIndex] });
      this.edges.push(edge); this.indexEdge(edge);
    });
    return this.ids.get(root)!;
  }

  private indexEdge(edge: ScalarEdge): void {
    const parents = this.parentEdges.get(edge.child) ?? [];
    parents.push(edge); this.parentEdges.set(edge.child, parents);
    const consumers = this.consumerEdges.get(edge.parent) ?? [];
    consumers.push(edge); this.consumerEdges.set(edge.parent, consumers);
  }
}
