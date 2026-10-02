import type { ForwardModel } from '../spatial/forward.js';

/** Learning is an activity, independent of deployment. Explicit legacy entries win. */
export function releaseLearningEnabled(query: URLSearchParams): boolean {
  return query.get('experience') === 'learn' && query.get('presentation') !== 'classic'
    && query.get('kiosk') !== '1' && query.get('demo') !== '1';
}

/** The introductory recipe follows abca's p3 character-to-character occurrence. */
export const INTRO_POSITION = 3;
export const REPRESENTATION_KINDS = ['tokenEmbedding', 'positionEmbedding', 'embeddingSum', 'embeddingNorm', 'preAttentionNorm'] as const;
export function introductoryEvidence(f: ForwardModel | undefined, requested: string, position = INTRO_POSITION) {
  if (!f) return { available: false as const, reason: 'No recorded computation is available yet.' };
  const document = f.input.slice(1).map(id => f.vocabulary[id] ?? '').join('');
  if (!Number.isInteger(position) || position < 0 || position >= f.input.length)
    return { available: false as const, reason: `This example has no lesson occurrence p${position}. Use abca for the introductory recipe.` };
  const probabilities = f.values({ kind: 'probabilities', token: position });
  const target = f.targets[position];
  if (!probabilities || probabilities.length !== f.vocabulary.length + 1 || target === undefined
    || probabilities.some(p => !Number.isFinite(p) || p < 0 || p > 1))
    return { available: false as const, reason: 'The full output distribution or known target was not captured. Missing evidence is not zero.' };
  const predicted = probabilities.reduce((best, p, i) => p > probabilities[best]! ? i : best, 0);
  const label = (id: number) => id === f.vocabulary.length ? 'END' : f.vocabulary[id] ?? `ID ${id}`;
  const members = REPRESENTATION_KINDS.map(kind => {
    const address = { kind, token: position, ...(kind === 'preAttentionNorm' ? {layer: 0} : {}) };
    const artifact = f.artifact(address);
    return { kind, address, identity: f.semanticId(address), artifact: artifact?.id,
      values: artifact?.availability === 'available' ? artifact.values ?? undefined : undefined };
  });
  return { available: true as const, run: f.runId, document, stale: requested !== document,
    prefix: f.input.slice(1, position + 1).map(id => f.vocabulary[id] ?? '').join(''), position,
    token: f.input[position]!, character: position === 0 ? 'START' : f.vocabulary[f.input[position]!]!,
    target, targetLabel: label(target), predicted, predictedLabel: label(predicted),
    rows: probabilities.map((probability, id) => ({id, label: label(id), probability, target: id === target, predicted: id === predicted})),
    members, finalPosition: f.input.length - 1, finalTarget: label(f.targets[f.input.length - 1]!),
  };
}

export function predictionFeedback(e: ReturnType<typeof introductoryEvidence>, answer: string): string {
  if (!e.available) return e.reason;
  if (answer === 'guarantee') return `${e.predictedLabel} has the highest probability in this run, but that is no guarantee and no token has been sampled. The known example target is ${e.targetLabel}.`;
  if (answer === 'train') return 'This prediction used the current parameters. It did not train or change them; learning is a separate explicit action.';
  return `Yes: the model assigns probabilities to the next token after ${e.prefix || 'START'}. The example tells us the target is ${e.targetLabel}; this run ranks ${e.predictedLabel} highest. Probability is not measured accuracy.`;
}
