import { snapshotId, type ArchivedSnapshot } from '../archive/snapshot.js';
import { CaptureContext } from '../inspect/capture.js';
import {
  CANONICAL_MICROGPT_DEFINITION,
  COMPOSITE_MLP_MICROGPT_DEFINITION,
  compositeMlpMicrogptDefinition,
  type ModelDefinitionIdentity,
} from '../model/definitions.js';
import { predict, predictForDefinition } from '../model/microgpt.js';
import { parameterData, restoreTraining } from '../model/state.js';
import { trainCompositeVariantStep, type ParameterUpdate } from '../model/training.js';
import { canonicalIdentity } from '../trace/compare.js';
import { TraceRecorder } from '../trace/recorder.js';
import { immutableCopy, type Artifact, type JsonValue, type RecordedRun, type RunManifest } from '../trace/types.js';
import { experimentManifest, type ExperimentTag } from './common.js';
import {
  archiveCompositeVariantState,
  compositeVariantStateId,
  initializeCompositeVariant,
  restoreCompositeVariantState,
  snapshotCompositeVariantState,
  variantParameterData,
  VARIANT_NUMERIC_POLICY,
  type ArchivedCompositeVariantState,
  type CompositeVariantInitializationRecord,
  validateCompositeVariantState,
} from './composite-variant-state.js';
import { compareMatchedVariantRuns, type MatchedVariantComparison } from './variant-comparison.js';

export const COMPOSITE_VARIANT_EXPERIMENT_IDENTITY = { id: 'microgpt.composite-parameterized-variant', version: 1 } as const;

export interface CompositeVariantExperiment {
  readonly id: string;
  readonly identity: typeof COMPOSITE_VARIANT_EXPERIMENT_IDENTITY;
  readonly source: { readonly modelDefinition: ModelDefinitionIdentity; readonly checkpointId: string; readonly snapshotId: string };
  readonly targetDefinition: ModelDefinitionIdentity;
  readonly initialization: CompositeVariantInitializationRecord;
  readonly initialState: ArchivedCompositeVariantState;
  readonly trainedState: ArchivedCompositeVariantState;
  readonly declaration: {
    readonly equation: 'W x + s B(Ax)'; readonly bottleneckWidth: number; readonly scale: number;
    readonly inheritedParameters: 'frozen'; readonly trainableParameterOrder: readonly string[];
  };
  readonly baselineRun: RecordedRun;
  readonly initializedRun: RecordedRun;
  readonly trainedRun: RecordedRun;
  readonly initializationComparison: MatchedVariantComparison;
  readonly trainedComparison: MatchedVariantComparison;
  readonly witness: {
    readonly token: number; readonly layer: number; readonly output: number; readonly bottleneck: number;
    readonly initialization: { readonly adapterExactlyZero: true; readonly compositeExactlyBase: true; readonly downstreamExactlyCanonical: true };
    readonly arithmetic: {
      readonly activation: readonly number[]; readonly aRow: readonly number[]; readonly aProducts: readonly number[]; readonly ax: number;
      readonly bRow: readonly number[]; readonly bProducts: readonly number[]; readonly bax: number;
      readonly scale: number; readonly scaledAdapter: number; readonly base: number; readonly composite: number;
    };
    readonly backward: { readonly compositeOutputAdjoint: number; readonly firstStepAGradientExactlyZero: true;
      readonly bUpdate: ParameterUpdate; readonly aUpdate: ParameterUpdate };
    readonly resume: { readonly savedStateId: string; readonly uninterruptedStateId: string; readonly resumedStateId: string;
      readonly exactStateEquality: true; readonly exactPredictionEquality: true };
    readonly trainedEffect: { readonly adapterActive: true; readonly compositeChanged: true; readonly downstreamChanged: true };
    readonly canonicalPreservation: { readonly before: string; readonly after: string; readonly byteIdentical: true };
  };
}

