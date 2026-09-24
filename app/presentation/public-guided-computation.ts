import type { RunResult } from '../worker/protocol.js';
import type {
  PublicLessonEvent,
  PublicLessonSession,
  PublicLessonTransition,
} from './public-lesson-controller.js';

export interface PublicGuidedComputationBinding {
  readonly result: RunResult;
  readonly runId: string;
  readonly capturedDocument: string;
  readonly lessonPosition: number;
}

export interface PublicGuidedComputationDecision {
  readonly binding?: PublicGuidedComputationBinding;
  readonly restore?: PublicGuidedComputationBinding;
}

export function lessonPosition(result: RunResult): number {
  return Math.max(0, result.tokenIds.length - 2);
}

function capturedDocument(
  result: RunResult,
  vocabulary: readonly string[],
): string {
  return (result.run.manifest.input as readonly number[])
    .slice(1)
    .map((id) => vocabulary[id] ?? '')
    .join('');
}

function resumesPart1Guided(
  before: PublicLessonSession,
  transition: PublicLessonTransition,
): boolean {
  return before.navigation.mode === 'explore'
    && transition.session !== before
    && transition.session.navigation.mode === 'guided'
    && transition.session.current.startsWith('p1_');
}

export function reconcilePublicGuidedComputation(
  binding: PublicGuidedComputationBinding | undefined,
  before: PublicLessonSession,
  event: PublicLessonEvent,
  transition: PublicLessonTransition,
  candidate: RunResult | undefined,
  vocabulary: readonly string[],
): PublicGuidedComputationDecision {
  if (event.type === 'RESET') return {};

  if (
    event.type === 'PREDICTION_COMPLETE'
    && transition.session !== before
    && transition.session.navigation.mode === 'guided'
    && transition.session.current === 'p1_prediction_preview'
    && candidate
  ) {
    const adopted: PublicGuidedComputationBinding = {
      result: candidate,
      runId: candidate.run.manifest.runId,
      capturedDocument: capturedDocument(candidate, vocabulary),
      // The last character-to-character transition; the final position predicts END.
      lessonPosition: lessonPosition(candidate),
    };
    return { binding: adopted };
  }

  if (
    event.type === 'RESUME_GUIDED'
    && binding
    && resumesPart1Guided(before, transition)
  ) {
    return { binding, restore: binding };
  }

  return { binding };
}
