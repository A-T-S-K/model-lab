/** Generic semantic identity is independent of labels and screen coordinates. */
export type SemanticCoordinate = string | number;
/** Selection shared by every world. Integrations own the coordinate vocabulary. */
export interface WorldSelection {
  node: string;
  port: string;
  phase: string;
  coordinates: Record<string, SemanticCoordinate>;
}
export interface SemanticAddress {
  modelDefinition: string;
  node: string;
  port: string;
  run: string;
  invocation: string;
  phase: string;
  coordinates: Readonly<Record<string, SemanticCoordinate>>;
}
export type RelationshipKind = "activation" | "parameter" | "saved_residual" | "control_state" |
  "target" | "objective" | "gradient" | "parameter_state" | "optimizer_update" |
  "structural" | "coordinate_mapping" | "evidence_boundary";
export interface SemanticRelationship {
  from: SemanticAddress;
  to: SemanticAddress;
  port: string;
  kind: RelationshipKind;
  origin?: "observed" | "derived";
}
export interface WorldNode {
  id: string;
  operation: string;
  port: string;
  coordinates: Readonly<Record<string, SemanticCoordinate>>;
  parameter?: string;
  invocation?: string;
  phase?: string;
}
export interface WorldDescriptor {
  integration: string;
  modelDefinition: string;
  label: string;
  nodes: readonly WorldNode[];
  /** Opaque registered presentation identity; generic topology never enumerates it. */
  presentation: string;
}

export interface SemanticWorld {
  descriptor: WorldDescriptor;
  run: string;
  nodes: readonly SemanticAddress[];
  relationships: readonly SemanticRelationship[];
  capabilities: readonly string[];
}
export interface RegisteredWorldPresentation {
  id: string;
  viewport: {x:number;y:number;width:number;height:number};
  render(state:{status:string;error:string;replay:boolean}):string;
  bind(changed:()=>void,render:()=>void):void;
}
export interface RegisteredWorldModel {
  presentation: RegisteredWorldPresentation;
  world: SemanticWorld;
  source: {sourceRunId:string;relationship:string};
  valid: boolean;
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
  return descriptor.nodes.map(node => ({modelDefinition:descriptor.modelDefinition,node:node.id,port:node.port,run,
    invocation:node.invocation??invocation,phase:node.phase??phase,coordinates:node.coordinates}));
}
