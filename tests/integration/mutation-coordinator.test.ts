import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionArchive } from '../../archive/session.js';
import { SessionRetention } from '../../archive/retention.js';
import {
  MutationCoordinator,
  validateMutationReceipt,
  validateMutationRequest,
  validateMutationReconciliationResult,
  type MutationPublicationLifecycle,
  type MutationReceipt,
} from '../../app/worker/mutation-coordinator.js';
import {
  FaultMutationAuthority,
  FaultMutationTransport,
  mutationRequest,
  testIntentId,
  type TestMutationIntent,
} from '../support/mutation-authority.js';

const S0 = 'state:S0', S1 = 'state:S1', S2 = 'state:S2', SX = 'state:Sx';
const A: TestMutationIntent = Object.freeze({version: 1, kind: 'set-state', afterStateId: S1});
const B: TestMutationIntent = Object.freeze({version: 1, kind: 'set-state', afterStateId: S2});

function setup(state = S0) {
  const authority = new FaultMutationAuthority('authority:test-local-v1', 'integration:test-state-v1', state);
  const transport = new FaultMutationTransport(authority);
  const coordinator = new MutationCoordinator(authority.authorityId, authority.integrationId, state, transport);
  return {authority, transport, coordinator};
}

function publicationCounter() {
  let publishes = 0, releases = 0;
  const lifecycle: MutationPublicationLifecycle = {
    publish: () => { publishes++; },
    releaseNotCommitted: () => { releases++; },
  };
  return {lifecycle, get publishes() { return publishes; }, get releases() { return releases; }};
}

test('M4-D closed request, receipt, identity, and reconciliation schemas refuse malformed authority data', () => {
  const request = mutationRequest('operation:A', A, S0);
  assert.deepEqual(validateMutationRequest(request), request);
  for (const invalid of [
    {...request, unexpected: true},
    {...request, version: 2},
    {...request, operationId: ''},
    {...request, intentId: 'display-label'},
    {...request, expectedStateId: ' '.repeat(2)},
  ]) assert.throws(() => validateMutationRequest(invalid));
  assert.throws(() => validateMutationReceipt({version: 1, status: 'maybe'}));
  const receipt = {
    version: 1, status: 'committed', authorityId: request.authorityId, integrationId: request.integrationId,
    clientId: request.clientId, operationId: request.operationId, intentId: request.intentId,
    beforeStateId: request.expectedStateId, afterStateId: S1, receiptId: `sha256:${'0'.repeat(64)}`,
  };
  assert.deepEqual(validateMutationReceipt(receipt), receipt);
  for (const invalid of [
    {...receipt, version: 2}, {...receipt, status: 'unknown'}, {...receipt, afterStateId: ''},
    {...receipt, receiptId: 'receipt:display-label'}, {...receipt, extra: true},
  ]) assert.throws(() => validateMutationReceipt(invalid));
  assert.throws(() => validateMutationReconciliationResult({kind: 'absent', currentStateId: S0, extra: 1}));
  assert.equal(testIntentId(A), testIntentId({...A}));
  assert.notEqual(testIntentId(A), testIntentId(B));
});

test('M4-D expected-state preconditions refuse locally or block stale authority state before application', async () => {
  const local = setup();
  await assert.rejects(local.coordinator.submit(mutationRequest('operation:A', A, S1), A), /expected state/);
  assert.equal(local.transport.submitCalls, 0); assert.equal(local.authority.applications, 0);

  const stale = setup(); stale.authority.stateId = SX; const publication = publicationCounter();
  const blocked = await stale.coordinator.submit(mutationRequest('operation:A', A, S0), A, publication.lifecycle);
  assert.equal(blocked.phase, 'BLOCKED'); if (blocked.phase !== 'BLOCKED') assert.fail();
  assert.equal(blocked.reason, 'state_conflict'); assert.equal(blocked.authoritativeStateId, SX);
  assert.equal(stale.authority.applications, 0); assert.equal(publication.releases, 1);
});

test('M4-D witness A normal commit applies and publishes once, then targets authoritative S1', async () => {
  const {authority, coordinator} = setup(), publication = publicationCounter();
  const committed = await coordinator.submit(mutationRequest('operation:A', A, S0), A, publication.lifecycle);
  assert.equal(committed.phase, 'COMMITTED');
  if (committed.phase !== 'COMMITTED') assert.fail();
  assert.equal(committed.receipt.beforeStateId, S0); assert.equal(committed.receipt.afterStateId, S1);
  assert.equal(authority.applications, 1); assert.equal(authority.stateId, S1); assert.equal(publication.publishes, 1);
  const next = await coordinator.submit(mutationRequest('operation:B', B, S1), B);
  assert.equal(next.phase, 'COMMITTED'); assert.equal(authority.applications, 2); assert.equal(authority.stateId, S2);
});

