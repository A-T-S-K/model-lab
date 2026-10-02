import { sourceMapping } from './mappings.js';
import stageSource from './stages.ts?raw';
import valueSource from '../../model/value.ts?raw';
import modelSource from '../../model/microgpt.ts?raw';
import backwardSource from '../../model/autograd.ts?raw';
import trainingSource from '../../model/training.ts?raw';
import { escapeHtml } from '../views/evidence.js';
import { sha256Hex } from '../../trace/sha256.js';
import { snippet } from './extraction.js';
export { snippet } from './extraction.js';

export const sourceFiles = { 'app/source/stages.ts': stageSource, 'model/value.ts': valueSource, 'model/microgpt.ts': modelSource, 'model/autograd.ts': backwardSource, 'model/training.ts': trainingSource };
const revisions = new Map<string, string>();
export async function prepareSource(): Promise<void> {
  await Promise.all(Object.entries(sourceFiles).map(async ([file, source]) => {
    revisions.set(file, await sha256Hex(new TextEncoder().encode(source)));
  }));
}
export function sourceView(kind: string): string {
  const mapping = sourceMapping(kind);
  if (mapping.status !== 'mapped') return `<p class="muted" data-source-status="${mapping.status}"><strong>${mapping.status.toUpperCase()}</strong> · ${escapeHtml(mapping.explanation)}</p>`;
  const { name, equation, file, symbol, entry } = mapping;
  const source = sourceFiles[file as keyof typeof sourceFiles];
  const excerpt = source && snippet(source, symbol, file);
  if (!excerpt) return '<p class="muted" data-source-status="unmapped"><strong>UNMAPPED</strong> · The declared source symbol could not be found in this build.</p>';
  return `<details class="source" data-source-status="mapped"><summary>Read source · ${escapeHtml(name)}</summary><p>${escapeHtml(equation)}</p><p><code>${file} · ${file === 'model/value.ts' ? 'Value.' : ''}${symbol}</code></p>${entry ? `<p>Canonical entry <code>${escapeHtml(entry)}</code> delegates to this executed mechanism in the same immutable source file.</p>` : ''}<small>Bundled source revision · SHA-256 <code>${revisions.get(file) ?? 'pending'}</code>. Available offline.</small><pre>${escapeHtml(excerpt)}</pre></details>`;
}
