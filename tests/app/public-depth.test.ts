import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spatialReadModel, type SpatialReadModel } from '../../app/spatial/bindings.js';
import { forwardReadModel } from '../../app/spatial/forward.js';
import { resolvePublicDepthContext, type PublicDepthSelection } from '../../app/spatial/public-depth.js';
import { renderContextualDock, type DockDepth } from '../../app/spatial/contextual-dock.js';
import { getPublicTourContent, type PublicTourState } from '../../app/spatial/public-tour.js';
import { sourceBinding } from '../../app/presentation/source-binding.js';
import { ModelSession } from '../../app/worker/controller.js';

async function part1Model(): Promise<SpatialReadModel> {
  const session = new ModelSession();
  const tag = { sessionId: 'pd1-part1', generationId: 0 };
  await session.handle({ ...tag, runId: 'init', command: 'initialize' });
  const response = await session.handle({ ...tag, runId: 'predict', command: 'predict', document: 'abca' });
  assert.equal(response.status, 'result');
  if (response.status !== 'result') throw new Error('prediction fixture unavailable');
  const run = response.result.run;
  const snapshot = response.result.snapshots[0];
  const forward = forwardReadModel(run, snapshot);
  const source = sourceBinding(run, forward.vocabulary, undefined, run.manifest.runId, 'abca', 'forward');
  return spatialReadModel(run, snapshot, source, { layer: 0, query: 3, key: 0, head: 0, feature: 0 });
}

const part1States: readonly [PublicTourState, string][] = [
  ['p1_prediction_preview', 'prediction'],
  ['p1_represent', 'representation'],
  ['p1_qkv', 'qkv'],
  ['p1_attention_compare', 'attention-comparison'],
  ['p1_attention_weights', 'attention-weights'],
  ['p1_value_mixture', 'value-mixture'],
  ['p1_attention_integration', 'attention-integration'],
  ['p1_transform', 'mlp'],
  ['p1_score', 'logits'],
  ['p1_probabilities', 'probabilities'],
];

test('PD1 Part 1 depth ownership lives on canonical lesson content', () => {
  for (const [state, kind] of part1States) {
    const content = getPublicTourContent(state);
    assert(content.depthSpec, state + ' must own a depthSpec');
    assert.equal(content.depthSpec.kind, kind);
    assert(content.depthSpec.members.some(member => member.id === content.depthSpec!.defaultMember));
    const visit = (value: unknown): void => {
      if (typeof value === 'number') assert.fail(state + ' depthSpec must not own numeric evidence/configuration');
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(visit);
    };
    visit(content.depthSpec);
  }
});

test('PD1 resolver preserves grouped Representation and distinct normalization identity', async () => {
  const model = await part1Model();
  const ctx = resolvePublicDepthContext(getPublicTourContent('p1_represent'), model);
  assert(ctx);
  assert.deepEqual(ctx.members.map(member => member.memberId), [
    'tokenEmbedding',
    'positionEmbedding',
    'embeddingSum',
    'embeddingNorm',
    'preAttentionNorm',
  ]);
  assert.equal(ctx.members.find(member => member.memberId === 'embeddingNorm')?.residualSource, true);
  assert.notEqual(
    ctx.members.find(member => member.memberId === 'embeddingNorm')?.semanticId,
    ctx.members.find(member => member.memberId === 'preAttentionNorm')?.semanticId,
  );
  assert.equal(ctx.members.find(member => member.memberId === 'tokenEmbedding')?.parameter, 'wte');
  assert.equal(ctx.members.find(member => member.memberId === 'positionEmbedding')?.parameter, 'wpe');
});

