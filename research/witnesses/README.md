# M1 heterogeneous witnesses

Use the existing pinned `research/pythia/.venv` environment. No installation,
upgrade or weight download is needed. The existing loopback bridge registers the
MLP alongside Pythia; its origin/host/request/epoch/size guards apply to both.

In **Models & saved evidence**, select **Numeric MLP · float32 / MSE / SGD**.
The numeric input is an explicit JSON batch with `kind`, `values` (N × 2) and
`targets` (N × 1). Values must be exactly representable float32 numbers. Choose
`predict` or `train`, then explicitly run the producer. Every UI request starts
from the declared initial state and training produces one disposable SGD result.
There is no persistent server training state or automatic acceptance. Exact
starting/resulting parameters, SGD settings, step and data cursor are retained in
**Original recording and supported state**. Their derived hashes appear in the
coverage text. No Adam moments are invented. Null RNG state means this deterministic
execution consumes no randomness, not that a seed substitutes for RNG state.

`mlp.py` contains the readable arithmetic; `adapter.py` binds actual tensors and
validates the supported state. An explicit version-2 bridge request may carry a
previous result in `state`; `null` selects the initial state. This is a disposable
execution from supplied state, not adoption. Training continuation is qualified for
constant learning rate 0.0625, SGD without momentum, these parameter meanings,
float32 CPU and the pinned environment. Unsupported settings fail. The application
save/open route only replays evidence and never resumes execution automatically.

**MicroGPT · 2 layers / 3 heads / width 6** uses the existing native TypeScript
forward implementation in a disposable browser worker. Its separate fixture has
context six, five vocabulary characters (`wxyz!`) plus BOS, and head width two.
The shared inspector binds all captured layers, heads and positions, including
causal K/V dependencies. It retains complete inference parameters/config/order;
training continuation and scalar capture are not advertised for this fixture.
Canonical fixtures, arithmetic, oracle and world layout are unchanged.

`fixtures.py` executes four query heads against two KV heads with an explicit
`[0,0,1,1]` mapping. A second fixture computes a real vector norm while leaving its
internal region opaque. The structural preview performs no numerical forward pass.
Unknown explanations remain unsupported. All use the same store/query/player and
inspector fallback; unavailable values stay null.

`identity.py` generates pinned source/capture metadata. Run it only when intentionally
updating this binding, before qualification. `qualify.py` allocates fresh evidence
through the existing safe-output helper, compares against a separately authored
`torch.nn` / `torch.optim.SGD` reference, checks deterministic state continuation,
and compares grouped-head results with independent scalar-loop arithmetic. It does
not overwrite the independent canonical Python oracle or its goldens.

```sh
PYTHONDONTWRITEBYTECODE=1 research/pythia/.venv/bin/python research/witnesses/qualify.py
```

Pass the emitted directory as `WITNESS_RECORDING_DIR` when running the integration
and browser witness tests. The browser checks use `playwright.slice.config.ts`,
a freshly allocated build, explicit local ports and the existing output harness.
See [M1 qualification](../../docs/reviews/M1-witness-qualification.md) for the exact
candidate, commands, saved evidence, observed failures and limits.
