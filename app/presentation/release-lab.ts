import type { ArchivedSnapshot } from '../../archive/session.js';
import type { RecordedRun } from '../../trace/types.js';
import { canonicalIdentity } from '../../trace/compare.js';
import fixture from '../../fixtures/canonical.initial.json';
export type LabRecipe = 'input' | 'head' | 'update';
export interface LabBaseline { readonly runId: string; readonly snapshotId: string; readonly sessionId: string; readonly generationId: number; readonly document: string; readonly position: number; }

export function labDraftRefusal(recipe: LabRecipe, document: string, changed: string, position: number): string | undefined {
  if (!/^[abc]{3,7}$/.test(document)) return 'Use 3–7 characters from a, b and c; this lesson needs the p3 occurrence.';
  if (!Number.isInteger(position) || position<0 || position>document.length) return 'Selected prediction position is unavailable.';
  if (recipe==='update' && position!==3) return 'One-update teaching requires the supported p3 occurrence.';
  if (recipe==='input') {
    if (!/^[abc]{3,7}$/.test(changed) || changed.length!==document.length) return 'Change exactly one character, keeping the same length and supported a, b, c vocabulary.';
    const differences=[...document].filter((c,i)=>c!==changed[i]).length;
    if (differences!==1) return 'Change exactly one character.';
    if ([...document].findIndex((c,i)=>c!==changed[i])+1>position) return 'Choose a changed character within the selected effective prefix.';
  }
}
export function labBaselineRefusal(baseline: LabBaseline | undefined, run: RecordedRun | undefined, snapshot: ArchivedSnapshot | undefined,
  accepted: ArchivedSnapshot | undefined, runtime: string): string | undefined {
  if (!baseline || !run || !snapshot || !accepted) return 'Prepare a fresh baseline explicitly from the current accepted state.';
  if (baseline.snapshotId!==accepted.id || run.manifest.startingSnapshotId!==snapshot.id || snapshot.id!==baseline.snapshotId ||
    baseline.runId!==run.manifest.runId || baseline.sessionId!==run.manifest.sessionId || baseline.generationId!==run.manifest.generationId)
    return 'Baseline is stale or belongs to another state/session. Prepare a fresh baseline.';
  if (run.manifest.runtimeRevision!==runtime || run.manifest.model.id!=='microgpt' || run.manifest.model.version!==fixture.reference.revision ||
    canonicalIdentity(snapshot.state.config)!==canonicalIdentity(fixture.config) ||
    canonicalIdentity(run.manifest.model.architecture)!==canonicalIdentity(snapshot.state.config) || run.manifest.startingCheckpointId!==snapshot.id ||
    !Array.isArray(run.manifest.input) || run.manifest.input.slice(1).map(id=>fixture.config.vocabulary[Number(id)]??'').join('')!==baseline.document ||
    !run.artifacts.some(a=>a.kind==='probabilities'&&a.concept.token===baseline.position&&a.availability==='available') || run.manifest.intervention || run.manifest.modelInitialization)
    return 'This selected model/state has no qualified Lab recipe. Select a supported canonical computation explicitly.';
  return undefined;
}