test('PD1 Q K V stay bound to one canonical run position layer and head with three projections', async () => {
  const model = await part1Model();
  const ctx = resolvePublicDepthContext(getPublicTourContent('p1_qkv'), model);
  assert(ctx);
  assert.equal(ctx.canonical.run, model.source.sourceRunId);
  assert.equal(ctx.canonical.position, 3);
  assert.equal(ctx.canonical.layer, 0);
  assert.equal(ctx.canonical.head, 0);
  for (const id of ['q', 'k', 'v']) {
    const member = ctx.members.find(candidate => candidate.memberId === id);
    assert(member);
    assert.deepEqual(member.shape, [model.width]);
    assert.equal(member.head, 0);
  }
  assert.deepEqual(
    ['q', 'k', 'v'].map(id => ctx.members.find(member => member.memberId === id)?.parameter),
    ['layer0.attn_wq', 'layer0.attn_wk', 'layer0.attn_wv'],
  );
});

test('PD1 causal comparison and weights expose complete eligible support and never synthesize future zeros', async () => {
  const model = await part1Model();
  const compare = resolvePublicDepthContext(getPublicTourContent('p1_attention_compare'), model, { key: 2 });
  assert(compare);
  assert.deepEqual(compare.eligibleKeys, [0, 1, 2, 3]);
  assert.deepEqual(compare.futureKeys, model.forward.input.length > 4 ? Array.from({ length: model.forward.input.length - 4 }, (_, i) => i + 4) : []);
  assert.deepEqual(compare.members.filter(member => member.memberId === 'keys').map(member => member.key), [0, 1, 2, 3]);
  assert.equal(compare.selectedKey, 2);
  assert.equal(compare.completeSupport, true);

  const weights = resolvePublicDepthContext(getPublicTourContent('p1_attention_weights'), model, { key: 3 });
  assert(weights);
  assert.equal(weights.selectedKey, 3);
  assert.equal(weights.completeSupport, true);
  assert.equal(model.forward.values(weights.members.find(member => member.memberId === 'scores')!.address)?.length, 4);
  assert.equal(model.forward.values(weights.members.find(member => member.memberId === 'weights')!.address)?.length, 4);
});

test('PD1 Value mixture contains every authentic causal contributor and rejects missing support', async () => {
  const model = await part1Model();
  const content = getPublicTourContent('p1_value_mixture');
  const ctx = resolvePublicDepthContext(content, model);
  assert(ctx);
  const values = ctx.members.filter(member => member.memberId === 'values');
  assert.equal(values.length, ctx.eligibleKeys.length);
  assert.equal(ctx.completeSupport, true);

  const originalValues = model.forward.values;
  const originalArtifact = model.forward.artifact;
  const incomplete = {
    ...model,
    forward: {
      ...model.forward,
      values: (address: Parameters<typeof originalValues>[0]) =>
        address.kind === 'v' && address.token === 2 ? undefined : originalValues(address),
      artifact: (address: Parameters<typeof originalArtifact>[0]) =>
        address.kind === 'v' && address.token === 2 ? undefined : originalArtifact(address),
    },
  } as SpatialReadModel;
  const missing = resolvePublicDepthContext(content, incomplete);
  assert(missing);
  assert.equal(missing.completeSupport, false);
});

test('PD1 attention integration binds all heads, WO, saved residual source, and result', async () => {
  const model = await part1Model();
  const ctx = resolvePublicDepthContext(getPublicTourContent('p1_attention_integration'), model);
  assert(ctx);
  assert.equal(ctx.members.filter(member => member.memberId === 'headOutputs').length, model.forward.heads);
  for (const id of ['attentionOutput', 'attentionProjection', 'savedResidual', 'attentionResidual']) {
    assert(ctx.members.some(member => member.memberId === id), id);
  }
  assert.equal(ctx.members.find(member => member.memberId === 'attentionProjection')?.parameter, 'layer0.attn_wo');
  assert.equal(ctx.members.find(member => member.memberId === 'savedResidual')?.kind, 'embeddingNorm');
  assert.equal(ctx.members.find(member => member.memberId === 'savedResidual')?.residualSource, true);

  const headOne = resolvePublicDepthContext(getPublicTourContent('p1_attention_integration'), model, {
    member: 'headOutputs',
    head: 1,
    element: 2,
  });
  assert(headOne);
  assert.equal(headOne.selectedHead, 1);
  assert.equal(headOne.members.find(member => member.memberId === 'headOutputs' && member.head === 1)?.head, 1);
});

