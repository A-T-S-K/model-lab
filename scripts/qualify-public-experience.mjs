#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { basename, fileURLToPath, join, relative } from 'node:path';
import {
  QUALIFICATION_PROFILE,
  QUALIFICATION_REPOSITORY,
  allocateQualificationOutput,
  assertExpectedCandidate,
  deriveCandidateBinding,
  digestTree,
  exactCandidateQualificationPass,
  readGitCandidateState,
  writeQualificationJson,
} from '../tests/support/qualification-evidence.ts';
import { generateRuntimeIdentity, runtimeIdentity } from './runtime-identity.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function parseArgs(argv) {
  const values = { expectedCommit: undefined, expectedTree: undefined, output: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--expected-commit' || arg === '--expected-tree' || arg === '--output') {
      if (!next || next.startsWith('--')) throw new Error('Missing value for ' + arg);
      if (arg === '--expected-commit') values.expectedCommit = next;
      else if (arg === '--expected-tree') values.expectedTree = next;
      else values.output = next;
      index += 1;
      continue;
    }
    throw new Error('Unknown qualification argument: ' + arg);
  }
  if (!values.expectedCommit || !values.expectedTree) {
    throw new Error('Usage: npm run qualify:public -- --expected-commit <full-sha> --expected-tree <full-tree-sha> [--output <fresh-name>]');
  }
  return values;
}

function executable(name) {
  if (process.platform === 'win32') return name + '.cmd';
  return name;
}

async function runProcess(command, args, env = process.env) {
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', shell: false });
  return await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(command + ' terminated by signal ' + signal));
      else resolve(code ?? 1);
    });
  });
}

