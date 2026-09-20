import { sourceMapping } from './mappings.js';
import * as stageModule from './stages.ts?raw';
import * as valueModule from '../../model/value.ts?raw';
import * as modelModule from '../../model/microgpt.ts?raw';
import * as backwardModule from '../../model/autograd.ts?raw';
import * as trainingModule from '../../model/training.ts?raw';
import { escapeHtml } from '../views/evidence.js';

const rawStr = (m: any): string => (typeof m?.default === 'string' ? m.default : '');
const stageSource = rawStr(stageModule);
const valueSource = rawStr(valueModule);
const modelSource = rawStr(modelModule);
const backwardSource = rawStr(backwardModule);
const trainingSource = rawStr(trainingModule);

export const sourceFiles = { 'app/source/stages.ts': stageSource, 'model/value.ts': valueSource, 'model/microgpt.ts': modelSource, 'model/autograd.ts': backwardSource, 'model/training.ts': trainingSource };
const revisions = new Map<string, string>();
export async function prepareSource(): Promise<void> {
  await Promise.all(Object.entries(sourceFiles).map(async ([file, source]) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    revisions.set(file, Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join(''));
  }));
}
/** Curated symbol boundaries, not fragile line numbers. The entire function remains readable. */
export function snippet(source: string, symbol: string, file: string): string | undefined {
  const marker = file === 'model/value.ts' ? `  ${symbol}(` : `export function${['forwardSequence','objectiveSequence','backwardSequence','adamProposals'].includes(symbol) ? '*' : ''} ${symbol}(`;
  const start = source.indexOf(marker);
  if (start < 0) return undefined;
  const next = source.indexOf(file === 'model/value.ts' ? '\n  }' : '\n}', start);
  return next < 0 ? source.slice(start) : source.slice(start, next + (file === 'model/value.ts' ? 4 : 2));
}
export function sourceView(kind: string): string {
  const mapping = sourceMapping(kind);
  if (mapping.status !== 'mapped') return `<p class="muted" data-source-status="${mapping.status}"><strong>${mapping.status.toUpperCase()}</strong> · ${escapeHtml(mapping.explanation)}</p>`;
  const { name, equation, file, symbol } = mapping;
  const source = sourceFiles[file as keyof typeof sourceFiles];
  const excerpt = source && snippet(source, symbol, file);
  if (!excerpt) return '<p class="muted" data-source-status="unmapped"><strong>UNMAPPED</strong> · The declared source symbol could not be found in this build.</p>';
  return `<details class="source" data-source-status="mapped"><summary>Read source · ${escapeHtml(name)}</summary><p>${escapeHtml(equation)}</p><p><code>${file} · ${file === 'model/value.ts' ? 'Value.' : ''}${symbol}</code></p><small>Bundled source revision · SHA-256 <code>${revisions.get(file) ?? 'pending'}</code>. Available offline.</small><pre>${escapeHtml(excerpt)}</pre></details>`;
}
