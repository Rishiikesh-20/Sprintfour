import { useRef, useCallback } from "react";

// Thresholds mirror backend config — kept here as frontend-only constants
const WINDOW_MS = 2000;
const ACTION_COUNT = 3;

export function useRapidActionDetector(onRapidBurst: (spanIds: string[]) => void) {
  const recentActions = useRef<Array<{ ts: number; spanId: string }>>([]);

  const recordAction = useCallback(
    (spanId: string) => {
      const now = Date.now();
      recentActions.current.push({ ts: now, spanId });

      // Trim to window
      recentActions.current = recentActions.current.filter(
        (a) => now - a.ts < WINDOW_MS
      );

      if (recentActions.current.length >= ACTION_COUNT) {
        const burstSpanIds = [...new Set(recentActions.current.map((a) => a.spanId))];
        // Clear so we don't re-fire on the next action in the same burst
        recentActions.current = [];
        onRapidBurst(burstSpanIds);
      }
    },
    [onRapidBurst]
  );

  return { recordAction };
}
