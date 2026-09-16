import { canonicalBytes } from '../archive/snapshot.js';
import { immutableCopy } from './types.js';

export const MAX_PAYLOAD_SLICE_VALUES = 256;
export const INLINE_VALUE_LIMIT = MAX_PAYLOAD_SLICE_VALUES;
export const NUMERICAL_PAYLOAD_FORMAT = 'model-lab-numerical-payload-v1' as const;

export type NumericalDType = 'float64' | 'float32' | 'int32';
export type ElementEncoding = 'ieee-754-binary64' | 'ieee-754-binary32' | 'signed-int32';

export interface NumericalPayloadDescriptor {
  readonly format: typeof NUMERICAL_PAYLOAD_FORMAT;
  readonly contentId: string;
  readonly dtype: NumericalDType;
  readonly elementEncoding: ElementEncoding;
  readonly byteOrder: 'little-endian';
  readonly layout: 'row-major';
  readonly elementCount: number;
  readonly byteLength: number;
}

interface PayloadIdentityMetadata extends Omit<NumericalPayloadDescriptor, 'contentId'> {}
interface StoredPayload { readonly descriptor: NumericalPayloadDescriptor; readonly bytes: Uint8Array }

const encodings: Readonly<Record<NumericalDType, { readonly encoding: ElementEncoding; readonly bytes: number }>> = {
  float64: { encoding: 'ieee-754-binary64', bytes: 8 },
  float32: { encoding: 'ieee-754-binary32', bytes: 4 },
  int32: { encoding: 'signed-int32', bytes: 4 },
};

