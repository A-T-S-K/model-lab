import {
  PUBLIC_TOUR_STATES,
  advanceTour,
  canAdvanceTour,
  getPublicTourContent,
  type PublicTourContent,
  type PublicTourOutcome,
  type PublicTourState,
  type TourEvidence,
} from '../spatial/public-tour.js';

export type PublicLessonRuntimeEffect =
  | 'START_TRAINING'
  | 'CONTINUE'
  | 'PAUSE'
  | 'RUN_TO_CONTRIBUTION'
  | 'RUN_TO_PROPOSAL'
  | 'ACCEPT_CANDIDATE'
  | 'DISCARD_CANDIDATE'
  | 'START_PREDICTION';

export type PublicLessonDriverPhase =
  | 'idle'
  | 'starting'
  | 'paused'
  | 'running'
  | 'pausing'
  | 'cancelling';

export interface PublicLessonTransitionContext {
  readonly evidence: TourEvidence;
  readonly driverPhase?: PublicLessonDriverPhase;
  readonly trainingStarted?: boolean;
}

export interface PublicLessonPending {
  readonly target: PublicTourState;
  readonly effect: PublicLessonRuntimeEffect;
}

export type PublicLessonNavigation =
  | { readonly mode: 'guided' }
  | { readonly mode: 'detail'; readonly returnState: PublicTourState }
  | { readonly mode: 'explore'; readonly returnState: PublicTourState }
  | {
      readonly mode: 'facilitator';
      readonly returnState: PublicTourState;
      readonly focusState: PublicTourState;
    };

export interface PublicLessonSession {
  readonly current: PublicTourState;
  readonly pending?: PublicLessonPending;
  readonly outcome?: PublicTourOutcome;
  readonly decisionPending?: PublicTourOutcome;
  readonly navigation: PublicLessonNavigation;
}

export type PublicLessonEvent =
  | { readonly type: 'RESET' }
  | { readonly type: 'PREDICTION_COMPLETE' }
  | { readonly type: 'PRIMARY_ACTION' }
  | { readonly type: 'START_PART2' }
  | { readonly type: 'TRAINING_PROGRESS' }
  | { readonly type: 'EXECUTION_FAILED' }
  | { readonly type: 'EXECUTION_CANCELLED' }
  | { readonly type: 'OPEN_DETAIL' }
  | { readonly type: 'RETURN_FROM_DETAIL' }
  | { readonly type: 'ENTER_EXPLORE' }
  | { readonly type: 'RESUME_GUIDED' }
  | { readonly type: 'FACILITATOR_GOTO'; readonly target: PublicTourState }
  | { readonly type: 'ACCEPT_REQUESTED' }
  | { readonly type: 'ACCEPT_COMPLETE' }
  | { readonly type: 'DISCARD_REQUESTED' }
  | { readonly type: 'DISCARD_COMPLETE' }
  | { readonly type: 'RESTART_REQUESTED' };

export interface PublicLessonDestination {
  readonly state: PublicTourState;
  readonly label: string;
  readonly available: boolean;
}

export interface PublicLessonView {
  readonly currentState: PublicTourState;
  readonly canonicalState: PublicTourState;
  readonly targetState?: PublicTourState;
  readonly outcome?: PublicTourOutcome;
  readonly decisionPending?: PublicTourOutcome;
  readonly content: PublicTourContent;
  readonly navigation: PublicLessonNavigation;
  readonly facilitatorDestinations: readonly PublicLessonDestination[];
}

export interface PublicLessonTransition {
  readonly session: PublicLessonSession;
  readonly effects: readonly PublicLessonRuntimeEffect[];
}

const EMPTY_EVIDENCE: TourEvidence = {
  hasObjective: false,
  hasMatchingContribution: false,
  hasFinalGradient: false,
  hasPinnedProposal: false,
  hasCandidateComparison: false,
};

const EMPTY_CONTEXT: PublicLessonTransitionContext = {
  evidence: EMPTY_EVIDENCE,
  driverPhase: 'idle',
  trainingStarted: false,
};

export function createPublicLessonSession(): PublicLessonSession {
  return {
    current: 'cold',
    navigation: { mode: 'guided' },
  };
}

function noChange(session: PublicLessonSession): PublicLessonTransition {
  return { session, effects: [] };
}

function displayedState(session: PublicLessonSession): PublicTourState {
  return session.navigation.mode === 'facilitator'
    ? session.navigation.focusState
    : session.current;
}

function isDriverUnstable(phase: PublicLessonDriverPhase | undefined): boolean {
  return phase === 'starting'
    || phase === 'running'
    || phase === 'pausing'
    || phase === 'cancelling';
}

function hasCurrentEvidence(state: PublicTourState, evidence: TourEvidence): boolean {
  switch (state) {
    case 'p2_objective':
      return evidence.hasObjective;
    case 'p2_gradient_contribution':
      return evidence.hasMatchingContribution;
    case 'p2_final_gradient':
      return evidence.hasFinalGradient;
    case 'p2_adam_proposal':
      return evidence.hasPinnedProposal;
    default:
      return true;
  }
}

