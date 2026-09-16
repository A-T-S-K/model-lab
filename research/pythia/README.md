# Optional native Pythia profile

This is an explicitly launched inference/capture service, not a canonical application
runtime dependency. It uses the trusted native Hugging Face GPTNeoX implementation.
No model forward pass is replaced. Canonical Node/browser installation is unchanged.

The current qualified local profile is
`pythia-14m-cpu-f32-eager-uncached-generation-v2`. The environment is Python 3.14.7,
macOS arm64, PyTorch 2.14.0, Transformers 5.17.0, CPU, one thread, eager attention,
eval, and explicitly uncached. Published F16
safetensors weights are explicitly converted to F32. `requirements.lock` pins every
resolved distribution and its SHA-256. `dependencies.json` records direct/transitive
provenance, requirements, download hashes and published license metadata; it is not
permission to install optional extras. Model and tokenizer are Apache-2.0 per the
[public model card](https://huggingface.co/EleutherAI/pythia-14m), pinned to
`cf967c0a9a04383db6f7b1108d86b2962634b4ac`. File hashes are in `model-lock.json`.
Native source excerpts in `source.json` retain Hugging Face's Apache-2.0 attribution
and the complete upstream file's SHA-256.

The existing interpreter was reused for `.venv/`. An equivalent explicitly approved
installation can run `python3 -m venv research/pythia/.venv` and then its Python with
`-m pip install --only-binary=:all: --require-hashes -r research/pythia/requirements.lock`.
The lock is platform-specific, not a promise of cross-platform reproduction.
The ignored `cache/` contains only the five files listed in `model-lock.json`,
downloaded from that immutable Hugging Face revision. No automatic download exists
in the executor. Startup verifies each file hash; loading uses `local_files_only`,
`use_safetensors=True`, `trust_remote_code=False`, and offline/telemetry-disabled
Hugging Face settings scoped to this process.

Start explicitly with free ports and the exact application's origin, for example:

```sh
research/pythia/.venv/bin/python research/pythia/server.py --port 4319 --origin http://127.0.0.1:4318
```

Use **Models & saved evidence** in the same application shell. The endpoint is
`http://127.0.0.1:4319/execute`. It accepts only bounded JSON inference requests for
the registered model/profile. No commands, paths, URLs, imports, writes or arbitrary
code are executed from requests. Host and Origin must match. Requests are serial,
with one native thread, 16 tokens, 128 ASCII characters, and bounded session/request
counts. Prediction accepts up to 16 tokens. Bounded generation accepts a prompt of at
most four tokens and one or two requested new tokens. This profile refuses other text
or configuration instead of silently transforming it.
The browser bounds responses at 4 MB and requests at 30 seconds. Cancellation revokes
browser admission; a CPU forward already running may finish server-side. It does not
change any canonical state. Restarting explicitly clears server request bookkeeping.

Capture covers token IDs/offsets, embedding output, nonzero layer 1 residual input,
both native LayerNorm outputs, fused pre-RoPE QKV, all four heads' native attention
probabilities, projected attention output, MLP output, residual output, and the final
input position's complete 50,304 logits. LayerNorm and MLP consume the same residual
input; the layer uses `(MLP + attention) + input`. Layers 0 and 2–5 are uncaptured
regions, not fabricated chains. Probabilities displayed from logits are derived;
output indices without saved labels remain indices, and top-k preserves omitted mass.
Predict remains an ordinary single capture and is not aliased to generation. Generate
uses `pythia-greedy-full-prefix-uncached-v1`: one distinct prompt-processing call and
one distinct native call per generated-token step. Every call uses the exact full
prefix and `use_cache=False`; no KV payload survives or is advertised. Selection uses
`argmax-full-output-v1` over all 50,304 logits. The observed logits and derived choice
are separate evidence, with the choice retaining the source-logits occurrence, full
output index, optional tokenizer label, generated position and stop reason. The fixed
recipe does not honor EOS and always terminates at `max_new_tokens`; it uses no
temperature, top-p, sampling or RNG. A future cached profile requires separate
qualification and no cached-versus-uncached equivalence is claimed here.

No scalar stepping, gradients, training, mutation or continuation is advertised.
Parameter weights are not training continuation state.

`identity.py` resolves the native source/binding identity and capture mapping before
qualification. `qualify.py` compares a fresh direct native model (including plain
no-hook passes) against prediction and every bounded generation occurrence. The
independent generation loop does not call the adapter generation implementation; it
reexecutes each full prefix with `use_cache=False` and applies the same full-support
greedy argmax. Internal references use separate minimal native hooks and are disclosed
as such. Do not silently change libraries, binding, weights, or eager-attention
processing; create a new profile and rerun qualification.

TransformerBridge was evaluated through the TransformerLens 3.9.0 release wheel
(SHA-256 `94739f9c54f53239c61f01e1953b8ed89cd3338c385a974ab38d1b45187f151e`)
and its [migration documentation](https://transformerlensorg.github.io/TransformerLens/content/migrating_to_v3.html).
The actual NeoX adapter declares Pythia/parallel blocks, normalization and fused QKV
splitting into new linear modules. This slice needs only native read-only boundaries,
so it chooses narrower PyTorch hooks without parameter processing/module replacement
or the broader Lens dependency stack (including datasets and wandb). Lens was not
installed or numerically qualified. This is an explicit binding choice, not a claim
that TransformerBridge lacks NeoX support or failed a benchmark.

Saved evidence uses the same registered codec, store, bounded queries and inspector
for both producers. The save slot keeps one selected recording in browser storage;
JSON export/import is inert and bounded. Versioned transport preserves negative zero.
Open saved prediction or generation runs without this environment/service. The strict
reader retains the M2-D `pythia-14m-cpu-f32-eager-v1` profile/runtime and the earlier
legacy profile for historical replay; it never relabels them with the current runtime.
Portable archive export/import and byte-backed payload storage remain M4-B work.
Current generation qualification is recorded in
`docs/reviews/M4-A-generation-qualification.md`.

Qualification outputs are fresh scratch runs: `qualify.py` allocates under
`test-results/scratch` before loading a model. `NATIVE_EVIDENCE_DIR`, if supplied,
must name a nonexistent immediate child of that directory. Existing/protected/aliased
destinations are refused. Use `PYTHONDONTWRITEBYTECODE=1` for qualification.
`test_bridge.py` now requires `SLICE_NATIVE_ENDPOINT` and `SLICE_ORIGIN` to identify
the explicitly launched task bridge. Browser output/build/port settings and current
qualification limits are documented in the [repair report](../../docs/reviews/M1-repair-qualification.md).
