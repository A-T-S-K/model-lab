import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { archiveSnapshot, snapshotId, validateTrainingSnapshot } from '../../archive/snapshot.js';
import { SessionArchive } from '../../archive/session.js';
import { sourceMapping } from '../../app/source/mappings.js';
import { forwardReadModel } from '../../app/spatial/forward.js';
import { runCompositeVariant } from '../../experiments/composite-model-variant.js';
import {
  archiveCompositeVariantState,
  initializeCompositeVariant,
  restoreCompositeVariantState,
  validateCompositeVariantState,
  VARIANT_NUMERIC_POLICY,
} from '../../experiments/composite-variant-state.js';
import { compareMatchedVariantRuns } from '../../experiments/variant-comparison.js';
import {
  CANONICAL_MICROGPT_DEFINITION,
  COMPOSITE_MLP_BOTTLENECK_WIDTH,
  COMPOSITE_MLP_MICROGPT_DEFINITION,
  COMPOSITE_MLP_SCALE,
  ModelDefinitionRegistry,
  compositeMlpMicrogptDefinition,
  compositeParameterSchema,
  modelDefinitions,
  type CompositeMlpDownReplacement,
  type ModelDefinitionContribution,
} from '../../model/definitions.js';
import { predict } from '../../model/microgpt.js';
import { restoreTraining, type TrainingSnapshot } from '../../model/state.js';
import { compareRuns } from '../../trace/compare.js';
import { isCompositeVariantExperiment } from '../../experiments/model-variant-experiment.js';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/canonical.initial.json', import.meta.url), 'utf8')) as TrainingSnapshot & {
  tokenIds: number[]; targetIds: number[];
};
const state = (): TrainingSnapshot => structuredClone({ formatVersion: fixture.formatVersion, config: fixture.config,
  parameterOrder: fixture.parameterOrder, parameters: fixture.parameters, optimizer: fixture.optimizer });
async function source() { return archiveSnapshot(state()); }
let cached: ReturnType<typeof runCompositeVariant> | undefined;
async function witness() { return cached ??= source().then(snapshot => runCompositeVariant({ snapshot, inputIds: fixture.tokenIds, targetIds: fixture.targetIds })); }

test('composite definition is registered directly on canonical with real rank-2 A/B schemas', () => {
  const definition = modelDefinitions.require(COMPOSITE_MLP_MICROGPT_DEFINITION);
  assert.deepEqual(definition.base, CANONICAL_MICROGPT_DEFINITION);
  assert.equal(definition.activation.operation, 'relu');
  assert.equal(definition.replacement?.kind, 'composite-mlp-down');
  if (definition.replacement?.kind !== 'composite-mlp-down') assert.fail('composite replacement absent');
  assert.equal(definition.replacement.bottleneckWidth, COMPOSITE_MLP_BOTTLENECK_WIDTH);
  assert.equal(definition.replacement.scale, COMPOSITE_MLP_SCALE);
  assert.equal(definition.replacement.policy.inheritedParameters, 'frozen');
  assert.deepEqual(definition.replacement.parameterSchema, compositeParameterSchema);
  assert.deepEqual(compositeParameterSchema.map(parameter => parameter.name), ['layer0.mlp_adapter_a','layer0.mlp_adapter_b']);
  assert.deepEqual(compositeParameterSchema.map(parameter => parameter.shape), [[2,32],[8,2]]);
  assert.equal(compositeParameterSchema[0]!.inputBasis.id, 'microgpt.mlp-activation.feature.v1');
  assert.equal(compositeParameterSchema[1]!.inputBasis.id, 'microgpt.adapter-bottleneck.feature.v1');
  assert.equal(compositeParameterSchema[1]!.outputBasis.id, 'microgpt.embedding.feature.v1');
});

