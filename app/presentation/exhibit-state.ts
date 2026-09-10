export interface ExhibitTiming {
  resetAfterMs: number;
  warningMs: number;
}
/** Initial field-test values, configurable in the URL and operator controls. */
export const DEFAULT_EXHIBIT_TIMING: ExhibitTiming = {
  resetAfterMs: 300_000,
  warningMs: 20_000,
};
function boundedSeconds(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed =
    value === null || value.trim() === "" ? fallback : Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, Math.round(parsed)))
    : fallback;
}
export function exhibitTiming(parameters: URLSearchParams): ExhibitTiming {
  const resetSeconds = boundedSeconds(
    parameters.get("idleSeconds"),
    DEFAULT_EXHIBIT_TIMING.resetAfterMs / 1000,
    30,
    3600,
  );
  const warningSeconds = boundedSeconds(
    parameters.get("warningSeconds"),
    DEFAULT_EXHIBIT_TIMING.warningMs / 1000,
    5,
    Math.min(120, resetSeconds - 5),
  );
  return {
    resetAfterMs: resetSeconds * 1000,
    warningMs: warningSeconds * 1000,
  };
}
export function exhibitState(
  enabled: boolean,
  attract: boolean,
  lastActivity: number,
  now: number,
  timing: ExhibitTiming,
): {
  phase: "DISABLED" | "ATTRACT" | "ACTIVE" | "WARNING" | "RESET";
  remainingMs?: number;
} {
  if (!enabled) return { phase: "DISABLED" };
  if (attract) return { phase: "ATTRACT" };
  const remainingMs = Math.max(0, lastActivity + timing.resetAfterMs - now);
  return {
    phase:
      remainingMs === 0
        ? "RESET"
        : remainingMs <= timing.warningMs
          ? "WARNING"
          : "ACTIVE",
    remainingMs,
  };
}
