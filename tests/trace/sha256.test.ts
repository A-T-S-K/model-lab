import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { sha256Hex, sha256Id, type Sha256Source } from '../../trace/sha256.js';

const encoder = new TextEncoder();
const portable: Sha256Source = {};

test('portable SHA-256 matches standard known-answer vectors', async () => {
  const vectors = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['The quick brown fox jumps over the lazy dog', 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'],
  ] as const;
  for (const [input, expected] of vectors) assert.equal(await sha256Hex(encoder.encode(input), portable), expected);
});

test('portable SHA-256 matches the independent Node implementation across block boundaries', async () => {
  for (const length of [0, 1, 55, 56, 63, 64, 65, 127, 128, 129, 1024, 1024 * 1024]) {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 31 + length) & 0xff);
    const expected = createHash('sha256').update(bytes).digest('hex');
    assert.equal(await sha256Hex(bytes, portable), expected, `length ${length}`);
    assert.equal(await sha256Id(bytes, portable), `sha256:${expected}`, `identity length ${length}`);
  }
});

test('native and portable SHA-256 paths preserve identical identities', async () => {
  const bytes = Uint8Array.from({ length: 8193 }, (_, index) => (index * 17) & 0xff);
  assert.equal(await sha256Hex(bytes), await sha256Hex(bytes, portable));
});

test('a present native digest rejection propagates without fallback', async () => {
  const failure = new Error('injected digest failure');
  const source = { subtle: { digest: async () => { throw failure; } } } as unknown as Sha256Source;
  await assert.rejects(sha256Hex(encoder.encode('do not retry'), source), error => error === failure);
});
