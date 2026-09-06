# Live scalar capture benchmark

Measured September 5, 2026 with the canonical 896-parameter fixture on Apple M1 Max, macOS arm64, Node v24.20.0, explicit garbage collection enabled.

Reproduce from `model-lab/`:

```sh
node --expose-gc --import tsx scripts/benchmark-capture.ts
```

The benchmark records the full forward graph including the loss objective at lengths 1, 4, and 8, then separately records actual backward adjoints and contributions. Every parameter is identified, including disconnected parameters. No scalar node or edge cap is imposed. Numeric snapshots are copied as nodes first appear; only requested slices are returned during normal inspection. Whole-graph serialization is an explicit advanced operation.

These are warmed single-sample Node measurements of the same engine used in the worker. They are not browser heap, browser rendering, responsiveness, or statistical tail-latency results. Forward capture time includes observer calls and context construction; total forward time also includes model execution. Backward capture excludes the backward computation itself. Heap deltas include the restored model, retained forward DAG, numeric snapshots, adjacency, and semantic recorder, before whole-graph response copying. Explicit post-capture GC measures retained heap; the pre-GC sample is an observed allocation sample, not a true peak. The benchmark keeps the loss result in scope, so backward heap also includes that live DAG although the context releases its strong live-node array.

| Length | Mode | Nodes | Edges | Derivative edges | JSON bytes | Retained heap bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | forward | 2825 | 3580 | 0 | 531507 | 2620560 |
| 1 | forward+backward | 2825 | 3580 | 3580 | 821978 | 3026864 |
| 4 | forward | 8924 | 14851 | 0 | 1861050 | 8806760 |
| 4 | forward+backward | 8924 | 14851 | 14851 | 3125258 | 10259072 |
| 8 | forward | 17812 | 31139 | 0 | 3835372 | 17811872 |
| 8 | forward+backward | 17812 | 31139 | 31139 | 6519094 | 20829256 |

| Length | Mode | Forward total ms | Forward capture ms | Backward ms | Backward capture ms | Plain graph copy ms | JSON ms | Selected slice ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | forward | 4.402 | 3.746 | n/a | n/a | 6.45 | 1.719 | 0.096 |
| 1 | forward+backward | 3.603 | 3.097 | 2.008 | 3.432 | 7.089 | 3.12 | 0.13 |
| 4 | forward | 14.862 | 12.129 | n/a | n/a | 16.924 | 5.858 | 0.246 |
| 4 | forward+backward | 8.798 | 7.348 | 12.994 | 5.428 | 20.38 | 8.63 | 0.229 |
| 8 | forward | 17.53 | 15.83 | n/a | n/a | 32.571 | 11.317 | 0.481 |
| 8 | forward+backward | 18.689 | 16.063 | 8.012 | 19.962 | 36.634 | 20.429 | 0.391 |

The final length-8 backward graph retains 17,812 nodes and 31,139 operand edges, about 6.52 MB JSON including semantic-root identities and the backward seed. Its capture boundary took 19.96 ms in this sample. Selected output-probability slices remained below 1.2 KB. Full active numeric retention is practical; no scalar graph cap is imposed. Browser measurements in [v0.2 acceptance](acceptance-v0.2.md) separately measure rendering and responsiveness.

Final raw measurements (bytes and milliseconds):

