import {
  transitionPublicLesson,
  type PublicLessonEvent,
  type PublicLessonSession,
  type PublicLessonTransitionContext,
} from './public-lesson-controller.js';

const OPENING_MS = 4_500;
const BEAT_MS = 5_000;
const RESULT_MS = 7_000;
const COMPLETION_MS = 4_500;
export interface PublicDemoTiming {
  opening: number;
  beat: number;
  result: number;
  completion: number;
}
const DEFAULT_TIMING: PublicDemoTiming = {
  opening: OPENING_MS, beat: BEAT_MS, result: RESULT_MS, completion: COMPLETION_MS,
};

export function publicDemoEnabled(parameters: URLSearchParams): boolean {
  return parameters.get('presentation') === 'spatial' && parameters.get('demo') === '1';
}

export class PublicDemo {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private scheduledKey = '';
  private stopped = false;

  constructor(
    readonly enabled: boolean,
    private readonly visible: () => boolean,
    private readonly request: (event: PublicLessonEvent) => void,
    private readonly activate: () => void,
    private readonly timing: PublicDemoTiming = DEFAULT_TIMING,
  ) {}

  get active(): boolean { return this.enabled && !this.stopped; }

  stop(): void {
    this.stopped = true;
    this.clear();
  }

  visibilityChanged(): void {
    this.clear();
  }

  sync(session: PublicLessonSession, context: PublicLessonTransitionContext, openingReady: boolean): void {
    if (!this.active || !this.visible()) { this.clear(); return; }
    if (session.navigation.mode !== 'guided' || session.pending || session.decisionPending) { this.clear(); return; }

    const state = session.current;
    const event: PublicLessonEvent = state === 'p1_complete' ? { type: 'START_PART2' }
      : state === 'candidate_ready' ? { type: 'DISCARD_REQUESTED' }
      : state === 'tour_complete' ? { type: 'RESTART_REQUESTED' }
      : { type: 'PRIMARY_ACTION' };
    if (state === 'cold' && !openingReady) { this.clear(); return; }
    if (state !== 'cold' && transitionPublicLesson(session, event, context).session === session) {
      this.clear();
      return;
    }

    const key = `${state}:${context.driverPhase}:${JSON.stringify(context.evidence)}`;
    if (this.timer && this.scheduledKey === key) return;
    this.clear();
    this.scheduledKey = key;
    const delay = state === 'cold' ? this.timing.opening
      : state === 'tour_complete' ? this.timing.completion
      : state === 'p1_complete' || state === 'candidate_ready' || state.startsWith('p2_') ? this.timing.result
      : this.timing.beat;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.scheduledKey = '';
      if (!this.active || !this.visible()) return;
      if (state === 'cold') this.activate();
      else this.request(event);
    }, delay);
  }

  private clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.scheduledKey = '';
  }
}
