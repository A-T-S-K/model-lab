import {
  COMPOSITE_VARIANT_EXPERIMENT_IDENTITY,
  validateCompositeVariantExperiment,
} from './composite-model-variant.js';
import {
  ACTIVATION_VARIANT_IDENTITY,
  validateActivationVariantExperiment,
} from './model-variant.js';
import {
  ModelVariantExperimentRegistry,
  isActivationVariantExperiment,
  isCompositeVariantExperiment,
} from './model-variant-experiment.js';
import {
  COMPOSITE_MLP_MICROGPT_DEFINITION,
  LEAKY_RELU_MICROGPT_DEFINITION,
} from '../model/definitions.js';

/** Reviewed build-time registrations. Imported receipts never add validators or run bindings. */
export const modelVariantExperiments = new ModelVariantExperimentRegistry()
  .register({
    identity: ACTIVATION_VARIANT_IDENTITY,
    targetDefinition: LEAKY_RELU_MICROGPT_DEFINITION,
    validateReceipt: async (experiment, source) => {
      if (!isActivationVariantExperiment(experiment)) throw new Error('Activation-variant receipt identity mismatch');
      await validateActivationVariantExperiment(experiment, source);
    },
    variantRuns: experiment => {
      if (!isActivationVariantExperiment(experiment)) throw new Error('Activation-variant receipt identity mismatch');
      return [experiment.variantRun];
    },
  })
  .register({
    identity: COMPOSITE_VARIANT_EXPERIMENT_IDENTITY,
    targetDefinition: COMPOSITE_MLP_MICROGPT_DEFINITION,
    validateReceipt: async (experiment, source) => {
      if (!isCompositeVariantExperiment(experiment)) throw new Error('Composite-variant receipt identity mismatch');
      await validateCompositeVariantExperiment(experiment, source);
    },
    variantRuns: experiment => {
      if (!isCompositeVariantExperiment(experiment)) throw new Error('Composite-variant receipt identity mismatch');
      return [experiment.initializedRun, experiment.trainedRun];
    },
  });
