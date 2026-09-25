import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicDemo, publicDemoEnabled } from '../../app/presentation/public-demo.js';
import { createPublicLessonSession, transitionPublicLesson, type PublicLessonEvent, type PublicLessonSession, type PublicLessonTransitionContext } from '../../app/presentation/public-lesson-controller.js';

const evidence = { hasObjective: false, hasMatchingContribution: false, hasFinalGradient: false, hasPinnedProposal: false, hasCandidateComparison: false };
const timing = { opening: 1, beat: 1, result: 1, completion: 1 };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('demo route is opt-in and requests the normal Part 1 event', async () => {
  assert.equal(publicDemoEnabled(new URLSearchParams('presentation=spatial&demo=1')), true);
  assert.equal(publicDemoEnabled(new URLSearchParams('presentation=spatial')), false);
  assert.equal(publicDemoEnabled(new URLSearchParams('demo=1')), false);
  let session = transitionPublicLesson(createPublicLessonSession(), { type: 'PREDICTION_COMPLETE' }).session;
  const events: PublicLessonEvent[] = [];
  const context: PublicLessonTransitionContext = { evidence, driverPhase: 'idle' };
  const demo = new PublicDemo(true, () => true, event => {
    events.push(event);
    session = transitionPublicLesson(session, event, context).session;
  }, () => {}, timing);
  demo.sync(session, context, false);
  await tick();
  assert.equal(session.current, 'p1_represent');
  assert.deepEqual(events, [{ type: 'PRIMARY_ACTION' }]);
  demo.stop();
});

test('Part 2 waits for evidence; candidate discards and completion restarts', async () => {
  const events: PublicLessonEvent[] = [];
  const demo = new PublicDemo(true, () => true, event => { events.push(event); }, () => {}, timing);
  const objective: PublicLessonSession = { current: 'p2_objective', navigation: { mode: 'guided' } };
  const context: PublicLessonTransitionContext = { evidence, driverPhase: 'paused', trainingStarted: true };
  demo.sync(objective, context, false);
  await tick();
  assert.equal(events.length, 0);
  demo.sync(objective, { ...context, evidence: { ...evidence, hasObjective: true } }, false);
  await tick();
  assert.deepEqual(events, [{ type: 'PRIMARY_ACTION' }]);
  const candidate: PublicLessonSession = { current: 'candidate_ready', navigation: { mode: 'guided' } };
  demo.sync(candidate, { ...context, evidence: { ...evidence, hasCandidateComparison: true } }, false);
  await tick();
  assert.deepEqual(events.map(event => event.type), ['PRIMARY_ACTION', 'DISCARD_REQUESTED']);
  demo.sync({ current: 'tour_complete', outcome: 'discarded', navigation: { mode: 'guided' } }, { evidence, driverPhase: 'idle' }, false);
  await tick();
  assert.deepEqual(events.map(event => event.type), ['PRIMARY_ACTION', 'DISCARD_REQUESTED', 'RESTART_REQUESTED']);
  demo.stop();
});

test('takeover and hidden page cancel scheduled transitions', async () => {
  let visible = true;
  const events: PublicLessonEvent[] = [];
  const demo = new PublicDemo(true, () => visible, event => { events.push(event); }, () => {}, timing);
  const session: PublicLessonSession = { current: 'p1_represent', navigation: { mode: 'guided' } };
  const context: PublicLessonTransitionContext = { evidence, driverPhase: 'idle' };
  demo.sync(session, context, false);
  visible = false;
  demo.visibilityChanged();
  await tick();
  assert.deepEqual(events, []);
  visible = true;
  demo.sync(session, context, false);
  demo.stop();
  await tick();
  assert.deepEqual(events, []);
});
