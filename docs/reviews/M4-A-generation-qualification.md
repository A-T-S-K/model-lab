# M4-A bounded native Pythia generation qualification

## Disposition

**ENGINEERING-QUALIFIED for the explicitly uncached Pythia profile.** M4 remains
**IN PROGRESS**. This slice closes the bounded-generation portion of FP-03 and
engineering-qualifies FP-09 for
`pythia-14m-cpu-f32-eager-uncached-generation-v2`. It does not advertise a cache,
make a cached-versus-uncached equivalence claim, complete M4, or begin M4-B portable
archives, byte-backed payloads or remote mutation reconciliation. Independent M5
foundation review remains required.

## Authority and candidate identity

- Starting HEAD, `foundation-v2-m3-qualified^{commit}`, and verified starting
  `origin/m4-durable-evidence`: `0f390851d594e73907929f0af0be76ab4cc1032c`.
- Ending implementation candidate: `01ae3a47efbe597a598c2694fc73ad97d46a6d87`.
  This report is a subsequent documentation-only closure commit.
- Starting application runtime:
  `sha256:fcb5284439b830cab7a1091f451e346f85c4f5084cbd19dd4613d13356075d8f`.
- Qualified ending application runtime:
  `sha256:ab73bfef4254fee02c48c67cecc2c60394c94ecb995948389618536884c988f4`.
- Branch: `m4-durable-evidence`. The worktree was clean at start. The documented
  unrelated `docs/abq-product-review.md` was not present in this checkout; no such
  path was created, staged or modified.
- Historical M2-D profile/runtime remain
  `pythia-14m-cpu-f32-eager-v1` /
  `sha256:290becead8351ebb54ab765c1f49091e3837209fb183909e457f6240687cd298`.
  The earlier registered legacy runtime
  `sha256:ea128d6858613534387d0089163786eb34b4c3f5d494e2d10cc4b36c0c21c69d`
  also remains registered under its original identity.
- Current profile/runtime are
  `pythia-14m-cpu-f32-eager-uncached-generation-v2` /
  `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`.
- Model revision: `cf967c0a9a04383db6f7b1108d86b2962634b4ac`.
  Definition/config:
  `pythia-14m:f97f966a66c444890ed461fff2a51eefb15d74303df05b948124719f199b0b17`.
  Checkpoint:
  `sha256:116a02532db461f91386a5b20f942ff2c8d4de7341e21b55caafc3d7b25f49a1`.
  Tokenizer source:
  `sha256:870f4e2baa6b683221fa52004d5d6f40ab8c9d31961617304b78c910c2c3caf2`.
  Installed native source:
  `sha256:c8684ddf23ca40c8151459902f89b19b13372aeb766cc21afc8a5323ac55f538`.

The original `profile.json`, `profile-legacy.json`, model/tokenizer locks, five pinned
cache files, canonical fixture/oracle, `dist`, and prepared ABQ outputs were not
rewritten. `profile-generation.json` is the new current binding; it explicitly names
the M2-D profile as its compatibility base.

## Inspected native surface

The installed Transformers 5.17.0 source and live signatures were inspected before
implementation. `GPTNeoXForCausalLM.forward` accepts `past_key_values`, `use_cache`
and `logits_to_keep`; `GPTNeoXModel.forward` constructs `DynamicCache` only when
`use_cache` is true. The pinned config declares `vocab_size=50304`, context 2,048,
`use_cache=true` as its library default and EOS/BOS ID 0. The loaded input embedding
has 50,304 rows and the LM head has 50,304 outputs. The tokenizer exposes 50,277
labels. Therefore every model output index can be supplied directly to the next native
invocation even when it has no tokenizer label. M4-A nevertheless always passes
`use_cache=False` and asserts that `past_key_values` is `None`.

## Contract and recipe

Generation uses the existing `pythia-native-v1` registered codec, `EvidenceStore`,
bounded slices, player and Pythia world. The envelope carries one versioned
`generation-v1` receipt and one generic run whose point IDs are unique across all
occurrences. It does not introduce a generation-only store.

The request is version 3 with an exact generation configuration. The fixed recipe is
`pythia-greedy-full-prefix-uncached-v1`; the selection policy is
`argmax-full-output-v1`. Effective bounds are one or two requested new tokens, no more
than four prompt tokens, no more than 16 total tokens, 2,048 points, 200,000 numeric
values and 4,000,000 encoded response bytes. The qualification witness contains 35
points, 163,860 values and 3,194,555 encoded bytes. No shared limit was raised.

The recipe uses no temperature, top-p, sampling or RNG. Verified EOS is not honored by
this fixed proof recipe; termination is always explicit `max_new_tokens`. Predict
remains the existing one-pass semantic action and is not an alias for generation.

Each occurrence retains exact prefix IDs, token embeddings, nonzero layer-1 residual
input, both LayerNorm branch outputs, fused pre-RoPE QKV, all four heads' native
post-RoPE attention probabilities, projected attention output, MLP output, parallel
residual output and all 50,304 final-position logits. The chosen output index is a
separate scalar `derived` point depending on the observed logits point. It is not
labeled as an activation or model observation.

