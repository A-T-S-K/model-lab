import { backward, zeroGrad } from '../model/autograd.js';
import {
  CANONICAL_MICROGPT_DEFINITION,
  CANONICAL_TO_LEAKY_INITIALIZATION,
  LEAKY_RELU_MICROGPT_DEFINITION,
  modelDefinitions,
  type ModelDefinitionIdentity,
} from '../model/definitions.js';
import { lossForDefinition, predict } from '../model/microgpt.js';
import { parameterValues, restoreTraining } from '../model/state.js';
import { snapshotId, type ArchivedSnapshot } from '../archive/snapshot.js';
import { CaptureContext } from '../inspect/capture.js';
import { canonicalIdentity } from '../trace/compare.js';
import { TraceRecorder } from '../trace/recorder.js';
import { immutableCopy, type Artifact, type RecordedRun, type RunManifest } from '../trace/types.js';
import { experimentManifest, type ExperimentTag } from './common.js';
import { compareMatchedVariantRuns, type MatchedVariantComparison } from './variant-comparison.js';
import { initializeModelVariant, initializationAsJson, type VariantInitializationRecord } from './variant-initialization.js';

export const ACTIVATION_VARIANT_IDENTITY = { id: 'microgpt.activation-variant', version: 1 } as const;

export interface ActivationVariantExperiment {
  readonly id: string;
  readonly identity: typeof ACTIVATION_VARIANT_IDENTITY;
  readonly source: {
    readonly modelDefinition: ModelDefinitionIdentity;
    readonly checkpointId: string;
    readonly snapshotId: string;
  };
  readonly targetDefinition: ModelDefinitionIdentity;
  readonly initialization: VariantInitializationRecord;
  readonly declaration: {
    readonly sourceSemanticKind: 'mlpRelu';
    readonly targetSemanticKind: 'mlpLeakyRelu';
    readonly operation: 'leaky_relu';
    readonly negativeSlope: number;
    readonly zeroDerivative: number;
  };
  readonly statePolicy: {
    readonly checkpointUse: 'parameter-initialization-only';
    readonly exactTrainingResume: false;
    readonly backwardState: 'disposable';
  };
  readonly baselineRun: RecordedRun;
  readonly variantRun: RecordedRun;
  readonly comparison: MatchedVariantComparison;
  readonly witness: {
    readonly token: number;
    readonly layer: number;
    readonly positive: { readonly index: number; readonly input: number; readonly canonical: number; readonly variant: number; readonly localDerivative: number };
    readonly negative: { readonly index: number; readonly input: number; readonly canonical: number; readonly variant: number; readonly localDerivative: number; readonly childAdjoint: number; readonly contribution: number };
    readonly downstream: {
      readonly mlpDownCanonical: readonly number[]; readonly mlpDownVariant: readonly number[];
      readonly residualCanonical: readonly number[]; readonly residualVariant: readonly number[];
      readonly logitsCanonical: readonly number[]; readonly logitsVariant: readonly number[];
      readonly probabilitiesCanonical: readonly number[]; readonly probabilitiesVariant: readonly number[];
    };
  };
  readonly lifecycle: { readonly status: 'succeeded'; readonly sessionId: string; readonly generationId: number };
}

export interface ActivationVariantRequest {
  readonly snapshot: ArchivedSnapshot;
  readonly inputIds: readonly number[];
  readonly targetIds: readonly number[];
  readonly targetDefinition?: ModelDefinitionIdentity;
  readonly sourceDefinition?: ModelDefinitionIdentity;
  readonly sourceCheckpointId?: string;
  readonly numericPolicy?: string;
  readonly tag?: ExperimentTag;
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
    throw new Error('Invalid activation-variant input or targets');
}

