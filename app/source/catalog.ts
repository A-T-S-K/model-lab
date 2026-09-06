import { sourceMapping } from './mappings.js';
import stageSource from './stages.ts?raw';
import valueSource from '../../model/value.ts?raw';
import modelSource from '../../model/microgpt.ts?raw';
import backwardSource from '../../model/autograd.ts?raw';
import trainingSource from '../../model/training.ts?raw';
import { escapeHtml } from '../views/evidence.js';

const files = { 'app/source/stages.ts': stageSource, 'model/value.ts': valueSource, 'model/microgpt.ts': modelSource, 'model/autograd.ts': backwardSource, 'model/training.ts': trainingSource };
const revisions = new Map<string, string>();
export async function prepareSource(): Promise<void> {
  await Promise.all(Object.entries(files).map(async ([file, source]) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    revisions.set(file, Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join(''));
  }));
}
/** Curated symbol boundaries, not fragile line numbers. The entire function remains readable. */
export function snippet(source: string, symbol: string, file: string): string | undefined {
  const marker = file === 'model/value.ts' ? `  ${symbol}(` : `export function ${symbol}(`;
  const start = source.indexOf(marker);
  if (start < 0) return undefined;
  const next = source.indexOf(file === 'model/value.ts' ? '\n  }' : '\n}', start);
  return next < 0 ? source.slice(start) : source.slice(start, next + (file === 'model/value.ts' ? 4 : 2));
}
export function sourceView(kind: string): string {
  const mapping = sourceMapping(kind);
  if (mapping.status !== 'mapped') return `<p class="muted" data-source-status="${mapping.status}"><strong>${mapping.status.toUpperCase()}</strong> · ${escapeHtml(mapping.explanation)}</p>`;
  const { name, equation, file, symbol } = mapping;
  const source = files[file as keyof typeof files];
  const excerpt = source && snippet(source, symbol, file);
  if (!excerpt) return '<p class="muted" data-source-status="unmapped"><strong>UNMAPPED</strong> · The declared source symbol could not be found in this build.</p>';
  return `<details class="source" data-source-status="mapped"><summary>Read source · ${escapeHtml(name)}</summary><p>${escapeHtml(equation)}</p><p><code>${file} · ${file === 'model/value.ts' ? 'Value.' : ''}${symbol}</code></p><small>Bundled source revision · SHA-256 <code>${revisions.get(file) ?? 'pending'}</code>. Available offline.</small><pre>${escapeHtml(excerpt)}</pre></details>`;
}
