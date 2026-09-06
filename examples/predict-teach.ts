// Run with npm run example. Only the fixture and mathematical model are needed.
import fixture from '../fixtures/canonical.initial.json' with { type: 'json' };
import { loadModel, createOptimizerState } from '../model/state.js';
import { tokenize, predict } from '../model/microgpt.js';
import { trainStep } from '../model/training.js';

const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
const optimizer = createOptimizerState(model, fixture.optimizer);
const { tokenIds, targetIds } = tokenize(model, 'abca');

// Position 3 sees START, a, b, c. The known next character in this example is a.
const position = 3;
const target = targetIds[position];
const before = predict(model, tokenIds);
const learning = trainStep(model, optimizer, tokenIds, targetIds);
const after = predict(model, tokenIds);

console.log('After prefix abc, target a:');
console.log('Probability before:', before.probabilities[position][target]);
console.log('Probability after one real update:', after.probabilities[position][target]);
console.log('Loss before update (mean over the example):', learning.meanLoss);
console.log('Parameters updated:', learning.update.parameters.length);
console.log('Completed training steps:', optimizer.step);