export async function runActivationVariant(request: ActivationVariantRequest): Promise<ActivationVariantExperiment> {
  const source = immutableCopy(request.snapshot);
  const targetIdentity = request.targetDefinition ?? LEAKY_RELU_MICROGPT_DEFINITION;
  const sourceIdentity = request.sourceDefinition ?? CANONICAL_MICROGPT_DEFINITION;
  const numericPolicy = request.numericPolicy ?? 'ECMAScript binary64; ordered scalar reductions';
  const tag = request.tag ?? { sessionId: 'activation-variant', generationId: 0, runId: 'activation-variant' };
  const input = [...request.inputIds], targets = [...request.targetIds];
  validateInput(input, targets, source);
  if (await snapshotId(source.state) !== source.id) throw new Error('Activation-variant source snapshot hash mismatch');
  const definition = modelDefinitions.require(targetIdentity);
  if (definition.identity.id !== LEAKY_RELU_MICROGPT_DEFINITION.id || definition.identity.version !== LEAKY_RELU_MICROGPT_DEFINITION.version ||
      definition.activation.operation !== 'leaky_relu' || definition.replacement?.sourceSemanticKind !== 'mlpRelu' ||
      definition.replacement.targetSemanticKind !== 'mlpLeakyRelu' || definition.activation.negativeSlope === undefined)
    throw new Error('Registered activation variant is inconsistent with the required Leaky ReLU replacement');
  const initialized = await initializeModelVariant({ targetDefinition: targetIdentity, sourceDefinition: sourceIdentity,
    sourceCheckpointId: request.sourceCheckpointId ?? source.id, source,
    mapping: CANONICAL_TO_LEAKY_INITIALIZATION, numericPolicy });
  const baselineId = `${tag.runId}:canonical`, variantId = `${tag.runId}:leaky-relu`;

  const baselineRecorder = new TraceRecorder(experimentManifest({ ...tag, runId: baselineId }, source, input, targets));
  predict(restoreTraining(source.state).model, input, baselineRecorder);
  const baselineRun = baselineRecorder.finish();

  const baseManifest = experimentManifest({ ...tag, runId: variantId }, source, input, targets);
  const variantManifest: RunManifest = {
    ...baseManifest,
    model: { id: definition.identity.id, version: definition.identity.version,
      architecture: source.state.config as unknown as RunManifest['model']['architecture'], capabilities: definition.capabilities },
    startingCheckpointId: initialized.record.id,
    modelInitialization: initializationAsJson(initialized.record),
  };
  const variantRecorder = new TraceRecorder(variantManifest);
  const context = new CaptureContext(initialized.model, variantRecorder);
  zeroGrad(parameterValues(initialized.model));
  const variantExecution = lossForDefinition(definition, initialized.model, input, targets, context);
  backward(variantExecution.mean);
  context.captureBackward(variantExecution.mean);
  const variantRun = variantRecorder.finish();
  const comparison = compareMatchedVariantRuns(baselineRun, variantRun);
  if (!comparison.compatible) throw new Error(`Matched variant comparison refused: ${comparison.reasons.join(', ')}`);

  let selected: { token: number; layer: number; positive: number; negative: number } | undefined;
  for (let token = 0; token < input.length && !selected; token++) for (let layer = 0; layer < source.state.config.nLayer && !selected; layer++) {
    const values = observed(baselineRun, 'mlpUp', token, layer).values;
    const positive = values.findIndex(value => value > 0), negative = values.findIndex(value => value < 0);
    if (positive >= 0 && negative >= 0) selected = { token, layer, positive, negative };
  }
  if (!selected) throw new Error('Deterministic activation witness does not contain both positive and negative preactivations');
  const upstream = observed(baselineRun, 'mlpUp', selected.token, selected.layer).values;
  const variantUp = observed(variantRun, 'mlpUp', selected.token, selected.layer).values;
  if (canonicalIdentity(upstream) !== canonicalIdentity(variantUp)) throw new Error('Upstream activation prevalues differ');
  const canonicalActivation = observed(baselineRun, 'mlpRelu', selected.token, selected.layer).values;
  const variantActivation = observed(variantRun, 'mlpLeakyRelu', selected.token, selected.layer);
  const derivative = (index: number) => {
    const inspection = context.inspect({ kind: 'artifact', artifactId: variantActivation.id, index });
    const root = inspection.graph?.roots[0];
    const edge = inspection.graph?.edges.find(candidate => candidate.child === root);
    if (root === undefined || !edge || inspection.graph?.nodes.find(node => node.id === root)?.operation !== 'leaky_relu')
      throw new Error('Activation witness is not bound to the executed Leaky ReLU scalar operation');
    return edge;
  };
  const positiveEdge = derivative(selected.positive), negativeEdge = derivative(selected.negative);
  if (positiveEdge.localDerivative !== 1 || negativeEdge.localDerivative !== definition.activation.negativeSlope ||
      negativeEdge.childAdjoint === undefined || negativeEdge.contribution === undefined || negativeEdge.contribution === 0)
    throw new Error('Leaky ReLU derivative witness does not contribute to the real backward path');
  const downstream = {
    mlpDownCanonical: observed(baselineRun, 'mlpDown', selected.token, selected.layer).values,
    mlpDownVariant: observed(variantRun, 'mlpDown', selected.token, selected.layer).values,
    residualCanonical: observed(baselineRun, 'mlpResidual', selected.token, selected.layer).values,
    residualVariant: observed(variantRun, 'mlpResidual', selected.token, selected.layer).values,
    logitsCanonical: observed(baselineRun, 'logits', selected.token).values,
    logitsVariant: observed(variantRun, 'logits', selected.token).values,
    probabilitiesCanonical: observed(baselineRun, 'probabilities', selected.token).values,
    probabilitiesVariant: observed(variantRun, 'probabilities', selected.token).values,
  };
  if (canonicalIdentity(downstream.mlpDownCanonical) === canonicalIdentity(downstream.mlpDownVariant) ||
      canonicalIdentity(downstream.residualCanonical) === canonicalIdentity(downstream.residualVariant) ||
      canonicalIdentity(downstream.logitsCanonical) === canonicalIdentity(downstream.logitsVariant) ||
      canonicalIdentity(downstream.probabilitiesCanonical) === canonicalIdentity(downstream.probabilitiesVariant))
    throw new Error('Activation replacement did not produce the required authentic downstream effect');
  if (await snapshotId(source.state) !== source.id) throw new Error('Activation variant mutated its canonical source snapshot');
  return immutableCopy({
    id: tag.runId, identity: ACTIVATION_VARIANT_IDENTITY,
    source: { modelDefinition: sourceIdentity, checkpointId: source.id, snapshotId: source.id },
    targetDefinition: definition.identity, initialization: initialized.record,
    declaration: { sourceSemanticKind: 'mlpRelu', targetSemanticKind: 'mlpLeakyRelu', operation: 'leaky_relu',
      negativeSlope: definition.activation.negativeSlope, zeroDerivative: definition.activation.derivativeAtZero },
    statePolicy: { checkpointUse: 'parameter-initialization-only', exactTrainingResume: false, backwardState: 'disposable' },
    baselineRun, variantRun, comparison,
    witness: { token: selected.token, layer: selected.layer,
      positive: { index: selected.positive, input: upstream[selected.positive]!, canonical: canonicalActivation[selected.positive]!,
        variant: variantActivation.values[selected.positive]!, localDerivative: positiveEdge.localDerivative },
      negative: { index: selected.negative, input: upstream[selected.negative]!, canonical: canonicalActivation[selected.negative]!,
        variant: variantActivation.values[selected.negative]!, localDerivative: negativeEdge.localDerivative,
        childAdjoint: negativeEdge.childAdjoint!, contribution: negativeEdge.contribution! },
      downstream }, lifecycle: { status: 'succeeded', sessionId: tag.sessionId, generationId: tag.generationId },
  });
}

