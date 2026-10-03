import { canonicalIdentity } from '../../trace/compare.js';
import { immutableCopy, type RecordedRun } from '../../trace/types.js';

/** Derived view of retained canonical character predictions. Never aligns internal tensors. */
export function compareInputConditionedOutputs(before: RecordedRun, after: RecordedRun, beforePosition: number, afterPosition: number) {
  const reasons: string[] = [];
  for (const key of ['model','startingCheckpointId','startingSnapshotId','numeric','runtimeVersion','runtimeRevision','sessionId','generationId'] as const) {
    if (canonicalIdentity(before.manifest[key]) !== canonicalIdentity(after.manifest[key])) reasons.push(`${key} differs`);
  }
  if (before.manifest.runId===after.manifest.runId) reasons.push('Distinct retained run identities required');
  const architecture = before.manifest.model.architecture;
  const vocabulary = architecture.vocabulary;
  if (before.manifest.model.id !== 'microgpt' || !Array.isArray(vocabulary) || !vocabulary.length ||
    vocabulary.some(v => typeof v !== 'string') || new Set(vocabulary).size !== vocabulary.length ||
    architecture.bosTokenId !== vocabulary.length || !before.manifest.startingSnapshotId ||
    before.manifest.startingCheckpointId !== before.manifest.startingSnapshotId) reasons.push('Unsupported tokenizer/output space or complete starting state');
  if (before.manifest.intervention || after.manifest.intervention || before.manifest.modelInitialization || after.manifest.modelInitialization)
    reasons.push('Only original same-definition predictions support input alignment');
  const width = Array.isArray(vocabulary) ? vocabulary.length + 1 : 0;
  const rows = [before,after].map((run, arm) => {
    const position = arm === 0 ? beforePosition : afterPosition;
    const input = run.manifest.input, targets = run.manifest.targets;
    if (!Array.isArray(input) || !Array.isArray(targets) || input.length !== targets.length || !input.length ||
      input.length > Number(architecture.blockSize) || input[0] !== architecture.bosTokenId || targets.at(-1) !== architecture.bosTokenId ||
      input.slice(1).some((v,i) => !Number.isInteger(v) || Number(v)<0 || Number(v)>=width-1 || targets[i]!==v) ||
      !Number.isInteger(position) || position < 0 || position >= input.length) reasons.push(`${arm ? 'Changed' : 'Baseline'} input transform/occurrence unavailable`);
    const candidates = run.artifacts.filter(a => a.kind==='probabilities' && a.concept.kind==='probabilities' && a.concept.token===position);
    const artifact = candidates.length===1 ? candidates[0] : undefined;
    if (!artifact || artifact.availability!=='available' || artifact.provenance!=='observed' || artifact.dtype!=='float64' ||
      canonicalIdentity(artifact.shape)!==canonicalIdentity([width]) || canonicalIdentity(artifact.axes)!==canonicalIdentity(['vocabulary']) ||
      artifact.values?.length!==width || artifact.values.some(v=>!Number.isFinite(v)||v<0||v>1)) reasons.push(`${arm ? 'Changed' : 'Baseline'} complete output support unavailable`);
    return artifact;
  });
  const compatible = reasons.length===0;
  return immutableCopy({policy:{id:'input-conditioned-output',version:1}, provenance:'derived', compatible, reasons,
    alignment:'canonical character lookup plus shared START/END output index; no internal alignment',
    inputs:[before.manifest.input,after.manifest.input], targets:[before.manifest.targets,after.manifest.targets],
    occurrences:[{runId:before.manifest.runId,position:beforePosition,artifactId:rows[0]?.id},{runId:after.manifest.runId,position:afterPosition,artifactId:rows[1]?.id}],
    rows:compatible ? Array.from({length:width},(_,index)=>({index,label:index===width-1?'END':String((vocabulary as readonly string[])[index]),before:rows[0]!.values![index]!,after:rows[1]!.values![index]!,delta:rows[1]!.values![index]!-rows[0]!.values![index]!})) : [],
    limitations:'Different inputs and targets are declared. These probabilities are conditional outputs, not a matched training-objective improvement. Internal evidence remains separately identified.'});
}
