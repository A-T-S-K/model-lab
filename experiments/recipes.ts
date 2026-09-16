import { headAblationRecipe } from './ablation.js';
import { activationPatchRecipe } from './activation-patch.js';
import { InterventionRecipeRegistry } from './intervention.js';

/** Reviewed build-time registrations. Archive imports never add executable recipes. */
export const interventionRecipes = new InterventionRecipeRegistry()
  .register(headAblationRecipe)
  .register(activationPatchRecipe);
