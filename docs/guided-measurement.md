# Guided example selection — v0.2.1

Measured September 6, 2026 with `node --import tsx scripts/measure-guided.ts` from Model Lab. The script starts once from the committed canonical fixture, trains on `abca`, and prints every nonterminal transition at the fixed update counts below. There is no sampling, reset search, hidden rerun, or held-out evaluation. Probabilities condition on the entire visible prefix (plus START), not just its final character.

| Real updates | After `a`: P(b) | After `ab`: P(c) | After `abc`: P(a) |
| ---: | ---: | ---: | ---: |
| 0 | 0.23812303453278005 | 0.28669712348062515 | 0.3591443770854818 |
| 1 | 0.2962035499649087 | 0.3189162106904069 | 0.4070454916035887 |
| 5 | 0.49483604813181664 | 0.4473116157887909 | 0.6216047355575851 |
| 10 | 0.6912566454217702 | 0.630954142148847 | 0.9143985601971759 |
| 20 | 0.9748402878611733 | 0.9802041482156737 | 0.9994170090269443 |
| 50 | 0.9995867288152911 | 0.999795898227653 | 0.9999603156742294 |

Guided selects the visible `abc → a` transition and **10 actual updates**. Ten is the first measured count at which this transition exceeds 90%; it produces a clear change without the near-saturation of 20 or 50 updates. It demonstrates fitting this training example, not general language understanding or unseen-data improvement. The UI must read its before/after numbers and completed count from the actual execution, including after prior training or cancellation; this table is selection evidence, never replacement UI data.

HUMAN TEACHING VALIDATION: PENDING. See the [short facilitator checklist](teaching-check.md).
