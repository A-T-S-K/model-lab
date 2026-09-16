import test from 'node:test';
import assert from 'node:assert/strict';
import { BoundedCache } from '../../app/presentation/bounded-cache.js';

test('bounded presentation cache accounts bytes, evicts LRU, and cancels pending reservations',()=>{
  const cache=new BoundedCache<string,{value:string}>(2,120,60);
  const a=cache.reserve('a',60)!;assert.equal(cache.status().pendingBytes,60);a.cancel();assert.equal(cache.status().pendingBytes,0);
  assert.equal(cache.reserve('a',60)!.commit({value:'a'.repeat(20)}),true);
  assert.equal(cache.reserve('b',60)!.commit({value:'b'.repeat(20)}),true);
  assert.equal(cache.get('a')?.value,'a'.repeat(20),'read refreshes LRU order');
  assert.equal(cache.reserve('c',60)!.commit({value:'c'.repeat(20)}),true);
  assert.equal(cache.get('b'),undefined);assert.equal(cache.get('a')?.value,'a'.repeat(20));assert.equal(cache.get('c')?.value,'c'.repeat(20));
  assert.equal(cache.status().entries,2);assert.equal(cache.status().evictions,1);
});

test('bounded presentation cache rejects oversized commits and invalidates stale reservations on clear',()=>{
  const cache=new BoundedCache<string,{value:string}>(2,100,50),oversized=cache.reserve('large',50)!;
  assert.equal(oversized.commit({value:'x'.repeat(80)}),false);assert.equal(cache.status().entries,0);assert.equal(cache.status().pendingBytes,0);
  const stale=cache.reserve('stale',50)!;cache.clear();assert.equal(stale.commit({value:'ok'}),false);assert.deepEqual(cache.status(),{entries:0,bytes:0,maxEntries:2,maxBytes:100,pendingBytes:0,evictions:0});
});