function requirePayload(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function descriptorFields(value: unknown): Record<string, unknown> {
  requirePayload(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'Invalid payload descriptor');
  const descriptor = value as Record<string, unknown>;
  const names = ['format', 'contentId', 'dtype', 'elementEncoding', 'byteOrder', 'layout', 'elementCount', 'byteLength'];
  requirePayload(Object.keys(descriptor).length === names.length && names.every(name => Object.hasOwn(descriptor, name)), 'Invalid payload descriptor fields');
  return descriptor;
}

function identityMetadata(descriptor: NumericalPayloadDescriptor): PayloadIdentityMetadata {
  return {
    format: descriptor.format,
    dtype: descriptor.dtype,
    elementEncoding: descriptor.elementEncoding,
    byteOrder: descriptor.byteOrder,
    layout: descriptor.layout,
    elementCount: descriptor.elementCount,
    byteLength: descriptor.byteLength,
  };
}
function sameDescriptor(left:NumericalPayloadDescriptor,right:NumericalPayloadDescriptor):boolean{
  return left.format===right.format&&left.contentId===right.contentId&&left.dtype===right.dtype&&left.elementEncoding===right.elementEncoding&&left.byteOrder===right.byteOrder&&left.layout===right.layout&&left.elementCount===right.elementCount&&left.byteLength===right.byteLength;
}

export function validatePayloadDescriptor(value: unknown): NumericalPayloadDescriptor {
  const descriptor = descriptorFields(value);
  requirePayload(descriptor.format === NUMERICAL_PAYLOAD_FORMAT, 'Unknown payload format');
  requirePayload(typeof descriptor.contentId === 'string' && /^sha256:[0-9a-f]{64}$/.test(descriptor.contentId), 'Malformed payload ID');
  requirePayload(descriptor.dtype === 'float64' || descriptor.dtype === 'float32' || descriptor.dtype === 'int32', 'Unsupported payload dtype');
  const dtype = descriptor.dtype as NumericalDType;
  requirePayload(descriptor.elementEncoding === encodings[dtype].encoding, 'Unsupported element encoding');
  requirePayload(descriptor.byteOrder === 'little-endian', 'Unsupported payload byte order');
  requirePayload(descriptor.layout === 'row-major', 'Unsupported payload layout');
  requirePayload(Number.isSafeInteger(descriptor.elementCount) && Number(descriptor.elementCount) >= 0, 'Invalid payload element count');
  requirePayload(Number.isSafeInteger(descriptor.byteLength) && Number(descriptor.byteLength) >= 0, 'Invalid payload byte length');
  requirePayload(descriptor.byteLength === Number(descriptor.elementCount) * encodings[dtype].bytes, 'Payload byte-length mismatch');
  return immutableCopy(descriptor) as unknown as NumericalPayloadDescriptor;
}

export function validatePayloadForPoint(descriptor: unknown, dtype: NumericalDType, shape: readonly number[]): NumericalPayloadDescriptor {
  const checked = validatePayloadDescriptor(descriptor);
  requirePayload(checked.dtype === dtype, 'Payload dtype does not match evidence point');
  requirePayload(shape.every(size => Number.isSafeInteger(size) && size >= 0), 'Invalid evidence shape');
  requirePayload(shape.reduce((product, size) => product * size, 1) === checked.elementCount, 'Payload element-count/shape mismatch');
  return checked;
}

async function contentIdFor(descriptor: Omit<NumericalPayloadDescriptor, 'contentId'>, bytes: Uint8Array): Promise<string> {
  const metadata = canonicalBytes(descriptor);
  const input = new Uint8Array(metadata.length + bytes.length);
  input.set(metadata); input.set(bytes, metadata.length);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function validateValue(dtype: NumericalDType, value: number): void {
  requirePayload(typeof value === 'number' && Number.isFinite(value), 'Payload values must be finite');
  if (dtype === 'float32') requirePayload(Object.is(Math.fround(value), value), 'Payload value is not exact float32');
  if (dtype === 'int32') requirePayload(Number.isInteger(value) && value >= -(2 ** 31) && value < 2 ** 31, 'Payload int32 overflow');
}

function encode(dtype: NumericalDType, values: readonly number[]): Uint8Array {
  const width = encodings[dtype].bytes, buffer = new ArrayBuffer(values.length * width), view = new DataView(buffer);
  values.forEach((value, index) => {
    validateValue(dtype, value); const offset = index * width;
    if (dtype === 'float64') view.setFloat64(offset, value, true);
    else if (dtype === 'float32') view.setFloat32(offset, value, true);
    else view.setInt32(offset, value, true);
  });
  return new Uint8Array(buffer);
}

function decodeValue(descriptor: NumericalPayloadDescriptor, view: DataView, index: number): number {
  const offset = index * encodings[descriptor.dtype].bytes;
  if (descriptor.dtype === 'float64') return view.getFloat64(offset, true);
  if (descriptor.dtype === 'float32') return view.getFloat32(offset, true);
  return view.getInt32(offset, true);
}

export interface NumericalPayloadStorage {
  put(dtype: NumericalDType, values: readonly number[]): Promise<NumericalPayloadDescriptor>;
  importPayload(descriptor: unknown, bytes: Uint8Array): Promise<NumericalPayloadDescriptor>;
  has(contentId: string): boolean;
  metadata(contentId: string): NumericalPayloadDescriptor;
  slice(descriptor: NumericalPayloadDescriptor, start: number, count: number): readonly number[];
  /** Whole-payload defensive copy for archive serialization only. */
  exportBytes(descriptor: NumericalPayloadDescriptor): Uint8Array;
}

/** In-memory content-addressed bytes. Backing buffers are copied on admission and never exposed. */
export class InMemoryNumericalPayloadStore implements NumericalPayloadStorage {
  readonly #payloads = new Map<string, StoredPayload>();

  async put(dtype: NumericalDType, values: readonly number[]): Promise<NumericalPayloadDescriptor> {
    requirePayload(Array.isArray(values), 'Payload values must be an array');
    const bytes = encode(dtype, values);
    const metadata: PayloadIdentityMetadata = {
      format: NUMERICAL_PAYLOAD_FORMAT,
      dtype,
      elementEncoding: encodings[dtype].encoding,
      byteOrder: 'little-endian',
      layout: 'row-major',
      elementCount: values.length,
      byteLength: bytes.length,
    };
    const descriptor = { ...metadata, contentId: await contentIdFor(metadata, bytes) };
    return this.importPayload(descriptor, bytes);
  }

  async importPayload(value: unknown, source: Uint8Array): Promise<NumericalPayloadDescriptor> {
    const descriptor = validatePayloadDescriptor(value);
    requirePayload(source instanceof Uint8Array, 'Payload bytes must be Uint8Array');
    const bytes = new Uint8Array(source);
    requirePayload(bytes.length === descriptor.byteLength, 'Payload byte-length mismatch');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let index = 0; index < descriptor.elementCount; index++) validateValue(descriptor.dtype, decodeValue(descriptor, view, index));
    requirePayload(await contentIdFor(identityMetadata(descriptor), bytes) === descriptor.contentId, 'Payload hash mismatch');
    const existing = this.#payloads.get(descriptor.contentId);
    if (existing) {
      requirePayload(sameDescriptor(existing.descriptor,descriptor) && existing.bytes.length === bytes.length &&
        existing.bytes.every((byte, index) => byte === bytes[index]), 'Conflicting payload content identity');
      return existing.descriptor;
    }
    const retained = immutableCopy(descriptor);
    this.#payloads.set(retained.contentId, { descriptor: retained, bytes });
    return retained;
  }

  has(contentId: string): boolean { return this.#payloads.has(contentId); }

  metadata(contentId: string): NumericalPayloadDescriptor {
    const payload = this.#payloads.get(contentId); requirePayload(payload, 'Missing numerical payload'); return payload.descriptor;
  }

  slice(value: NumericalPayloadDescriptor, start: number, count: number): readonly number[] {
    const descriptor = validatePayloadDescriptor(value), payload = this.#payloads.get(descriptor.contentId);
    requirePayload(payload, 'Missing numerical payload');
    requirePayload(sameDescriptor(payload.descriptor,descriptor), 'Payload metadata mismatch');
    requirePayload(Number.isSafeInteger(start) && start >= 0, 'Invalid payload slice start');
    requirePayload(Number.isSafeInteger(count) && count >= 0 && count <= MAX_PAYLOAD_SLICE_VALUES, 'Invalid payload slice count');
    requirePayload(start + count <= descriptor.elementCount, 'Payload slice out of bounds');
    const view = new DataView(payload.bytes.buffer, payload.bytes.byteOffset, payload.bytes.byteLength), result: number[] = [];
    for (let index = start; index < start + count; index++) result.push(decodeValue(descriptor, view, index));
    return Object.freeze(result);
  }

  exportBytes(value: NumericalPayloadDescriptor): Uint8Array {
    const descriptor = validatePayloadDescriptor(value), payload = this.#payloads.get(descriptor.contentId);
    requirePayload(payload, 'Missing numerical payload');
    requirePayload(sameDescriptor(payload.descriptor, descriptor), 'Payload metadata mismatch');
    return new Uint8Array(payload.bytes);
  }
}

/**
 * Transaction-local payload overlay. Reads fall through to immutable session bytes;
 * new bytes remain isolated until the archive that owns this layer is published.
 */
export class LayeredNumericalPayloadStore implements NumericalPayloadStorage {
  readonly #local = new InMemoryNumericalPayloadStore();
  constructor(readonly parent: NumericalPayloadStorage) {}

  async put(dtype: NumericalDType, values: readonly number[]): Promise<NumericalPayloadDescriptor> {
    const descriptor = await this.#local.put(dtype, values);
    if (!this.parent.has(descriptor.contentId)) return descriptor;
    const existing = this.parent.metadata(descriptor.contentId);
    requirePayload(sameDescriptor(existing, descriptor), 'Conflicting parent payload identity');
    return existing;
  }

  async importPayload(value: unknown, source: Uint8Array): Promise<NumericalPayloadDescriptor> {
    const descriptor = validatePayloadDescriptor(value);
    if (this.parent.has(descriptor.contentId)) {
      const existing = this.parent.metadata(descriptor.contentId);
      requirePayload(sameDescriptor(existing, descriptor), 'Conflicting parent payload identity');
      return existing;
    }
    return this.#local.importPayload(descriptor, source);
  }

  has(contentId: string): boolean { return this.#local.has(contentId) || this.parent.has(contentId); }
  metadata(contentId: string): NumericalPayloadDescriptor {
    return this.#local.has(contentId) ? this.#local.metadata(contentId) : this.parent.metadata(contentId);
  }
  slice(value: NumericalPayloadDescriptor, start: number, count: number): readonly number[] {
    return this.#local.has(value.contentId) ? this.#local.slice(value, start, count) : this.parent.slice(value, start, count);
  }
  exportBytes(value: NumericalPayloadDescriptor): Uint8Array {
    return this.#local.has(value.contentId) ? this.#local.exportBytes(value) : this.parent.exportBytes(value);
  }
}
