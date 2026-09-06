import type { ConceptRef, Provenance } from '../trace/types.js';

/** Plain worker boundary data. A scalar edge represents an operand occurrence.
 * Node IDs are internal addresses within one run and exact runtime revision,
 * never portable semantic identities. Historical navigation requires verification. */
export interface ParameterRef { index: number; name: string; row: number; column: number }
export interface ScalarNode {
  id: number; operation: string; value: number; gradient?: number;
  parameter?: ParameterRef; constant?: string; exponent?: number;
}
export interface ScalarEdge {
  id: number; child: number; parent: number; inputIndex: number;
  localDerivative: number; childAdjoint?: number; contribution?: number;
}
export interface StructuralEvent {
  operation: string; description: string; values: readonly number[];
  concept?: ConceptRef; nodeIds?: readonly number[];
}
export interface ScalarGraph {
  roots: readonly number[]; nodes: readonly ScalarNode[]; edges: readonly ScalarEdge[];
  structural: readonly StructuralEvent[];
  /** Included in whole capture so archived semantic elements retain their observed identity. */
  semanticRoots?: readonly { artifactId: string; nodeIds: readonly number[] }[];
}
export interface InspectionVerification {
  sourceArtifactId: string; observedValues: readonly number[]; recomputedValues: readonly number[];
  maxAbsoluteError: number; maxRelativeError: number; tolerancePolicy: string; verified: boolean;
}
export type InspectionTarget = { kind: 'artifact'; artifactId: string; index: number } |
  { kind: 'gradient'; parameterIndex: number } | { kind: 'node'; nodeId: number } | { kind: 'whole' };
export interface InspectionResult {
  sourceRunId: string; provenance: Provenance;
  availability: 'available' | 'not_captured' | 'unsupported';
  graph: ScalarGraph | null; verification?: InspectionVerification; reason?: string;
}
