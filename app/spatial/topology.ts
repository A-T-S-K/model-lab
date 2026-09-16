/** Generic semantic identity is independent of labels and screen coordinates. */
export type SemanticCoordinate = string | number;
export interface SemanticAddress {
  modelDefinition: string;
  node: string;
  port: string;
  run: string;
  invocation: string;
  phase: string;
  coordinates: Readonly<Record<string, SemanticCoordinate>>;
}
export type RelationshipKind = "activation" | "parameter" | "saved_residual" | "control_state";
export interface SemanticRelationship {
  from: SemanticAddress;
  to: SemanticAddress;
  port: string;
  kind: RelationshipKind;
}
export interface WorldNode {
  id: string;
  operation: string;
  port: string;
  coordinates: Readonly<Record<string, SemanticCoordinate>>;
  parameter?: string;
}
export interface WorldDescriptor {
  integration: string;
  modelDefinition: string;
  label: string;
  nodes: readonly WorldNode[];
  layout: "microgpt-canonical-curated" | "microgpt-repeated-blocks";
}

const ordered = (value: Readonly<Record<string, SemanticCoordinate>>) =>
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
export function semanticAddressId(address: SemanticAddress): string {
  return JSON.stringify({
    modelDefinition: address.modelDefinition,
    node: address.node,
    port: address.port,
    run: address.run,
    invocation: address.invocation,
    phase: address.phase,
    coordinates: ordered(address.coordinates),
  });
}

/** Composition joins descriptor structure to one run; it never executes a model. */
export function composeWorld(descriptor: WorldDescriptor, run: string, invocation: string, phase: string): readonly SemanticAddress[] {
  return descriptor.nodes.map(node => ({modelDefinition:descriptor.modelDefinition,node:node.id,port:node.port,run,invocation,phase,coordinates:node.coordinates}));
}
