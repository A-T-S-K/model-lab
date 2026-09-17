const ID_LIMIT = 128;
const RECEIPT_HISTORY_LIMIT = 64;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/+\-]{0,127}$/;
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;

export type MutationRefusalReason =
  | 'state_conflict'
  | 'operation_conflict'
  | 'invalid_request'
  | 'ledger_full';

export interface MutationRequest {
  readonly version: 1;
  readonly authorityId: string;
  readonly integrationId: string;
  readonly clientId: string;
  readonly operationId: string;
  readonly intentId: string;
  readonly expectedStateId: string;
}

export interface MutationReceipt {
  readonly version: 1;
  readonly status: 'committed';
  readonly authorityId: string;
  readonly integrationId: string;
  readonly clientId: string;
  readonly operationId: string;
  readonly intentId: string;
  readonly beforeStateId: string;
  readonly afterStateId: string;
  readonly receiptId: string;
}

export type MutationSubmitResult =
  | { readonly kind: 'committed'; readonly receipt: MutationReceipt }
  | { readonly kind: 'refused'; readonly reason: MutationRefusalReason; readonly currentStateId: string };

export type MutationReconciliationResult =
  | { readonly kind: 'committed'; readonly receipt: MutationReceipt }
  | { readonly kind: 'absent'; readonly currentStateId: string };

export interface MutationTransport<Intent> {
  submit(request: MutationRequest, intent: Intent): Promise<unknown>;
  reconcile(request: MutationRequest): Promise<unknown>;
}

/** A caller may retain durable capacity from dispatch through authoritative resolution. */
export interface MutationPublicationLifecycle {
  publish(receipt: MutationReceipt): void | Promise<void>;
  releaseNotCommitted(): void | Promise<void>;
}

interface ActiveMutation<Intent> {
  readonly request: MutationRequest;
  readonly intent: Intent;
  readonly publication?: MutationPublicationLifecycle;
  publicationSettled: boolean;
}

export type MutationCoordinatorState =
  | { readonly phase: 'READY'; readonly authoritativeStateId: string }
  | { readonly phase: 'SUBMITTING'; readonly operationId: string; readonly expectedStateId: string }
  | { readonly phase: 'COMMITTED'; readonly receipt: MutationReceipt }
  | { readonly phase: 'REFUSED'; readonly operationId: string; readonly reason: MutationRefusalReason | 'definitely_not_committed'; readonly authoritativeStateId: string }
  | { readonly phase: 'INDETERMINATE'; readonly operationId: string; readonly expectedStateId: string; readonly reason: string }
  | { readonly phase: 'RECONCILING'; readonly operationId: string; readonly expectedStateId: string }
  | { readonly phase: 'BLOCKED'; readonly operationId: string; readonly reason: 'state_conflict' | 'integrity_error' | 'publication_error'; readonly detail: string; readonly authoritativeStateId?: string };

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
    throw new Error(`${label} has unknown or missing fields`);
}

function opaqueId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length > ID_LIMIT || !OPAQUE_ID.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function digestId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_ID.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function literal<T extends string | number>(value: unknown, expected: T, label: string): T {
  if (value !== expected) throw new Error(`Invalid ${label}`);
  return expected;
}

export function validateMutationRequest(value: unknown): MutationRequest {
  const input = record(value, 'Mutation request');
  exactKeys(input, ['version', 'authorityId', 'integrationId', 'clientId', 'operationId', 'intentId', 'expectedStateId'], 'Mutation request');
  return Object.freeze({
    version: literal(input.version, 1, 'mutation request version'),
    authorityId: opaqueId(input.authorityId, 'authority ID'),
    integrationId: opaqueId(input.integrationId, 'integration ID'),
    clientId: opaqueId(input.clientId, 'client ID'),
    operationId: opaqueId(input.operationId, 'operation ID'),
    intentId: digestId(input.intentId, 'intent digest'),
    expectedStateId: opaqueId(input.expectedStateId, 'expected state ID'),
  });
}

