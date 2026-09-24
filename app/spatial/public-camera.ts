import type { PublicTourState } from './public-tour.js';

export interface PublicCameraBounds { x:number; y:number; width:number; height:number }

export type PublicCameraMode = 'overview' | 'semantic' | 'hold';
export interface PublicLessonCameraPlan {
  readonly mode: PublicCameraMode;
  readonly includeFocus?: boolean;
  readonly includeSelected?: boolean;
  readonly kinds?: readonly string[];
  readonly headKinds?: readonly string[];
  readonly overlays?: readonly string[];
  readonly padX?: number;
  readonly padY?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
}

const semantic = (
  plan: Omit<PublicLessonCameraPlan, 'mode'>,
): PublicLessonCameraPlan => ({ mode: 'semantic', ...plan });

export function publicLessonCameraPlan(state: PublicTourState): PublicLessonCameraPlan {
  switch (state) {
    case 'cold':
      return { mode: 'overview' };
    case 'p1_prediction_preview':
      return semantic({ kinds: ['logits', 'probabilities'], padX: 120, padY: 90, minWidth: 1200, minHeight: 620 });
    case 'p1_represent':
      return semantic({ includeFocus: true, padX: 130, padY: 100, minWidth: 1200, minHeight: 700 });
    case 'p1_qkv':
      return semantic({ includeFocus: true, kinds: ['preAttentionNorm'], headKinds: ['q', 'k', 'v'], padX: 130, padY: 100, minWidth: 1300, minHeight: 720 });
    case 'p1_attention_compare':
    case 'p1_attention_weights':
    case 'p1_value_mixture':
      return semantic({
        includeFocus: true,
        kinds: ['preAttentionNorm'],
        headKinds: ['q', 'k', 'v', 'attentionLogits', 'attentionProbabilities', 'headOutput'],
        padX: 150,
        padY: 105,
        minWidth: 1500,
        minHeight: 720,
      });
    case 'p1_attention_integration':
      return semantic({ includeFocus: true, padX: 140, padY: 110, minWidth: 1800, minHeight: 780 });
    case 'p1_transform':
      return semantic({ includeFocus: true, padX: 140, padY: 110, minWidth: 1550, minHeight: 820 });
    case 'p1_score':
    case 'p1_probabilities':
      return semantic({ includeFocus: true, kinds: ['mlpResidual', 'logits', 'probabilities'], padX: 130, padY: 100, minWidth: 1300, minHeight: 680 });
    case 'p1_complete':
      return semantic({ includeFocus: true, padX: 90, padY: 90, minWidth: 2600, minHeight: 900 });
    case 'p2_objective':
      return semantic({ includeSelected: true, kinds: ['probabilities'], overlays: ['[data-testid="objective-anchor"]'], padX: 120, padY: 100, minWidth: 1250, minHeight: 720 });
    case 'p2_backward_trace':
      return semantic({ includeSelected: true, overlays: ['[data-testid="reverse-causal-overlay"]'], padX: 100, padY: 90, minWidth: 2600, minHeight: 900 });
    case 'p2_gradient_contribution':
    case 'p2_final_gradient':
      return semantic({
        kinds: ['tokenEmbedding'],
        overlays: ['.explanation-active[data-world-parameter]', '[data-testid="parameter-learning-overlay"]'],
        padX: 120,
        padY: 100,
        minWidth: 1200,
        minHeight: 700,
      });
    case 'p2_adam_proposal':
      return semantic({
        overlays: ['.explanation-active[data-world-parameter]', '[data-testid="parameter-learning-overlay"]', '[data-testid="adam-learning-overlay"]'],
        padX: 120,
        padY: 90,
        minWidth: 1200,
        minHeight: 720,
      });
    case 'candidate_ready':
      return semantic({ includeSelected: true, kinds: ['mlpResidual', 'logits', 'probabilities'], padX: 130, padY: 100, minWidth: 1300, minHeight: 680 });
    case 'tour_complete':
      return { mode: 'hold' };
  }
  const exhaustive: never = state;
  return exhaustive;
}

export function unionPublicCameraBounds(boxes: readonly PublicCameraBounds[]): PublicCameraBounds | undefined {
  if (boxes.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function padPublicCameraBounds(
  bounds: PublicCameraBounds,
  options: Pick<PublicLessonCameraPlan, 'padX' | 'padY' | 'minWidth' | 'minHeight'>,
  domain: PublicCameraBounds,
): PublicCameraBounds {
  const padX = options.padX ?? 110;
  const padY = options.padY ?? 90;
  const minWidth = options.minWidth ?? 980;
  const minHeight = options.minHeight ?? 560;
  const width = Math.min(domain.width, Math.max(minWidth, bounds.width + padX * 2));
  const height = Math.min(domain.height, Math.max(minHeight, bounds.height + padY * 2));
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return {
    x: Math.round(Math.min(domain.x + domain.width - width, Math.max(domain.x, cx - width / 2))),
    y: Math.round(Math.min(domain.y + domain.height - height, Math.max(domain.y, cy - height / 2))),
    width: Math.round(width),
    height: Math.round(height),
  };
}
