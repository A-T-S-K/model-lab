import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUuid, type RandomSource } from '../../app/worker/random-uuid.js';

test('randomUuid prefers native randomUUID when available', () => {
  const source: RandomSource = {
    randomUUID: () => 'native-id',
    getRandomValues: () => { throw new Error('fallback should not run'); },
  };
  assert.equal(randomUuid(source), 'native-id');
});

test('randomUuid falls back to getRandomValues on insecure origins', () => {
  const source: RandomSource = {
    getRandomValues(bytes) {
      for (let index = 0; index < bytes.length; index++) bytes[index] = index;
      return bytes;
    },
  };

  assert.equal(randomUuid(source), '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('randomUuid refuses to invent an ID without a cryptographically secure source', () => {
  assert.throws(() => randomUuid({} as RandomSource), /Cryptographically secure random source unavailable/);
});