test('deterministic identity-preserving initialization owns A/B state and newly zeroed optimizer moments', async () => {
  const snapshot = await source();
  const initialized = await initializeCompositeVariant({ source: snapshot });
  const a = initialized.state.state.parameters['layer0.mlp_adapter_a']!, b = initialized.state.state.parameters['layer0.mlp_adapter_b']!;
  assert.equal(a[0]![0], -2 / 64); assert.equal(a[1]![2], 3 / 64); assert.ok(a.flat().some(value => value !== 0));
  assert.ok(b.flat().every(value => Object.is(value, 0)));
  assert.deepEqual(initialized.model.variant.trainableParameterOrder, ['layer0.mlp_adapter_a','layer0.mlp_adapter_b']);
  assert.ok(initialized.state.state.optimizer.m.every(value => Object.is(value, 0)));
  assert.ok(initialized.state.state.optimizer.v.every(value => Object.is(value, 0)));
  assert.equal(initialized.state.state.optimizer.m.length, 80);
  assert.deepEqual(initialized.initialization.optimizerHyperparameterProvenance.fields,
    ['learningRate','beta1','beta2','epsilon','numSteps']);
  assert.equal(initialized.initialization.optimizerHyperparameterProvenance.dynamicState, 'new-zero-moments');
  assert.deepEqual(initialized.initialization.continuationProvenance,
    { datasetCursor: 'new-zero-for-fixed-variant-sequence', rngState: 'unused-null' });
  assert.deepEqual(initialized.state.state.continuation, { datasetCursor: 0, rngState: null });
  assert.notEqual(initialized.initialization.id, snapshot.id); assert.notEqual(initialized.state.id, snapshot.id);
  await validateCompositeVariantState(initialized.state.state);
  const restored = await restoreCompositeVariantState(initialized.state, snapshot);
  assert.deepEqual(restored.model.parameters['layer0.mlp_adapter_a']!.map(row => row.map(value => value.data)), a);
});

test('real composite backward updates B first, A later, resumes exactly, and preserves canonical state', async () => {
  const experiment = await witness(), witnessData = experiment.witness;
  assert.equal(witnessData.initialization.adapterExactlyZero, true);
  assert.equal(witnessData.initialization.compositeExactlyBase, true);
  assert.equal(witnessData.initialization.downstreamExactlyCanonical, true);
  assert.ok(witnessData.backward.compositeOutputAdjoint !== 0);
  assert.match(witnessData.backward.bUpdate.name, /mlp_adapter_b$/); assert.notEqual(witnessData.backward.bUpdate.gradient, 0);
  assert.notEqual(witnessData.backward.bUpdate.delta, 0);
  assert.match(witnessData.backward.aUpdate.name, /mlp_adapter_a$/); assert.notEqual(witnessData.backward.aUpdate.gradient, 0);
  assert.notEqual(witnessData.backward.aUpdate.delta, 0);
  assert.equal(witnessData.resume.uninterruptedStateId, witnessData.resume.resumedStateId);
  assert.equal(witnessData.resume.exactStateEquality, true); assert.equal(witnessData.resume.exactPredictionEquality, true);
  assert.equal(witnessData.arithmetic.aProducts.reduce((sum, value) => sum + value, 0), witnessData.arithmetic.ax);
  assert.equal(witnessData.arithmetic.bProducts.reduce((sum, value) => sum + value, 0), witnessData.arithmetic.bax);
  assert.equal(witnessData.arithmetic.scale * witnessData.arithmetic.bax, witnessData.arithmetic.scaledAdapter);
  assert.equal(witnessData.arithmetic.base + witnessData.arithmetic.scaledAdapter, witnessData.arithmetic.composite);
  assert.equal(witnessData.trainedEffect.adapterActive, true); assert.equal(witnessData.trainedEffect.downstreamChanged, true);
  assert.equal(witnessData.canonicalPreservation.before, witnessData.canonicalPreservation.after);
  assert.deepEqual(experiment.trainedState.state.trainingPolicy.inheritedParameterOrder, fixture.parameterOrder);
  assert.deepEqual(experiment.trainedState.state.optimizer.parameterOrder, ['layer0.mlp_adapter_a','layer0.mlp_adapter_b']);
  assert.equal(experiment.trainedState.state.optimizer.step, 2);
  assert.equal(experiment.trainedState.state.continuation.datasetCursor, fixture.optimizer.datasetCursor + 2);
});

