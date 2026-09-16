import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SessionArchive } from '../../archive/session.js';
import { archiveSnapshot, snapshotId } from '../../archive/snapshot.js';
import { sourceMapping } from '../../app/source/mappings.js';
import { forwardReadModel } from '../../app/spatial/forward.js';
import { runActivationVariant, validateActivationVariantExperiment } from '../../experiments/model-variant.js';
import { backward } from '../../model/autograd.js';
import {
  CANONICAL_MICROGPT_DEFINITION,
  CANONICAL_TO_LEAKY_INITIALIZATION,
  LEAKY_RELU_MICROGPT_DEFINITION,
  LEAKY_RELU_NEGATIVE_SLOPE,
  ModelDefinitionRegistry,
  modelDefinitions,
  type ModelDefinitionContribution,
} from '../../model/definitions.js';
import { predict } from '../../model/microgpt.js';
import { restoreTraining, type TrainingSnapshot } from '../../model/state.js';
import { Value } from '../../model/value.js';
import { compareRuns } from '../../trace/compare.js';
import { compareMatchedVariantRuns } from '../../experiments/variant-comparison.js';
import { initializeModelVariant, requireExactVariantResume } from '../../experiments/variant-initialization.js';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/canonical.initial.json', import.meta.url), 'utf8')) as TrainingSnapshot & {
  tokenIds: number[]; targetIds: number[];
};
const state = (): TrainingSnapshot => structuredClone({ formatVersion: fixture.formatVersion, config: fixture.config,
  parameterOrder: fixture.parameterOrder, parameters: fixture.parameters, optimizer: fixture.optimizer });
async function source() { return archiveSnapshot(state()); }
async function witness() { const snapshot = await source(); return { snapshot, experiment: await runActivationVariant({ snapshot, inputIds: fixture.tokenIds, targetIds: fixture.targetIds }) }; }

test('canonical and Leaky ReLU definitions are unique reviewed registrations with one explicit replacement', () => {
  assert.equal(modelDefinitions.list().length, 3);
  const canonical = modelDefinitions.require(CANONICAL_MICROGPT_DEFINITION);
  const variant = modelDefinitions.require(LEAKY_RELU_MICROGPT_DEFINITION);
  assert.equal(canonical.activation.operation, 'relu'); assert.equal(canonical.activation.semanticKind, 'mlpRelu');
  assert.equal(variant.activation.operation, 'leaky_relu'); assert.equal(variant.activation.semanticKind, 'mlpLeakyRelu');
  assert.equal(variant.activation.negativeSlope, LEAKY_RELU_NEGATIVE_SLOPE);
  assert.equal(variant.activation.derivativeAtZero, LEAKY_RELU_NEGATIVE_SLOPE);
  assert.deepEqual(variant.base, CANONICAL_MICROGPT_DEFINITION);
  assert.deepEqual(variant.replacement, { kind: 'activation', sourceSemanticKind: 'mlpRelu', targetSemanticKind: 'mlpLeakyRelu', declaration: 'Replace canonical MLP ReLU with Leaky ReLU' });
  assert.equal(variant.comparison?.pointMappings.filter(point => point.relationship === 'replaced').length, 1);
  assert.throws(() => modelDefinitions.require({ id: 'unknown', version: '1' }), /Unknown model definition/);
});

test('Leaky ReLU scalar forward and positive, negative, and zero derivatives are exact', () => {
  for (const [input, output, derivative] of [[4, 4, 1], [-4, -0.04, 0.01], [0, 0, 0.01]] as const) {
    const x = new Value(input); const y = x.leakyRelu(LEAKY_RELU_NEGATIVE_SLOPE);
    assert.equal(y.data, output); assert.equal(y.operation, 'leaky_relu'); assert.equal(y.localDerivatives[0], derivative);
    backward(y); assert.equal(x.grad, derivative);
  }
  for (const slope of [0, -0.1, 1, NaN, Infinity]) assert.throws(() => new Value(1).leakyRelu(slope), /negative slope/);
});

test('explicit canonical checkpoint mapping initializes variant parameters without claiming resume', async () => {
  const snapshot = await source();
  const initialized = await initializeModelVariant({ targetDefinition: LEAKY_RELU_MICROGPT_DEFINITION,
    sourceDefinition: CANONICAL_MICROGPT_DEFINITION, sourceCheckpointId: snapshot.id, source: snapshot,
    mapping: CANONICAL_TO_LEAKY_INITIALIZATION, numericPolicy: 'ECMAScript binary64; ordered scalar reductions' });
  assert.notEqual(initialized.record.id, snapshot.id);
  assert.equal(initialized.record.sourceCheckpointId, snapshot.id);
  assert.equal(initialized.record.checkpointUse, 'parameter-initialization-only');
  assert.equal(initialized.record.exactTrainingResume, false);
  assert.deepEqual(initialized.record.parameterMapping.map(pair => pair.source), snapshot.state.parameterOrder);
  assert.deepEqual(initialized.record.parameterMapping.map(pair => pair.target), snapshot.state.parameterOrder);
  assert.throws(() => requireExactVariantResume(initialized.record), /not an exact cross-definition resume/);
});

