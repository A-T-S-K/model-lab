# Reference provenance

The model organism is Andrej Karpathy's [microgpt gist](https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95), explained in his [February 12, 2026 article](https://karpathy.github.io/2026/02/12/microgpt/).

- Source bytes and author discussion rechecked: September 6, 2026. Numerical comparison below remains the September 5 record.
- Pinned gist revision: `14fb038816c7aae0bb9342c2dbf1a51dd134a5ff`.
- [Immutable source](https://gist.githubusercontent.com/karpathy/8627fe009c40f57531cb18360106ce95/raw/14fb038816c7aae0bb9342c2dbf1a51dd134a5ff/microgpt.py).
- Exact source bytes SHA-256: `d47d88c2fd432c8ebdc1048beab7f7eb64ea7e0e664e11b812d72a6d95ebccee`.

The pinned source file attributes `@karpathy` and contains no license header. Separately, on February 24, 2026, Andrej Karpathy [explicitly stated in the gist discussion](https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95?permalink_comment_id=5999841#gistcomment-5999841): “microgpt is MIT licensed.” These are distinct source and author-statement facts. AI Village is not making a repository-level licensing decision in this pass; no license files are added or changed.

The upstream source is **not vendored**. A downloaded copy under `/tmp` was used to recheck the pinned hash and header. `microgpt_reference.py` is a separately written mathematical oracle, with attribution here; it is not a preserved copy of upstream text.

## Fidelity and intentional differences

The oracle preserves the pinned mathematical operations: both embedding and pre-attention RMSNorm; sequential causal K/V graphs; attention and MLP residual paths; ReLU; direct final output projection without an extra normalization; mean target cross-entropy; and Adam's linear schedule and bias correction.

The tiny fixture substitutes three characters and BOS, width 8, two heads, one layer, and context 8. It uses the fixed teacher-forced document `abca`. Its parameter count is 896. There is no dataset download, shuffle, sampled generation, or import-time training. The oracle uses an iterative backward traversal and captures numerical observations in ordinary dictionaries. None of those observations changes graph operations.

The committed initial matrices were created once using CPython `random.Random(42).gauss(0, 0.08)` in declared matrix order. That is initialization provenance, not a cross-language RNG contract. Regeneration always consumes committed numeric state and never runs an RNG. `rngState: null` means teacher forcing has no active RNG state; it is not a saved seed or a claim that stochastic generation can resume. The dataset cursor starts at zero for the fixed example.

## Validation against the original source

`compare_upstream.py` accepts a local upstream source path, verifies the exact hash **before execution**, extracts its mathematical declarations using Python's AST, injects the committed matrices/configuration, and invokes the original forward/backward computation. It also executes the original Adam assignment and update loop extracted from the same file. Dataset I/O, random initialization, training iteration, and sampling top-level code are not executed.

Run from the Model Lab directory:

```sh
python3 reference/compare_upstream.py /path/to/hash-matching/microgpt.py
```

The September 5 comparison checked 3,676 scalar values: all pre/post logits and probabilities, per-position and mean losses, all gradients, all post-update parameters, and Adam first/second moments. Maximum absolute difference was **0.0**. The check permits absolute and relative error of `1e-12`; the observed result was exact. This validation establishes the independent oracle's numerical agreement without committing upstream code. The optional comparison needs the externally supplied original file; ordinary tests and regeneration are offline.

## Reproduction

```sh
python3 reference/generate_fixture.py --check
python3 -m unittest discover -s tests/reference -v
```

The regeneration check compares bytes, including full-precision serialized Python floats. This is deterministic within the validated CPython/libm environment; platforms with different transcendental implementations may need numerical review rather than silently rewriting evidence. Cross-runtime conformance uses explicit tolerances, separate from canonical display rounding.
