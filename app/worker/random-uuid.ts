export interface RandomSource {
  randomUUID?: () => string;
  getRandomValues(array: Uint8Array): Uint8Array;
}

/**
 * Generate a collision-resistant browser session ID on both secure and insecure
 * origins. `crypto.randomUUID()` is secure-context-only, while
 * `crypto.getRandomValues()` remains available on ordinary HTTP origins.
 */
export function randomUuid(source: RandomSource = globalThis.crypto): string {
  if (typeof source.randomUUID === 'function') return source.randomUUID.call(source);

  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