export function validateMutationReceipt(value: unknown): MutationReceipt {
  const input = record(value, 'Mutation receipt');
  exactKeys(input, ['version', 'status', 'authorityId', 'integrationId', 'clientId', 'operationId', 'intentId', 'beforeStateId', 'afterStateId', 'receiptId'], 'Mutation receipt');
  return Object.freeze({
    version: literal(input.version, 1, 'mutation receipt version'),
    status: literal(input.status, 'committed', 'mutation receipt status'),
    authorityId: opaqueId(input.authorityId, 'receipt authority ID'),
    integrationId: opaqueId(input.integrationId, 'receipt integration ID'),
    clientId: opaqueId(input.clientId, 'receipt client ID'),
    operationId: opaqueId(input.operationId, 'receipt operation ID'),
    intentId: digestId(input.intentId, 'receipt intent digest'),
    beforeStateId: opaqueId(input.beforeStateId, 'receipt before-state ID'),
    afterStateId: opaqueId(input.afterStateId, 'receipt after-state ID'),
    receiptId: digestId(input.receiptId, 'receipt ID'),
  });
}

function refusalReason(value: unknown): MutationRefusalReason {
  if (value === 'state_conflict' || value === 'operation_conflict' || value === 'invalid_request' || value === 'ledger_full') return value;
  throw new Error('Invalid mutation refusal reason');
}

export function validateMutationSubmitResult(value: unknown): MutationSubmitResult {
  const input = record(value, 'Mutation submit result');
  if (input.kind === 'committed') {
    exactKeys(input, ['kind', 'receipt'], 'Committed mutation result');
    return Object.freeze({kind: 'committed', receipt: validateMutationReceipt(input.receipt)});
  }
  if (input.kind === 'refused') {
    exactKeys(input, ['kind', 'reason', 'currentStateId'], 'Refused mutation result');
    return Object.freeze({kind: 'refused', reason: refusalReason(input.reason), currentStateId: opaqueId(input.currentStateId, 'current state ID')});
  }
  throw new Error('Invalid mutation submit result kind');
}

export function validateMutationReconciliationResult(value: unknown): MutationReconciliationResult {
  const input = record(value, 'Mutation reconciliation result');
  if (input.kind === 'committed') {
    exactKeys(input, ['kind', 'receipt'], 'Committed reconciliation result');
    return Object.freeze({kind: 'committed', receipt: validateMutationReceipt(input.receipt)});
  }
  if (input.kind === 'absent') {
    exactKeys(input, ['kind', 'currentStateId'], 'Absent reconciliation result');
    return Object.freeze({kind: 'absent', currentStateId: opaqueId(input.currentStateId, 'current state ID')});
  }
  throw new Error('Invalid mutation reconciliation result kind');
}

function sameReceipt(left: MutationReceipt, right: MutationReceipt): boolean {
  return left.version === right.version && left.status === right.status && left.authorityId === right.authorityId &&
    left.integrationId === right.integrationId && left.clientId === right.clientId && left.operationId === right.operationId &&
    left.intentId === right.intentId && left.beforeStateId === right.beforeStateId && left.afterStateId === right.afterStateId &&
    left.receiptId === right.receiptId;
}

/** One serialized mutation stream for one reviewed authority/integration binding. */
export class MutationCoordinator<Intent> {
  #state: MutationCoordinatorState;
  #active?: ActiveMutation<Intent>;
  readonly #receipts = new Map<string, MutationReceipt>();

  constructor(
    readonly authorityId: string,
    readonly integrationId: string,
    initialStateId: string,
    readonly transport: MutationTransport<Intent>,
    readonly receiptHistoryLimit = RECEIPT_HISTORY_LIMIT,
  ) {
    opaqueId(authorityId, 'authority ID'); opaqueId(integrationId, 'integration ID'); opaqueId(initialStateId, 'initial state ID');
    if (!Number.isInteger(receiptHistoryLimit) || receiptHistoryLimit < 1 || receiptHistoryLimit > 256) throw new Error('Invalid receipt history limit');
    this.#state = Object.freeze({phase: 'READY', authoritativeStateId: initialStateId});
  }

