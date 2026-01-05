export const TIMEWINDOW_UNIFY_MS = 60_000;

export interface TimeWindow {
  anchor_ts_ms: number;
  window_ms: number;
  window_start_ms: number;
  window_end_ms: number;
}

export function nowMs(): number {
  return Date.now();
}

export function unifyTimeWindow(anchorTsMs?: number, windowMs: number = TIMEWINDOW_UNIFY_MS): TimeWindow {
  const anchor = anchorTsMs ?? nowMs();
  const alignedStart = Math.floor(anchor / TIMEWINDOW_UNIFY_MS) * TIMEWINDOW_UNIFY_MS;
  return {
    anchor_ts_ms: anchor,
    window_ms: windowMs,
    window_start_ms: alignedStart,
    window_end_ms: alignedStart + windowMs,
  };
}

export function calculateDataAgeMs(observedTsMs: number, rawTsMs: number): number {
  return Math.max(0, observedTsMs - rawTsMs);
}

export function clampWindowStart(window: TimeWindow, earliestTsMs: number): TimeWindow {
  if (window.window_start_ms < earliestTsMs) {
    return {
      ...window,
      window_start_ms: earliestTsMs,
    };
  }
  return window;
}