test('actual model replacement preserves upstream values, changes activation/downstream values, and contributes to backward', async () => {
  const { snapshot, experiment } = await witness(); const w = experiment.witness;
  assert.equal(await snapshotId(snapshot.state), snapshot.id);
  assert.equal(experiment.variantRun.manifest.model.id, LEAKY_RELU_MICROGPT_DEFINITION.id);
  assert.equal(experiment.variantRun.manifest.startingCheckpointId, experiment.initialization.id);
  assert.deepEqual(experiment.variantRun.manifest.modelInitialization, experiment.initialization);
  const mappedUp = experiment.comparison.artifacts.filter(item => item.mapping.sourceKind === 'mlpUp');
  assert.ok(mappedUp.length > 0); assert.ok(mappedUp.every(item => item.deltas?.every(delta => Object.is(delta, 0))));
  assert.ok(w.positive.input > 0); assert.equal(w.positive.variant, w.positive.input); assert.equal(w.positive.canonical, w.positive.input); assert.equal(w.positive.localDerivative, 1);
  assert.ok(w.negative.input < 0); assert.equal(w.negative.canonical, 0); assert.equal(w.negative.variant, LEAKY_RELU_NEGATIVE_SLOPE * w.negative.input);
  assert.equal(w.negative.localDerivative, LEAKY_RELU_NEGATIVE_SLOPE); assert.notEqual(w.negative.childAdjoint, 0); assert.notEqual(w.negative.contribution, 0);
  assert.notDeepEqual(w.downstream.mlpDownVariant, w.downstream.mlpDownCanonical);
  assert.notDeepEqual(w.downstream.residualVariant, w.downstream.residualCanonical);
  assert.notDeepEqual(w.downstream.logitsVariant, w.downstream.logitsCanonical);
  assert.notDeepEqual(w.downstream.probabilitiesVariant, w.downstream.probabilitiesCanonical);
  assert.equal(w.negative.input, -0.09757900640020112); assert.equal(w.negative.variant, -0.0009757900640020112);
  assert.equal(w.downstream.probabilitiesCanonical[0], 0.2704975187813897);
  assert.equal(w.downstream.probabilitiesVariant[0], 0.2704389828864514);
});

test('variant semantic world and source bind the executed replacement rather than canonical ReLU', async () => {
  const { snapshot, experiment } = await witness();
  const world = forwardReadModel(experiment.variantRun, snapshot);
  assert.equal(world.descriptor.modelDefinition, 'microgpt.leaky-relu:1');
  assert.equal(world.descriptor.label, 'MicroGPT · Leaky ReLU variant');
  assert.ok(world.descriptor.nodes.some(node => node.operation === 'mlpLeakyRelu'));
  assert.ok(!world.descriptor.nodes.some(node => node.operation === 'mlpRelu'));
  assert.equal(world.activationKind, 'mlpLeakyRelu');
  assert.equal(world.upstream({ kind: 'mlpLeakyRelu', token: 0, layer: 0 })[0]?.address.kind, 'mlpUp');
  assert.equal(world.upstream({ kind: 'mlpDown', token: 0, layer: 0 })[0]?.address.kind, 'mlpLeakyRelu');
  const source = sourceMapping('mlpLeakyRelu'); assert.equal(source.status, 'mapped');
  if (source.status === 'mapped') { assert.equal(source.file, 'model/value.ts'); assert.equal(source.symbol, 'leakyRelu'); assert.match(source.equation, /negativeSlope/); }
  const activation = experiment.variantRun.artifacts.find(artifact => artifact.kind === 'mlpLeakyRelu'); assert.ok(activation);
  assert.ok(!experiment.variantRun.artifacts.some(artifact => artifact.kind === 'mlpRelu'));
});

