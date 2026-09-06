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

## Canonical byte-exact regeneration

The historical canonical fixture is preserved (Option A); September 5 upstream comparison results above have **not** been rerun. Regeneration consumes the committed initial bytes and checks the full-precision JSON encoding byte-for-byte, including key order and whitespace. This is a provenance claim about a defined CPython/libm environment, not a cross-platform floating-point guarantee.

The accepted canonical generation environment, revalidated September 6, is **macOS 26.5.2 (25F84), arm64**, Apple Command Line Tools **CPython 3.9.6**, build `default, May 22 2026, 11:13:45`, compiler `Clang 21.0.0 (clang-2100.1.1.101)`, using that macOS system libm. Executable: `/Library/Developer/CommandLineTools/usr/bin/python3`, SHA-256 `bdea59019a38eb6600cc9e71e984a97fedadc406448431281e7657030f54987e`. Python version alone does not identify this environment. This records the validated Apple environment; it is not a digest-pinned, redistributable environment image.

Unchanged fixture SHA-256 digests:

- `canonical.initial.json`: `09670a2658a3bca2f7204927cdd41f8559fdd360d180533698a9857a4863b056`.
- `canonical.expected.json`: `b8af1e9889a7a9561b5a9cff7320436d83f2822f0fa0fd62853760b905bd0737`.

```sh
npm run test:reference:canonical
```

This runs the original byte-equality assertion in `tests/canonical/` and `generate_fixture.py --check`. Neither writes fixtures. On a different environment, byte failure does not authorize replacing evidence. The explicit generator without `--check` remains a deliberate authoring command, outside all acceptance paths.

## Portable numerical conformance

```sh
npm run test:reference           # always aliases test:reference:portable
npm run test:reference:portable
```

These run offline reference properties, adversarial validator regressions, and an uninstrumented native oracle regeneration compared recursively with the untouched canonical evidence. There is no environment-variable switch or skipped exact test. Canonical verification has its own explicit command.

The portable comparison requires exact Python/JSON types, object keys and insertion order, array lengths and element order, integer IDs/counts/indexes, strings, booleans/nulls and identity fields. Configuration and declared ordering subtrees are exact even for floating inputs. The unchanged initial-state byte hash binds configuration, parameter order, input/target IDs, initial matrices, optimizer inputs and continuation state. Parameter matrix keys/order, token/target fields and optimizer structure are checked directly in generated evidence. Reference algebraic identities and exact post-update re-execution are tested against one native execution; agreement of that execution with the canonical fixture is tested separately.

For finite floating numerical evidence only:

```text
abs(actual - canonical) <= 1e-30 + 1e-12 * abs(canonical)
```

The `1e-12` relative limit matches the existing upstream reference relative tolerance. The `1e-30` absolute floor is deliberately much tighter than its `1e-12` floor, so tiny second moments cannot undergo meaningful relative drift under a unit-scale absolute allowance. The measured maximum relative error is about 5,000 times smaller than the limit. Zero evidence has only the `1e-30` floor. Non-finite values fail. Neither canonical evidence nor regenerated values are rounded. Existing TypeScript/model tolerances remain unchanged.

Output reports differing-float count, maximum absolute and relative errors, and the path of each maximum. Relative error uses the absolute canonical value as denominator (infinity for nonzero error from zero). Failure includes the first offending path, values, error magnitudes and allowed error, plus global maxima over comparable numeric leaves.

The [measured macOS/Linux discrepancy and operation-level diagnosis](PORTABILITY.md) found **two of 10,117 floats** differing, maximum absolute error **2.0679515313825692e-25**, maximum relative error **1.984571846060205e-16**, both at `adam.vHat[150]`. Ubuntu 24.04 and Debian Linux CPython 3.12.14 agreed exactly with each other. Tracing isolated platform `pow` differences; replaying macOS primitive outputs restored the entire canonical byte stream with identical operation inputs. This justifies separating provenance from portable conformance without changing the model or fixtures.

Hosted Linux CI, aggregate acceptance, and isolated-subtree acceptance use the portable path. Canonical verification is not scheduled on a generic macOS runner: the defined Apple OS/CPython/libm environment is not available as a pinned hosted image. It remains a local provenance gate in that environment. A future deliberate canonical-container migration would need new provenance and full dependent acceptance, rather than an opportunistic fixture rewrite.