test('strict comparison refuses the definition while matched-variant exposes internals without fake counterparts', async () => {
  const experiment = await witness();
  const strict = compareRuns(experiment.baselineRun, experiment.trainedRun);
  assert.equal(strict.compatible, false); assert.ok(strict.reasons.includes('model differs'));
  assert.equal(experiment.trainedComparison.compatible, true);
  assert.ok(experiment.trainedComparison.artifacts.some(item => item.mapping.sourceKind === 'mlpDown' && item.mapping.targetKind === 'mlpCompositeDown'));
  assert.deepEqual(experiment.trainedComparison.variantOnly.map(item => item.mapping.targetKind),
    ['mlpBaseDown','mlpAdapterA','mlpAdapterB','mlpAdapterScaled']);
  const tampered = structuredClone(experiment.trainedRun);
  (tampered.manifest.modelInitialization as Record<string, unknown>).currentVariantStateId = 'wrong';
  assert.equal(compareMatchedVariantRuns(experiment.baselineRun, tampered).compatible, false);
});

test('semantic world exposes the real split/merge, source bindings, and parameter ownership', async () => {
  const experiment = await witness(), snapshot = await source();
  const world = forwardReadModel(experiment.trainedRun, snapshot, experiment.trainedState);
  assert.equal(world.descriptor.modelDefinition, 'microgpt.composite-mlp:1');
  for (const kind of ['mlpBaseDown','mlpAdapterA','mlpAdapterB','fixedAdapterScale','mlpAdapterScaled','mlpCompositeDown'])
    assert.ok(world.descriptor.nodes.some(node => node.operation === kind), `${kind} semantic node`);
  assert.deepEqual(world.upstream({ kind: 'mlpCompositeDown', token: 0, layer: 0 }).map(dependency => dependency.address.kind),
    ['mlpBaseDown','mlpAdapterScaled']);
  assert.equal(world.upstream({ kind: 'mlpResidual', token: 0, layer: 0 })[0]!.address.kind, 'mlpCompositeDown');
  assert.deepEqual(world.parameterOwners['layer0.mlp_fc2'], { kind: 'mlpBaseDown', layer: 0 });
  assert.deepEqual(world.parameterOwners['layer0.mlp_adapter_a'], { kind: 'mlpAdapterA', layer: 0 });
  assert.deepEqual(world.parameterOwners['layer0.mlp_adapter_b'], { kind: 'mlpAdapterB', layer: 0 });
  assert.equal(world.parameterDetails['layer0.mlp_fc2']!.trainability, 'frozen');
  assert.equal(world.parameterDetails['layer0.mlp_adapter_a']!.trainability, 'trainable');
  assert.equal(world.parameterDetails['layer0.mlp_adapter_a']!.optimizerMembership, true);
  assert.equal(world.parameterDetails['layer0.mlp_fc2']!.optimizerMembership, false);
  assert.equal(world.sourceSnapshotId, experiment.trainedState.id);
  const a = world.explain({ kind: 'mlpAdapterA', token: 0, layer: 0 }, 0);
  const b = world.explain({ kind: 'mlpAdapterB', token: 0, layer: 0 }, 0);
  const scaled = world.explain({ kind: 'mlpAdapterScaled', token: 0, layer: 0 }, 0);
  const composite = world.explain({ kind: 'mlpCompositeDown', token: 0, layer: 0 }, 0);
  assert.equal(a.terms?.reduce((sum, term) => sum + term.product, 0), a.observed);
  assert.equal(b.terms?.reduce((sum, term) => sum + term.product, 0), b.observed);
  assert.equal(scaled.inputs?.[0]! * scaled.fixedScale!, scaled.observed);
  assert.equal(composite.pairs?.[0]! + composite.pairs?.[1]!, composite.observed);
  assert.deepEqual(['mlpBaseDown','mlpAdapterA','mlpAdapterB','fixedAdapterScale','mlpAdapterScaled','mlpCompositeDown']
    .map(kind => sourceMapping(kind).status), Array(6).fill('mapped'));
  assert.equal((sourceMapping('mlpAdapterScaled') as { symbol: string }).symbol, 'scaleCompositeAdapter');
  assert.equal((sourceMapping('mlpCompositeDown') as { symbol: string }).symbol, 'addCompositeBranches');
});

