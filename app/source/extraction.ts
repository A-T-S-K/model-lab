/** Curated symbol boundaries, not fragile line numbers. The entire function remains readable. */
export function snippet(source: string, symbol: string, file: string): string | undefined {
  const marker = file === 'model/value.ts' ? `  ${symbol}(` : source.includes(`export function* ${symbol}(`) ? `export function* ${symbol}(` : `export function ${symbol}(`;
  const start = source.indexOf(marker);
  if (start < 0) return undefined;
  const next = source.indexOf(file === 'model/value.ts' ? '\n  }' : '\n}', start);
  return next < 0 ? source.slice(start) : source.slice(start, next + (file === 'model/value.ts' ? 4 : 2));
}