test('M4-D witnesses B/H lost acknowledgement reconciles once and late/duplicate acknowledgements do not republish', async () => {
  const {authority, transport, coordinator} = setup(), publication = publicationCounter();
  transport.plan = {dropAcknowledgement: true, duplicateAcknowledgement: true};
  const unknown = await coordinator.submit(mutationRequest('operation:A', A, S0), A, publication.lifecycle);
  assert.equal(unknown.phase, 'INDETERMINATE'); assert.equal(authority.applications, 1); assert.equal(authority.stateId, S1);
  assert.equal(publication.publishes, 0); assert.equal(publication.releases, 0);
  await assert.rejects(coordinator.submit(mutationRequest('operation:B', B, S0), B), /unresolved operation/);
  transport.plan = {};
  const reconciled = await coordinator.reconcile();
  assert.equal(reconciled.phase, 'COMMITTED'); assert.equal(authority.applications, 1); assert.equal(publication.publishes, 1);
  await coordinator.acknowledge(transport.takeLateAcknowledgement());
  await coordinator.acknowledge(transport.takeLateAcknowledgement());
  assert.equal(coordinator.state.phase, 'COMMITTED'); assert.equal(publication.publishes, 1); assert.equal(authority.applications, 1);
});

test('M4-D witness C dropped request is authoritatively absent and safe retry preserves the operation identity', async () => {
  const {authority, transport, coordinator} = setup(), publication = publicationCounter();
  const request = mutationRequest('operation:A', A, S0);
  transport.plan = {dropRequest: true};
  assert.equal((await coordinator.submit(request, A, publication.lifecycle)).phase, 'INDETERMINATE');
  assert.equal(authority.applications, 0);
  transport.plan = {};
  const absent = await coordinator.reconcile();
  assert.equal(absent.phase, 'REFUSED');
  if (absent.phase !== 'REFUSED') assert.fail();
  assert.equal(absent.reason, 'definitely_not_committed'); assert.equal(publication.publishes, 0); assert.equal(publication.releases, 0);
  const committed = await coordinator.retry();
  assert.equal(committed.phase, 'COMMITTED'); assert.equal(authority.applications, 1); assert.equal(publication.publishes, 1);
  assert.equal(transport.submitCalls, 2); assert.deepEqual([...authority.ledger.keys()], [request.operationId]);
});

test('M4-D witnesses D/E duplicate delivery is idempotent and conflicting same-ID reuse is refused', () => {
  const authority = new FaultMutationAuthority('authority:test-local-v1', 'integration:test-state-v1', S0);
  const request = mutationRequest('operation:A', A, S0), first = authority.submit(request, A), duplicate = authority.submit(request, A);
  assert.equal(first.kind, 'committed'); assert.deepEqual(duplicate, first); assert.equal(authority.applications, 1);
  const differentIntent = authority.submit({...request, intentId: testIntentId(B)}, B);
  assert.deepEqual(differentIntent, {kind: 'refused', reason: 'operation_conflict', currentStateId: S1});
  const differentExpected = authority.submit({...request, expectedStateId: S1}, A);
  assert.deepEqual(differentExpected, {kind: 'refused', reason: 'operation_conflict', currentStateId: S1});
  assert.equal(authority.applications, 1); assert.deepEqual(authority.ledger.get(request.operationId), first.kind === 'committed' ? first.receipt : undefined);
});

test('M4-D transport-injected duplicate request still applies the operation exactly once', async () => {
  const {authority, transport, coordinator} = setup(); transport.plan = {duplicateRequest: true};
  const committed = await coordinator.submit(mutationRequest('operation:A', A, S0), A);
  assert.equal(committed.phase, 'COMMITTED'); assert.equal(transport.submitCalls, 1);
  assert.equal(authority.applications, 1); assert.equal(authority.ledger.size, 1);
});

