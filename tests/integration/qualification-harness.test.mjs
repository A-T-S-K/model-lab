import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allocateQualificationOutput,
  assertExpectedCandidate,
  deriveCandidateBinding,
  digestTree,
  exactCandidateQualificationPass,
  readGitCandidateState,
} from '../support/qualification-evidence.ts';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function createGitFixture() {
  const root = await mkdtemp(join(tmpdir(), 'model-lab-qualification-'));
  git(root, ['init']);
  git(root, ['config', 'user.email', 'qualification@example.invalid']);
  git(root, ['config', 'user.name', 'Qualification Test']);
  await writeFile(join(root, 'tracked.txt'), 'candidate\n');
  git(root, ['add', 'tracked.txt']);
  git(root, ['commit', '-m', 'candidate']);
  return {
    root,
    commit: git(root, ['rev-parse', 'HEAD']),
    tree: git(root, ['rev-parse', 'HEAD^{tree}']),
  };
}

function verifiedInput() {
  return {
    expectedCommit: 'a'.repeat(40),
    expectedTree: 'b'.repeat(40),
    preflight: {
      commit: 'a'.repeat(40),
      tree: 'b'.repeat(40),
      clean: true,
      runtimeIdentity: 'sha256:' + 'c'.repeat(64),
    },
    postflight: {
      commit: 'a'.repeat(40),
      tree: 'b'.repeat(40),
      clean: true,
      runtimeIdentity: 'sha256:' + 'c'.repeat(64),
    },
    servedRuntime: 'sha256:' + 'c'.repeat(64),
    artifactDigestBefore: 'sha256:' + 'd'.repeat(64),
    artifactDigestAfter: 'sha256:' + 'd'.repeat(64),
  };
}

test('expected commit mismatch is rejected before qualification work', async () => {
  const fixture = await createGitFixture();
  try {
    assert.throws(
      () => assertExpectedCandidate(readGitCandidateState(fixture.root), '0'.repeat(40), fixture.tree),
      /Candidate commit mismatch/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('expected tree mismatch is rejected before qualification work', async () => {
  const fixture = await createGitFixture();
  try {
    assert.throws(
      () => assertExpectedCandidate(readGitCandidateState(fixture.root), fixture.commit, '0'.repeat(40)),
      /Candidate tree mismatch/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('dirty exact candidate is rejected for tracked and untracked changes', async () => {
  const fixture = await createGitFixture();
  try {
    await writeFile(join(fixture.root, 'tracked.txt'), 'changed\n');
    assert.throws(
      () => assertExpectedCandidate(readGitCandidateState(fixture.root), fixture.commit, fixture.tree),
      /clean working tree/,
    );
    await writeFile(join(fixture.root, 'tracked.txt'), 'candidate\n');
    await writeFile(join(fixture.root, 'untracked.txt'), 'untracked\n');
    assert.throws(
      () => assertExpectedCandidate(readGitCandidateState(fixture.root), fixture.commit, fixture.tree),
      /clean working tree/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('qualification output collisions and unsafe names are refused', async () => {
  const root = await mkdtemp(join(tmpdir(), 'model-lab-output-'));
  try {
    const first = await allocateQualificationOutput(root, 'q0-owned');
    assert.match(first.directory, /test-results[\\/]scratch[\\/]q0-owned$/);
    await assert.rejects(() => allocateQualificationOutput(root, 'q0-owned'), /EEXIST/);
    await assert.rejects(() => allocateQualificationOutput(root, '../escape'), /simple fresh child name/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('qualification allocation refuses a symlinked scratch root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'model-lab-symlink-'));
  const outside = await mkdtemp(join(tmpdir(), 'model-lab-outside-'));
  try {
    await mkdir(join(root, 'test-results'));
    await symlink(outside, join(root, 'test-results', 'scratch'), 'dir');
    await assert.rejects(() => allocateQualificationOutput(root, 'q0-symlink'), /symlink|real directory/i);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('runtime mismatch prevents verified candidate binding and manual status is ignored', () => {
  const input = verifiedInput();
  const mismatch = {
    ...input,
    servedRuntime: 'sha256:' + 'e'.repeat(64),
    status: 'verified',
  };
  const binding = deriveCandidateBinding(mismatch);
  assert.equal(binding.status, 'unverified');
  assert.equal(binding.checks.runtimeMatchedServedBuild, false);
});

test('build digest mismatch prevents verified candidate binding', () => {
  const input = verifiedInput();
  const binding = deriveCandidateBinding({
    ...input,
    artifactDigestAfter: 'sha256:' + 'e'.repeat(64),
  });
  assert.equal(binding.status, 'unverified');
  assert.equal(binding.checks.servedArtifactStable, false);
});

test('browser failure remains independent of verified candidate binding', () => {
  const binding = deriveCandidateBinding(verifiedInput());
  assert.equal(binding.status, 'verified');
  assert.equal(exactCandidateQualificationPass(binding, 'failed'), false);
  assert.equal(binding.status, 'verified');
  assert.equal(exactCandidateQualificationPass(binding, 'passed'), true);
});

test('qualification timestamps and filesystem mtimes do not affect binding or build digest', async () => {
  const firstBinding = deriveCandidateBinding({ ...verifiedInput(), preflightAt: '2026-01-01T00:00:00Z' });
  const secondBinding = deriveCandidateBinding({ ...verifiedInput(), preflightAt: '2030-01-01T00:00:00Z' });
  assert.deepEqual(firstBinding, secondBinding);

  const root = await mkdtemp(join(tmpdir(), 'model-lab-digest-'));
  try {
    const file = join(root, 'asset.js');
    await writeFile(file, 'same bytes\n');
    const before = await digestTree(root);
    await utimes(file, new Date(0), new Date(0));
    const after = await digestTree(root);
    assert.equal(after, before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('qualification source has no personal BRAIN_DIR dependency', async () => {
  for (const path of [
    join(projectRoot, 'scripts', 'qualify-public-experience.mjs'),
    join(projectRoot, 'tests', 'browser', 'pre-m5-abq-experience.spec.ts'),
  ]) {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /BRAIN_DIR|\.gemini\/antigravity/);
  }
});
