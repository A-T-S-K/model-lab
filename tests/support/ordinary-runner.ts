import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import type { Writable, Readable } from 'node:stream';
import { join } from 'node:path';
import type { allocateOrdinaryOutput } from './ordinary-output.js';

export interface OwnedStage { command: string; args: string[]; name: string }
// Injection is for owned synthetic controls, never an environment/CLI override.
export interface RunnerOptions {
  openLog?: (path: string) => Writable;
  graceMs?: number;
  killMs?: number;
  mirror?: boolean;
}
const message = (error: unknown) => String(error);
async function groupGone(pid: number, signal: AbortSignal) {
  if (process.platform === 'win32') return;
  while (!signal.aborted) {
    try { process.kill(-pid, 0); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
async function bounded(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise.then(() => true, () => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), ms); })]); }
  finally { clearTimeout(timer); }
}
export async function runOwnedStages(root: string, output: Awaited<ReturnType<typeof allocateOrdinaryOutput>>,
  stages: OwnedStage[], env: NodeJS.ProcessEnv, options: RunnerOptions = {}) {
  let interrupt: ((error: Error) => void) | undefined, interrupted: string | undefined;
  const cleanupErrors: string[] = [];
  const signals = ['SIGINT', 'SIGTERM'] as const;
  const handlers = signals.map(signal => {
    const handler = () => { interrupted ??= signal; interrupt?.(Error(`Interrupted: ${signal}`)); };
    process.on(signal, handler); return handler;
  });
  const grace = options.graceMs ?? 1500, killWait = options.killMs ?? 1500;
  try {
    for (const stage of stages) {
      if (interrupted) throw Error(`Interrupted: ${interrupted}`);
      if (!/^[a-z][a-z0-9-]*$/.test(stage.name)) throw Error('Unsafe stage name');
      let original: unknown, child: ChildProcess | undefined;
      let fail!: (error: unknown) => void;
      const failure = new Promise<never>((_, reject) => { fail = error => { if (!original) { original = error; reject(error); } }; });
      // Attach a rejection observer even during synchronous setup/cleanup.
      void failure.catch(() => {});
      interrupt = fail;
      const log = options.openLog?.(join(output.directory, stage.name + '.log')) ?? createWriteStream(join(output.directory, stage.name + '.log'), { flags: 'wx' });
      const onLogError = (error: Error) => fail(error);
      log.on('error', onLogError);
      const logDone = finished(log, { cleanup: true });
      void logDone.catch(fail);
      let closed: Promise<void> = Promise.resolve(), pumps: Promise<void>[] = [];
      let onChildError: ((error: Error) => void) | undefined;
      let onClose: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
      const write = (destination: Writable, bytes: Buffer) => new Promise<void>((resolve, reject) => {
        if (destination.destroyed || !destination.writable) { reject(Error('Log destination is no longer writable')); return; }
        destination.write(bytes, error => error ? reject(error) : resolve());
      });
      const pump = async (source: Readable, mirror: Writable) => {
        // Await each write callback: at most one bounded pipe chunk per source,
        // with Node pipe buffering/backpressure rather than an output accumulator.
        for await (const bytes of source) {
          await write(log, bytes);
          if (options.mirror !== false) await write(mirror, bytes);
        }
      };
      try {
        if (!options.openLog) {
          // File open is asynchronous; no child may run before exclusive open.
          await Promise.race([new Promise<void>(resolve => log.once('open', () => resolve())), failure]);
        } else if (log.destroyed || !log.writable) throw Error('Log destination is not usable');
        if (interrupted) throw Error(`Interrupted: ${interrupted}`);
        child = spawn(stage.command, stage.args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
        closed = new Promise<void>(resolve => {
          onClose = (code, signal) => { if (code !== 0) fail(Error(`${stage.name} exited ${code ?? 128}${signal ? ` (${signal})` : ''}`)); resolve(); };
          child!.once('close', onClose);
        });
        onChildError = error => fail(error);
        child.on('error', onChildError);
        pumps = [pump(child.stdout!, process.stdout), pump(child.stderr!, process.stderr)];
        for (const promise of pumps) void promise.catch(fail);
        await Promise.race([Promise.all([closed, ...pumps]), failure]);
        log.end();
        await Promise.race([logDone, failure]);
      } catch (error) {
        original ??= error;
        if (child?.pid) {
          const stop = (signal: NodeJS.Signals) => {
            try { if (process.platform === 'win32') child!.kill(signal); else process.kill(-child!.pid!, signal); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') cleanupErrors.push(`Child ${signal}: ${message(error)}`); }
          };
          stop(interrupted === 'SIGINT' ? 'SIGINT' : 'SIGTERM');
          const controller = new AbortController();
          const settled = Promise.allSettled([closed, ...pumps, groupGone(child.pid, controller.signal)]);
          // Always escalate the owned group after the grace interval if pipes
          // remain open, including a leader that exited before its descendants.
          if (!await bounded(settled, grace)) {
            stop('SIGKILL');
            if (!await bounded(settled, killWait)) cleanupErrors.push('Child/stdio closure exceeded cleanup deadline after SIGKILL');
          }
          controller.abort();
          await bounded(settled, killWait);
        } else if (child && !await bounded(closed, killWait)) cleanupErrors.push('Spawn failure closure exceeded cleanup deadline');
        child?.stdout?.destroy(); child?.stderr?.destroy();
        if (!log.destroyed) log.destroy();
        if (!await bounded(Promise.allSettled([logDone, ...pumps]), killWait)) cleanupErrors.push('Log/pump settlement exceeded cleanup deadline');
        throw original;
      } finally {
        interrupt = undefined;
        log.removeListener('error', onLogError);
        log.removeAllListeners('open');
        if (onChildError) child?.removeListener('error', onChildError);
        if (onClose) child?.removeListener('close', onClose);
      }
    }
  } catch (error) {
    try {
      await output.write(interrupted ? 'interruption.json' : 'failure.json', JSON.stringify({ status: interrupted ? 'interrupted' : 'failed', error: message(error), signal: interrupted, cleanupErrors }));
    } catch (receiptError) { cleanupErrors.push(`Failure receipt: ${message(receiptError)}`); }
    if (cleanupErrors.length) console.error('Owned runner cleanup failures:', cleanupErrors);
    throw error;
  } finally { signals.forEach((signal, i) => process.off(signal, handlers[i])); }
}