export async function validateActivationVariantExperiment(experiment: ActivationVariantExperiment, snapshot: ArchivedSnapshot): Promise<void> {
  const copy = immutableCopy(experiment);
  if (copy.identity.id !== ACTIVATION_VARIANT_IDENTITY.id || copy.identity.version !== ACTIVATION_VARIANT_IDENTITY.version ||
      copy.lifecycle.status !== 'succeeded') throw new Error('Invalid activation-variant experiment identity or lifecycle');
  if (await snapshotId(snapshot.state) !== snapshot.id || copy.source.checkpointId !== snapshot.id ||
      copy.source.snapshotId !== snapshot.id || copy.initialization.sourceCheckpointId !== snapshot.id ||
      copy.initialization.sourceSnapshotId !== snapshot.id) throw new Error('Activation-variant source snapshot or checkpoint mismatch');
  const initialized = await initializeModelVariant({ targetDefinition: copy.targetDefinition,
    sourceDefinition: copy.source.modelDefinition, sourceCheckpointId: copy.source.checkpointId, source: snapshot,
    mapping: copy.initialization.mapping, numericPolicy: copy.initialization.numericPolicy,
    parameterMapping: copy.initialization.parameterMapping });
  if (canonicalIdentity(initialized.record) !== canonicalIdentity(copy.initialization))
    throw new Error('Activation-variant initialization receipt differs from the registered mapping');
  if (copy.baselineRun.manifest.startingCheckpointId !== snapshot.id || copy.baselineRun.manifest.startingSnapshotId !== snapshot.id ||
      copy.variantRun.manifest.startingCheckpointId !== copy.initialization.id || copy.variantRun.manifest.startingSnapshotId !== snapshot.id ||
      canonicalIdentity(copy.variantRun.manifest.modelInitialization) !== canonicalIdentity(copy.initialization))
    throw new Error('Activation-variant run provenance does not match its source and mapped checkpoint');
  const comparison = compareMatchedVariantRuns(copy.baselineRun, copy.variantRun);
  if (!comparison.compatible || canonicalIdentity(comparison) !== canonicalIdentity(copy.comparison))
    throw new Error('Invalid matched-variant comparison receipt');
  if (copy.declaration.operation !== 'leaky_relu' || copy.declaration.sourceSemanticKind !== 'mlpRelu' ||
      copy.declaration.targetSemanticKind !== 'mlpLeakyRelu' || copy.declaration.negativeSlope !== 0.01 ||
      copy.declaration.zeroDerivative !== 0.01 || copy.statePolicy.exactTrainingResume !== false ||
      copy.statePolicy.checkpointUse !== 'parameter-initialization-only' || copy.statePolicy.backwardState !== 'disposable')
    throw new Error('Activation-variant declaration or state policy mismatch');
}
