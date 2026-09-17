/**
 * Presentation-only work limits. These limits bound DOM construction and derived
 * reads; they never change retained evidence or portable archive identity.
 */
export const PRESENTATION_WORK = Object.freeze({
  historyRuns: 32,
  historySnapshots: 64,
  spatialExperiments: 64,
  sharedRuns: 32,
  sharedPoints: 24,
  fallbackPoints: 24,
  coordinateOptions: 64,
  relationships: 24,
  scalarEdges: 24,
  scalarOperands: 16,
  structuralEvents: 12,
  structuralValues: 16,
  breadcrumbs: 16,
  comparisonRows: 32,
  valuePreview: 16,
  payloadSlice: 256,
  numericalValues: 200_000,
  distributionTopK: 20,
});

export interface PresentationWindow<T> {
  readonly items: readonly T[];
  readonly offset: number;
  readonly end: number;
  readonly total: number;
  readonly limit: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

export function presentationWindow<T>(
  values: readonly T[],
  requestedOffset: number,
  limit: number,
  includeIndex?: number,
): PresentationWindow<T> {
  if (!Number.isSafeInteger(limit) || limit <= 0)
    throw new Error("Presentation window limit is invalid");
  const maximum = Math.max(0, values.length - limit);
  let offset = Number.isSafeInteger(requestedOffset)
    ? Math.min(maximum, Math.max(0, requestedOffset))
    : 0;
  if (includeIndex !== undefined && includeIndex >= 0 && includeIndex < values.length) {
    if (includeIndex < offset) offset = Math.floor(includeIndex / limit) * limit;
    else if (includeIndex >= offset + limit)
      offset = Math.min(maximum, Math.floor(includeIndex / limit) * limit);
  }
  const end = Math.min(values.length, offset + limit);
  return Object.freeze({
    items: Object.freeze(values.slice(offset, end)),
    offset,
    end,
    total: values.length,
    limit,
    hasPrevious: offset > 0,
    hasNext: end < values.length,
  });
}

export function previousWindowOffset(offset: number, limit: number): number {
  return Math.max(0, offset - limit);
}

export function nextWindowOffset(offset: number, limit: number, total: number): number {
  return Math.min(Math.max(0, total - limit), offset + limit);
}

export function windowSummary(window: Pick<PresentationWindow<unknown>, "offset" | "end" | "total">): string {
  return window.total === 0
    ? "showing 0 of 0 retained"
    : `showing ${window.offset + 1}–${window.end} of ${window.total} retained`;
}

export function rangeWindow(total: number, requestedOffset: number, limit: number, includeIndex?: number) {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(limit) || limit <= 0)
    throw new Error("Presentation range is invalid");
  const maximum = Math.max(0, total - limit);
  let offset = Number.isSafeInteger(requestedOffset) ? Math.min(maximum, Math.max(0, requestedOffset)) : 0;
  if (includeIndex !== undefined && includeIndex >= 0 && includeIndex < total && (includeIndex < offset || includeIndex >= offset + limit))
    offset = Math.min(maximum, Math.floor(includeIndex / limit) * limit);
  const end = Math.min(total, offset + limit);
  return Object.freeze({offset,end,total,limit,hasPrevious:offset>0,hasNext:end<total});
}
