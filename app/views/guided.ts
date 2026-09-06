import { escapeHtml, probabilityView } from './evidence.js';
import type { RunResult } from '../worker/protocol.js';

export const guidedMap = [
  ['characters', 'Characters', 'The model reads a sequence of characters: a, b, and c. START / END marks the sequence boundary.'],
  ['embeddingSum', 'Tokens + position', 'A token is a character’s number ID. It selects a learned vector; a position vector tells the model where it appears.'],
  ['attentionOutput', 'Attention', 'Attention mixes information from this position and earlier positions. It cannot look at future characters.'],
  ['mlpRelu', 'MLP', 'A small neural network transforms the mixed information, using learned weights and a simple rule that keeps positive values.'],
  ['logits', 'Scores', 'The model calculates a score for each possible next character. Parameters are the adjustable numbers used in these calculations.'],
  ['probabilities', 'Probabilities', 'Scores become probabilities that sum to 100%. A probability describes how much of the model’s prediction goes to one possible next character.'],
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

export function lessonPosition(result: RunResult): number {
  // Follow the last character-to-character transition, never the final character → END payoff.
  return Math.max(0, result.tokenIds.length - 2);
}

export function guidedView(result: RunResult | undefined, learning: GuidedLearning | undefined, vocabulary: readonly string[], currentDocument: string, liveRunId: string, busy: boolean, ready: boolean, mapIndex: number): string {
  const position = result ? lessonPosition(result) : 0;
  const captured = result?.tokenIds.slice(1).map(id => vocabulary[id]).join('') ?? '';
  const target = result?.targetIds[position];
  const prefix = captured.slice(0, position);
  const values = result?.probabilities[position];
  const current = !!result && result.run.manifest.runId === liveRunId && captured === currentDocument;
  const canTeach = current && /^[abc]{2,7}$/.test(currentDocument) && ready && !busy;
  const label = (id: number | undefined) => id === undefined ? 'unavailable' : vocabulary[id] ?? 'START / END';
  const percent = (value: number) => `${(100 * value).toFixed(2)}%`;
  const learnedPrefix = learning?.document.slice(0, learning.position);
  const earlier = learning && (learning.document !== captured || learning.document !== currentDocument || learning.afterRunId !== liveRunId || result?.run.manifest.runId !== learning.afterRunId);
  return `<div class="guided-lesson" data-testid="guided-lesson">
    <section class="panel lesson-predict"><div class="eyebrow">01 / Predict</div><h2>What comes next?</h2>
      ${result?.run.manifest.intervention ? '<p class="note" data-testid="intervention-declaration">This recorded prediction used a changed model: one attention head’s output was disabled. Explore identifies the head and its measured effects.</p>' : ''}<p>This is a tiny GPT. It sees characters and tries to predict what comes next. The fixed starting model is untrained; teaching changes it.</p>
      <ol class="model-map" aria-label="Map of the model">${guidedMap.map(([, name], index) => `<li><button data-map="${index}" aria-pressed="${index === mapIndex}" class="${index === mapIndex ? 'active' : ''}">${name}</button></li>`).join('')}</ol>
      <p class="map-explanation" data-testid="map-explanation">${guidedMap[mapIndex]![2]}</p>
      <div class="lesson-prediction"><div><p>Follow this prefix from the recorded input:</p><div class="lesson-prefix"><span class="boundary">START / END</span> ${escapeHtml(prefix || '∅')}</div>
      <p>Known next character: <strong data-testid="guided-target">${escapeHtml(label(target))}</strong></p><p class="muted">The prediction uses the whole prefix. The known next character is the answer we can teach it.</p></div>
      <div><h3>The model’s prediction</h3><div data-testid="probabilities">${probabilityView(values, [...vocabulary, 'START / END'])}</div></div></div>
      <p class="muted">${current ? 'These numbers came from the run you just watched.' : 'These numbers belong to the recorded input shown above. Predict to use the current input and model.'}</p>
      <button id="why-prediction">Why this prediction? · Explore</button>
    </section>
    <section class="panel lesson-teach"><div class="eyebrow">02 / Teach</div><h2>Give the model the next characters</h2>
      <p>Teaching compares each prediction with the known next character. Its loss measures how far those predictions miss the answers. Each real update adjusts the model’s parameters, the adjustable numbers used in its calculations.</p>
      <p>We’ll train on <strong>${escapeHtml(captured || '(empty input)')}</strong> for 10 updates, then predict the same input again. The starting example follows <strong>abc → a</strong>.</p>
      <button id="teach" class="primary" ${canTeach ? '' : 'disabled'}>Teach · 10 real updates</button>
      ${!current ? '<p class="note">Predict the current input first to start a new teaching comparison.</p>' : captured.length < 2 ? '<p class="note">Enter at least two characters and Predict to follow a character-to-character example.</p>' : '<p class="muted">Teach again to continue from the current model. No hidden reset.</p>'}
    </section>
    <section class="panel lesson-changed" data-testid="guided-change"><div class="eyebrow">03 / See what changed</div><h2>Did the target become more likely?</h2>
      ${learning ? `<p>${earlier ? 'Earlier teaching comparison. ' : ''}This comparison used <strong>${escapeHtml(learning.document)}</strong>: after <strong>${escapeHtml(learnedPrefix!)}</strong>, target <strong>${escapeHtml(label(learning.target))}</strong>.</p>
      <div class="lesson-comparison"><div><small>Before this teaching session</small><div class="lesson-number" data-testid="guided-before" data-value="${learning.before}">${percent(learning.before)}</div></div><span aria-hidden="true">→</span><div><small>After <strong data-testid="guided-completed">${learning.completed}</strong> real updates</small><div class="lesson-number" data-testid="guided-after" data-value="${learning.after}">${percent(learning.after)}</div></div></div>
      <p>From model step ${learning.startingStep} to ${learning.startingStep + learning.completed}. These are the probabilities measured before the first update and after the last completed update.</p>
      <p>Parameters changed, so the model’s prediction changed. A gradient tells training how a parameter affects loss; Explore shows the actual changes. Fitting this example does not show how well the model understands other text.</p>` : '<p>Teach the model to compare the target probability before and after real updates. No result is filled in ahead of time.</p>'}
      <p class="muted">${learning ? 'The buttons below follow this teaching comparison’s recorded after prediction.' : 'The buttons below follow the current recorded prediction.'}</p><div class="controls"><button id="guided-explore">Why did that change? · Explore</button><button id="guided-microscope" ${!result || busy ? 'disabled' : ''}>Follow one number · Microscope</button></div>
    </section></div>`;
}
