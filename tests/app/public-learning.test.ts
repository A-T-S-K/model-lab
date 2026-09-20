import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelSession } from '../../app/worker/controller.js';
import { forwardReadModel, Address } from '../../app/spatial/forward.js';
import { objectiveLearningBounds, publicLearningScene } from '../../app/spatial/public-learning.js';
import type { ParameterPin, LearningModel } from '../../app/spatial/learning.js';
import type { TrainingProgress } from '../../app/worker/training-execution.js';

test('publicLearningScene keeps reverse dependencies truthful and admits only compact state-specific spatial evidence', async () => {
  const session = new ModelSession();
  const tag = { sessionId: 'public-learning-test', generationId: 0 };
  await session.handle({ ...tag, runId: 'init', command: 'initialize' });

  const response = await session.handle({ ...tag, runId: 'test-pred', command: 'predict', document: 'abca' });
  assert.equal(response.status, 'result');
  if (response.status !== 'result') return;

  const r = response.result;
  const f = forwardReadModel(r.run, r.snapshots[0]);
  const defaultPin: ParameterPin = { name: 'wte', row: 0, column: 0 };

  // Reverse-path truth remains exact and spatial.
  const sceneSvg = publicLearningScene({
    f,
    pin: defaultPin,
    isLearningActive: true,
    learningRouteStop: 0,
    tourState: 'p2_backward_trace',
    query: 3,
    head: 0,
  });

  const edgeRegex = /<path\s+[^>]*class="[^"]*reverse-causal-edge[^"]*"[^>]*>/g;
  const edgeMatches = sceneSvg.match(edgeRegex);
  assert(edgeMatches && edgeMatches.length > 0, 'Must have .reverse-causal-edge elements');

  for (const edgeTag of edgeMatches) {
    const getAttr = (name: string) => {
      const match = edgeTag.match(new RegExp(`${name}="([^"]+)"`));
      return match ? match[1] : undefined;
    };

    const fromKind = getAttr('data-reverse-from-kind');
    const fromToken = getAttr('data-reverse-from-token');
    const fromLayer = getAttr('data-reverse-from-layer');
    const fromHead = getAttr('data-reverse-from-head');

    const toKind = getAttr('data-reverse-to-kind');
    const toToken = getAttr('data-reverse-to-token');
    const toLayer = getAttr('data-reverse-to-layer');
    const toHead = getAttr('data-reverse-to-head');

    assert(fromKind, `Edge must have data-reverse-from-kind: ${edgeTag}`);
    assert(toKind, `Edge must have data-reverse-to-kind: ${edgeTag}`);

    const fromAddr: Address = {
      kind: fromKind as any,
      token: fromToken !== undefined ? parseInt(fromToken, 10) : 0,
      layer: fromLayer !== undefined ? parseInt(fromLayer, 10) : undefined,
      head: fromHead !== undefined ? parseInt(fromHead, 10) : undefined,
    };

    const toAddr: Address = {
      kind: toKind as any,
      token: toToken !== undefined ? parseInt(toToken, 10) : 0,
      layer: toLayer !== undefined ? parseInt(toLayer, 10) : undefined,
      head: toHead !== undefined ? parseInt(toHead, 10) : undefined,
    };

    const upstream = f.upstream(fromAddr);
    const matchesUpstream = upstream.some(dep => {
      const u = dep.address;
      if (u.kind !== toAddr.kind) return false;
      if (toToken !== undefined && u.token !== toAddr.token) return false;
      if (toAddr.layer !== undefined && u.layer !== toAddr.layer) return false;
      if (toAddr.head !== undefined && u.head !== toAddr.head) return false;
      return true;
    });

    assert(
      matchesUpstream,
      `Reverse causal edge from ${JSON.stringify(fromAddr)} to ${JSON.stringify(toAddr)} must be in f.upstream()`
    );
  }

  const mlpResidualEdge = edgeMatches.find(e => e.includes('data-reverse-from-kind="mlpResidual"') && e.includes('data-reverse-to-kind="attentionResidual"'));
  assert(mlpResidualEdge, 'Must have reverse-causal-edge for residual branch mlpResidual -> attentionResidual');

  const attnResidualEdge = edgeMatches.find(e => e.includes('data-reverse-from-kind="attentionResidual"') && e.includes('data-reverse-to-kind="embeddingNorm"'));
  assert(attnResidualEdge, 'Must have reverse-causal-edge for residual branch attentionResidual -> embeddingNorm');

  const falseShortcut = edgeMatches.find(e => e.includes('data-reverse-from-kind="headOutput"') && e.includes('data-reverse-to-kind="preAttentionNorm"'));
  assert.equal(falseShortcut, undefined, 'Must NOT have false shortcut headOutput <- preAttentionNorm');

  const guideRegex = /<path\s+[^>]*class="[^"]*reverse-region-guide[^"]*"[^>]*>/g;
  const guideMatches = sceneSvg.match(guideRegex);
  assert(guideMatches && guideMatches.length > 0, 'Must have .reverse-region-guide elements for fan-in/conceptual guides');

  assert(!sceneSvg.includes('reverse-truth-banner'), 'Reverse truth banner must not be duplicated in graph markup');
  assert(!sceneSvg.includes('Backward explanation path over the real computation'), 'Reverse truth prose belongs in the dock, not world-space text');
  assert(!sceneSvg.includes('parameter-learning-overlay'), 'TRACE must introduce dependency before contribution arithmetic');
  assert(!sceneSvg.includes('adam-learning-overlay'));
  assert(!sceneSvg.includes('objective-anchor'));

  // Objective is a compact authentic multi-position strip with provenance and no backward trace.
  const objectiveSvg = publicLearningScene({
    f,
    pin: defaultPin,
    isLearningActive: true,
    learningRouteStop: 0,
    tourState: 'p2_objective',
  });

  assert(objectiveSvg.includes('data-testid="objective-anchor"'));
  assert(objectiveSvg.includes('TRAINING OBJECTIVE'));
  assert(objectiveSvg.includes('POSITION → KNOWN TARGET → LOSS'));
  assert.equal((objectiveSvg.match(/data-testid="objective-row"/g) ?? []).length, f.targets.length);
  for (let position = 0; position < f.targets.length; position++) {
    assert(objectiveSvg.includes(`data-objective-position="${position}"`));
    assert(objectiveSvg.includes(`data-objective-target="${f.targets[position]}"`));
  }
  assert(objectiveSvg.includes('Mean loss: pending'));
  assert(objectiveSvg.includes('>PENDING<'));
  assert(!objectiveSvg.includes('reverse-causal-overlay'), 'MEASURE must not expose backward dependency structure');
  assert(!objectiveSvg.includes('parameter-learning-overlay'));
  assert(!objectiveSvg.includes('adam-learning-overlay'));
  const objectiveBounds = objectiveLearningBounds(f.targets.length);
  assert(objectiveBounds.x + objectiveBounds.width <= 4500, 'Objective strip must stay inside the fixed canonical public world');

  const mockDerivedLearning: LearningModel = {
    available: true,
    start: {} as any,
    end: {} as any,
    objective: {
      runId: 'test-run',
      origin: 'DERIVED',
      rows: f.input.map((inp, idx) => ({
        position: idx,
        input: inp,
        inputLabel: String(inp),
        target: f.targets![idx],
        targetLabel: String(f.targets![idx]),
        probability: 0.25,
        loss: 1.386,
        origin: 'DERIVED',
      })),
      mean: 1.386,
    },
    afterObjective: { runId: 'test-run', origin: 'DERIVED', rows: [], mean: 1.386 },
    backward: { visible: [], hiddenCount: 0, hiddenSubtotal: 0, sum: 0, gradient: 0, fanInAvailable: true, contributions: [] } as any,
    adam: { update: { before: 0.1, gradient: -0.01, mBefore: 0, vBefore: 0, mAfter: -0.001, vAfter: 0.0001, mHat: -0.01, vHat: 0.01, delta: -0.001, after: 0.101 } as any } as any,
  } as unknown as LearningModel;

  const derivedSvg = publicLearningScene({
    f,
    pin: defaultPin,
    isLearningActive: true,
    learning: mockDerivedLearning,
    learningRouteStop: 0,
    tourState: 'p2_objective',
  });
  assert.equal((derivedSvg.match(/data-testid="objective-row"/g) ?? []).length, f.targets.length);
  assert(derivedSvg.includes('Mean loss: 1.386'));
  assert(derivedSvg.includes('>DERIVED<'), 'Must retain DERIVED provenance');
  assert(!derivedSvg.includes('>OBSERVED<'), 'Must never label derived objective evidence observed');

  // Gradient contribution is a parameter-local marker only.
  const nonWtePin: ParameterPin = { name: 'mlp.fc', row: 1, column: 2 };
  const contributionProgress = {
    phase: 'backward',
    pin: 0,
    gradient: 7.5,
    final: false,
    contributions: [{
      child: 1,
      operand: 0,
      childAdjoint: 2,
      localDerivative: 3,
      contribution: 6,
      before: 1.5,
      after: 7.5,
      ordinal: 4,
    }],
    losses: [],
  } as unknown as TrainingProgress;

  const contributionSvg = publicLearningScene({
    f,
    pin: nonWtePin,
    training: contributionProgress,
    isLearningActive: true,
    learningRouteStop: 5,
    tourState: 'p2_gradient_contribution',
  });
  assert(contributionSvg.includes('mlp.fc[1,2]'), 'Selected parameter label must remain dynamic');
  assert(contributionSvg.includes('CONTRIBUTION 6'));
  assert(contributionSvg.includes('1.5 + 6 → 7.5'));
  assert(contributionSvg.includes('PARTIAL GRADIENT'));
  assert(contributionSvg.includes(' 7.5</tspan>'));
  assert(!contributionSvg.includes('2 × 3'), 'Child-adjoint × local-derivative arithmetic belongs in the dock');
  assert(!/first contribution|second contribution|arrived then/i.test(contributionSvg), 'Guided must not fabricate backward arrival chronology');
  assert(!contributionSvg.includes('objective-anchor'));
  assert(!contributionSvg.includes('adam-learning-overlay'));
  assert(contributionSvg.includes('reverse-causal-overlay'), 'Contribution keeps the same truthful backward dependency world');

  // Final Gradient reuses the same tether but drops stale contribution detail.
  const finalProgress = {
    ...contributionProgress,
    final: true,
    gradient: 7.5,
  } as unknown as TrainingProgress;
  const finalSvg = publicLearningScene({
    f,
    pin: nonWtePin,
    training: finalProgress,
    isLearningActive: true,
    learningRouteStop: 5,
    tourState: 'p2_final_gradient',
  });
  assert(finalSvg.includes('mlp.fc[1,2]'));
  assert(finalSvg.includes('FINAL GRADIENT'));
  assert(finalSvg.includes(' 7.5</tspan>'));
  assert(!finalSvg.includes('CONTRIBUTION 6'), 'Final-gradient marker must not preserve an old contribution as the teaching result');
  assert(!finalSvg.includes('param-overlay-accum'));
  assert(!finalSvg.includes('objective-anchor'));
  assert(!finalSvg.includes('adam-learning-overlay'));
  assert(finalSvg.includes('reverse-causal-overlay'), 'Final gradient remains grounded in the same backward dependency world');

  // Adam is a compact provisional marker. Pending never fabricates numbers.
  const pendingAdamSvg = publicLearningScene({
    f,
    pin: nonWtePin,
    isLearningActive: true,
    learningRouteStop: 6,
    tourState: 'p2_adam_proposal',
  });
  assert(pendingAdamSvg.includes('data-status="pending"'));
  assert(pendingAdamSvg.includes('data-testid="adam-proposal-pending"'));
  assert(pendingAdamSvg.includes('ADAM PROPOSAL'));
  assert(pendingAdamSvg.includes('mlp.fc[1,2]'));
  assert(pendingAdamSvg.includes('>PENDING<'));
  assert(pendingAdamSvg.includes('ACCEPTED MODEL UNCHANGED'));
  assert(!pendingAdamSvg.includes('-0.042'));
  assert(!pendingAdamSvg.includes('-0.0042'));
  assert(!pendingAdamSvg.includes('0.0270'));
  assert(!pendingAdamSvg.includes('objective-anchor'));
  assert(!pendingAdamSvg.includes('parameter-learning-overlay'));
  assert(!pendingAdamSvg.includes('reverse-causal-overlay'));

  const realProposalProgress = {
    phase: 'optimizer proposal',
    pin: 0,
    gradient: -0.055,
    final: true,
    contributions: [],
    losses: [],
    proposal: {
      index: 0,
      name: 'wte',
      row: 0,
      column: 0,
      biasCorrection1: 0.9,
      biasCorrection2: 0.999,
      before: 0.1234,
      gradient: -0.055,
      mBefore: 0.01,
      vBefore: 0.002,
      mAfter: 0.0035,
      vAfter: 0.0018,
      mHat: 0.035,
      vHat: 0.018,
      delta: -0.0025,
      after: 0.1259,
    },
  } as unknown as TrainingProgress;

  const readyAdamSvg = publicLearningScene({
    f,
    pin: defaultPin,
    training: realProposalProgress,
    isLearningActive: true,
    learningRouteStop: 6,
    tourState: 'p2_adam_proposal',
  });
  assert(readyAdamSvg.includes('data-status="ready"'));
  assert(readyAdamSvg.includes('wte[0,0] · PROVISIONAL'));
  assert(readyAdamSvg.includes('g -0.055 · stored m 0.01 · stored v 0.002'));
  assert(readyAdamSvg.includes('ADAM → θ 0.1234 → θ′ 0.1259'));
  assert(readyAdamSvg.includes('ACCEPTED MODEL UNCHANGED'));
  assert(!readyAdamSvg.includes('adam-proposal-table'));
  assert(!readyAdamSvg.includes('m′'));
  assert(!readyAdamSvg.includes('v′'));
  assert(!readyAdamSvg.includes('Delta:'));

  // Candidate Ready owns no graph callout boxes; comparison and decision stay in the dock.
  const candidateSvg = publicLearningScene({
    f,
    pin: defaultPin,
    training: { ...realProposalProgress, phase: 'ready' } as unknown as TrainingProgress,
    isLearningActive: true,
    tourState: 'candidate_ready',
  });
  assert.equal(candidateSvg, '');
});