export interface CompositeVariantRequest {
  readonly snapshot: ArchivedSnapshot; readonly inputIds: readonly number[]; readonly targetIds: readonly number[];
  readonly targetDefinition?: ModelDefinitionIdentity; readonly sourceDefinition?: ModelDefinitionIdentity;
  readonly sourceCheckpointId?: string; readonly numericPolicy?: string; readonly tag?: ExperimentTag;
}

function observed(run: RecordedRun, kind: string, token: number, layer?: number): Artifact & { readonly values: readonly number[] } {
  const matches = run.artifacts.filter(artifact => artifact.kind === kind && artifact.concept.token === token &&
    artifact.concept.layer === layer && artifact.availability === 'available' && artifact.values);
  if (matches.length !== 1) throw new Error(`Expected one observed ${kind} occurrence`);
  return matches[0] as Artifact & { readonly values: readonly number[] };
}
function validateInput(input: readonly number[], targets: readonly number[], snapshot: ArchivedSnapshot): void {
  if (!input.length || input.length !== targets.length || input.length > snapshot.state.config.blockSize ||
      [...input, ...targets].some(id => !Number.isInteger(id) || id < 0 || id > snapshot.state.config.bosTokenId))
    throw new Error('Invalid composite-variant input or targets');
}
function variantManifest(tag: ExperimentTag, source: ArchivedSnapshot, input: readonly number[], targets: readonly number[],
  initialization: CompositeVariantInitializationRecord, startingCheckpointId: string, currentVariantStateId?: string): RunManifest {
  const base = experimentManifest(tag, source, [...input], [...targets]);
  return { ...base, model: { id: compositeMlpMicrogptDefinition.identity.id, version: compositeMlpMicrogptDefinition.identity.version,
    architecture: source.state.config as unknown as RunManifest['model']['architecture'], capabilities: compositeMlpMicrogptDefinition.capabilities },
    startingCheckpointId, modelInitialization: { ...initialization,
      ...(currentVariantStateId ? { currentVariantStateId } : {}) } as unknown as JsonValue };
}
const dotProducts = (row: readonly number[], input: readonly number[]) => row.map((weight, index) => weight * input[index]!);
const orderedSum = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0);