test('M4-D witness F absent operation with authority advanced elsewhere blocks retry until explicit refresh', async () => {
  const {authority, transport, coordinator} = setup(), publication = publicationCounter();
  transport.plan = {dropRequest: true};
  await coordinator.submit(mutationRequest('operation:A', A, S0), A, publication.lifecycle);
  const externalIntent: TestMutationIntent = {version: 1, kind: 'set-state', afterStateId: SX};
  assert.equal(authority.submit(mutationRequest('operation:X', externalIntent, S0), externalIntent).kind, 'committed');
  transport.plan = {};
  const blocked = await coordinator.reconcile();
  assert.equal(blocked.phase, 'BLOCKED');
  if (blocked.phase !== 'BLOCKED') assert.fail();
  assert.equal(blocked.reason, 'state_conflict'); assert.equal(blocked.authoritativeStateId, SX);
  assert.equal(publication.releases, 1); assert.equal(authority.applications, 1);
  await assert.rejects(coordinator.retry());
  assert.equal(coordinator.refresh(SX).phase, 'READY');
});

test('M4-D witness G unavailable reconciliation stays indeterminate with no automatic churn', async () => {
  const {authority, transport, coordinator} = setup();
  transport.plan = {dropRequest: true};
  await coordinator.submit(mutationRequest('operation:A', A, S0), A);
  transport.plan = {reconciliationFailure: true};
  const first = await coordinator.reconcile();
  assert.equal(first.phase, 'INDETERMINATE'); assert.equal(transport.reconcileCalls, 1); assert.equal(authority.applications, 0);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(transport.reconcileCalls, 1, 'coordinator must not start a speculative reconciliation loop');
  const second = await coordinator.reconcile();
  assert.equal(second.phase, 'INDETERMINATE'); assert.equal(transport.reconcileCalls, 2);
  if (second.phase !== 'INDETERMINATE') assert.fail();
  assert.equal(second.operationId, 'operation:A');
  await assert.rejects(coordinator.submit(mutationRequest('operation:B', B, S0), B), /unresolved operation/);
  assert.equal(authority.stateId, S0, 'read-only authority inspection remains independently available');
});

test('M4-D delayed acknowledgement serializes the stream and a duplicate acknowledgement is inert', async () => {
  const {authority, transport, coordinator} = setup(), publication = publicationCounter();
  transport.plan = {delayAcknowledgement: true, duplicateAcknowledgement: true};
  const pending = coordinator.submit(mutationRequest('operation:A', A, S0), A, publication.lifecycle);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(coordinator.state.phase, 'SUBMITTING');
  await assert.rejects(coordinator.submit(mutationRequest('operation:B', B, S0), B), /unresolved operation/);
  transport.releaseAcknowledgement(); assert.equal((await pending).phase, 'COMMITTED');
  await coordinator.acknowledge(transport.takeLateAcknowledgement());
  assert.equal(authority.applications, 1); assert.equal(publication.publishes, 1);
});

test('M4-D malformed and conflicting reconciliation receipts block instead of being repaired', async () => {
  const malformed = setup(); malformed.transport.plan = {dropRequest: true};
  await malformed.coordinator.submit(mutationRequest('operation:A', A, S0), A);
  malformed.transport.plan = {reconciliationValue: {kind: 'committed', receipt: {version: 1, status: 'impossible'}}};
  const malformedState = await malformed.coordinator.reconcile();
  assert.equal(malformedState.phase, 'BLOCKED');
  if (malformedState.phase !== 'BLOCKED') assert.fail();
  assert.equal(malformedState.reason, 'integrity_error');

  for (const changed of [
    {operationId: 'operation:wrong'},
    {intentId: `sha256:${'1'.repeat(64)}`},
    {beforeStateId: SX},
    {authorityId: 'authority:wrong'},
    {integrationId: 'integration:wrong'},
    {clientId: 'client:wrong'},
  ]) {
    const mismatch = setup(); mismatch.transport.plan = {dropAcknowledgement: true};
    await mismatch.coordinator.submit(mutationRequest('operation:A', A, S0), A);
    const original = mismatch.authority.ledger.get('operation:A')!;
    mismatch.transport.plan = {reconciliationValue: {kind: 'committed', receipt: {...original, ...changed}}};
    const mismatchState = await mismatch.coordinator.reconcile();
    assert.equal(mismatchState.phase, 'BLOCKED'); if (mismatchState.phase !== 'BLOCKED') assert.fail();
    assert.equal(mismatchState.reason, 'integrity_error'); assert.match(mismatchState.detail, /does not match/);
  }

  const conflicting = setup();
  const committed = await conflicting.coordinator.submit(mutationRequest('operation:A', A, S0), A);
  assert.equal(committed.phase, 'COMMITTED'); if (committed.phase !== 'COMMITTED') assert.fail();
  const altered: MutationReceipt = {...committed.receipt, afterStateId: SX};
  const blocked = await conflicting.coordinator.acknowledge({kind: 'committed', receipt: altered});
  assert.equal(blocked.phase, 'BLOCKED'); if (blocked.phase !== 'BLOCKED') assert.fail();
  assert.equal(blocked.reason, 'integrity_error'); assert.equal(conflicting.authority.applications, 1);
});

