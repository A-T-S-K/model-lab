import type { SpatialReadModel } from './bindings.js';
import type { Address } from './forward.js';
import { headKinds, layerKinds, parameterFor } from './microgpt-topology.js';
import type {
  PublicDepthKind,
  PublicDepthMember,
  PublicTourContent,
  PublicTourState,
} from './public-tour.js';

export interface PublicDepthSelection {
  member?: string;
  key?: number;
  head?: number;
  element?: number;
  hiddenFeature?: number;
  outputFeature?: number;
}

export interface ResolvedPublicDepthMember {
  readonly memberId: string;
  readonly occurrenceId: string;
  readonly role: string;
  readonly kind: string;
  readonly address: Address;
  readonly key?: number;
  readonly head?: number;
  readonly slice?: { readonly start: number; readonly end: number };
  readonly shape?: readonly number[];
  readonly artifactId?: string;
  readonly availability: string;
  readonly semanticId: string;
  readonly parameter?: string;
  readonly provenance?: string;
  readonly residualSource: boolean;
}

export interface ResolvedPublicDepthCanonicalIdentity {
  readonly state: PublicTourState;
  readonly run: string;
  readonly snapshot?: string;
  readonly phase: string;
  readonly position: number;
  readonly layer?: number;
  readonly head?: number;
  readonly key?: number;
  readonly anchor: Address;
}

export interface ResolvedPublicDepthContext {
  readonly kind: PublicDepthKind;
  readonly canonical: ResolvedPublicDepthCanonicalIdentity;
  readonly members: readonly ResolvedPublicDepthMember[];
  readonly selectedMember: string;
  readonly selectedKey?: number;
  readonly selectedHead?: number;
  readonly element: number;
  readonly hiddenFeature: number;
  readonly outputFeature: number;
  readonly eligibleKeys: readonly number[];
  readonly futureKeys: readonly number[];
  readonly completeSupport: boolean;
}

const integerInRange = (value: number | undefined, length: number, fallback = 0) => {
  if (length <= 0) return 0;
  if (value !== undefined && Number.isInteger(value) && value >= 0 && value < length) return value;
  return Math.min(Math.max(0, fallback), length - 1);
};

const occurrenceAddress = (
  member: PublicDepthMember,
  position: number,
  layer: number | undefined,
  head: number | undefined,
  key: number | undefined,
): Address => {
  const token = member.occurrence?.kind === 'causal-keys' && key !== undefined ? key : position;
  return {
    kind: member.kind,
    token,
    ...(layerKinds.has(member.kind) && layer !== undefined ? { layer } : {}),
    ...(headKinds.has(member.kind) && head !== undefined ? { head } : {}),
  };
};

function resolveMember(
  model: SpatialReadModel,
  member: PublicDepthMember,
  position: number,
  layer: number | undefined,
  canonicalHead: number | undefined,
  head: number | undefined,
  key: number | undefined,
): ResolvedPublicDepthMember {
  const effectiveHead = head ?? canonicalHead;
  const effectiveLayer = member.occurrence?.kind === 'final-layer'
    ? Math.max(0, model.forward.layers - 1)
    : layer;
  const address = occurrenceAddress(member, position, effectiveLayer, effectiveHead, key);
  const artifact = model.forward.artifact(address);
  const raw = model.forward.values(address);
  const slice = member.slice === 'canonical-head' && effectiveHead !== undefined
    ? { start: effectiveHead * model.width, end: (effectiveHead + 1) * model.width }
    : undefined;
  const sliceAvailable = !slice || Boolean(raw && raw.length >= slice.end);
  const shape = slice
    ? [model.width]
    : raw
      ? [raw.length]
      : undefined;
  const occurrenceId = [
    member.id,
    key === undefined ? '' : `k${key}`,
    head === undefined || member.occurrence?.kind !== 'all-heads' ? '' : `h${head}`,
  ].filter(Boolean).join(':');

  return {
    memberId: member.id,
    occurrenceId,
    role: member.role,
    kind: member.kind,
    address,
    ...(key === undefined ? {} : { key }),
    ...(effectiveHead === undefined ? {} : { head: effectiveHead }),
    ...(slice ? { slice } : {}),
    ...(shape ? { shape } : {}),
    artifactId: artifact?.id,
    availability: artifact && sliceAvailable ? artifact.availability : 'not_captured',
    semanticId: model.forward.semanticId(address),
    parameter: member.parameter === 'owner' ? parameterFor(member.kind, address.layer) : undefined,
    provenance: artifact?.provenance,
    residualSource: member.residual === 'saved-source',
  };
}

const memberValuesAvailable = (model: SpatialReadModel, member: ResolvedPublicDepthMember) => {
  const values = model.forward.values(member.address);
  if (!values) return false;
  return member.slice ? values.length >= member.slice.end : true;
};

const memberLength = (model: SpatialReadModel, member: ResolvedPublicDepthMember | undefined) => {
  if (!member) return 0;
  const values = model.forward.values(member.address);
  if (!values) return member.shape?.[0] ?? 0;
  return member.slice ? Math.max(0, Math.min(values.length, member.slice.end) - member.slice.start) : values.length;
};