function effectForPublicAdvance(state: PublicTourState): PublicLessonRuntimeEffect | undefined {
  switch (state) {
    case 'p2_objective':
      return 'RUN_TO_CONTRIBUTION';
    case 'p2_gradient_contribution':
      return 'CONTINUE';
    case 'p2_final_gradient':
      return 'RUN_TO_PROPOSAL';
    case 'p2_adam_proposal':
      return 'CONTINUE';
    default:
      return undefined;
  }
}

export function publicLessonDestinationAvailable(
  session: PublicLessonSession,
  target: PublicTourState,
  context: PublicLessonTransitionContext = EMPTY_CONTEXT,
): boolean {
  if (target === 'cold' || target === 'tour_complete') return false;
  if (session.pending || session.decisionPending) return false;
  if (session.navigation.mode === 'detail' || session.navigation.mode === 'explore') return false;
  if (isDriverUnstable(context.driverPhase)) return false;
  if (target === displayedState(session)) return true;
  if (session.current === 'cold') return false;
  if (target.startsWith('p1_')) return true;

  switch (target) {
    case 'p2_objective':
      return context.evidence.hasObjective;
    case 'p2_gradient_contribution':
      return context.evidence.hasMatchingContribution;
    case 'p2_final_gradient':
      return context.evidence.hasFinalGradient;
    case 'p2_adam_proposal':
      return context.evidence.hasPinnedProposal;
    case 'candidate_ready':
      return context.evidence.hasCandidateComparison;
    default:
      return false;
  }
}

export function getPublicLessonView(
  session: PublicLessonSession,
  context: PublicLessonTransitionContext = EMPTY_CONTEXT,
): PublicLessonView {
  const currentState = displayedState(session);
  const facilitatorDestinations = PUBLIC_TOUR_STATES
    .filter(state => state !== 'cold' && state !== 'tour_complete')
    .map(state => ({
      state,
      label: getPublicTourContent(state).headline,
      available: publicLessonDestinationAvailable(session, state, context),
    }));

  return {
    currentState,
    canonicalState: session.current,
    targetState: session.pending?.target,
    outcome: session.outcome,
    decisionPending: session.decisionPending,
    content: getPublicTourContent(currentState, session.outcome),
    navigation: session.navigation,
    facilitatorDestinations,
  };
}

function beginDetour(
  session: PublicLessonSession,
  mode: 'detail' | 'explore',
  context: PublicLessonTransitionContext,
): PublicLessonTransition {
  if (session.navigation.mode !== 'guided' || session.decisionPending) return noChange(session);
  if (session.pending?.effect === 'START_TRAINING' || session.pending?.effect === 'START_PREDICTION') {
    return noChange(session);
  }
  const shouldPause = context.driverPhase === 'running'
    && (session.pending !== undefined
      || (session.current === 'p2_objective' && context.evidence.hasObjective));
  return {
    session: {
      ...session,
      pending: undefined,
      navigation: { mode, returnState: session.current },
    },
    effects: shouldPause ? ['PAUSE'] : [],
  };
}