async function runChecked(command, args, label) {
  const code = await runProcess(command, args);
  if (code !== 0) throw new Error(label + ' failed with exit ' + String(code));
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not reserve a qualification preview port');
  }
  const port = address.port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function readOptionalJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const preGit = readGitCandidateState(root);
  assertExpectedCandidate(preGit, args.expectedCommit, args.expectedTree);
  const preRuntime = await runtimeIdentity(root);
  const preflightAt = new Date().toISOString();

  const qualification = await allocateQualificationOutput(root, args.output);
  const allocationRelative = relative(root, qualification.directory).split('\\').join('/');
  const candidate = {
    schemaVersion: 1,
    repository: QUALIFICATION_REPOSITORY,
    qualificationProfile: QUALIFICATION_PROFILE,
    expected: { commit: args.expectedCommit, tree: args.expectedTree },
    preflight: {
      commit: preGit.commit,
      tree: preGit.tree,
      workingTree: 'clean',
      runtimeSourceIdentity: preRuntime.revision,
    },
    allocation: {
      id: basename(qualification.directory),
      path: allocationRelative,
    },
    preflightAt,
  };
  await qualification.write('candidate.json', JSON.stringify(candidate, null, 2) + '\n');

  const qualificationStartedAt = new Date().toISOString();
  let finalManifestWritten = false;
  try {
    const generated = await generateRuntimeIdentity(root);
    if (generated.revision !== preRuntime.revision) {
      throw new Error('Generated runtime revision differs from preflight runtime identity');
    }

    await runChecked(executable('npm'), ['run', 'typecheck'], 'typecheck');

    const runtimeBeforeBuild = await runtimeIdentity(root);
    if (runtimeBeforeBuild.revision !== preRuntime.revision) {
      throw new Error('Runtime identity changed before build');
    }

    const vite = join(root, 'node_modules', '.bin', executable('vite'));
    await runChecked(vite, ['build', '--outDir', qualification.build, '--emptyOutDir'], 'owned Vite build');
    const artifactDigestBefore = await digestTree(qualification.build);

    const port = await reservePort();
    const browserEnv = {
      ...process.env,
      MODEL_LAB_QUALIFICATION_ROOT: allocationRelative,
      MODEL_LAB_QUALIFICATION_CAPTURE_DIR:
        relative(root, qualification.captureDirectory).split('\\').join('/'),
      MODEL_LAB_QUALIFICATION_EXPECTED_RUNTIME: preRuntime.revision,
      MODEL_LAB_QUALIFICATION_PORT: String(port),
    };
    const playwright = join(root, 'node_modules', '.bin', executable('playwright'));
    let browserResult = 'failed';
    let browserFailure;
    try {
      const browserExit = await runProcess(playwright, [
        'test',
        'tests/browser/pre-m5-abq-experience.spec.ts',
        '--config',
        'playwright.qualification.config.ts',
      ], browserEnv);
      browserResult = browserExit === 0 ? 'passed' : 'failed';
      if (browserExit !== 0) browserFailure = 'Playwright exit ' + String(browserExit);
    } catch (error) {
      browserFailure = String(error);
    }

    let postGit;
    let postRuntime;
    let artifactDigestAfter;
    let postflightError;
    try {
      postGit = readGitCandidateState(root);
      postRuntime = await runtimeIdentity(root);
      artifactDigestAfter = await digestTree(qualification.build);
    } catch (error) {
      postflightError = String(error);
    }

    const served = await readOptionalJson(join(qualification.report, 'served-runtime.json'));
    const browserEvidence = await readOptionalJson(join(qualification.report, 'browser-evidence.json'));
    const binding = deriveCandidateBinding({
      expectedCommit: args.expectedCommit,
      expectedTree: args.expectedTree,
      preflight: {
        commit: preGit.commit,
        tree: preGit.tree,
        clean: preGit.clean,
        runtimeIdentity: preRuntime.revision,
      },
      postflight: {
        commit: postGit?.commit,
        tree: postGit?.tree,
        clean: postGit?.clean,
        runtimeIdentity: postRuntime?.revision,
      },
      servedRuntime: served?.runtimeRevision,
      artifactDigestBefore,
      artifactDigestAfter,
    });

    const completedAt = new Date().toISOString();
    const manifest = {
      schemaVersion: 1,
      repository: QUALIFICATION_REPOSITORY,
      qualification: {
        profile: QUALIFICATION_PROFILE,
        entrypoint: 'npm run qualify:public',
        suite: 'tests/browser/pre-m5-abq-experience.spec.ts',
        result: browserResult,
        startedAt: qualificationStartedAt,
        completedAt,
        ...(browserFailure ? { browserFailure } : {}),
      },
      candidate: {
        expectedCommit: args.expectedCommit,
        expectedTree: args.expectedTree,
        preflight: {
          commit: preGit.commit,
          tree: preGit.tree,
          workingTree: preGit.clean ? 'clean' : 'dirty',
          runtimeIdentity: preRuntime.revision,
          establishedAt: preflightAt,
        },
        postflight: {
          commit: postGit?.commit ?? null,
          tree: postGit?.tree ?? null,
          workingTree: postGit ? (postGit.clean ? 'clean' : 'dirty') : 'unavailable',
          runtimeIdentity: postRuntime?.revision ?? null,
          ...(postflightError ? { error: postflightError } : {}),
        },
      },
      runtime: {
        modelLab: {
          sourceIdentity: preRuntime.revision,
          servedRevision: served?.runtimeRevision ?? null,
        },
      },
      build: {
        artifactDigestBefore,
        artifactDigestAfter: artifactDigestAfter ?? null,
      },
      candidateBinding: binding,
      browser: browserEvidence?.browser ?? null,
      captures: browserEvidence?.captures ?? [],
    };

    await writeQualificationJson(
      root,
      qualification.directory,
      join(qualification.evidence, 'manifest.json'),
      manifest,
    );
    finalManifestWritten = true;

    if (!exactCandidateQualificationPass(binding, browserResult)) {
      throw new Error(
        'Public qualification did not establish an exact-candidate PASS: binding=' +
        binding.status + ', browser=' + browserResult,
      );
    }

    await qualification.write('completion.json', JSON.stringify({
      status: 'passed',
      candidateBinding: binding.status,
      qualificationResult: browserResult,
      completedAt,
    }) + '\n');
    console.log('Exact-candidate public qualification PASS: ' + allocationRelative);
  } catch (error) {
    try {
      await qualification.write('failure.json', JSON.stringify({
        status: 'failed',
        error: String(error),
        finalManifestWritten,
        failedAt: new Date().toISOString(),
      }) + '\n');
    } catch (recordError) {
      console.error('Could not retain qualification failure receipt:', recordError);
    }
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