```json
{
  "environment": {
    "node": "v24.20.0",
    "platform": "darwin",
    "arch": "arm64",
    "cpu": "Apple M1 Max",
    "gcExposed": true
  },
  "note": "Node worker-equivalent execution, not browser heap/rendering; forward includes loss objective, graph capture, and semantic recording. Retained heap includes live forward DAG and numeric evidence, measured after GC. Timing samples are descriptive, not limits.",
  "measurements": [
    {
      "length": 1,
      "mode": "forward",
      "nodes": 2825,
      "edges": 3580,
      "derivativeEdges": 0,
      "structuralEvents": 18,
      "jsonBytes": 531507,
      "selectedSliceBytes": 816,
      "heapPeakObservedDeltaBytes": 5400328,
      "retainedHeapDeltaBytes": 2620560,
      "forwardWithCaptureMs": 4.402,
      "forwardCaptureMs": 3.746,
      "backwardMs": null,
      "backwardCaptureMs": null,
      "wholePlainCopyMs": 6.45,
      "serializationMs": 1.719,
      "selectedSliceMs": 0.096
    },
    {
      "length": 1,
      "mode": "forward+backward",
      "nodes": 2825,
      "edges": 3580,
      "derivativeEdges": 3580,
      "structuralEvents": 19,
      "jsonBytes": 821978,
      "selectedSliceBytes": 1113,
      "heapPeakObservedDeltaBytes": 3379048,
      "retainedHeapDeltaBytes": 3026864,
      "forwardWithCaptureMs": 3.603,
      "forwardCaptureMs": 3.097,
      "backwardMs": 2.008,
      "backwardCaptureMs": 3.432,
      "wholePlainCopyMs": 7.089,
      "serializationMs": 3.12,
      "selectedSliceMs": 0.13
    },
    {
      "length": 4,
      "mode": "forward",
      "nodes": 8924,
      "edges": 14851,
      "derivativeEdges": 0,
      "structuralEvents": 72,
      "jsonBytes": 1861050,
      "selectedSliceBytes": 783,
      "heapPeakObservedDeltaBytes": 16077656,
      "retainedHeapDeltaBytes": 8806760,
      "forwardWithCaptureMs": 14.862,
      "forwardCaptureMs": 12.129,
      "backwardMs": null,
      "backwardCaptureMs": null,
      "wholePlainCopyMs": 16.924,
      "serializationMs": 5.858,
      "selectedSliceMs": 0.246
    },
    {
      "length": 4,
      "mode": "forward+backward",
      "nodes": 8924,
      "edges": 14851,
      "derivativeEdges": 14851,
      "structuralEvents": 73,
      "jsonBytes": 3125258,
      "selectedSliceBytes": 1076,
      "heapPeakObservedDeltaBytes": 21010968,
      "retainedHeapDeltaBytes": 10259072,
      "forwardWithCaptureMs": 8.798,
      "forwardCaptureMs": 7.348,
      "backwardMs": 12.994,
      "backwardCaptureMs": 5.428,
      "wholePlainCopyMs": 20.38,
      "serializationMs": 8.63,
      "selectedSliceMs": 0.229
    },
    {
      "length": 8,
      "mode": "forward",
      "nodes": 17812,
      "edges": 31139,
      "derivativeEdges": 0,
      "structuralEvents": 144,
      "jsonBytes": 3835372,
      "selectedSliceBytes": 525,
      "heapPeakObservedDeltaBytes": 31589632,
      "retainedHeapDeltaBytes": 17811872,
      "forwardWithCaptureMs": 17.53,
      "forwardCaptureMs": 15.83,
      "backwardMs": null,
      "backwardCaptureMs": null,
      "wholePlainCopyMs": 32.571,
      "serializationMs": 11.317,
      "selectedSliceMs": 0.481
    },
    {
      "length": 8,
      "mode": "forward+backward",
      "nodes": 17812,
      "edges": 31139,
      "derivativeEdges": 31139,
      "structuralEvents": 145,
      "jsonBytes": 6519094,
      "selectedSliceBytes": 650,
      "heapPeakObservedDeltaBytes": 36598544,
      "retainedHeapDeltaBytes": 20829256,
      "forwardWithCaptureMs": 18.689,
      "forwardCaptureMs": 16.063,
      "backwardMs": 8.012,
      "backwardCaptureMs": 19.962,
      "wholePlainCopyMs": 36.634,
      "serializationMs": 20.429,
      "selectedSliceMs": 0.391
    }
  ]
}
```
