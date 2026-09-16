import { inspectHistorical } from './inspector.js';
import type { HistoricalRequest, AblationRequest, ActivationPatchRequest, ActivationVariantRequest, CompositeVariantRequest, WorkerResponse } from './protocol.js';
import { HEAD_ABLATION_RECIPE, isHeadAblationExperiment } from '../../experiments/ablation.js';
import { ACTIVATION_PATCH_RECIPE, headOutputOccurrence, isActivationPatchExperiment } from '../../experiments/activation-patch.js';
import { interventionRecipes } from '../../experiments/recipes.js';
import { runActivationVariant } from '../../experiments/model-variant.js';
import { runCompositeVariant } from '../../experiments/composite-model-variant.js';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<HistoricalRequest | AblationRequest | ActivationPatchRequest | ActivationVariantRequest | CompositeVariantRequest>) => void; postMessage(response: WorkerResponse): void };
scope.onmessage = event => {
  const request = event.data;
  const tag = { sessionId: request.sessionId, runId: request.runId, generationId: request.generationId };
  const execution = request.command === 'ablate'
    ? interventionRecipes.require(HEAD_ABLATION_RECIPE).execute({ snapshot: request.snapshot, inputIds: request.inputIds,
      targetIds: request.targetIds, selection: request.selection, tag }).then(experiment => {
        if (!isHeadAblationExperiment(experiment)) throw new Error('Registered head-ablation executor returned another recipe');
        return { ...tag, status: 'ablation' as const, experiment };
      })
    : request.command === 'activationPatch'
      ? interventionRecipes.require(ACTIVATION_PATCH_RECIPE).execute({ snapshot: request.snapshot, donorInputIds: request.inputIds, donorTargetIds: request.targetIds,
        targetInputIds: request.inputIds, targetTargetIds: request.targetIds,
        donor: headOutputOccurrence(request.snapshot, `${tag.runId}:donor`, request.donor.token, request.donor.layer, request.donor.head),
        target: headOutputOccurrence(request.snapshot, `${tag.runId}:intervention`, request.target.token, request.target.layer, request.target.head), tag })
        .then(experiment => {
          if (!isActivationPatchExperiment(experiment)) throw new Error('Registered activation-patch executor returned another recipe');
          return { ...tag, status: 'activationPatch' as const, experiment };
        })
      : request.command === 'activationVariant'
        ? runActivationVariant({ snapshot: request.snapshot, inputIds: request.inputIds, targetIds: request.targetIds, tag })
          .then(experiment => ({ ...tag, status: 'activationVariant' as const, experiment }))
        : request.command === 'compositeVariant'
          ? runCompositeVariant({ snapshot: request.snapshot, inputIds: request.inputIds, targetIds: request.targetIds, tag })
            .then(experiment => ({ ...tag, status: 'compositeVariant' as const, experiment }))
        : inspectHistorical(request).then(inspection => ({ ...tag, status: 'inspection' as const, inspection }));
  void execution.then(response => scope.postMessage(response))
    .catch(error => scope.postMessage({ ...tag, status: 'error', error: error instanceof Error ? error.message : String(error) }));
};
