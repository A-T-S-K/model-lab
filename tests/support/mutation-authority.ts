import { createHash } from 'node:crypto';
import {
  validateMutationRequest,
  validateMutationReceipt,
  type MutationReceipt,
  type MutationRequest,
  type MutationSubmitResult,
  type MutationReconciliationResult,
  type MutationTransport,
} from '../../app/worker/mutation-coordinator.js';

export interface TestMutationIntent {
  readonly version: 1;
  readonly kind: 'set-state';
  readonly afterStateId: string;
}

function exactIntent(value: TestMutationIntent): TestMutationIntent {
  const candidate = value as unknown as Record<string, unknown>;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
      Object.keys(candidate).sort().join(',') !== 'afterStateId,kind,version' || candidate.version !== 1 || candidate.kind !== 'set-state' ||
      typeof candidate.afterStateId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:@/+\-]{0,127}$/.test(candidate.afterStateId))
    throw new Error('Invalid test mutation intent');
  return Object.freeze({version: 1, kind: 'set-state', afterStateId: candidate.afterStateId});
}

function hash(value: string): string { return `sha256:${createHash('sha256').update(value).digest('hex')}`; }

export function testIntentId(intentValue: TestMutationIntent): string {
  const intent = exactIntent(intentValue);
  return hash(JSON.stringify([intent.version, intent.kind, intent.afterStateId]));
}

function receiptFor(request: MutationRequest, afterStateId: string): MutationReceipt {
  const body = {
    version: 1 as const,
    status: 'committed' as const,
    authorityId: request.authorityId,
    integrationId: request.integrationId,
    clientId: request.clientId,
    operationId: request.operationId,
    intentId: request.intentId,
    beforeStateId: request.expectedStateId,
    afterStateId,
  };
  return validateMutationReceipt({...body, receiptId: hash(JSON.stringify(Object.values(body)))});
}

/** Bounded in-memory proof authority. It deliberately makes no restart-durability claim. */
export class FaultMutationAuthority {
  readonly ledger = new Map<string, MutationReceipt>();
  applications = 0;
  constructor(
    readonly authorityId: string,
    readonly integrationId: string,
    public stateId: string,
    readonly ledgerLimit = 8,
  ) {
    if (!Number.isInteger(ledgerLimit) || ledgerLimit < 1 || ledgerLimit > 32) throw new Error('Invalid test authority ledger limit');
  }

  submit(requestValue: MutationRequest, intentValue: TestMutationIntent): MutationSubmitResult {
    const request = validateMutationRequest(requestValue), intent = exactIntent(intentValue);
    if (request.authorityId !== this.authorityId || request.integrationId !== this.integrationId)
      return Object.freeze({kind: 'refused', reason: 'invalid_request', currentStateId: this.stateId});
    const existing = this.ledger.get(request.operationId);
    if (existing) {
      if (existing.intentId !== request.intentId || existing.beforeStateId !== request.expectedStateId || existing.clientId !== request.clientId)
        return Object.freeze({kind: 'refused', reason: 'operation_conflict', currentStateId: this.stateId});
      return Object.freeze({kind: 'committed', receipt: existing});
    }
    if (testIntentId(intent) !== request.intentId)
      return Object.freeze({kind: 'refused', reason: 'invalid_request', currentStateId: this.stateId});
    if (request.expectedStateId !== this.stateId)
      return Object.freeze({kind: 'refused', reason: 'state_conflict', currentStateId: this.stateId});
    if (this.ledger.size >= this.ledgerLimit)
      return Object.freeze({kind: 'refused', reason: 'ledger_full', currentStateId: this.stateId});
    const receipt = receiptFor(request, intent.afterStateId);
    this.applications++;
    this.stateId = intent.afterStateId;
    this.ledger.set(request.operationId, receipt);
    return Object.freeze({kind: 'committed', receipt});
  }

  reconcile(requestValue: MutationRequest): MutationReconciliationResult {
    const request = validateMutationRequest(requestValue), receipt = this.ledger.get(request.operationId);
    if (request.authorityId !== this.authorityId || request.integrationId !== this.integrationId) throw new Error('Unknown test mutation authority or integration');
    return receipt ? Object.freeze({kind: 'committed', receipt}) : Object.freeze({kind: 'absent', currentStateId: this.stateId});
  }
}

export interface FaultPlan {
  dropRequest?: boolean;
  dropAcknowledgement?: boolean;
  delayAcknowledgement?: boolean;
  duplicateRequest?: boolean;
  duplicateAcknowledgement?: boolean;
  reconciliationFailure?: boolean;
  reconciliationValue?: unknown;
}

/** Deterministic transport faults remain selected until the caller clears the plan. */
export class FaultMutationTransport implements MutationTransport<TestMutationIntent> {
  plan: FaultPlan = {};
  submitCalls = 0;
  reconcileCalls = 0;
  readonly lateAcknowledgements: unknown[] = [];
  #releaseDelay?: () => void;

  constructor(readonly authority: FaultMutationAuthority) {}

  async submit(request: MutationRequest, intent: TestMutationIntent): Promise<unknown> {
    this.submitCalls++;
    if (this.plan.dropRequest) throw new Error('Mutation request transport unavailable before delivery');
    const result = this.authority.submit(request, intent);
    if (this.plan.duplicateRequest) this.authority.submit(request, intent);
    if (this.plan.duplicateAcknowledgement) this.lateAcknowledgements.push(structuredClone(result));
    if (this.plan.dropAcknowledgement) {
      this.lateAcknowledgements.push(structuredClone(result));
      throw new Error('Mutation acknowledgement lost after delivery');
    }
    if (this.plan.delayAcknowledgement) await new Promise<void>(resolve => { this.#releaseDelay = resolve; });
    return result;
  }

  async reconcile(request: MutationRequest): Promise<unknown> {
    this.reconcileCalls++;
    if (this.plan.reconciliationFailure) throw new Error('Reconciliation transport unavailable');
    if ('reconciliationValue' in this.plan) return this.plan.reconciliationValue;
    return this.authority.reconcile(request);
  }

  releaseAcknowledgement(): void { this.#releaseDelay?.(); this.#releaseDelay = undefined; }
  takeLateAcknowledgement(): unknown {
    const value = this.lateAcknowledgements.shift();
    if (!value) throw new Error('No delayed acknowledgement');
    return value;
  }
}

export function mutationRequest(operationId: string, intent: TestMutationIntent, expectedStateId: string): MutationRequest {
  return Object.freeze({
    version: 1,
    authorityId: 'authority:test-local-v1',
    integrationId: 'integration:test-state-v1',
    clientId: 'client:test-session-v1',
    operationId,
    intentId: testIntentId(intent),
    expectedStateId,
  });
}
