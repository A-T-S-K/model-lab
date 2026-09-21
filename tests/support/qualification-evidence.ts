import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { allocateSliceOutput, browserEvidenceDirectory, validateScratchPath } from './slice-output.js';

export const QUALIFICATION_PROFILE = 'pre-m5-public';
export const QUALIFICATION_REPOSITORY = 'A-T-S-K/model-lab';

const FULL_SHA = /^[a-f0-9]{40}$/;
const OUTPUT_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export interface GitCandidateState {
  readonly commit: string;
  readonly tree: string;
  readonly clean: boolean;
  readonly status: string;
}

export interface QualificationCandidateRecord {
  readonly schemaVersion: 1;
  readonly repository: string;
  readonly qualificationProfile: string;
  readonly expected: {
    readonly commit: string;
    readonly tree: string;
  };
  readonly preflight: {
    readonly commit: string;
    readonly tree: string;
    readonly workingTree: 'clean';
    readonly runtimeSourceIdentity: string;
  };
  readonly allocation: {
    readonly id: string;
    readonly path: string;
  };
  readonly preflightAt: string;
}

export interface CandidateBindingInput {
  readonly expectedCommit: string;
  readonly expectedTree: string;
  readonly preflight: {
    readonly commit: string;
    readonly tree: string;
    readonly clean: boolean;
    readonly runtimeIdentity: string;
  };
  readonly postflight: {
    readonly commit?: string;
    readonly tree?: string;
    readonly clean?: boolean;
    readonly runtimeIdentity?: string;
  };
  readonly servedRuntime?: string;
  readonly artifactDigestBefore?: string;
  readonly artifactDigestAfter?: string;
}

export interface CandidateBinding {
  readonly status: 'verified' | 'unverified';
  readonly checks: {
    readonly expectedCommitMatchedBefore: boolean;
    readonly expectedCommitMatchedAfter: boolean;
    readonly expectedTreeMatchedBefore: boolean;
    readonly expectedTreeMatchedAfter: boolean;
    readonly sourceCleanBefore: boolean;
    readonly sourceCleanAfter: boolean;
    readonly runtimeMatchedServedBuild: boolean;
    readonly runtimeStableAfter: boolean;
    readonly servedArtifactStable: boolean;
  };
}

export interface QualificationBrowserContext {
  readonly allocation: string;
  readonly build: string;
  readonly runner: string;
  readonly evidence: string;
  readonly report: string;
  readonly captureDirectory: string;
  readonly expectedRuntimeIdentity: string;
  readonly candidate: QualificationCandidateRecord;
}

function gitValue(root: string, args: readonly string[]) {
  return execFileSync('git', [...args], { cwd: root, encoding: 'utf8' }).trim();
}

export function readGitCandidateState(root: string): GitCandidateState {
  const status = gitValue(root, ['status', '--porcelain=v1', '--untracked-files=all']);
  return {
    commit: gitValue(root, ['rev-parse', 'HEAD']),
    tree: gitValue(root, ['rev-parse', 'HEAD^{tree}']),
    clean: status.length === 0,
    status,
  };
}

export function assertExpectedCandidate(
  state: GitCandidateState,
  expectedCommit: string,
  expectedTree: string,
) {
  if (!FULL_SHA.test(expectedCommit)) throw new Error('Expected commit must be a full lowercase 40-character SHA');
  if (!FULL_SHA.test(expectedTree)) throw new Error('Expected tree must be a full lowercase 40-character SHA');
  if (state.commit !== expectedCommit) {
    throw new Error('Candidate commit mismatch: expected ' + expectedCommit + ', actual ' + state.commit);
  }
  if (state.tree !== expectedTree) {
    throw new Error('Candidate tree mismatch: expected ' + expectedTree + ', actual ' + state.tree);
  }
  if (!state.clean) {
    throw new Error('Exact qualification requires a clean working tree; git status:\n' + state.status);
  }
}

export async function allocateQualificationOutput(root: string, outputName?: string) {
  if (outputName !== undefined && !OUTPUT_NAME.test(outputName)) {
    throw new Error('Qualification output must be a simple fresh child name');
  }
  const destination = outputName === undefined ? undefined : 'test-results/scratch/' + outputName;
  const output = await allocateSliceOutput(root, destination, 'qualification-');
  const build = join(output.directory, 'build');
  await mkdir(build, { mode: 0o700 });
  const runner = await validateScratchPath(root, join(output.directory, 'runner'));
  const evidence = await validateScratchPath(root, join(output.directory, 'evidence'));
  const report = await validateScratchPath(root, join(output.directory, 'report'));
  const ownedBuild = await validateScratchPath(root, build);
  const captureDirectory = await browserEvidenceDirectory(root, output.directory);
  return { ...output, build: ownedBuild, runner, evidence, report, captureDirectory };
}

