# ABQ facilitator guide

**Foundation prerequisite:** full unfamiliar-user testing, timed workshop rehearsal,
actual-station and release qualification follow independent M5 foundation acceptance
at M6. See the [status ledger](foundation-status.md) and [authority map](README.md).
These current MicroGPT/ABQ instructions are retained for that gate and for authorized
internal engineering/visual/accessibility review; old rehearsal passes do not waive it.
Human results remain unrun/pending. This document grants no execution permission.

“This is one very small real transformer. We can inspect its calculations and test how changes affect it.” Its three-character vocabulary demonstrates mechanisms, not useful language understanding or the scale of a pretrained language model.

## Short encounter · pacing target 60–90 seconds

Start at the recorded idle model. Name it as recorded, then click **Start · explore a real prediction**. Click **Sample abca · q3 / h0 / k0**. Position q3 has read prefix `abc` and compares its prediction with known target `a`. The final position instead targets END; input START/output END share a boundary ID. This is teacher-forced next-token prediction, not generated continuation.

Show the named top token and distribution. Probabilities are this model's normalized outputs, not universal confidence. The bars in the map are actual values; the matrices below are stored parameters.

Use **Q/K scores**. Both vector lengths and alignment affect the score. Read one signed product, the reduction and scale factor. **Softmax** uses every causal score in the shared denominator. **Value mixture** combines all matching value vectors; its fitted affine geometry belongs to this source only. **Residual** distinguishes channel concatenation, WO projection and addition of the saved input.

Invite an earlier-key choice or MLP detour. Home/Back preserve the model. **Resume short route** explicitly restores the guide landmark and its saved semantic selection. Exact tables and source remain under **Values / arithmetic / source**. Do not interpret high attention alone as a complete causal explanation.

## Deeper encounter · pacing target 3–5 minutes

Name accepted state versus provisional work before starting. Click **Step through learning**, then **Run to next gradient contribution** before backward. The necessary live phases run and stop at a genuine partial accumulator without timing a Pause click. Show contribution + previous accumulator = next partial gradient. This is one pinned parameter's slice of the objective across all target positions.

**Continue** reaches **Candidate ready — not accepted**. Compare Current/Candidate outputs. Ask the visitor to choose **Accept update** or **Discard candidate** explicitly; a lower training loss does not establish generalization. After accepting, show the updated forward evidence. If facilitating, disable idle expiry through **Show operator controls** first.

Select **Weighted values**, choose a head, then **Test without this head**. The experiment zeroes its aggregated output at all positions before concatenation, leaving the accepted model untrained. Show matching upstream evidence and downstream changes (including valid no-change cases). Do not call this an attack success. **Return to current model** restores the accepted evidence.

Optional detour: choose **ReLU** and find an actually negative pre-activation component in the current run. Show its index and zero output. Do not manufacture a value or change input just to imply the desired result.

These are pacing targets and an expert script, not measured human completion or learning outcomes. Use the six-task form in `morning-checklist.md` before claiming walk-up discovery or teaching acceptance.
