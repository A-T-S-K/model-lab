# September 6, 2026 portability investigation

Decision: **Option A**, preserve the existing canonical fixture and historical provenance. A Linux container cannot reproduce Apple's libm merely by pinning a Python version. Migrating evidence would add a new provenance baseline with no necessary benefit for this repair. A digest-pinned canonical migration remains a separate future decision.

Before changing tests, the unchanged oracle and original nine tests were run on:

- macOS 26.5.2 (25F84), arm64, Apple CPython 3.9.6 (`default, May 22 2026, 11:13:45`, Clang 21.0.0 / clang-2100.1.1.101): canonical bytes match.
- Linux amd64 (Docker Desktop emulation), CPython 3.12.14 (`main, Sep 1 2026, 00:10:15`, GCC 12.2.0), Debian glibc 2.36-9+deb12u14. Image `python:3.12.14-slim-bookworm@sha256:782412e85d0f0984994c290652577d4018aff08145c85b262bb63dc0c7522254`.
- The same CPython binary copied into Ubuntu 24.04, using Ubuntu glibc **2.39-0ubuntu8.8** (`LD_LIBRARY_PATH=/usr/local/lib`). This tests Ubuntu's libm; it is not a claim to reproduce the hosted setup-python binary/compiler or runner image exactly.

Both Linux environments generated identical output. Each failed only the original byte-equality test; the other eight tests passed. The hosted failure environment reported by the user is Ubuntu 24.04 / Python 3.12.14 / Node 24.20.0. No hosted workflow was triggered during this investigation.

## Complete evidence comparison

An independent recursive comparison before validator implementation required matching Python types, dictionary keys **and insertion order**, list lengths/order, and all non-float leaves. It visited 46 dictionaries, 463 arrays, 63 integers, 5 strings and 10,117 floats. Exactly **two floats** differed:

| Path | Canonical macOS | Linux | Absolute error | Relative error (canonical denominator) |
| --- | --- | --- | --- | --- |
| `$.adam.vAfter[150]` | `1.0420139414392543e-11` | `1.0420139414392545e-11` | `1.6155871338926322e-27` | `1.5504467547345336e-16` |
| `$.adam.vHat[150]` | `1.0420139414392533e-09` | `1.0420139414392535e-09` | **`2.0679515313825692e-25`** | **`1.984571846060205e-16`** |

The largest absolute and relative errors are both at `$.adam.vHat[150]`. Forward/post-update evidence, losses, all 896 gradients, post-parameters and Adam deltas are exact. Parameter matrix ordering, position/head/layer indices, token and target IDs, reference strings, optimizer structure and initial-state hash are exact. Configuration, initial parameters, flattening order, targets, moments and continuation inputs come from the identical committed initial file; its byte hash binds those inputs without tolerances. No separate configuration or optimizer input was generated on Linux.

## Operation-level diagnosis

`diagnose_platform.py` instruments scalar numeric `**`, `math.exp` and `math.log` calls through an AST transform in memory; it does not edit the oracle or fixtures. A macOS trace and Linux replay contain **4,104** primitive calls. With all macOS outputs replayed, every subsequent operation name and input matches exactly and the **whole generated fixture matches canonical bytes**. Only two same-input `pow` results differ on Linux:

| Input operation | macOS | Linux |
| --- | --- | --- |
| `(-3.228024072771536e-05) ** 2` | `1.0420139414392533e-09` | `1.0420139414392535e-09` |
| `(1.158301143102351e-10) ** 0.5` | `1.0762439979402214e-05` | `1.0762439979402212e-05` |

The first is the squared gradient in Adam at flattened parameter 150 (`layer0.attn_wq[2][6]`: 32 `wte`, 64 `wpe`, and 32 `lm_head` entries precede the query matrix). The second is Adam's square root at parameter 161. The square-root difference is absorbed by later representable rounding and changes no stored parameter. No `exp` or `log` outputs differ for identical inputs in this measurement. This isolates CPython/platform `pow`/libm variation, rather than an altered model, input, backward path or optimizer algorithm.

Reproduce diagnostics with an absolute subtree path and an output prefix outside the repository:

```sh
python3 reference/diagnose_platform.py "$PWD" /tmp/model-lab-macos
# Run the same command on Linux with /tmp/model-lab-linux as output prefix.
# Copy the macOS calls JSON to Linux, then:
python3 reference/diagnose_platform.py "$PWD" /tmp/model-lab-replay /tmp/model-lab-macos.calls.json
```

The replay is diagnostic evidence only. Acceptance always runs the uninstrumented oracle with native platform operations; it never substitutes, rounds, or replays canonical results.