test('PD1 MLP exposes authentic 8 to 32 to 32 to 8 shapes and independent hidden/output selection', async () => {
  const model = await part1Model();
  const ctx = resolvePublicDepthContext(getPublicTourContent('p1_transform'), model, {
    member: 'mlpDown',
    hiddenFeature: 17,
    outputFeature: 6,
  });
  assert(ctx);
  const shape = (id: string) => ctx.members.find(member => member.memberId === id)?.shape?.[0];
  assert.equal(shape('preMlpNorm'), 8);
  assert.equal(shape('mlpUp'), 32);
  assert.equal(shape('mlpRelu'), 32);
  assert.equal(shape('mlpDown'), 8);
  assert.equal(shape('mlpResidual'), 8);
  assert.equal(ctx.hiddenFeature, 17);
  assert.equal(ctx.outputFeature, 6);
  const down = ctx.members.find(member => member.memberId === 'mlpDown');
  assert(down);
  assert.equal(model.forward.explain(down.address, ctx.outputFeature).terms?.length, 32);
});

test('PD1 logits and probabilities bind the complete vocabulary at the same run and position', async () => {
  const model = await part1Model();
  for (const state of ['p1_score', 'p1_probabilities'] as const) {
    const ctx = resolvePublicDepthContext(getPublicTourContent(state), model);
    assert(ctx);
    const logits = ctx.members.find(member => member.kind === 'logits');
    assert(logits);
    assert.equal(model.forward.values(logits.address)?.length, model.forward.vocabulary.length);
    if (state === 'p1_probabilities') {
      const probabilities = ctx.members.find(member => member.kind === 'probabilities');
      assert(probabilities);
      assert.equal(model.forward.values(probabilities.address)?.length, model.forward.vocabulary.length);
    }
    assert.equal(ctx.canonical.run, model.source.sourceRunId);
    assert.equal(ctx.canonical.position, 3);
    if (state === 'p1_score') {
      assert.equal(ctx.members.find(member => member.memberId === 'input')?.address.layer, model.forward.layers - 1);
    }
  }
});

test('PD1 temporary detail selection never changes canonical lesson identity', async () => {
  const model = await part1Model();
  for (const state of ['p1_represent', 'p1_qkv', 'p1_value_mixture', 'p1_transform'] as const) {
    const content = getPublicTourContent(state);
    const canonical = resolvePublicDepthContext(content, model);
    const temporary = resolvePublicDepthContext(content, model, {
      member: content.depthSpec?.members.at(-1)?.id,
      key: 2,
      element: 3,
      hiddenFeature: 17,
      outputFeature: 6,
    });
    assert(canonical && temporary);
    assert.equal(temporary.canonical.state, canonical.canonical.state);
    assert.equal(temporary.canonical.run, canonical.canonical.run);
    assert.equal(temporary.canonical.position, canonical.canonical.position);
    assert.equal(temporary.canonical.layer, canonical.canonical.layer);
    assert.equal(temporary.canonical.head, canonical.canonical.head);
    assert.equal(temporary.canonical.key, canonical.canonical.key);
  }
});