export function resolvePublicDepthContext(
  content: PublicTourContent,
  model: SpatialReadModel,
  temporary: PublicDepthSelection = {},
): ResolvedPublicDepthContext | undefined {
  const spec = content.depthSpec;
  if (content.part !== 1 || !spec) return undefined;

  const intent = content.selectionIntent;
  const position = intent.token;
  const layer = intent.layer;
  const canonicalHead = intent.head;
  const eligibleCount = Math.max(0, Math.min(position + 1, model.forward.input.length));
  const eligibleKeys = Array.from({ length: eligibleCount }, (_, key) => key);
  const futureKeys = Array.from(
    { length: Math.max(0, model.forward.input.length - eligibleCount) },
    (_, index) => eligibleCount + index,
  );
  const selectedKey = eligibleKeys.includes(temporary.key ?? Number.NaN)
    ? temporary.key
    : eligibleKeys.includes(intent.key ?? Number.NaN)
      ? intent.key
      : eligibleKeys[0];
  const selectedHead = temporary.head !== undefined
    && Number.isInteger(temporary.head)
    && temporary.head >= 0
    && temporary.head < model.forward.heads
      ? temporary.head
      : canonicalHead;

  const members: ResolvedPublicDepthMember[] = [];
  for (const member of spec.members) {
    const occurrence = member.occurrence?.kind ?? 'canonical';
    if (occurrence === 'causal-keys') {
      for (const key of eligibleKeys) {
        members.push(resolveMember(model, member, position, layer, canonicalHead, canonicalHead, key));
      }
      continue;
    }
    if (occurrence === 'all-heads') {
      for (let head = 0; head < model.forward.heads; head += 1) {
        members.push(resolveMember(model, member, position, layer, canonicalHead, head, undefined));
      }
      continue;
    }
    members.push(resolveMember(model, member, position, layer, canonicalHead, canonicalHead, undefined));
  }

  const selectedMember = spec.members.some(member => member.id === temporary.member)
    ? temporary.member!
    : spec.defaultMember;
  const selectedOccurrence = members.find(member =>
    member.memberId === selectedMember &&
    (member.key === undefined || member.key === selectedKey) &&
    (member.head === undefined || selectedHead === undefined || member.head === selectedHead)
  ) ?? members.find(member => member.memberId === selectedMember);
  const element = integerInRange(temporary.element, memberLength(model, selectedOccurrence), 0);

  const hiddenMember = members.find(member => member.kind === 'mlpUp')
    ?? members.find(member => member.kind === 'mlpRelu');
  const outputMember = members.find(member => member.kind === 'mlpResidual')
    ?? members.find(member => member.kind === 'mlpDown')
    ?? selectedOccurrence;
  const hiddenFeature = integerInRange(temporary.hiddenFeature, memberLength(model, hiddenMember), 0);
  const outputFeature = integerInRange(temporary.outputFeature, memberLength(model, outputMember), element);

  const memberGroupAvailable = (id: string) => {
    const group = members.filter(member => member.memberId === id);
    return group.length > 0 && group.every(member => memberValuesAvailable(model, member));
  };

  let completeSupport = members.length > 0 && members.every(member => memberValuesAvailable(model, member));
  if (spec.kind === 'attention-comparison') {
    const scores = members.find(member => member.kind === 'attentionLogits');
    completeSupport = memberGroupAvailable('query')
      && memberGroupAvailable('keys')
      && memberLength(model, scores) === eligibleKeys.length;
  } else if (spec.kind === 'attention-weights') {
    const scores = members.find(member => member.kind === 'attentionLogits');
    const weights = members.find(member => member.kind === 'attentionProbabilities');
    completeSupport = memberLength(model, scores) === eligibleKeys.length
      && memberLength(model, weights) === eligibleKeys.length;
  } else if (spec.kind === 'value-mixture') {
    const weights = members.find(member => member.kind === 'attentionProbabilities');
    const output = members.find(member => member.kind === 'headOutput');
    const values = members.filter(member => member.memberId === 'values');
    const explanation = output
      ? model.forward.explain(output.address, outputFeature)
      : undefined;
    completeSupport = memberLength(model, weights) === eligibleKeys.length
      && values.length === eligibleKeys.length
      && values.every(member => memberValuesAvailable(model, member))
      && Boolean(output && memberValuesAvailable(model, output))
      && Boolean(explanation?.mixture);
  } else if (spec.kind === 'logits') {
    const outputWidth = model.forward.vocabulary.length + 1;
    const logits = members.find(member => member.kind === 'logits');
    completeSupport = memberLength(model, logits) === outputWidth;
  } else if (spec.kind === 'probabilities' || spec.kind === 'prediction') {
    const outputWidth = model.forward.vocabulary.length + 1;
    const logits = members.find(member => member.kind === 'logits');
    const probabilities = members.find(member => member.kind === 'probabilities');
    completeSupport = memberLength(model, logits) === outputWidth
      && memberLength(model, probabilities) === outputWidth;
  }

  const anchor = occurrenceAddress(
    {
      id: 'anchor',
      role: 'Canonical lesson anchor',
      kind: intent.kind,
    },
    position,
    layer,
    canonicalHead,
    undefined,
  );

  return {
    kind: spec.kind,
    canonical: {
      state: content.state,
      run: model.source.sourceRunId,
      snapshot: model.source.sourceSnapshotId,
      phase: model.source.phase,
      position,
      ...(layer === undefined ? {} : { layer }),
      ...(canonicalHead === undefined ? {} : { head: canonicalHead }),
      ...(intent.key === undefined ? {} : { key: intent.key }),
      anchor,
    },
    members,
    selectedMember,
    ...(['attention-comparison', 'attention-weights', 'value-mixture'].includes(spec.kind) && selectedKey !== undefined
      ? { selectedKey }
      : {}),
    ...(selectedHead !== undefined ? { selectedHead } : {}),
    element,
    hiddenFeature,
    outputFeature,
    eligibleKeys,
    futureKeys,
    completeSupport,
  };
}
