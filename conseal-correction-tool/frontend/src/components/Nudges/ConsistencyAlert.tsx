import React from "react";
import { PiiSpan } from "../../types/pii";

interface Props {
  changedSpan: PiiSpan;
  inconsistentPeers: PiiSpan[];
  onFixAll: () => void;
  onDismiss: () => void;
  onHighlight: (ids: string[]) => void;
}

export function ConsistencyAlert({
  changedSpan,
  inconsistentPeers,
  onFixAll,
  onDismiss,
  onHighlight,
}: Props): React.ReactElement | null {
  if (inconsistentPeers.length === 0) return null;

  const count = inconsistentPeers.length;
  const action = changedSpan.status === "redacted" ? "redacted" : "left visible";

  function handleHighlight() {
    const ids = inconsistentPeers.map((p) => p.id);
    onHighlight(ids);
    // Scroll to first highlighted span
    const first = window.document.querySelector(`[data-span-id="${ids[0]}"]`);
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="flex items-start gap-3 bg-white border-2 border-slate-950 p-4 shadow-md">
      <span className="font-mono text-slate-500 text-xs uppercase tracking-widest flex-shrink-0 mt-0.5">
        ⬡
      </span>
      <div className="flex-1 space-y-2">
        <p className="font-mono text-xs font-bold text-slate-950 uppercase tracking-widest">
          Inconsistency Detected
        </p>
        <p className="font-mono text-xs text-slate-600">
          You {action}{" "}
          <span className="font-bold text-slate-950">"{changedSpan.text}"</span> — it appears{" "}
          {count} more {count === 1 ? "time" : "times"} with a different status.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleHighlight}
            className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 bg-slate-950 text-white hover:bg-slate-800 transition-colors"
          >
            highlight matches
          </button>
          <button
            onClick={onFixAll}
            className="font-mono text-xs text-slate-950 underline hover:text-slate-600 transition-colors"
          >
            apply to all →
          </button>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="font-mono text-slate-400 hover:text-slate-700 text-xs transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