  get state(): MutationCoordinatorState { return this.#state; }
  get mutationBlocked(): boolean { return this.#state.phase === 'SUBMITTING' || this.#state.phase === 'INDETERMINATE' || this.#state.phase === 'RECONCILING' || this.#state.phase === 'BLOCKED'; }

  async submit(requestValue: MutationRequest, intent: Intent, publication?: MutationPublicationLifecycle): Promise<MutationCoordinatorState> {
    const request = validateMutationRequest(requestValue);
    if (request.authorityId !== this.authorityId || request.integrationId !== this.integrationId) throw new Error('Unknown mutation authority or integration identity');
    if (this.#active || this.mutationBlocked) throw new Error('Mutation stream has an unresolved operation');
    if (this.#receipts.size >= this.receiptHistoryLimit) throw new Error('Bounded receipt history is full');
    const current = this.#authoritativeState();
    if (request.expectedStateId !== current) throw new Error('Mutation expected state does not match the known authoritative state');
    this.#active = {request, intent, publication, publicationSettled: false};
    return this.#dispatch();
  }

  async retry(): Promise<MutationCoordinatorState> {
    if (!this.#active || this.#state.phase !== 'REFUSED' || this.#state.reason !== 'definitely_not_committed') throw new Error('Mutation is not eligible for safe retry');
    return this.#dispatch();
  }

  async reconcile(): Promise<MutationCoordinatorState> {
    const active = this.#active;
    if (!active || this.#state.phase !== 'INDETERMINATE') throw new Error('No indeterminate mutation to reconcile');
    this.#state = Object.freeze({phase: 'RECONCILING', operationId: active.request.operationId, expectedStateId: active.request.expectedStateId});
    let value: unknown;
    try { value = await this.transport.reconcile(active.request); }
    catch (error) {
      this.#state = Object.freeze({phase: 'INDETERMINATE', operationId: active.request.operationId, expectedStateId: active.request.expectedStateId, reason: error instanceof Error ? error.message : 'Reconciliation unavailable'});
      return this.#state;
    }
    let result: MutationReconciliationResult;
    try { result = validateMutationReconciliationResult(value); }
    catch (error) { return this.#blockIntegrity(active.request.operationId, error instanceof Error ? error.message : 'Malformed reconciliation result'); }
    if (result.kind === 'committed') return await this.#acceptReceipt(result.receipt);
    if (result.currentStateId === active.request.expectedStateId) {
      this.#state = Object.freeze({phase: 'REFUSED', operationId: active.request.operationId, reason: 'definitely_not_committed', authoritativeStateId: result.currentStateId});
    } else {
      await this.#releaseNotCommitted(active);
      this.#state = Object.freeze({phase: 'BLOCKED', operationId: active.request.operationId, reason: 'state_conflict', detail: 'Operation is absent but authority state changed; refresh or rebase is required', authoritativeStateId: result.currentStateId});
    }
    return this.#state;
  }

  /** Accepts a delayed or duplicated original acknowledgement without republishing it. */
  async acknowledge(value: unknown): Promise<MutationCoordinatorState> {
    let result: MutationSubmitResult;
    try { result = validateMutationSubmitResult(value); }
    catch (error) {
      const operationId = this.#active?.request.operationId ?? (this.#state.phase === 'COMMITTED' ? this.#state.receipt.operationId : 'unknown-operation');
      return this.#blockIntegrity(operationId, error instanceof Error ? error.message : 'Malformed mutation acknowledgement');
    }
    if (result.kind !== 'committed') throw new Error('A late refusal cannot resolve a mutation acknowledgement');
    return this.#acceptReceipt(result.receipt);
  }

  /** Cancellation after dispatch is only presentation intent; it cannot assert rollback. */
  cancel(): MutationCoordinatorState {
    if (this.#active && (this.#state.phase === 'SUBMITTING' || this.#state.phase === 'INDETERMINATE' || this.#state.phase === 'RECONCILING'))
      this.#state = Object.freeze({phase: 'INDETERMINATE', operationId: this.#active.request.operationId, expectedStateId: this.#active.request.expectedStateId, reason: 'Cancellation cannot prove whether the authority committed; reconciliation required'});
    return this.#state;
  }

  /** A local presentation reset never clears an unresolved surviving-authority mutation. */
  resetPresentation(): MutationCoordinatorState {
    if (this.#active && (this.#state.phase === 'SUBMITTING' || this.#state.phase === 'INDETERMINATE' || this.#state.phase === 'RECONCILING'))
      this.#state = Object.freeze({phase: 'INDETERMINATE', operationId: this.#active.request.operationId, expectedStateId: this.#active.request.expectedStateId, reason: 'Local reset cannot resolve remote authority state; reconciliation required'});
    return this.#state;
  }

  /** Caller abandons an authoritatively absent operation and releases its publication authority. */
  async releaseDefinitelyNotCommitted(): Promise<MutationCoordinatorState> {
    const active = this.#active;
    if (!active || this.#state.phase !== 'REFUSED' || this.#state.reason !== 'definitely_not_committed') throw new Error('Operation is not definitely absent');
    await this.#releaseNotCommitted(active); this.#active = undefined;
    this.#state = Object.freeze({phase: 'READY', authoritativeStateId: active.request.expectedStateId});
    return this.#state;
  }

  /** Explicit caller refresh/rebase is required after an absent operation meets changed state. */
  refresh(authoritativeStateId: string): MutationCoordinatorState {
    const stateId = opaqueId(authoritativeStateId, 'refreshed authoritative state ID');
    if (this.#state.phase !== 'BLOCKED' || this.#state.reason !== 'state_conflict' || this.#state.authoritativeStateId !== stateId)
      throw new Error('Refresh does not match the reconciled authoritative state');
    this.#active = undefined;
    this.#state = Object.freeze({phase: 'READY', authoritativeStateId: stateId});
    return this.#state;
  }

  async #dispatch(): Promise<MutationCoordinatorState> {
    const active = this.#active!;
    this.#state = Object.freeze({phase: 'SUBMITTING', operationId: active.request.operationId, expectedStateId: active.request.expectedStateId});
    let value: unknown;
    try { value = await this.transport.submit(active.request, active.intent); }
    catch (error) {
      this.#state = Object.freeze({phase: 'INDETERMINATE', operationId: active.request.operationId, expectedStateId: active.request.expectedStateId, reason: error instanceof Error ? error.message : 'Mutation acknowledgement unavailable'});
      return this.#state;
    }
    let result: MutationSubmitResult;
    try { result = validateMutationSubmitResult(value); }
    catch (error) { return this.#blockIntegrity(active.request.operationId, error instanceof Error ? error.message : 'Malformed mutation result'); }
    if (result.kind === 'committed') return this.#acceptReceipt(result.receipt);
    await this.#releaseNotCommitted(active);
    if (result.reason === 'state_conflict') {
      this.#state = Object.freeze({phase: 'BLOCKED', operationId: active.request.operationId, reason: 'state_conflict', detail: 'Authority refused a stale expected state; refresh or rebase is required', authoritativeStateId: result.currentStateId});
      return this.#state;
    }
    this.#state = Object.freeze({phase: 'REFUSED', operationId: active.request.operationId, reason: result.reason, authoritativeStateId: result.currentStateId});
    this.#active = undefined;
    return this.#state;
  }

  async #acceptReceipt(value: MutationReceipt): Promise<MutationCoordinatorState> {
    const receipt = validateMutationReceipt(value);
    const known = this.#receipts.get(receipt.operationId);
    if (known) {
      if (!sameReceipt(known, receipt)) return this.#blockIntegrity(receipt.operationId, 'Conflicting receipt for committed operation');
      return this.#state;
    }
    const active = this.#active;
    if (!active) return this.#blockIntegrity(receipt.operationId, 'Receipt has no matching mutation context');
    const request = active.request;
    if (receipt.authorityId !== request.authorityId || receipt.integrationId !== request.integrationId || receipt.clientId !== request.clientId ||
        receipt.operationId !== request.operationId || receipt.intentId !== request.intentId || receipt.beforeStateId !== request.expectedStateId)
      return this.#blockIntegrity(request.operationId, 'Authoritative receipt does not match the submitted mutation identity');
    if (this.#receipts.size >= this.receiptHistoryLimit) return this.#blockIntegrity(request.operationId, 'Bounded receipt history is full');
    this.#receipts.set(receipt.operationId, receipt);
    try {
      if (active.publication && !active.publicationSettled) {
        active.publicationSettled = true;
        await active.publication.publish(receipt);
      }
    } catch (error) {
      this.#state = Object.freeze({phase: 'BLOCKED', operationId: request.operationId, reason: 'publication_error', detail: error instanceof Error ? error.message : 'Receipt publication failed'});
      throw error;
    }
    this.#active = undefined;
    this.#state = Object.freeze({phase: 'COMMITTED', receipt});
    return this.#state;
  }

  async #releaseNotCommitted(active: ActiveMutation<Intent>): Promise<void> {
    if (!active.publication || active.publicationSettled) return;
    active.publicationSettled = true;
    await active.publication.releaseNotCommitted();
  }

  #blockIntegrity(operationId: string, detail: string): MutationCoordinatorState {
    this.#state = Object.freeze({phase: 'BLOCKED', operationId, reason: 'integrity_error', detail});
    return this.#state;
  }

  #authoritativeState(): string {
    if (this.#state.phase === 'READY') return this.#state.authoritativeStateId;
    if (this.#state.phase === 'COMMITTED') return this.#state.receipt.afterStateId;
    if (this.#state.phase === 'REFUSED') return this.#state.authoritativeStateId;
    throw new Error('Authoritative state is unresolved');
  }
}
