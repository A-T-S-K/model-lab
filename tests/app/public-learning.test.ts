import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelSession } from '../../app/worker/controller.js';
import { forwardReadModel, Address } from '../../app/spatial/forward.js';
import { publicLearningScene } from '../../app/spatial/public-learning.js';
import type { ParameterPin, LearningModel } from '../../app/spatial/learning.js';
import type { TrainingProgress } from '../../app/worker/training-execution.js';

test('publicLearningScene enforces exact-address reverse-causal edges, truthful targets, dynamic pins, and removes fabricated Adam numbers', async () => {
  const session = new ModelSession();
  const tag = { sessionId: 'public-learning-test', generationId: 0 };
  await session.handle({ ...tag, runId: 'init', command: 'initialize' });

  const response = await session.handle({ ...tag, runId: 'test-pred', command: 'predict', document: 'abca' });
  assert.equal(response.status, 'result');
  if (response.status !== 'result') return;

  const r = response.result;
  const f = forwardReadModel(r.run, r.snapshots[0]);
  const defaultPin: ParameterPin = { name: 'wte', row: 0, column: 0 };

  // 1. Exact address attributes on every .reverse-causal-edge and upstream validity
  const sceneSvg = publicLearningScene({
    f,
    pin: defaultPin,
    isLearningActive: true,
    learningRouteStop: 1,
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

    // Assert that toAddr is an authoritative upstream dependency of fromAddr in forward model
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

  // 2. Residual branches: mlpResidual -> attentionResidual, and attentionResidual -> embeddingNorm
  const mlpResidualEdge = edgeMatches.find(e => e.includes('data-reverse-from-kind="mlpResidual"') && e.includes('data-reverse-to-kind="attentionResidual"'));
  assert(mlpResidualEdge, 'Must have reverse-causal-edge for residual branch mlpResidual -> attentionResidual');

  const attnResidualEdge = edgeMatches.find(e => e.includes('data-reverse-from-kind="attentionResidual"') && e.includes('data-reverse-to-kind="embeddingNorm"'));
  assert(attnResidualEdge, 'Must have reverse-causal-edge for residual branch attentionResidual -> embeddingNorm');

  // 3. Prohibit false shortcut: headOutput <- preAttentionNorm
  const falseShortcut = edgeMatches.find(e => e.includes('data-reverse-from-kind="headOutput"') && e.includes('data-reverse-to-kind="preAttentionNorm"'));
  assert.equal(falseShortcut, undefined, 'Must NOT have false shortcut headOutput <- preAttentionNorm');

  // 4. Multi-key fan-in and conceptual landmarks use .reverse-region-guide
  const guideRegex = /<path\s+[^>]*class="[^"]*reverse-region-guide[^"]*"[^>]*>/g;
  const guideMatches = sceneSvg.match(guideRegex);
  assert(guideMatches && guideMatches.length > 0, 'Must have .reverse-region-guide elements for fan-in/conceptual guides');

  // 5. Objective Anchor: All 5 canonical positions, targets from f.targets, and truthful provenance
  assert(f.targets && f.targets.length >= 5, 'ForwardModel must have authoritative targets');
  const objectiveSvg = publicLearningScene({
    f,
    pin: defaultPin,
    isLearningActive: true,
    learningRouteStop: 0,
  });

  for (let i = 0; i < 5; i++) {
    assert(objectiveSvg.includes(`p${i}`), `Objective anchor must include position p${i}`);
    const expectedTarget = f.targets[i];
    const expectedTargetLabel = (f.vocabulary && f.vocabulary[expectedTarget]) ?? String(expectedTarget);
    assert(
      objectiveSvg.includes(`target ${expectedTarget}`) || objectiveSvg.includes(expectedTargetLabel),
      `Objective anchor must present authoritative target ${expectedTarget} at p${i}`
    );
  }
  // Pending provenance when uncalculated
  assert(objectiveSvg.includes('[PENDING]'), 'Objective anchor must show [PENDING] when uncomputed');
  assert(!objectiveSvg.includes('[OBSERVED]'), 'Objective anchor must NOT claim [OBSERVED] when uncomputed');

  // Objective provenance with completed LearningModel: DERIVED must never be labeled OBSERVED
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
  });
  assert(derivedSvg.includes('[DERIVED]'), 'Must retain [DERIVED] provenance');
  assert(!derivedSvg.includes('[OBSERVED]'), 'Must NEVER label DERIVED as [OBSERVED]');

  // 6. Dynamic Parameter Pin derivation (no hardcoded wte[0,0] fallback)
  const nonWtePin: ParameterPin = { name: 'mlp.fc', row: 1, column: 2 };
  const customPinSvg = publicLearningScene({
    f,
    pin: nonWtePin,
    isLearningActive: true,
    learningRouteStop: 6,
  });
  assert(customPinSvg.includes('mlp.fc[1,2]'), 'Must dynamically derive parameter pin label mlp.fc[1,2]');
  assert(!customPinSvg.includes('wte[0,0]'), 'Must NOT have hard-coded wte[0,0] fallback');

  // 7. Adam Proposal truth: honest pending state with zero fabricated numbers
  const pendingAdamSvg = publicLearningScene({
    f,
    pin: nonWtePin,
    isLearningActive: true,
    learningRouteStop: 6,
  });
  assert(pendingAdamSvg.includes('data-status="pending"'), 'Adam overlay must be pending when proposal is undefined');
  assert(pendingAdamSvg.includes('data-testid="adam-proposal-pending"'), 'Must contain adam-proposal-pending testid');
  assert(pendingAdamSvg.includes('Optimizer proposal pending'), 'Must state optimizer proposal is pending');
  assert(pendingAdamSvg.includes('Persistent optimizer state belongs to mlp.fc[1,2]'), 'Must explain persistent optimizer state belongs to pin');
  // Confirm absence of fabricated numbers
  assert(!pendingAdamSvg.includes('-0.042'), 'Must NOT contain fabricated gradient -0.042');
  assert(!pendingAdamSvg.includes('-0.0042'), 'Must NOT contain fabricated moment -0.0042');
  assert(!pendingAdamSvg.includes('0.0270'), 'Must NOT contain fabricated update 0.0270');

  // Authentic proposal rendering when proposal is provided
  const realProposalProgress: TrainingProgress = {
    phase: 'ready',
    startingSnapshotId: 'snap1234567890',
    acceptedStep: 1,
    gradient: -0.055,
    final: true,
    gradientSourceRunId: 'run1',
    contributions: [],
    losses: [],
    pin: 0,
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
    pin: nonWtePin,
    training: realProposalProgress,
    isLearningActive: true,
    learningRouteStop: 6,
  });
  assert(readyAdamSvg.includes('data-status="ready"'), 'Adam overlay must be ready when proposal exists');
  assert(readyAdamSvg.includes('data-testid="adam-proposal-table"'), 'Must contain proposal table');
  assert(readyAdamSvg.includes('0.1234'), 'Must contain authentic proposal before value');
  assert(readyAdamSvg.includes('0.1259'), 'Must contain authentic proposal after value');
});
