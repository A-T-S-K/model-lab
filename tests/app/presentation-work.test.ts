import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESENTATION_WORK, presentationWindow } from "../../app/presentation/work-contract.js";
import { fullSupportDistributionFromSlices, memoizedFullSupportDistribution } from "../../app/views/full-support-distribution.js";
import { microscopePresentationWindows } from "../../app/presentation/microscope-work.js";

test("M4-C2 logical archive and point collections materialize only their presentation windows", () => {
  const archive = Array.from({ length: 4096 }, (_, index) => `run-${index}`);
  const runs = presentationWindow(archive, 2048, PRESENTATION_WORK.historyRuns);
  assert.equal(runs.items.length, PRESENTATION_WORK.historyRuns);
  assert.equal(runs.total, 4096);
  assert.equal(runs.items[0], "run-2048");
  const points = presentationWindow(Array.from({ length: 2048 }, (_, index) => index), 2016, PRESENTATION_WORK.sharedPoints);
  assert.equal(points.items.length, PRESENTATION_WORK.sharedPoints);
  assert.equal(points.total, 2048);
  assert(points.items.includes(2039));
});

test("M4-C2 maximum full-support work is exactly two bounded passes", () => {
  let calls = 0;
  let valuesRead = 0;
  let largest = 0;
  const result = fullSupportDistributionFromSlices(
    PRESENTATION_WORK.numericalValues,
    PRESENTATION_WORK.numericalValues - 1,
    (start, count) => {
      calls++;
      valuesRead += count;
      largest = Math.max(largest, count);
      return Array.from({ length: count }, (_, offset) => ((start + offset) % 37) / 10);
    },
  );
  assert.equal(calls, Math.ceil(PRESENTATION_WORK.numericalValues / PRESENTATION_WORK.payloadSlice) * 2);
  assert.equal(valuesRead, PRESENTATION_WORK.numericalValues * 2);
  assert.equal(largest, PRESENTATION_WORK.payloadSlice);
  assert.equal(result.top.length, 5);
  assert.equal(result.selected.index, PRESENTATION_WORK.numericalValues - 1);
  assert.deepEqual(Object.keys(result).sort(), ["denominator", "maximum", "omittedMass", "selected", "shownMass", "size", "top"]);
  assert.throws(() => fullSupportDistributionFromSlices(PRESENTATION_WORK.numericalValues + 1, 0, () => []), /qualified evidence bound/);
  assert.throws(() => fullSupportDistributionFromSlices(10, 0, () => [], 21), /Distribution bound/);
});

test("M4-C2 unchanged full-support selection reuses only a bounded summary", () => {
  const owner = {};
  let calls = 0;
  const read = (start: number, count: number) => { calls++; return Array.from({ length: count }, (_, offset) => start + offset); };
  const first = memoizedFullSupportDistribution(owner, "run/point", 1024, 7, read);
  const afterFirst = calls;
  const second = memoizedFullSupportDistribution(owner, "run/point", 1024, 7, read);
  assert.equal(second, first);
  assert.equal(calls, afterFirst);
  assert.equal(first.top.length, 5);
});

test("M4-C2 microscope bounds fanout, operand and structural-event presentation windows", () => {
  const nodes = Array.from({ length: 121 }, (_, id) => ({ id, operation: id ? "multiply" : "source", value: id, ...(id === 0 ? { gradient: 1 } : {}) }));
  const edges = Array.from({ length: 100 }, (_, index) => ({ id: index, parent: 0, child: index + 1, inputIndex: index, localDerivative: 1, childAdjoint: 1, contribution: 1 }));
  const structural = Array.from({ length: 30 }, (_, index) => ({ operation: `event-${index}`, description: `structural ${index}`, values: Array.from({ length: 100 }, (_, value) => value), nodeIds: Array.from({ length: 100 }, (_, value) => value) }));
  const graph={ roots:[0],nodes,edges,structural },windows=microscopePresentationWindows(graph,nodes[0]!,{consumers:24,structural:12});
  assert.equal(windows.consumers.items.length,PRESENTATION_WORK.scalarEdges);assert.equal(windows.consumers.offset,24);assert.equal(windows.consumers.total,100);
  assert.equal(windows.structural.items.length,PRESENTATION_WORK.structuralEvents);assert.equal(windows.structural.offset,12);assert.equal(windows.structural.total,30);
  assert.equal(windows.operands.items.length,0);
});
