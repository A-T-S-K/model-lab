/** Fixed, non-stochastic candidate sweep; every candidate is printed, including regressions. */
import fixture from '../fixtures/canonical.initial.json' with { type: 'json' };
import { loadModel, createOptimizerState } from '../model/state.js';
import { predict, tokenize } from '../model/microgpt.js';
import { trainStep } from '../model/training.js';

const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
const optimizer = createOptimizerState(model, fixture.optimizer);
const { tokenIds, targetIds } = tokenize(model, fixture.document);
const checkpoints = [0, 1, 5, 10, 20, 50];
for (let step = 0; step <= checkpoints.at(-1)!; step++) {
  if (checkpoints.includes(step)) {
    const prediction = predict(model, tokenIds);
    console.log(JSON.stringify({ updates: step, transitions: tokenIds.flatMap((input, position) =>
      input === model.config.bosTokenId || targetIds[position] === model.config.bosTokenId ? [] : [{
        prefix: fixture.document.slice(0, position), position,
        after: model.config.vocabulary[input], target: model.config.vocabulary[targetIds[position]],
        probability: prediction.probabilities[position][targetIds[position]],
      }]) }));
  }
  if (step < checkpoints.at(-1)!) trainStep(model, optimizer, tokenIds, targetIds);
}