test('M4-D authority and coordinator histories are bounded without evicting committed receipts', async () => {
  const authority = new FaultMutationAuthority('authority:test-local-v1', 'integration:test-state-v1', S0, 1);
  const first = authority.submit(mutationRequest('operation:A', A, S0), A); assert.equal(first.kind, 'committed');
  const refused = authority.submit(mutationRequest('operation:B', B, S1), B);
  assert.deepEqual(refused, {kind: 'refused', reason: 'ledger_full', currentStateId: S1});
  assert.equal(authority.applications, 1); assert.deepEqual(authority.submit(mutationRequest('operation:A', A, S0), A), first);

  const transport = new FaultMutationTransport(new FaultMutationAuthority(authority.authorityId, authority.integrationId, S0));
  const coordinator = new MutationCoordinator(authority.authorityId, authority.integrationId, S0, transport, 1);
  await coordinator.submit(mutationRequest('operation:A', A, S0), A);
  await assert.rejects(coordinator.submit(mutationRequest('operation:B', B, S1), B), /history is full/);
  assert.equal(transport.authority.applications, 1, 'capacity refusal must happen before another authority contact');
});

test('M4-D cancellation and local reset retain ambiguous operation identity and require reconciliation', async () => {
  for (const action of ['cancel', 'reset'] as const) {
    const {transport, coordinator} = setup(); transport.plan = {dropAcknowledgement: true};
    await coordinator.submit(mutationRequest(`operation:${action}`, A, S0), A);
    const state = action === 'cancel' ? coordinator.cancel() : coordinator.resetPresentation();
    assert.equal(state.phase, 'INDETERMINATE'); if (state.phase !== 'INDETERMINATE') assert.fail();
    assert.equal(state.operationId, `operation:${action}`); assert.match(state.reason, /reconciliation required/i);
    await assert.rejects(coordinator.submit(mutationRequest('operation:new', B, S0), B), /unresolved operation/);
    transport.plan = {}; assert.equal((await coordinator.reconcile()).phase, 'COMMITTED');
  }
});

test('M4-D retention publication authority spans ambiguity, commits once, and releases definite absence', async () => {
  const retention = new SessionRetention(new SessionArchive()); await retention.synchronize();
  const transaction = await retention.begin('canonical'); let publishes = 0, releases = 0;
  const lifecycle: MutationPublicationLifecycle = {
    publish: async () => { publishes++; await transaction.commit(); },
    releaseNotCommitted: () => { releases++; transaction.cancel(); },
  };
  const committed = setup(); committed.transport.plan = {dropAcknowledgement: true};
  await committed.coordinator.submit(mutationRequest('operation:A', A, S0), A, lifecycle);
  assert.equal(retention.status().reservationCount, 1); assert.equal(publishes, 0); assert.equal(releases, 0);
  committed.transport.plan = {}; await committed.coordinator.reconcile();
  assert.equal(retention.status().reservationCount, 0); assert.equal(publishes, 1); assert.equal(releases, 0);
  await committed.coordinator.acknowledge(committed.transport.takeLateAcknowledgement()); assert.equal(publishes, 1);

  const absentTransaction = await retention.begin('canonical');
  const absentLifecycle: MutationPublicationLifecycle = {publish: () => assert.fail(), releaseNotCommitted: () => { releases++; absentTransaction.cancel(); }};
  const absent = setup(); absent.transport.plan = {dropRequest: true};
  await absent.coordinator.submit(mutationRequest('operation:absent', A, S0), A, absentLifecycle);
  absent.transport.plan = {}; await absent.coordinator.reconcile();
  assert.equal(retention.status().reservationCount, 1, 'safe retry may retain the existing reservation');
  await absent.coordinator.releaseDefinitelyNotCommitted();
  assert.equal(retention.status().reservationCount, 0); assert.equal(releases, 1);
});
