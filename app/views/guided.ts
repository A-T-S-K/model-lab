import {
  guidedReadModel,
  type GuidedBatch,
} from "../presentation/guided-read-model.js";
import { instrumentView, sourceStrip } from "./instrument.js";
import { escapeHtml } from "./evidence.js";
import type { RunResult } from "../worker/protocol.js";

export const guidedMap = [
  [
    "characters",
    "Characters",
    "The model reads a sequence of characters: a, b, and c. START / END marks the sequence boundary.",
  ],
  [
    "embeddingSum",
    "Tokens + position",
    "A token is a character’s number ID. It selects a learned vector; a position vector tells the model where it appears.",
  ],
  [
    "attentionOutput",
    "Attention",
    "Attention mixes information from this position and earlier positions. It cannot look at future characters.",
  ],
  [
    "mlpRelu",
    "MLP",
    "A small neural network transforms the mixed information, using learned weights and a simple rule that keeps positive values.",
  ],
  [
    "logits",
    "Scores",
    "The model calculates a score for each possible next character. Parameters are the adjustable numbers used in these calculations.",
  ],
  [
    "probabilities",
    "Probabilities",
    "Scores become probabilities that sum to 100%. A probability describes how much of the model’s prediction goes to one possible next character.",
  ],
] as const;

export interface GuidedLearning {
  document: string;
  position: number;
  target: number;
  before: number;
  after: number;
  completed: number;
  startingStep: number;
  afterRunId: string;
}

export { lessonPosition } from '../presentation/public-guided-computation.js';

/** Explain the selected execution beside its probabilities, independently of the live model. */
export function probabilityContextView(
  result: RunResult | undefined,
  learning: GuidedLearning | undefined,
): string {
  if (!result) return "";
  const runId = result.run.manifest.runId;
  const experiment = result.experiment;
  const before =
    experiment &&
    [
      experiment.beforeRunId,
      experiment.trainingRunId,
      experiment.backwardRunId,
    ].includes(runId);
  const after = experiment?.afterRunId === runId;
  const relationship =
    before || after
      ? `${before ? "Before" : "After"} the update from model step ${experiment!.update.step} to ${experiment!.update.step + 1}`
      : `Recorded prediction at model step ${result.trainingStep}`;
  const sameTeaching =
    (before || after) &&
    learning &&
    experiment?.afterRunId === learning.afterRunId;
  return `<div class="note" data-testid="probability-context" data-run-id="${escapeHtml(runId)}"><strong>${escapeHtml(relationship)}</strong>
    ${sameTeaching ? `<p>This is the last single update in the ${learning.completed}-update Teach comparison (model steps ${learning.startingStep} to ${learning.startingStep + learning.completed}). Guided compares before the first update with after the last.</p>` : ""}
    <p>Inspecting a recorded run does not change the live model.</p></div>`;
}