test('legacy canonical snapshot codec stays exact and refuses variant-shaped state', async () => {
  const canonical = state(); validateTrainingSnapshot(canonical);
  const canonicalId = await snapshotId(canonical);
  const withAdapter = structuredClone(canonical);
  withAdapter.parameters['layer0.mlp_adapter_a'] = Array.from({ length: 2 }, () => Array(32).fill(0));
  withAdapter.parameterOrder.push('layer0.mlp_adapter_a');
  assert.throws(() => validateTrainingSnapshot(withAdapter), /Invalid snapshot/);
  const snapshot = await source(), initialized = await initializeCompositeVariant({ source: snapshot });
  assert.throws(() => validateTrainingSnapshot(initialized.state.state as never), /Invalid snapshot/);
  assert.equal(await snapshotId(canonical), canonicalId);
});

test('composite preflight refuses identity, checkpoint, precision, schema, optimizer, and receipt substitutions', async () => {
  const snapshot = await source();
  await assert.rejects(initializeCompositeVariant({ source: snapshot, targetDefinition: { id: 'unknown', version: '1' } }), /Unknown model definition/);
  await assert.rejects(initializeCompositeVariant({ source: snapshot, sourceDefinition: COMPOSITE_MLP_MICROGPT_DEFINITION }), /Wrong base/);
  await assert.rejects(initializeCompositeVariant({ source: snapshot, sourceCheckpointId: 'wrong' }), /Wrong canonical base checkpoint/);
  await assert.rejects(initializeCompositeVariant({ source: snapshot, numericPolicy: 'float32' }), /Incompatible numeric policy/);
  const schemaMutations = [
    (schema: typeof compositeParameterSchema) => schema.slice(0, 1),
    (schema: typeof compositeParameterSchema) => [{ ...schema[0]!, name: 'layer0.same_size_wrong_name' }, schema[1]!],
    (schema: typeof compositeParameterSchema) => [{ ...schema[0]!, shape: [1,64] as const }, schema[1]!],
    (schema: typeof compositeParameterSchema) => [{ ...schema[0]!, inputBasis: { ...schema[0]!.inputBasis, id: 'wrong-basis' } }, schema[1]!],
    (schema: typeof compositeParameterSchema) => [schema[1]!, schema[0]!],
  ];
  for (const mutate of schemaMutations) await assert.rejects(initializeCompositeVariant({ source: snapshot,
    parameterSchema: mutate(compositeParameterSchema) }), /Parameter schema/);
  const initialized = await initializeCompositeVariant({ source: snapshot });
  for (const mutate of [
    (copy: typeof initialized.state.state) => { delete (copy.parameters as Record<string, unknown>)['layer0.mlp_adapter_a']; },
    (copy: typeof initialized.state.state) => { copy.parameters['layer0.mlp_adapter_b']![0]!.pop(); },
    (copy: typeof initialized.state.state) => { (copy.parameterSchema[0]!.inputBasis as { id: string }).id = 'wrong-basis'; },
    (copy: typeof initialized.state.state) => { copy.optimizer.parameterOrder.reverse(); },
    (copy: typeof initialized.state.state) => { copy.optimizer.parameterOrder[0] = 'layer0.mlp_fc2'; },
    (copy: typeof initialized.state.state) => { copy.optimizer.m.pop(); },
    (copy: typeof initialized.state.state) => { (copy.definition as { id: string }).id = 'other-definition'; },
    (copy: typeof initialized.state.state) => { (copy as { baseCheckpointId: string }).baseCheckpointId = 'sha256:other'; },
    (copy: typeof initialized.state.state) => { (copy.initialization as { id: string }).id = 'sha256:tampered'; },
    (copy: typeof initialized.state.state) => { (copy.initialization.trainability as { inheritedParameters: string }).inheritedParameters = 'trainable'; },
    (copy: typeof initialized.state.state) => { (copy.initialization.initializationDeclaration[0] as { declaration: string }).declaration = 'ambient random'; },
    (copy: typeof initialized.state.state) => { (copy.initialization.optimizerHyperparameterProvenance as { dynamicState: string }).dynamicState = 'copied canonical moments'; },
    (copy: typeof initialized.state.state) => { (copy.initialization.continuationProvenance as { datasetCursor: string }).datasetCursor = 'copied canonical cursor'; },
    (copy: typeof initialized.state.state) => { copy.parameters['layer0.mlp_adapter_a']![0]![0] = Number.NaN; },
  ]) {
    const bad = structuredClone(initialized.state.state); mutate(bad);
    await assert.rejects(archiveCompositeVariantState(bad), /Invalid composite variant state|Canonical data|Unknown model definition/);
  }
  const canonicalOptimizer = structuredClone(initialized.state.state);
  (canonicalOptimizer.optimizer as { parameterOrder: string[] }).parameterOrder = [...fixture.parameterOrder];
  canonicalOptimizer.optimizer.m = [...fixture.optimizer.m]; canonicalOptimizer.optimizer.v = [...fixture.optimizer.v];
  await assert.rejects(validateCompositeVariantState(canonicalOptimizer), /optimizer|parameter order/);
  const wrongInheritedConfig = structuredClone(initialized.state.state); wrongInheritedConfig.optimizer.config.learningRate = 0.02;
  const rehashedWrongConfig = await archiveCompositeVariantState(wrongInheritedConfig);
  await assert.rejects(restoreCompositeVariantState(rehashedWrongConfig, snapshot), /inherited optimizer configuration/);
  const otherBase = structuredClone(snapshot); (otherBase as { id: string }).id = 'sha256:other';
  await assert.rejects(restoreCompositeVariantState(initialized.state, otherBase), /another base checkpoint|Wrong|hash/);
});

