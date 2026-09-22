import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type ViteDevServer } from 'vite';
import {
  getPublicLessonView,
  type PublicLessonSession,
  type PublicLessonView,
} from '../../app/presentation/public-lesson-controller.js';
import type { PresentationState } from '../../app/spatial/presenter.js';

let vite: ViteDevServer | undefined;

async function renderShell(
  publicLesson: PublicLessonView,
  profile: 'visitor' | 'facilitator' | 'workbench' = 'visitor',
): Promise<string> {
  vite ??= await createServer({
    root: process.cwd(),
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  const module = await vite.ssrLoadModule('/app/spatial/presenter.ts') as {
    SpatialPresenter: new (selection: {
      layer: number;
      query: number;
      key: number;
      head: number;
      feature: number;
    }) => {
      render(model: undefined, state: PresentationState): string;
    };
  };

  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalMatchMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { addEventListener() {} },
  });
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });

  try {
    const presenter = new module.SpatialPresenter({
      layer: 0,
      query: 0,
      key: 0,
      head: 0,
      feature: 0,
    });
    return presenter.render(undefined, {
      profile,
      publicLesson,
      document: 'abca',
      busy: false,
      ready: true,
      status: '',
      error: '',
      scalar: '',
      retention: { bytes: 0, runs: 0, snapshots: 0, experiments: 0 },
    });
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as { document?: unknown }).document;
    if (originalMatchMedia) Object.defineProperty(globalThis, 'matchMedia', originalMatchMedia);
    else delete (globalThis as { matchMedia?: unknown }).matchMedia;
  }
}

function view(session: PublicLessonSession): PublicLessonView {
  return getPublicLessonView(session);
}

function shellTag(html: string): string {
  const match = html.match(/<div[^>]*class="spatial-shell[^"]*"[^>]*>/);
  assert(match, 'spatial shell opening tag must render');
  return match[0];
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(name + '="([^"]*)"'))?.[1];
}

async function assertSemantics(
  lesson: PublicLessonView,
  expected: {
    canonical: string;
    displayed: string;
    navigation: string;
    target?: string;
    outcome?: string;
  },
  profile: 'visitor' | 'facilitator' = 'visitor',
): Promise<void> {
  const tag = shellTag(await renderShell(lesson, profile));
  assert.equal(attr(tag, 'data-public-canonical-state'), expected.canonical);
  assert.equal(attr(tag, 'data-public-displayed-state'), expected.displayed);
  assert.equal(attr(tag, 'data-public-navigation-mode'), expected.navigation);
  assert.equal(attr(tag, 'data-public-target-state'), expected.target ?? '');
  assert.equal(attr(tag, 'data-public-outcome'), expected.outcome ?? '');
}

after(async () => {
  await vite?.close();
  vite = undefined;
});

test('public shell exposes Guided, Detail, and Explore Part 1 semantics directly from PublicLessonView', async () => {
  await assertSemantics(
    view({ current: 'p1_represent', navigation: { mode: 'guided' } }),
    {
      canonical: 'p1_represent',
      displayed: 'p1_represent',
      navigation: 'guided',
    },
  );
  await assertSemantics(
    view({
      current: 'p1_represent',
      navigation: { mode: 'detail', returnState: 'p1_represent' },
    }),
    {
      canonical: 'p1_represent',
      displayed: 'p1_represent',
      navigation: 'detail',
    },
  );
  await assertSemantics(
    view({
      current: 'p1_represent',
      navigation: { mode: 'explore', returnState: 'p1_represent' },
    }),
    {
      canonical: 'p1_represent',
      displayed: 'p1_represent',
      navigation: 'explore',
    },
  );
});

test('public shell exposes Guided Part 2, exact pending target, and candidate-ready empty outcome', async () => {
  await assertSemantics(
    view({ current: 'p2_gradient_contribution', navigation: { mode: 'guided' } }),
    {
      canonical: 'p2_gradient_contribution',
      displayed: 'p2_gradient_contribution',
      navigation: 'guided',
    },
  );
  await assertSemantics(
    view({
      current: 'p2_gradient_contribution',
      pending: { target: 'p2_final_gradient', effect: 'CONTINUE' },
      navigation: { mode: 'guided' },
    }),
    {
      canonical: 'p2_gradient_contribution',
      displayed: 'p2_gradient_contribution',
      navigation: 'guided',
      target: 'p2_final_gradient',
    },
  );
  await assertSemantics(
    view({ current: 'candidate_ready', navigation: { mode: 'guided' } }),
    {
      canonical: 'candidate_ready',
      displayed: 'candidate_ready',
      navigation: 'guided',
      outcome: '',
    },
  );
});

test('facilitator focus keeps canonical and displayed state distinct', async () => {
  await assertSemantics(
    view({
      current: 'p1_represent',
      navigation: {
        mode: 'facilitator',
        returnState: 'p1_represent',
        focusState: 'p2_gradient_contribution',
      },
    }),
    {
      canonical: 'p1_represent',
      displayed: 'p2_gradient_contribution',
      navigation: 'facilitator',
    },
    'facilitator',
  );
});

test('tour-complete outcome is exactly accepted or discarded and Workbench does not fabricate public semantics', async () => {
  for (const outcome of ['accepted', 'discarded'] as const) {
    await assertSemantics(
      view({ current: 'tour_complete', outcome, navigation: { mode: 'guided' } }),
      {
        canonical: 'tour_complete',
        displayed: 'tour_complete',
        navigation: 'guided',
        outcome,
      },
    );
  }

  const workbenchTag = shellTag(await renderShell(
    view({ current: 'p1_represent', navigation: { mode: 'guided' } }),
    'workbench',
  ));
  for (const name of [
    'data-public-canonical-state',
    'data-public-displayed-state',
    'data-public-navigation-mode',
    'data-public-target-state',
    'data-public-outcome',
  ]) {
    assert.equal(attr(workbenchTag, name), undefined);
  }
});