function publicDock(
  model: SpatialReadModel,
  state: Extract<PublicTourState, `p1_${string}`>,
  depth: DockDepth,
  selection: PublicDepthSelection = {},
): string {
  const tourContent = getPublicTourContent(state);
  const resolved = resolvePublicDepthContext(tourContent, model, selection);
  assert(resolved);
  return renderContextualDock({
    model,
    address: resolved.canonical.anchor,
    element: resolved.element,
    row: 0,
    column: 0,
    pin: { name: 'wte', row: 0, column: 0 },
    scalar: '',
    depth,
    profile: 'visitor',
    freeExplore: false,
    lessonProgress: tourContent.progress,
    routePurpose: tourContent.routePurpose,
    primaryAction: '',
    attentionAction: '',
    shortDetour: true,
    shortMessage: '',
    operatorControls: false,
    hasComparison: false,
    tourContent,
    publicDepthSelection: selection,
  });
}

test('PD1 contextual dock routes Part 1 grouped Values and Source before generic endpoint rendering', async () => {
  const model = await part1Model();
  const representation = publicDock(model, 'p1_represent', 'values');
  for (const id of ['tokenEmbedding', 'positionEmbedding', 'embeddingSum', 'embeddingNorm', 'preAttentionNorm']) {
    assert.match(representation, new RegExp('data-depth-member-section="' + id + '"'));
  }
  assert.match(representation, /saved residual source/);

  const qkv = publicDock(model, 'p1_qkv', 'values');
  for (const parameter of ['layer0.attn_wq', 'layer0.attn_wk', 'layer0.attn_wv']) assert.match(qkv, new RegExp(parameter));

  const source = publicDock(model, 'p1_represent', 'source');
  assert.match(source, /data-testid="public-depth-source-members"/);
  assert.match(source, /wte/);
  assert.match(source, /wpe/);
  assert.match(source, /embeddingNorm/);
  assert.match(source, /preAttentionNorm/);

  const logitsSource = publicDock(model, 'p1_score', 'source', { element: 2 });
  assert.match(logitsSource, /lm_head/);
  assert.match(logitsSource, /Detail selection: Vocabulary logits component \[2\]/);
});

test('PD1 contextual dock renders complete Value support and truthful MLP width-changing math', async () => {
  const model = await part1Model();
  const mixtureValues = publicDock(model, 'p1_value_mixture', 'values');
  assert.match(mixtureValues, /data-testid="value-mixture-support"/);
  assert.match(mixtureValues, /data-depth-key="3"/);
  for (const key of [0, 1, 2, 3]) assert.match(mixtureValues, new RegExp('Eligible Value contributor / key ' + key));

  const mixtureMath = publicDock(model, 'p1_value_mixture', 'math', {
    member: 'values',
    key: 2,
    element: 1,
  });
  assert.match(mixtureMath, /data-testid="mixture-contributors"/);
  assert.match(mixtureMath, /Selected scalar \/ Microscope/);
  assert.match(mixtureMath, /Eligible Value contributor \/ key 2 component \[1\]/);

  const integrationMath = publicDock(model, 'p1_attention_integration', 'math', {
    member: 'headOutputs',
    head: 1,
    element: 2,
  });
  assert.match(integrationMath, /Head 1, channel 2/);
  assert.match(integrationMath, /concat\[6\]/);
  const integrationSource = publicDock(model, 'p1_attention_integration', 'source', {
    member: 'headOutputs',
    head: 1,
    element: 2,
  });
  assert.match(integrationSource, /inspected head 1/);

  const mlpValues = publicDock(model, 'p1_transform', 'values', { hiddenFeature: 17, outputFeature: 6 });
  assert.match(mlpValues, /8 -&gt; 32 -&gt; 32 -&gt; 8|8 -> 32 -> 32 -> 8/);
  assert.match(mlpValues, /shape \[32\]/);

  const mlpMath = publicDock(model, 'p1_transform', 'math', {
    member: 'mlpDown',
    hiddenFeature: 17,
    outputFeature: 6,
  });
  assert.match(mlpMath, /data-testid="relu-calculation"/);
  assert.match(mlpMath, /data-testid="mlp-contraction-support"/);
  assert.match(mlpMath, /depends on all 32 hidden activations/);
  assert.match(mlpMath, /not paired one-to-one with hidden feature 17/);
});
