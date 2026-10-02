import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import type { allocateOrdinaryOutput } from './ordinary-output.js';

export interface OwnedStage { command: string; args: string[]; name: string }
export async function runOwnedStages(root: string, output: Awaited<ReturnType<typeof allocateOrdinaryOutput>>,
  stages: OwnedStage[], env: NodeJS.ProcessEnv) {
  let child: ChildProcess | undefined, interrupted: string | undefined;
  const signals = ['SIGINT', 'SIGTERM'] as const;
  const handlers = signals.map(signal => {
    const handler = () => {
      interrupted = signal;
      if (child?.pid) {
        if (process.platform === 'win32') child.kill(signal);
        else { try { process.kill(-child.pid, signal); } catch {} }
      }
    };
    process.on(signal, handler); return handler;
  });
  try {
    for (const stage of stages) {
      if (interrupted) throw Error(`Interrupted: ${interrupted}`);
      if (!/^[a-z][a-z0-9-]*$/.test(stage.name)) throw Error('Unsafe stage name');
      const log = createWriteStream(join(output.directory, stage.name + '.log'), { flags: 'wx' });
      try {
        const code = await new Promise<number>((resolve, reject) => {
          log.once('error', reject);
          child = spawn(stage.command, stage.args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
          child.stdout!.on('data', bytes => { log.write(bytes); process.stdout.write(bytes); });
          child.stderr!.on('data', bytes => { log.write(bytes); process.stderr.write(bytes); });
          child.once('error', reject);
          // close waits for stdio to drain, retaining the tail of failure logs.
          child.once('close', (code, signal) => resolve(code ?? (signal ? 128 : 1)));
        });
        if (code !== 0 || interrupted) throw Error(`${stage.name} exited ${code}${interrupted ? ` (${interrupted})` : ''}`);
      } finally { child = undefined; await new Promise<void>(resolve => log.end(resolve)); }
    }
  } catch (error) {
    await output.write(interrupted ? 'interruption.json' : 'failure.json', JSON.stringify({ status: interrupted ? 'interrupted' : 'failed', error: String(error), signal: interrupted }));
    throw error;
  } finally { signals.forEach((signal, i) => process.off(signal, handlers[i])); }
}
