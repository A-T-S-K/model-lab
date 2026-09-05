import { Value } from './value.js';

export interface ModelConfig {
  nLayer: number;
  nEmbd: number;
  nHead: number;
  blockSize: number;
  /** Character vocabulary; BOS occupies the next token ID. */
  vocabulary: string[];
  bosTokenId: number;
}

export type ParameterData = Record<string, number[][]>;
export interface Model {
  config: ModelConfig;
  parameters: Record<string, Value[][]>;
  parameterOrder: string[];
}

export interface OptimizerState {
  /** Number of updates already applied. Also the linear schedule position. */
  step: number;
  learningRate: number;
  beta1: number;
  beta2: number;
  epsilon: number;
  numSteps: number;
  m: number[];
  v: number[];
  datasetCursor: number;
  /** Current PRNG state if a caller samples. Teacher forcing consumes no randomness. */
  rngState: number | null;
}

export interface TrainingSnapshot {
  formatVersion: 1;
  config: ModelConfig;
  parameterOrder: string[];
  parameters: ParameterData;
  optimizer: OptimizerState;
}

export function parameterShapes(config: ModelConfig): Record<string, [number, number]> {
  const { nLayer, nEmbd, blockSize, vocabulary } = config;
  const shapes: Record<string, [number, number]> = {
    wte: [vocabulary.length + 1, nEmbd], wpe: [blockSize, nEmbd], lm_head: [vocabulary.length + 1, nEmbd],
  };
  for (let layer = 0; layer < nLayer; layer++) {
    for (const name of ['attn_wq', 'attn_wk', 'attn_wv', 'attn_wo']) shapes[`layer${layer}.${name}`] = [nEmbd, nEmbd];
    shapes[`layer${layer}.mlp_fc1`] = [4 * nEmbd, nEmbd];
    shapes[`layer${layer}.mlp_fc2`] = [nEmbd, 4 * nEmbd];
  }
  return shapes;
}

export function loadModel(config: ModelConfig, parameters: ParameterData, parameterOrder = Object.keys(parameters)): Model {
  for (const size of [config.nLayer, config.nEmbd, config.nHead, config.blockSize]) {
    if (!Number.isInteger(size) || size < 1) throw new Error('Architecture sizes must be positive integers');
  }
  if (config.nEmbd % config.nHead || config.bosTokenId !== config.vocabulary.length) throw new Error('Invalid head width or BOS ID');
  const shapes = parameterShapes(config);
  if (parameterOrder.length !== Object.keys(shapes).length || new Set(parameterOrder).size !== parameterOrder.length) throw new Error('Invalid parameter order');
  const loaded: Model['parameters'] = {};
  for (const name of parameterOrder) {
    const shape = shapes[name];
    const matrix = parameters[name];
    if (!shape || !matrix || matrix.length !== shape[0] || matrix.some(row => row.length !== shape[1] || row.some(value => !Number.isFinite(value)))) {
      throw new Error(`Invalid parameter matrix: ${name}`);
    }
    loaded[name] = matrix.map(row => row.map(value => new Value(value)));
  }
  return { config: structuredClone(config), parameters: loaded, parameterOrder: [...parameterOrder] };
}

export function parameterValues(model: Model): Value[] {
  return model.parameterOrder.flatMap(name => model.parameters[name].flat());
}

export function parameterData(model: Model): ParameterData {
  return Object.fromEntries(model.parameterOrder.map(name => [name, model.parameters[name].map(row => row.map(value => value.data))]));
}

export function gradientData(model: Model): ParameterData {
  return Object.fromEntries(model.parameterOrder.map(name => [name, model.parameters[name].map(row => row.map(value => value.grad))]));
}

export function createOptimizerState(model: Model, overrides: Partial<OptimizerState> = {}): OptimizerState {
  const count = parameterValues(model).length;
  return structuredClone({ step: 0, learningRate: 0.01, beta1: 0.85, beta2: 0.99, epsilon: 1e-8,
    numSteps: 1000, m: Array(count).fill(0), v: Array(count).fill(0), datasetCursor: 0, rngState: null, ...overrides });
}

export function snapshotTraining(model: Model, optimizer: OptimizerState): TrainingSnapshot {
  return structuredClone({ formatVersion: 1, config: model.config, parameterOrder: model.parameterOrder, parameters: parameterData(model), optimizer });
}

export function restoreTraining(snapshot: TrainingSnapshot): { model: Model; optimizer: OptimizerState } {
  if (snapshot.formatVersion !== 1) throw new Error('Unsupported snapshot version');
  return { model: loadModel(snapshot.config, snapshot.parameters, snapshot.parameterOrder), optimizer: structuredClone(snapshot.optimizer) };
}
