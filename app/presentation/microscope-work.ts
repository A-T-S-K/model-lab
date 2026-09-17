import type { ScalarGraph, ScalarNode } from "../../inspect/types.js";
import { PRESENTATION_WORK, presentationWindow } from "./work-contract.js";

export interface MicroscopeWindowOffsets {
  readonly operands?: number;
  readonly consumers?: number;
  readonly structural?: number;
}
export function microscopePresentationWindows(
  graph: ScalarGraph,
  node: ScalarNode,
  offsets: MicroscopeWindowOffsets = {},
) {
  const operands = graph.edges.filter((edge) => edge.child === node.id).sort((a, b) => a.inputIndex - b.inputIndex);
  const consumers = graph.edges.filter((edge) => edge.parent === node.id);
  return Object.freeze({
    operands: presentationWindow(operands, offsets.operands ?? 0, PRESENTATION_WORK.scalarOperands),
    consumers: presentationWindow(consumers, offsets.consumers ?? 0, PRESENTATION_WORK.scalarEdges),
    structural: presentationWindow(graph.structural, offsets.structural ?? 0, PRESENTATION_WORK.structuralEvents),
  });
}
