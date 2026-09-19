import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learningPhasePresentation } from '../../app/spatial/learning.js';
import type { TrainingPhase } from '../../app/worker/training-execution.js';

test('learningPhasePresentation maps every TrainingPhase to distinct truthful presentation labels', () => {
  const phases: TrainingPhase[] = [
    'baseline forward',
    'training forward',
    'loss',
    'backward seed',
    'backward',
    'optimizer proposal',
    'candidate application',
    'candidate forward',
    'ready',
  ];

  const results = new Map(phases.map(p => [p, learningPhasePresentation(p)]));

  // Required explicit assertions from specification:
  // baseline forward !== backward
  assert.notEqual(results.get('baseline forward')!.label, results.get('backward')!.label);
  assert(!results.get('baseline forward')!.label.toLowerCase().includes('backward'));
  assert(!results.get('baseline forward')!.purpose.toLowerCase().includes('backward'));
  assert(!results.get('baseline forward')!.purpose.toLowerCase().includes('candidate'));

  // training forward !== backward
  assert.notEqual(results.get('training forward')!.label, results.get('backward')!.label);
  assert(!results.get('training forward')!.label.toLowerCase().includes('backward'));
  assert(!results.get('training forward')!.purpose.toLowerCase().includes('gradient'));

  // candidate forward !== backward
  assert.notEqual(results.get('candidate forward')!.label, results.get('backward')!.label);
  assert(!results.get('candidate forward')!.label.toLowerCase().includes('backward'));
  assert(!results.get('candidate forward')!.purpose.toLowerCase().includes('backward'));

  // candidate application !== Adam Proposal
  assert.notEqual(results.get('candidate application')!.label, results.get('optimizer proposal')!.label);
  assert.notEqual(results.get('candidate application')!.purpose, results.get('optimizer proposal')!.purpose);

  // Exact semantic mappings
  assert.equal(results.get('baseline forward')!.label, 'Learning · Baseline Forward');
  assert.equal(results.get('training forward')!.label, 'Learning · Training Forward');
  assert.equal(results.get('loss')!.label, 'Learning · Training Objective');
  assert.equal(results.get('backward seed')!.label, 'Learning · Backward Seed');
  assert.equal(results.get('backward')!.label, 'Learning · Backward');
  assert.equal(results.get('optimizer proposal')!.label, 'Learning · Adam Proposal');
  assert.equal(results.get('candidate application')!.label, 'Learning · Private Candidate');
  assert.equal(results.get('candidate forward')!.label, 'Learning · Candidate Forward');
  assert.equal(results.get('ready')!.label, 'Learning · Candidate Ready');

  // Assert distinct labels across all phases
  const labels = new Set(Array.from(results.values()).map(r => r.label));
  assert.equal(labels.size, phases.length, 'Every phase must produce a distinct label');

  // Contextual backwards label test
  const backwardPass = learningPhasePresentation('backward', { final: false, count: 42 });
  assert.equal(backwardPass.label, 'Learning · Backward pass (42 steps)');

  const backwardComplete = learningPhasePresentation('backward', { final: true });
  assert.equal(backwardComplete.label, 'Learning · Backward complete');

  // Contextual proposal label test with pin
  const proposalWithPin = learningPhasePresentation('optimizer proposal', { pinLabel: 'wte[0,0]' });
  assert.equal(proposalWithPin.label, 'Learning · Adam Proposal');
  assert(proposalWithPin.purpose.includes('wte[0,0]'));
});
