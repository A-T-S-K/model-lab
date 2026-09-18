export type ExperienceProfile = "visitor" | "facilitator" | "workbench";

export interface ExperienceCapabilities {
  readonly profile: ExperienceProfile;
  readonly eventSafety: boolean;
  readonly researchVariants: boolean;
  readonly portableArchive: boolean;
  readonly sharedInspector: boolean;
  readonly classicToggle: boolean;
  readonly executionDiagnostics: boolean;
  readonly defaultSemanticSelectors: boolean;
  readonly teachingSelectors: boolean;
  readonly headAblation: boolean;
  readonly donorPatch: boolean;
  readonly configurableIdleReset: boolean;
}

export function experienceCapabilities(
  profile: ExperienceProfile,
  exploringFreely = false,
): ExperienceCapabilities {
  switch (profile) {
    case "visitor":
      return {
        profile,
        eventSafety: true,
        researchVariants: false,
        portableArchive: false,
        sharedInspector: false,
        classicToggle: false,
        executionDiagnostics: false,
        defaultSemanticSelectors: exploringFreely,
        teachingSelectors: exploringFreely,
        headAblation: true,
        donorPatch: false,
        configurableIdleReset: false,
      };
    case "facilitator":
      return {
        profile,
        eventSafety: true,
        researchVariants: false,
        portableArchive: false,
        sharedInspector: false,
        classicToggle: false,
        executionDiagnostics: false,
        defaultSemanticSelectors: true,
        teachingSelectors: true,
        headAblation: true,
        donorPatch: false,
        configurableIdleReset: true,
      };
    case "workbench":
      return {
        profile,
        eventSafety: false,
        researchVariants: true,
        portableArchive: true,
        sharedInspector: true,
        classicToggle: true,
        executionDiagnostics: true,
        defaultSemanticSelectors: true,
        teachingSelectors: true,
        headAblation: true,
        donorPatch: true,
        configurableIdleReset: true,
      };
  }
}

export function resolveExperienceProfile(options: {
  isKiosk: boolean;
  isFacilitatorOpen?: boolean;
}): ExperienceProfile {
  if (!options.isKiosk) return "workbench";
  return options.isFacilitatorOpen ? "facilitator" : "visitor";
}
