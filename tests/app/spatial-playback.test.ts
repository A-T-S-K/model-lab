import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ExplanationPlayback} from '../../app/spatial/playback.js';
test('one clock cancels stale ticks, preserves cursor on exploration, and bounds restart',async()=>{
 let applied=0;const p=new ExplanationPlayback(()=>{},()=>applied++,10);
 p.bind('run-a','forward',3);p.play();p.play();assert.equal(p.pendingTimers,1);
 p.pause(true);const n=applied;await new Promise(r=>setTimeout(r,50));assert.equal(applied,n);assert.equal(p.cursor,0);
 p.resume();assert.equal(p.exploring,false);p.step(99);assert.equal(p.cursor,2);
 p.play();await new Promise(r=>setTimeout(r,50));assert.equal(p.playing,false);assert.equal(p.pendingTimers,0);
 p.bind('experiment-a','learning',5);p.step(3);p.pause(true);p.resume();assert.equal(p.cursor,3);assert.equal(p.source,'experiment-a');
 p.invalidate();p.play();assert.equal(p.pendingTimers,0);assert.equal(p.source,'');
});