export async function runCompositeVariant(request: CompositeVariantRequest): Promise<CompositeVariantExperiment> {
  const source = immutableCopy(request.snapshot), input = [...request.inputIds], targets = [...request.targetIds];
  validateInput(input, targets, source);
  const sourceIdBefore = await snapshotId(source.state);
  if (sourceIdBefore !== source.id) throw new Error('Composite-variant source snapshot hash mismatch');
  const tag = request.tag ?? { sessionId: 'composite-variant', generationId: 0, runId: 'composite-variant' };
  const initialized = await initializeCompositeVariant({ source, targetDefinition: request.targetDefinition,
    sourceDefinition: request.sourceDefinition, sourceCheckpointId: request.sourceCheckpointId,
    numericPolicy: request.numericPolicy });

  const baselineRecorder = new TraceRecorder(experimentManifest({ ...tag, runId: `${tag.runId}:canonical` }, source, input, targets));
  predict(restoreTraining(source.state).model, input, baselineRecorder);
  const baselineRun = baselineRecorder.finish();

  const initialRestored = await restoreCompositeVariantState(initialized.state, source);
  const initializedRecorder = new TraceRecorder(variantManifest({ ...tag, runId: `${tag.runId}:initialized` }, source, input, targets,
    initialized.initialization, initialized.initialization.id));
  predictForDefinition(compositeMlpMicrogptDefinition, initialRestored.model, input, initializedRecorder);
  const initializedRun = initializedRecorder.finish();
  const initializationComparison = compareMatchedVariantRuns(baselineRun, initializedRun);
  if (!initializationComparison.compatible) throw new Error(`Initialized matched-variant comparison refused: ${initializationComparison.reasons.join(', ')}`);
  for (let token = 0; token < input.length; token++) for (let layer = 0; layer < source.state.config.nLayer; layer++) {
    const zero = observed(initializedRun, 'mlpAdapterScaled', token, layer).values;
    const base = observed(initializedRun, 'mlpBaseDown', token, layer).values;
    const composite = observed(initializedRun, 'mlpCompositeDown', token, layer).values;
    const canonical = observed(baselineRun, 'mlpDown', token, layer).values;
    if (!zero.every(value => Object.is(value, 0)) || canonicalIdentity(base) !== canonicalIdentity(composite) || canonicalIdentity(base) !== canonicalIdentity(canonical))
      throw new Error('Composite identity-preserving initialization proof failed');
  }
  for (const kind of ['mlpResidual','logits','probabilities']) for (let token = 0; token < input.length; token++) {
    const layer = kind === 'mlpResidual' ? source.state.config.nLayer - 1 : undefined;
    if (canonicalIdentity(observed(baselineRun, kind, token, layer).values) !== canonicalIdentity(observed(initializedRun, kind, token, layer).values))
      throw new Error('Composite initialization changed canonical downstream evidence');
  }

  const uninterrupted = await restoreCompositeVariantState(initialized.state, source);
  const frozenBefore = parameterData(uninterrupted.model);
  const first = trainCompositeVariantStep(uninterrupted.model, uninterrupted.optimizer, uninterrupted.continuation, input, targets);
  const firstState = await archiveCompositeVariantState(snapshotCompositeVariantState(uninterrupted.model, uninterrupted.optimizer,
    uninterrupted.continuation, initialized.state.state));
  const trainingRecorder = new TraceRecorder(variantManifest({ ...tag, runId: `${tag.runId}:training-step-2` }, source, input, targets,
    initialized.initialization, firstState.id, firstState.id));
  const trainingContext = new CaptureContext(uninterrupted.model, trainingRecorder);
  const second = trainCompositeVariantStep(uninterrupted.model, uninterrupted.optimizer, uninterrupted.continuation, input, targets, trainingContext);
  const trainingRun = trainingRecorder.finish();
  const uninterruptedState = await archiveCompositeVariantState(snapshotCompositeVariantState(uninterrupted.model, uninterrupted.optimizer,
    uninterrupted.continuation, initialized.state.state));
  if (canonicalIdentity(parameterData(uninterrupted.model)) !== canonicalIdentity(frozenBefore))
    throw new Error('Composite training mutated an inherited canonical parameter');

  const resumedAfterOne = await restoreCompositeVariantState(firstState, source);
  trainCompositeVariantStep(resumedAfterOne.model, resumedAfterOne.optimizer, resumedAfterOne.continuation, input, targets);
  const resumedState = await archiveCompositeVariantState(snapshotCompositeVariantState(resumedAfterOne.model, resumedAfterOne.optimizer,
    resumedAfterOne.continuation, firstState.state));
  const uninterruptedPrediction = predictForDefinition(compositeMlpMicrogptDefinition, uninterrupted.model, input);
  const resumedPrediction = predictForDefinition(compositeMlpMicrogptDefinition, resumedAfterOne.model, input);
  if (uninterruptedState.id !== resumedState.id || canonicalIdentity(uninterruptedState.state) !== canonicalIdentity(resumedState.state) ||
      canonicalIdentity(uninterruptedPrediction) !== canonicalIdentity(resumedPrediction)) throw new Error('Exact same-variant resume proof failed');

  const trainedRestored = await restoreCompositeVariantState(uninterruptedState, source);
  const trainedRecorder = new TraceRecorder(variantManifest({ ...tag, runId: `${tag.runId}:trained` }, source, input, targets,
    initialized.initialization, uninterruptedState.id, uninterruptedState.id));
  predictForDefinition(compositeMlpMicrogptDefinition, trainedRestored.model, input, trainedRecorder);
  const trainedRun = trainedRecorder.finish();
  const trainedComparison = compareMatchedVariantRuns(baselineRun, trainedRun);
  if (!trainedComparison.compatible) throw new Error(`Trained matched-variant comparison refused: ${trainedComparison.reasons.join(', ')}`);

  const layer = 0, token = 0, output = 0, bottleneck = 0;
  const activation = observed(trainedRun, 'mlpRelu', token, layer).values;
  const axVector = observed(trainedRun, 'mlpAdapterA', token, layer).values;
  const bVector = observed(trainedRun, 'mlpAdapterB', token, layer).values;
  const scaled = observed(trainedRun, 'mlpAdapterScaled', token, layer).values;
  const base = observed(trainedRun, 'mlpBaseDown', token, layer).values;
  const composite = observed(trainedRun, 'mlpCompositeDown', token, layer).values;
  const trainedParameters = variantParameterData(trainedRestored.model);
  const aRow = trainedParameters[`layer${layer}.mlp_adapter_a`]![bottleneck]!;
  const bRow = trainedParameters[`layer${layer}.mlp_adapter_b`]![output]!;
  const aProducts = dotProducts(aRow, activation), ax = orderedSum(aProducts);
  const bProducts = dotProducts(bRow, axVector), bax = orderedSum(bProducts);
  if (ax !== axVector[bottleneck] || bax !== bVector[output] || bax * initialized.initialization.scale !== scaled[output] ||
      base[output]! + scaled[output]! !== composite[output]) throw new Error('Exact composite arithmetic witness failed');

  const bUpdate = first.update.parameters.find(update => update.name.endsWith('mlp_adapter_b') && update.gradient !== 0 && update.delta !== 0);
  const firstAGradients = Object.entries(first.gradients).filter(([name]) => name.endsWith('mlp_adapter_a')).flatMap(([, rows]) => rows.flat());
  const aUpdate = second.update.parameters.find(update => update.name.endsWith('mlp_adapter_a') && update.gradient !== 0 && update.delta !== 0);
  if (!bUpdate || !firstAGradients.every(value => Object.is(value, 0)) || !aUpdate) throw new Error('Composite A/B gradient and update witness failed');
  const compositeArtifact = observed(trainingRun, 'mlpCompositeDown', token, layer);
  const inspection = trainingContext.inspect({ kind: 'artifact', artifactId: compositeArtifact.id, index: output });
  const root = inspection.graph?.roots[0], rootNode = inspection.graph?.nodes.find(node => node.id === root);
  if (!rootNode || rootNode.operation !== 'add' || !Number.isFinite(rootNode.gradient) || rootNode.gradient === 0)
    throw new Error('Loss did not reach the real composite output');
  const initializedComposite = observed(initializedRun, 'mlpCompositeDown', token, layer).values;
  const initializedProbability = observed(initializedRun, 'probabilities', token).values;
  const trainedProbability = observed(trainedRun, 'probabilities', token).values;
  if (!scaled.some(value => value !== 0) || canonicalIdentity(initializedComposite) === canonicalIdentity(composite) ||
      canonicalIdentity(initializedProbability) === canonicalIdentity(trainedProbability)) throw new Error('Trained adapter did not produce an authentic downstream effect');
  const sourceIdAfter = await snapshotId(source.state);
  if (sourceIdAfter !== sourceIdBefore) throw new Error('Composite variant mutated its canonical source snapshot');

  return immutableCopy({
    id: tag.runId, identity: COMPOSITE_VARIANT_EXPERIMENT_IDENTITY,
    source: { modelDefinition: request.sourceDefinition ?? CANONICAL_MICROGPT_DEFINITION, checkpointId: source.id, snapshotId: source.id },
    targetDefinition: COMPOSITE_MLP_MICROGPT_DEFINITION, initialization: initialized.initialization,
    initialState: initialized.state, trainedState: uninterruptedState,
    declaration: { equation: 'W x + s B(Ax)' as const, bottleneckWidth: initialized.initialization.bottleneckWidth,
      scale: initialized.initialization.scale, inheritedParameters: 'frozen' as const,
      trainableParameterOrder: initialized.initialization.trainability.trainableParameterOrder },
    baselineRun, initializedRun, trainedRun, initializationComparison, trainedComparison,
    witness: { token, layer, output, bottleneck,
      initialization: { adapterExactlyZero: true as const, compositeExactlyBase: true as const, downstreamExactlyCanonical: true as const },
      arithmetic: { activation, aRow, aProducts, ax, bRow, bProducts, bax, scale: initialized.initialization.scale,
        scaledAdapter: scaled[output]!, base: base[output]!, composite: composite[output]! },
      backward: { compositeOutputAdjoint: rootNode.gradient!, firstStepAGradientExactlyZero: true as const, bUpdate, aUpdate },
      resume: { savedStateId: firstState.id, uninterruptedStateId: uninterruptedState.id, resumedStateId: resumedState.id,
        exactStateEquality: true as const, exactPredictionEquality: true as const },
      trainedEffect: { adapterActive: true as const, compositeChanged: true as const, downstreamChanged: true as const },
      canonicalPreservation: { before: sourceIdBefore, after: sourceIdAfter, byteIdentical: true as const },
    },
  });
}