test('definition registry refuses invalid rank, scale, and nonfinite or incompatible declarations', () => {
  const valid = compositeMlpMicrogptDefinition;
  const contribution = (replacement: CompositeMlpDownReplacement): ModelDefinitionContribution => ({ ...valid,
    identity: { id: `invalid-composite-${Math.random()}`, version: '1' }, replacement });
  assert.throws(() => new ModelDefinitionRegistry().register(contribution({ ...valid.replacement as CompositeMlpDownReplacement,
    bottleneckWidth: 0 })), /bottleneck/);
  for (const scale of [0, Number.NaN, Number.POSITIVE_INFINITY]) assert.throws(() => new ModelDefinitionRegistry().register(contribution({
    ...valid.replacement as CompositeMlpDownReplacement, scale })), /scale/);
  const nonfiniteDeclaration = structuredClone(compositeParameterSchema);
  (nonfiniteDeclaration[0]!.initialization as { algorithm: string }).algorithm = 'ambient-random-or-nonfinite';
  assert.throws(() => new ModelDefinitionRegistry().register(contribution({ ...valid.replacement as CompositeMlpDownReplacement,
    parameterSchema: nonfiniteDeclaration })), /schema/);
});

test('canonical source prediction and hash remain unchanged after the complete composite witness', async () => {
  const snapshot = await source(), beforeId = await snapshotId(snapshot.state);
  const before = predict(restoreTraining(snapshot.state).model, fixture.tokenIds);
  await runCompositeVariant({ snapshot, inputIds: fixture.tokenIds, targetIds: fixture.targetIds, numericPolicy: VARIANT_NUMERIC_POLICY });
  assert.equal(await snapshotId(snapshot.state), beforeId);
  assert.deepEqual(predict(restoreTraining(snapshot.state).model, fixture.tokenIds), before);
});

test('archive admits composite evidence through the shared definition-aware variant family', async () => {
  const snapshot = await source(), experiment = await runCompositeVariant({ snapshot, inputIds: fixture.tokenIds, targetIds: fixture.targetIds,
    tag: { sessionId: 'archive-composite', generationId: 0, runId: 'archive-composite' } });
  const archive = new SessionArchive(); await archive.addSnapshot(snapshot); await archive.addRun(experiment.baselineRun);
  await archive.addModelVariantExperiment(experiment);
  const retained = archive.modelVariantExperiments.get(experiment.id); assert.ok(retained && isCompositeVariantExperiment(retained));
  assert.equal(retained.trainedState.id, experiment.trainedState.id);
  assert.equal(archive.runs.get(experiment.trainedRun.manifest.runId)?.manifest.model.id, COMPOSITE_MLP_MICROGPT_DEFINITION.id);
  const tampered = structuredClone(experiment); (tampered.trainedState as { id: string }).id = 'sha256:tampered';
  await assert.rejects(archive.addModelVariantExperiment(tampered), /state identity/);
});
