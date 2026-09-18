# ABQ facilitator guide

**Foundation prerequisite:** full unfamiliar-user testing, timed workshop rehearsal,
actual-station and release qualification follow independent M5 foundation acceptance
at M6. See the [status ledger](foundation-status.md) and [authority map](README.md).
These current MicroGPT/ABQ instructions are retained for that gate and for authorized
internal engineering/visual/accessibility review; old rehearsal passes do not waive it.
Human results remain unrun/pending. This document grants no execution permission.

“This is one very small real transformer. We can inspect its calculations and test how changes affect it.” Its three-character vocabulary demonstrates mechanisms, not useful language understanding or the scale of a pretrained language model.

## Progressive disclosure and profile design

Model Lab provides a progressive disclosure hierarchy tailored for walk-up discovery:
- **Walk-up visitor**: Clean presentation omitting engineering clutter (shared inspector, classic toggle, archive export/import, research variants, raw execution stepping, and diagnostic buttons). Primary actions are sequential: **Continue: [Landmark]** (`#short-continue`) for the 5-stop route, and **Teach: step through learning** (`#short-teach`) at stop 5.
- **Detours and free exploration**: Visitors can click **Explore freely** (`#visitor-explore-toggle`) to reveal semantic dropdowns or click world nodes directly. When on a detour, **Resume short route** (`#short-resume`) cleanly brings the visitor back to their current short route stop.
- **Facilitator mode**: Clicking **Show operator controls** (`#operator-controls`) opens the facilitator panel. This gives the facilitator direct landmark buttons (Sample abca and stops 0–4), the authoritative retention capacity readout, and the idle reset opt-out toggle.

## Short encounter · pacing target 60–90 seconds

Start at the recorded idle model. Name it as recorded, then click **Start · explore a real prediction**.
Follow the 5-stop Short teaching route using the primary **Continue** button:
1. **Stop 1 · Prediction**: Position q3 has read prefix `abc` and compares its prediction with known target `a`. Show the named top token and distribution.
2. **Stop 2 · Q/K scores**: Both vector lengths and alignment affect the score. Read one signed product, the reduction and scale factor.
3. **Stop 3 · Softmax**: Softmax uses every causal score in the shared denominator.
4. **Stop 4 · Value mixture**: Combines all matching value vectors; fitted affine geometry belongs to this source only.
5. **Stop 5 · Residual**: Distinguishes channel concatenation, WO projection and addition of the saved input.

Invite an earlier-key choice or MLP detour. Home/Back preserve the model. **Resume short route** explicitly restores the guide landmark and its saved semantic selection. Exact tables and source remain under **Values / arithmetic / source**. Do not interpret high attention alone as a complete causal explanation.

## Deeper encounter · pacing target 3–5 minutes

Before starting a deep teaching session, click **Show operator controls → Disable idle reset · facilitated session**. This disables the 300-second idle timer, allowing uninterrupted facilitation. Crucially, **this opt-out persists across Public Reset**, so walking through multiple reset-and-repeat cycles does not re-enable the timer unexpectedly.

From Stop 5 (Residual), click **Teach: step through learning** (`#short-teach`). Name accepted state versus provisional work before starting.
1. Click **Run to next gradient contribution** (`#execution-pin`). The necessary live phases run and pause at a genuine partial accumulator. Show contribution + previous accumulator = next partial gradient. This is one pinned parameter's slice of the objective across all target positions.
2. Click **Continue** (`#execution-continue`) to run through remaining backward nodes and optimizer proposals to reach **Candidate ready — not accepted**.
3. Compare Current vs. Candidate outputs. Ask the visitor to choose **Accept update** (`#execution-accept`) or **Discard candidate** (`#execution-cancel`) explicitly; a lower training loss does not establish generalization. After accepting, show the updated forward evidence. If discarded, the candidate is cleanly released without modifying the accepted model.

Select **Weighted values**, choose a head, then **Test without this head**. The experiment zeroes its aggregated output at all positions before concatenation, leaving the accepted model untrained. Show matching upstream evidence and downstream changes (including valid no-change cases). Do not call this an attack success. **Return to current model** restores the accepted evidence.

Optional detour: choose **ReLU** and find an actually negative pre-activation component in the current run. Show its index and zero output. Do not manufacture a value or change input just to imply the desired result.

These are pacing targets and an expert script, not measured human completion or learning outcomes. Use the six-task form in `morning-checklist.md` before claiming walk-up discovery or teaching acceptance.
