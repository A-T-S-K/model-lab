import type { EvidencePoint } from "../../trace/evidence.js";

export interface AvailabilityPresentation {
  readonly label: string;
  readonly numerical: boolean;
  readonly explanation: string;
}
const presentations: Readonly<Record<string, AvailabilityPresentation>> = Object.freeze({
  available: Object.freeze({ label: "AVAILABLE", numerical: true, explanation: "Authentic retained numerical evidence is available through bounded reads." }),
  not_captured: Object.freeze({ label: "NOT CAPTURED", numerical: false, explanation: "This evidence was not saved for this occurrence; no value is substituted and inspection does not reexecute it." }),
  not_applicable: Object.freeze({ label: "NOT APPLICABLE", numerical: false, explanation: "This coordinate or computation does not exist for this occurrence; no value is substituted." }),
  unsupported: Object.freeze({ label: "UNSUPPORTED", numerical: false, explanation: "This backend or representation does not support the requested evidence; no value is substituted." }),
  budget_exceeded: Object.freeze({ label: "BUDGET EXCEEDED", numerical: false, explanation: "Capture was requested, but the qualified capture budget prevented retention. No numerical values were retained and zero is not substituted. Structural and source metadata remain inspectable; opening this point does not reexecute it." }),
  shape_only: Object.freeze({ label: "SHAPE ONLY", numerical: false, explanation: "Only structural shape, axes, roles, source binding and known topology are retained. This is not numerical execution." }),
  opaque: Object.freeze({ label: "OPAQUE", numerical: false, explanation: "The boundary and qualified relationships are known, but internal numerical semantics are deliberately unavailable." }),
});

export function availabilityPresentation(point: Pick<EvidencePoint, "availability">): AvailabilityPresentation {
  return presentations[point.availability] ?? Object.freeze({
    label: point.availability.replaceAll("_", " ").toUpperCase(),
    numerical: false,
    explanation: "Numerical evidence is unavailable; no value is substituted.",
  });
}