export function guidedView(
  result: RunResult | undefined,
  learning: GuidedLearning | undefined,
  vocabulary: readonly string[],
  currentDocument: string,
  liveRunId: string,
  busy: boolean,
  ready: boolean,
  mapIndex: number,
  replay = false,
  batch?: GuidedBatch,
  pendingCommand?: "predict" | "train",
): string {
  const model = guidedReadModel(
    result,
    learning,
    vocabulary,
    currentDocument,
    liveRunId,
    busy,
    ready,
    replay,
    batch,
    pendingCommand,
  );
  const percent = (value: number | undefined) =>
    value === undefined ? "—" : (value * 100).toFixed(1);
  const comparison = model.comparison;
  const showComparison =
    comparison &&
    comparison.afterRunId === result?.run.manifest.runId &&
    comparison.document === currentDocument;
  const distribution =
    model.frame === "A1" || model.frame === "TEACH"
      ? ""
      : showComparison
        ? `<div class="instrument-comparison" data-testid="guided-change"><p>${model.earlierComparison ? "Earlier teaching comparison. " : ""}This comparison used <b>${escapeHtml(comparison.document)}</b></p><div class="comparison-values"><span data-testid="guided-before" data-value="${comparison.before}">${percent(comparison.before)}%</span><span>→</span><span data-testid="guided-after" data-value="${comparison.after}">${percent(comparison.after)}%</span></div><div class="comparison-scale"><span class="current-mark" style="width:${100 * comparison.after}%"></span><span class="before-mark" style="left:${100 * comparison.before}%"></span></div><div class="probability-axis"><span>0%</span><span>100%</span></div><p class="pp-change">${comparison.after >= comparison.before ? "+" : ""}${percent(comparison.after - comparison.before)} pp</p><p><strong data-testid="guided-completed">${comparison.completed}</strong> REAL UPDATES</p><small>Reference line: before · filled mark: after</small></div>`
        : `<div class="instrument-distribution" data-testid="probabilities"><div class="probability-axis"><span>0%</span><span>100%</span></div>${model.values?.map((value, i) => `<div class="probability-row" data-value="${value}"><span>${escapeHtml(vocabulary[i] ?? "START / END")}</span><div class="bar-track"><span class="bar" style="width:${100 * value}%"></span></div><code title="${value}">${percent(value)}%</code></div>`).join("") ?? "<p>NOT CAPTURED</p>"}</div>`;
  const extended = model.earlierComparison && !showComparison;
  const output = `<div class="instrument-result"><span>Next token <b data-testid="guided-target">${escapeHtml(model.target)}</b></span><div class="hero-probability" data-value="${model.probability ?? ""}">${percent(model.probability)}<small>%</small></div></div>${extended ? probabilityContextView(result, learning) : ""}${distribution}`;
  return `<div class="instrument-guided ${extended ? "with-historical" : ""}" data-testid="guided-lesson" data-frame="${model.frame}"><div class="instrument-intro"><p class="eyebrow">A NEURAL NETWORK, OPEN TO INSPECTION</p><h1>Watch one real neural network learn.</h1></div>${instrumentView(model, mapIndex, output)}<section class="instrument-invitation">
    ${model.frame === "A1" ? `<p>Teach it. Watch the prediction change.</p><button id="activate-attract" class="primary" ${busy || !ready || !result ? "disabled" : ""}>TOUCH TO START</button><p class="replay-label">RECORDED RUN · REPLAY</p>` : model.frame === "TEACH" ? `<p>Teaching on ${escapeHtml(batch!.capturedDocument)}</p><div role="status" class="teach-progress" data-testid="teach-progress"><span aria-hidden="true">${"■".repeat(batch!.completedCount)}${"□".repeat(10 - batch!.completedCount)}</span> <b><span data-testid="guided-completed">${batch!.completedCount}</span> / 10 REAL UPDATES</b></div><button id="cancel-teach">Cancel teaching</button><p class="instrument-caption">Counts advance only when a real update completes.</p>` : `<p>${showComparison ? (comparison!.before === comparison!.after ? "Same context. Target probability unchanged." : "Same context. Same model. A changed prediction.") : `The model gives “${escapeHtml(model.target)}” a ${percent(model.probability)}% chance of coming next.`}</p><div class="instrument-actions">${showComparison ? '<button id="guided-explore" class="primary">Why did that change? · Explore</button><button id="guided-microscope">Follow one number · Microscope</button>' : `<button id="teach" class="primary" ${model.canTeach ? "" : "disabled"}>Teach · 10 real updates</button><button id="why-prediction">Why this prediction? · Explore</button>`}</div><p class="instrument-caption">${batch && batch.status !== "COMPLETE" && comparison ? `${batch.status} · ${comparison.completed} completed real updates. ` : ""}Teach on ${escapeHtml(model.source?.capturedDocument ?? currentDocument)} · the full ${result?.tokenIds.length ?? 5}-position objective.</p>`}
    ${!replay && mapIndex !== 5 ? `<p data-testid="map-explanation" class="instrument-caption">${guidedMap[mapIndex]![2]}</p>` : '<span data-testid="map-explanation" class="sr-only"></span>'}
  </section><footer class="instrument-footer">${sourceStrip(model)}<p>${replay ? "Recorded real run. Not live." : `Public example ${escapeHtml(model.prefix)} → ${escapeHtml(model.target)} · 1 of ${result?.tokenIds.length ?? 5} training positions · Next-token probability, not overall accuracy.`}</p></footer>
  ${!replay && ((model.earlierComparison && !showComparison) || result?.run.manifest.intervention) ? `<div class="source-context-extra">${result?.run.manifest.intervention ? '<p data-testid="intervention-declaration">This recorded prediction used a declared head intervention.</p>' : ""}${comparison ? `<div data-testid="guided-change"><p>Earlier teaching comparison. This comparison used ${escapeHtml(comparison.document)}</p><span data-testid="guided-before" data-value="${comparison.before}">${percent(comparison.before)}%</span> → <span data-testid="guided-after" data-value="${comparison.after}">${percent(comparison.after)}%</span> · <span data-testid="guided-completed">${comparison.completed}</span> real updates <button id="guided-explore">Why did that change? · Explore</button><button id="guided-microscope">Follow one number · Microscope</button></div>` : ""}</div>` : ""}</div>`;
}