test('strict comparison stays strict while matched-variant requires the registered relationship', async () => {
  const { experiment } = await witness();
  const strict = compareRuns(experiment.baselineRun, experiment.variantRun);
  assert.equal(strict.compatible, false); assert.ok(strict.reasons.includes('model differs'));
  assert.equal(experiment.comparison.compatible, true); assert.equal(experiment.comparison.policy.id, 'matched-variant');
  assert.ok(experiment.comparison.artifacts.some(item => item.mapping.relationship === 'replaced' && item.mapping.sourceKind === 'mlpRelu' && item.mapping.targetKind === 'mlpLeakyRelu'));
  const incompatible = structuredClone(experiment.variantRun); (incompatible.manifest.modelInitialization as { sourceCheckpointId: string }).sourceCheckpointId = 'wrong';
  const refused = compareMatchedVariantRuns(experiment.baselineRun, incompatible);
  assert.equal(refused.compatible, false); assert.match(refused.reasons.join(' '), /base checkpoint/); assert.deepEqual(refused.artifacts, []);
});

test('variant preflight refuses identity, state, mapping, precision, and declaration shortcuts', async () => {
  const snapshot = await source();
  const base = { targetDefinition: LEAKY_RELU_MICROGPT_DEFINITION, sourceDefinition: CANONICAL_MICROGPT_DEFINITION,
    sourceCheckpointId: snapshot.id, source: snapshot, mapping: CANONICAL_TO_LEAKY_INITIALIZATION,
    numericPolicy: 'ECMAScript binary64; ordered scalar reductions' } as const;
  await assert.rejects(initializeModelVariant({ ...base, targetDefinition: { id: 'unknown', version: '1' } }), /Unknown model definition/);
  await assert.rejects(initializeModelVariant({ ...base, sourceDefinition: LEAKY_RELU_MICROGPT_DEFINITION }), /Wrong base/);
  await assert.rejects(initializeModelVariant({ ...base, sourceCheckpointId: 'wrong' }), /Wrong source checkpoint/);
  await assert.rejects(initializeModelVariant({ ...base, numericPolicy: 'float32' }), /Incompatible numeric policy/);
  const reordered = snapshot.state.parameterOrder.map(name => ({ source: name, target: name }));
  [reordered[0]!.target, reordered[1]!.target] = [reordered[1]!.target, reordered[0]!.target];
  await assert.rejects(initializeModelVariant({ ...base, parameterMapping: reordered }), /names and order/);
  await assert.rejects(initializeModelVariant({ ...base, parameterMapping: [...reordered].reverse() }), /names and order/);
  const wrongMapping = { id: 'same-shapes-implicit', version: 1 };
  await assert.rejects(initializeModelVariant({ ...base, mapping: wrongMapping }), /Unregistered/);
  for (const mutate of [
    (copy: TrainingSnapshot) => { delete copy.parameters[copy.parameterOrder[0]!]; },
    (copy: TrainingSnapshot) => { copy.parameters[copy.parameterOrder[0]!]![0]!.pop(); },
  ]) {
    const bad = state(); mutate(bad);
    await assert.rejects(archiveSnapshot(bad), /Invalid snapshot/);
  }
  const valid = modelDefinitions.require(LEAKY_RELU_MICROGPT_DEFINITION);
  const contribution = (overrides: Partial<ModelDefinitionContribution>): ModelDefinitionContribution => ({ ...valid,
    identity: { id: `invalid-${Math.random()}`, version: '1' }, ...overrides });
  for (const slope of [0, NaN, Infinity]) {
    assert.throws(() => new ModelDefinitionRegistry().register(contribution({ activation: { ...valid.activation, negativeSlope: slope } })), /Invalid Leaky ReLU/);
  }
  assert.throws(() => new ModelDefinitionRegistry().register(contribution({ replacement: { ...valid.replacement!, targetSemanticKind: 'undeclaredNode' as never } })), /replacement and activation/);
});

test('archive keeps variant admission separate and canonical snapshot/prediction immutable', async () => {
  const { snapshot, experiment } = await witness(); const beforeId = await snapshotId(snapshot.state);
  const canonicalBefore = predict(restoreTraining(snapshot.state).model, fixture.tokenIds);
  const archive = new SessionArchive(); await archive.addSnapshot(snapshot); await archive.addRun(experiment.baselineRun);
  await archive.addModelVariantExperiment(experiment);
  assert.equal(archive.modelVariantExperiments.get(experiment.id)?.variantRun.manifest.model.id, 'microgpt.leaky-relu');
  assert.equal(archive.runs.get(experiment.variantRun.manifest.runId)?.manifest.startingCheckpointId, experiment.initialization.id);
  assert.equal(await snapshotId(snapshot.state), beforeId);
  assert.deepEqual(predict(restoreTraining(snapshot.state).model, fixture.tokenIds), canonicalBefore);
  const tampered = structuredClone(experiment); (tampered.variantRun.manifest.modelInitialization as { sourceCheckpointId: string }).sourceCheckpointId = 'wrong';
  await assert.rejects(validateActivationVariantExperiment(tampered, snapshot), /initialization receipt|provenance|comparison/);
});
