import test from "node:test";
import assert from "node:assert/strict";
import {
  experienceCapabilities,
  resolveExperienceProfile,
} from "../../app/presentation/experience-profile.js";

test("resolveExperienceProfile maps entry parameters and disclosure state", () => {
  assert.equal(
    resolveExperienceProfile({ isKiosk: true, isFacilitatorOpen: false }),
    "visitor",
  );
  assert.equal(
    resolveExperienceProfile({ isKiosk: true, isFacilitatorOpen: true }),
    "facilitator",
  );
  assert.equal(
    resolveExperienceProfile({ isKiosk: true, isFacilitator: true }),
    "facilitator",
  );
  assert.equal(
    resolveExperienceProfile({ isKiosk: true, isFacilitator: false }),
    "visitor",
  );
  assert.equal(
    resolveExperienceProfile({ isKiosk: true, isFacilitator: false, isFacilitatorOpen: true }),
    "visitor",
  );
  assert.equal(
    resolveExperienceProfile({ isKiosk: false, isFacilitatorOpen: false }),
    "workbench",
  );
  assert.equal(
    resolveExperienceProfile({ isKiosk: false, isFacilitatorOpen: true }),
    "workbench",
  );
  assert.equal(
    resolveExperienceProfile({ isKiosk: false, isFacilitator: true }),
    "workbench",
  );
});

test("visitor capabilities enforce safety and low-clutter disclosure", () => {
  const visitor = experienceCapabilities("visitor", false);
  assert.equal(visitor.eventSafety, true, "event safety must be active");
  assert.equal(visitor.researchVariants, false, "research controls must be false");
  assert.equal(visitor.portableArchive, false, "portable archive must be false");
  assert.equal(visitor.sharedInspector, false, "shared inspector must be false");
  assert.equal(visitor.classicToggle, false, "classic presentation must be false");
  assert.equal(visitor.executionDiagnostics, false, "raw diagnostics must be false");
  assert.equal(visitor.defaultSemanticSelectors, false, "default semantic selectors must be false before explore");
  assert.equal(visitor.teachingSelectors, false, "teaching selectors must be false before explore");
  assert.equal(visitor.headAblation, true, "head ablation is available in visitor");
  assert.equal(visitor.donorPatch, false, "donor patch is workbench-only");
  assert.equal(visitor.configurableIdleReset, false, "visitor cannot configure idle reset");
});

test("visitor exploring freely reveals semantic navigation without enabling teaching selectors or research", () => {
  const exploring = experienceCapabilities("visitor", true);
  assert.equal(exploring.eventSafety, true, "event safety remains active");
  assert.equal(exploring.defaultSemanticSelectors, true, "semantic selectors become available");
  assert.equal(exploring.teachingSelectors, false, "teaching selectors must remain false during free explore");
  assert.equal(exploring.headAblation, true, "head ablation remains available");

  // Research and workbench affordances MUST stay false
  assert.equal(exploring.researchVariants, false, "research variants remain false");
  assert.equal(exploring.portableArchive, false, "portable archive remains false");
  assert.equal(exploring.sharedInspector, false, "shared inspector remains false");
  assert.equal(exploring.classicToggle, false, "classic presentation remains false");
  assert.equal(exploring.donorPatch, false, "donor patch remains false");
  assert.equal(exploring.executionDiagnostics, false, "raw diagnostics remain false");
});

test("facilitator capabilities preserve event safety, enable teaching, and block research", () => {
  const facilitator = experienceCapabilities("facilitator");
  assert.equal(facilitator.eventSafety, true, "event safety remains active");
  assert.equal(facilitator.defaultSemanticSelectors, true, "semantic selectors available");
  assert.equal(facilitator.teachingSelectors, true, "teaching selectors available");
  assert.equal(facilitator.configurableIdleReset, true, "idle reset independently configurable");
  assert.equal(facilitator.headAblation, true, "head ablation available");

  // Research / workbench controls must remain false
  assert.equal(facilitator.researchVariants, false, "research variants must be false");
  assert.equal(facilitator.portableArchive, false, "portable archive must be false");
  assert.equal(facilitator.sharedInspector, false, "shared inspector must be false");
  assert.equal(facilitator.classicToggle, false, "classic presentation must be false");
  assert.equal(facilitator.donorPatch, false, "donor patch must be false");
  assert.equal(facilitator.executionDiagnostics, false, "execution diagnostics must be false");
});

test("workbench capabilities preserve expert development and research affordances", () => {
  const workbench = experienceCapabilities("workbench");
  assert.equal(workbench.eventSafety, false, "workbench does not block navigation/import");
  assert.equal(workbench.researchVariants, true, "research variants enabled");
  assert.equal(workbench.portableArchive, true, "portable archive enabled");
  assert.equal(workbench.sharedInspector, true, "shared inspector enabled");
  assert.equal(workbench.classicToggle, true, "classic presentation toggle enabled");
  assert.equal(workbench.executionDiagnostics, true, "execution diagnostics enabled");
  assert.equal(workbench.defaultSemanticSelectors, true, "semantic selectors enabled");
  assert.equal(workbench.teachingSelectors, true, "teaching selectors enabled");
  assert.equal(workbench.headAblation, true, "head ablation enabled");
  assert.equal(workbench.donorPatch, true, "donor patch enabled");
  assert.equal(workbench.configurableIdleReset, true, "idle reset configuration enabled");
});