export async function digestTree(directory: string) {
  const paths: string[] = [];
  async function visit(absolute: string, prefix: string) {
    const entries = await readdir(absolute, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? prefix + '/' + entry.name : entry.name;
      const absoluteEntry = join(absolute, entry.name);
      if (entry.isDirectory()) await visit(absoluteEntry, rel);
      else if (entry.isFile()) paths.push(rel);
      else throw new Error('Unsupported build artifact entry: ' + rel);
    }
  }
  await visit(directory, '');
  paths.sort();

  const hash = createHash('sha256');
  hash.update('model-lab-build-v1\0');
  for (const path of paths) {
    const bytes = await readFile(join(directory, ...path.split('/')));
    hash.update(String(Buffer.byteLength(path)) + ':' + path + ':' + String(bytes.length) + ':');
    hash.update(bytes);
  }
  return 'sha256:' + hash.digest('hex');
}

export function deriveCandidateBinding(input: CandidateBindingInput): CandidateBinding {
  const checks = {
    expectedCommitMatchedBefore: input.preflight.commit === input.expectedCommit,
    expectedCommitMatchedAfter: input.postflight.commit === input.expectedCommit,
    expectedTreeMatchedBefore: input.preflight.tree === input.expectedTree,
    expectedTreeMatchedAfter: input.postflight.tree === input.expectedTree,
    sourceCleanBefore: input.preflight.clean === true,
    sourceCleanAfter: input.postflight.clean === true,
    runtimeMatchedServedBuild:
      input.servedRuntime !== undefined && input.servedRuntime === input.preflight.runtimeIdentity,
    runtimeStableAfter:
      input.postflight.runtimeIdentity !== undefined &&
      input.postflight.runtimeIdentity === input.preflight.runtimeIdentity,
    servedArtifactStable:
      input.artifactDigestBefore !== undefined &&
      input.artifactDigestAfter !== undefined &&
      input.artifactDigestBefore === input.artifactDigestAfter,
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'verified' : 'unverified',
    checks,
  };
}

export function exactCandidateQualificationPass(
  binding: CandidateBinding,
  browserResult: 'passed' | 'failed',
) {
  return binding.status === 'verified' && browserResult === 'passed';
}

function assertInside(owner: string, target: string) {
  const rel = relative(owner, target);
  if (!rel || rel.startsWith('..' + sep) || rel === '..' || isAbsolute(rel)) {
    throw new Error('Qualification output escaped its allocation');
  }
}

export async function writeQualificationJson(
  root: string,
  allocation: string,
  target: string,
  value: unknown,
) {
  const owner = await validateScratchPath(root, allocation);
  const parent = await validateScratchPath(root, dirname(target));
  assertInside(owner, parent);
  const file = await open(
    target,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await file.writeFile(JSON.stringify(value, null, 2) + '\n');
  } finally {
    await file.close();
  }
}

export async function qualificationBrowserContext(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<QualificationBrowserContext | undefined> {
  const rawAllocation = env.MODEL_LAB_QUALIFICATION_ROOT;
  if (rawAllocation === undefined) return undefined;

  const expectedRuntimeIdentity = env.MODEL_LAB_QUALIFICATION_EXPECTED_RUNTIME;
  const rawCaptureDirectory = env.MODEL_LAB_QUALIFICATION_CAPTURE_DIR;
  if (!expectedRuntimeIdentity || !rawCaptureDirectory) {
    throw new Error('Incomplete Model Lab qualification environment');
  }

  const allocation = await validateScratchPath(root, rawAllocation);
  const build = await validateScratchPath(root, join(allocation, 'build'));
  const runner = await validateScratchPath(root, join(allocation, 'runner'));
  const evidence = await validateScratchPath(root, join(allocation, 'evidence'));
  const report = await validateScratchPath(root, join(allocation, 'report'));
  const captureDirectory = await validateScratchPath(root, rawCaptureDirectory);
  const captureRelative = relative(evidence, captureDirectory);
  if (!captureRelative || captureRelative.startsWith('..' + sep) || captureRelative === '..' || isAbsolute(captureRelative)) {
    throw new Error('Qualification capture directory must be owned by the evidence directory');
  }

  const candidatePath = await validateScratchPath(root, join(allocation, 'candidate.json'));
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8')) as QualificationCandidateRecord;
  if (candidate.repository !== QUALIFICATION_REPOSITORY || candidate.qualificationProfile !== QUALIFICATION_PROFILE) {
    throw new Error('Qualification candidate metadata has the wrong repository/profile');
  }
  if (candidate.preflight.runtimeSourceIdentity !== expectedRuntimeIdentity) {
    throw new Error('Qualification runtime environment does not match immutable candidate metadata');
  }

  return {
    allocation,
    build,
    runner,
    evidence,
    report,
    captureDirectory,
    expectedRuntimeIdentity,
    candidate,
  };
}