export async function validateCompositeVariantExperiment(experiment: CompositeVariantExperiment, source: ArchivedSnapshot): Promise<void> {
  const copy = immutableCopy(experiment);
  if (copy.identity.id !== COMPOSITE_VARIANT_EXPERIMENT_IDENTITY.id || copy.identity.version !== COMPOSITE_VARIANT_EXPERIMENT_IDENTITY.version ||
      copy.targetDefinition.id !== COMPOSITE_MLP_MICROGPT_DEFINITION.id || copy.targetDefinition.version !== COMPOSITE_MLP_MICROGPT_DEFINITION.version)
    throw new Error('Invalid composite-variant experiment identity');
  if (await snapshotId(source.state) !== source.id || copy.source.checkpointId !== source.id || copy.source.snapshotId !== source.id ||
      copy.initialization.sourceCheckpointId !== source.id || copy.initialization.sourceSnapshotId !== source.id)
    throw new Error('Composite-variant source snapshot or checkpoint mismatch');
  await validateCompositeVariantState(copy.initialState.state); await validateCompositeVariantState(copy.trainedState.state);
  if (copy.initialState.id !== await compositeVariantStateId(copy.initialState.state) ||
      copy.trainedState.id !== await compositeVariantStateId(copy.trainedState.state))
    throw new Error('Composite-variant state identity mismatch');
  if (copy.initialState.state.initialization.id !== copy.initialization.id || copy.trainedState.state.initialization.id !== copy.initialization.id ||
      copy.trainedRun.manifest.startingCheckpointId !== copy.trainedState.id || copy.initializedRun.manifest.startingCheckpointId !== copy.initialization.id)
    throw new Error('Composite-variant run/state provenance mismatch');
  const initialComparison = compareMatchedVariantRuns(copy.baselineRun, copy.initializedRun);
  const trainedComparison = compareMatchedVariantRuns(copy.baselineRun, copy.trainedRun);
  if (!initialComparison.compatible || !trainedComparison.compatible || canonicalIdentity(initialComparison) !== canonicalIdentity(copy.initializationComparison) ||
      canonicalIdentity(trainedComparison) !== canonicalIdentity(copy.trainedComparison)) throw new Error('Invalid composite matched-variant comparison receipt');
  if (!copy.witness.canonicalPreservation.byteIdentical || copy.witness.canonicalPreservation.before !== source.id ||
      copy.witness.canonicalPreservation.after !== source.id || copy.witness.resume.uninterruptedStateId !== copy.witness.resume.resumedStateId)
    throw new Error('Composite preservation or resume receipt mismatch');
}