## Deterministic witness and full-support proof

Prompt: `The cat sat`.

| Occurrence | Generated step | Exact effective prefix | Final input position | Choice / label | Generated position | Stop |
| --- | ---: | --- | ---: | --- | ---: | --- |
| `prefill:0` | 0 | `[510, 5798, 2206]` | 2 | none | none | none |
| `generation:1` | 1 | `[510, 5798, 2206]` | 2 | `327` / `Ġon` | 3 | none |
| `generation:2` | 2 | `[510, 5798, 2206, 327]` | 3 | `253` / `Ġthe` | 4 | `max_new_tokens` |

Step 1 selected logit is `15.577466011047363`, selected probability
`0.1729444395399012`, and top-five omitted mass `0.5829196863414466`. Step 2 selected
logit is `13.342390060424805`, selected probability `0.37002563338324457`, and
top-five omitted mass `0.3307867347192953`. Both denominators cover all 50,304
observed logits. Displayed top five values are not renormalized. Exact arbitrary index
50,303 remained available; its step-2 logit is `-3.8919265270233154`, and the UI
truthfully states that no tokenizer label exists for indices at or above 50,277.

The codec requires the choice to be the first full-support maximum, within `[0,50304)`,
and binds it to its exact logits occurrence. Unmapped choices must retain a null label;
tests reject a fabricated label. Generated integer IDs are appended directly to the
next prefix rather than decoded, fabricated as text or re-tokenized.

## Invocation, step, epoch and invalidation proof

The native request's cancellation epoch was `37` in independent qualification and `2`
in the browser route. Occurrence identities were `prefill:0`, `generation:1` and
`generation:2`; generated steps were 0, 1 and 2. Model position, generated position,
run/request ID, occurrence, step and semantic point are separate fields. A mutation
that replaced generated step 1 with cancellation epoch 37 failed admission. Repeating
the same prompt under another request retained equal deterministic choices `[327,253]`
but produced a distinct run and request occurrence.

The native client retains one cancellation authority. Cancel or producer/profile
switch increments its epoch and aborts the request. A deliberately delayed generation
response arriving after cancellation failed before shared-store publication and left
the store empty. Server transport also rejected duplicate requests and stale epochs.
Because every request starts from prompt IDs and immutable checkpoint/profile identity,
and the receipt requires `retainedState=false`, no prior result can provide hidden
execution state to another request.

## Explicit uncached policy

The receipt requires exactly:

```text
capability = unsupported
qualified = false
strategy = full-prefix-reexecution
useCache = false
retainedState = false
```

Prompt processing and both generated steps are distinct ordinary native calls. Every
generated-token call consumes the complete exact prefix; every direct and instrumented
call asserts `past_key_values is None`. Profile, checkpoint, model switch, cancel and
request boundaries therefore invalidate the operation rather than a cache object.
There is no cache identity or reusable KV payload. No cached path is advertised, so no
cached-versus-uncached equivalence claim is made. A future cache-enabled profile needs
its own qualification.

## Independent native reference and selected internals

`qualify.py` loads a fresh direct Hugging Face GPTNeoX model and never calls the
generation adapter implementation for its reference loop. It runs the same prompt,
full-prefix forward calls, `use_cache=False`, and full-support greedy argmax. For every
occurrence it compares exact prefix IDs, all 50,304 logits, chosen output index and
generated position. Minimal reference hooks separately compare embedding, layer-1
residual input, both LayerNorm branches, QKV, attention probabilities, attention
output, MLP output and residual output. The established prediction comparison and
parallel residual identity also remain.

All prediction and generation comparisons have maximum absolute error `0` and maximum
relative error `0` under the unchanged float32 policy
`abs(error) <= 1e-6 + 1e-6 * abs(reference)`. Browser inspection selected attention
heads 0 and 2 on a generated invocation and observed different retained native values.

## Replay and UI proof

The shared developer UI offers Predict and Generate only for the current native
Pythia binding. The generation world adds an occurrence selector, prompt versus
generated-step labeling, exact effective prefix, generated/model positions, explicit
choice, stop reason, full-support top-k/omitted mass and exact index lookup, plus
`uncached · full prefix reexecuted` and cache refusal. The selected occurrence continues
to use the existing six-block Pythia world and selected layer-1 evidence.

The live route saved the real generation envelope. The bridge was then stopped before
the offline route opened the saved record. Reopening, changing occurrence, selecting
QKV, changing typed coordinates, refusing uncaptured post-RoPE detail, inspecting
index 50,303 and returning to canonical Predict issued **zero** native HTTP requests.
The retained source identity and original profile/runtime remained bound.

Visual evidence inspected at native resolution:

- `test-results/scratch/m4a-browser-live-20260916-01/evidence/test-d5dQmf/m4-a-generation-step2-1920.png`
- `test-results/scratch/m4a-browser-live-20260916-01/evidence/test-d5dQmf/m4-a-choice-evidence-1920.png`
- `test-results/scratch/m4a-browser-offline-20260916-01/evidence/test-qjlvJ7/m4-a-replay-reduced-1280.png`

The 1920×1080 timeline, selected full-support distribution and choice evidence were
legible. The 1280×720 reduced-motion view retained the occurrence/prefix/cache meaning;
the evidence lens remained intentionally scrollable rather than hiding values.

## Strict controls and historical compatibility

Transport and codec tests refuse unsupported action/profile, zero or excessive token
requests, overlong generation prefixes, malformed configuration, wrong selection
policy, tampered prefix, non-argmax or out-of-range choice, fabricated unmapped label,
repeated occurrence identity, occurrence/step mismatch, cancellation epoch substituted
as step, missing previous-choice dependency, wrong checkpoint/runtime, malformed
full-support logits, duplicate points, duplicate requests, stale epochs and stale final
admission. Invalid imports are rejected without mutation or repair.

An original retained M2-D recording at runtime
`sha256:290becead8351ebb54ab765c1f49091e3837209fb183909e457f6240687cd298`
was admitted and replayed by the strict reader after the new profile was added. Its
definition, checkpoint, input-transform, profile and runtime identities were unchanged.
Current ordinary Predict used the new binding, retained the original 11-point capture,
layer-1 world, pre-RoPE warning, observed attention probabilities, exact output index
50,303 and disconnected replay semantics.

## Commands and results

| Command / scope | Result |
| --- | --- |
| Live authority: status, HEAD, milestone tag, branch and remote `ls-remote` | PASS; all starting refs matched `0f390851…` |
| Installed Transformers/GPTNeoX signature, source, config, tokenizer and embedding inspection | PASS; 50,304 input/output support, 50,277 labels, verified EOS 0, cache interfaces observed |
| `research/pythia/.venv/bin/python research/pythia/identity.py` | PASS; current profile metadata matches installed pinned binding without rewriting historical profile |
| Fresh `research/pythia/qualify.py` in `test-results/scratch/m4a-native-20260916-01` | PASS; prediction plus three generation occurrences, all maximum errors 0 |
| `research/pythia/test_bridge.py` against explicit loopback bridge | PASS, 15/15 bounded origin/host/schema/budget/live/stale controls |
| Focused codec, repeated-occurrence, cancellation, replay and Pythia-world tests | PASS, 14/14 in the combined focused invocation after one test-fixture float32 correction |
| `npm test` with current prediction/generation recordings | PASS, 203 cases: 199 passed, 4 unrelated optional MLP/fixture cases skipped |
| `npm run test:reference` | PASS, 17/17 and portable exact conformance, zero differing floats |
| `npm run test:reference:canonical` | PASS, byte-for-byte canonical regeneration |
| `npm run typecheck` | PASS |
| `npm run example` | PASS |
| `vite build --outDir test-results/scratch/m4a-build-20260916-01/build` | PASS; original `dist` untouched |
| Focused M4-A live 1920×1080 route | PASS, 1/1 |
| Focused M4-A bridge-stopped 1280×720 reduced-motion replay route | PASS, 1/1; zero native requests |
| Representative retained M3-D/canonical accepted-state browser route | PASS, 1/1; accepted snapshot exact after all M3 families |
| Historical M2-D recording strict admission/replay | PASS, 4/4 shared-evidence cases |

The first unprivileged bridge bind/connect and full `npm test` invocations hit the
managed sandbox's loopback restriction (`EPERM`). The same commands reran with the
task-owned loopback permission. The full rerun passed; no product change was made for
those environmental failures. The malformed-unmapped-label test initially wrote a
JavaScript double into a declared float32 point and failed at the earlier dtype guard;
rounding the deliberately forged value to float32 allowed the intended later label
guard to be exercised. Production code was unchanged by that test-fixture correction.

## Unrun scope

Per the M4-A stop boundary, no broad CI, benchmark, soak, installation isolation,
aggregate release acceptance, deployment, PR, M5 independent review, M6 user/workshop
qualification, portable archive export/import, byte-backed payload work, remote
mutation reconciliation or cached profile qualification ran. The full browser catalog
was not rerun; focused M4-A plus representative M3-D/canonical routes were used. The
four optional MLP/fixture cases in the full unit invocation were skipped because this
Pythia slice did not allocate fresh MLP fixture recordings; their retained M3 and
shared-contract coverage passed elsewhere in the same suite and representative M3-D
browser route.

## Ledger disposition and next dependency

FP-03 now records bounded native generation in addition to prior native inference,
selected internals and disconnected replay. FP-09 is engineering-qualified only for
the explicit uncached v2 Pythia profile: occurrence/position/step/epoch separation,
logits-versus-choice separation, full-prefix execution, invalidation and replay all
passed. M4 remains IN PROGRESS. The next dependency is M4-B portable archive and
payload storage, including its separately authorized remote-reconciliation scope.