export function transitionPublicLesson(
  session: PublicLessonSession,
  event: PublicLessonEvent,
  context: PublicLessonTransitionContext = EMPTY_CONTEXT,
): PublicLessonTransition {
  switch (event.type) {
    case 'RESET':
      return { session: createPublicLessonSession(), effects: [] };

    case 'PREDICTION_COMPLETE':
      if (
        session.current !== 'cold'
        && session.pending?.effect !== 'START_PREDICTION'
      ) return noChange(session);
      return {
        session: {
          current: 'p1_prediction_preview',
          navigation: { mode: 'guided' },
        },
        effects: [],
      };

    case 'PRIMARY_ACTION': {
      if (session.navigation.mode !== 'guided' || session.pending || session.decisionPending) return noChange(session);
      if (session.current.startsWith('p1_') && session.current !== 'p1_complete') {
        const next = advanceTour(session.current);
        return next === session.current
          ? noChange(session)
          : { session: { ...session, current: next }, effects: [] };
      }
      const next = advanceTour(session.current);
      if (next === session.current) return noChange(session);
      if (canAdvanceTour(session.current, context.evidence)) {
        return { session: { ...session, current: next }, effects: [] };
      }
      const effect = effectForPublicAdvance(session.current);
      if (!effect || context.driverPhase !== 'paused' || !hasCurrentEvidence(session.current, context.evidence)) {
        return noChange(session);
      }
      return {
        session: {
          ...session,
          pending: { target: next, effect },
        },
        effects: [effect],
      };
    }

    case 'START_PART2':
      if (
        session.navigation.mode !== 'guided'
        || session.current !== 'p1_complete'
        || session.pending
        || session.decisionPending
        || (context.driverPhase !== undefined && context.driverPhase !== 'idle')
      ) return noChange(session);
      return {
        session: {
          ...session,
          pending: { target: 'p2_objective', effect: 'START_TRAINING' },
        },
        effects: ['START_TRAINING'],
      };

    case 'TRAINING_PROGRESS': {
      if (
        session.pending?.effect === 'START_TRAINING'
        && session.pending.target === 'p2_objective'
        && context.trainingStarted
      ) {
        const nextSession: PublicLessonSession = {
          ...session,
          current: 'p2_objective',
          pending: undefined,
          navigation: { mode: 'guided' },
        };
        if (context.evidence.hasObjective && context.driverPhase === 'running') {
          return { session: nextSession, effects: ['PAUSE'] };
        }
        if (!context.evidence.hasObjective && context.driverPhase === 'paused') {
          return { session: nextSession, effects: ['CONTINUE'] };
        }
        return { session: nextSession, effects: [] };
      }

      if (session.navigation.mode !== 'guided') {
        if (
          session.current === 'p2_objective'
          && context.evidence.hasObjective
          && context.driverPhase === 'running'
        ) {
          return { session, effects: ['PAUSE'] };
        }
        return noChange(session);
      }

      if (session.pending && canAdvanceTour(session.current, context.evidence)) {
        const nextSession: PublicLessonSession = {
          ...session,
          current: session.pending.target,
          pending: undefined,
        };
        return {
          session: nextSession,
          effects: context.driverPhase === 'running' ? ['PAUSE'] : [],
        };
      }

      if (
        session.current === 'p2_objective'
        && !session.pending
        && context.evidence.hasObjective
        && context.driverPhase === 'running'
      ) {
        return { session, effects: ['PAUSE'] };
      }
      return noChange(session);
    }

    case 'EXECUTION_FAILED':
    case 'EXECUTION_CANCELLED':
      if (!session.pending && !session.decisionPending) return noChange(session);
      return {
        session: {
          ...session,
          pending: undefined,
          decisionPending: undefined,
        },
        effects: [],
      };

    case 'OPEN_DETAIL':
      return beginDetour(session, 'detail', context);

    case 'RETURN_FROM_DETAIL':
      if (session.navigation.mode !== 'detail') return noChange(session);
      return {
        session: {
          ...session,
          current: session.navigation.returnState,
          pending: undefined,
          navigation: { mode: 'guided' },
        },
        effects: [],
      };

    case 'ENTER_EXPLORE':
      return beginDetour(session, 'explore', context);

    case 'RESUME_GUIDED':
      if (session.navigation.mode === 'guided') return noChange(session);
      return {
        session: {
          ...session,
          current: session.navigation.returnState,
          pending: undefined,
          navigation: { mode: 'guided' },
        },
        effects: [],
      };

    case 'FACILITATOR_GOTO': {
      if (!publicLessonDestinationAvailable(session, event.target, context)) return noChange(session);
      if (session.navigation.mode === 'guided' && event.target === session.current) return noChange(session);
      const returnState = session.navigation.mode === 'facilitator'
        ? session.navigation.returnState
        : session.current;
      return {
        session: {
          ...session,
          navigation: {
            mode: 'facilitator',
            returnState,
            focusState: event.target,
          },
        },
        effects: [],
      };
    }

    case 'ACCEPT_REQUESTED':
      if (
        session.navigation.mode !== 'guided'
        || session.current !== 'candidate_ready'
        || session.pending
        || session.decisionPending
        || !context.evidence.hasCandidateComparison
        || context.driverPhase !== 'paused'
      ) return noChange(session);
      return {
        session: { ...session, decisionPending: 'accepted' },
        effects: ['ACCEPT_CANDIDATE'],
      };

    case 'ACCEPT_COMPLETE':
      if (session.current !== 'candidate_ready' || session.decisionPending !== 'accepted') return noChange(session);
      return {
        session: {
          current: 'tour_complete',
          outcome: 'accepted',
          navigation: { mode: 'guided' },
        },
        effects: [],
      };

    case 'DISCARD_REQUESTED':
      if (
        session.navigation.mode !== 'guided'
        || session.current !== 'candidate_ready'
        || session.pending
        || session.decisionPending
        || !context.evidence.hasCandidateComparison
        || context.driverPhase !== 'paused'
      ) return noChange(session);
      return {
        session: { ...session, decisionPending: 'discarded' },
        effects: ['DISCARD_CANDIDATE'],
      };

    case 'DISCARD_COMPLETE':
      if (session.current !== 'candidate_ready' || session.decisionPending !== 'discarded') return noChange(session);
      return {
        session: {
          current: 'tour_complete',
          outcome: 'discarded',
          navigation: { mode: 'guided' },
        },
        effects: [],
      };

    case 'RESTART_REQUESTED':
      if (
        session.navigation.mode !== 'guided'
        || session.current !== 'tour_complete'
        || session.pending
        || session.decisionPending
        || (context.driverPhase !== undefined && context.driverPhase !== 'idle')
      ) return noChange(session);
      return {
        session: {
          ...session,
          pending: { target: 'p1_prediction_preview', effect: 'START_PREDICTION' },
        },
        effects: ['START_PREDICTION'],
      };
  }
}
