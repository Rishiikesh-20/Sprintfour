import React from "react";
import { AuditEntry, AuditAction, PiiSpan, PiiType } from "../../types/pii";
import { useConsealStore } from "../../state/store";

interface Props {
  onRefresh: () => void;
}

export function AuditTimeline({ onRefresh }: Props): React.ReactElement {
  const auditLog = useConsealStore((s) => s.auditLog);
  const spans = useConsealStore((s) => s.spans);

  return (
    <div className="flex flex-col flex-1 overflow-hidden border-t border-slate-200">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <h3 className="font-mono tracking-tight text-slate-900 text-xs uppercase">
          Audit Log
        </h3>
        <button
          onClick={onRefresh}
          className="font-mono text-slate-400 hover:text-slate-700 text-xs transition-colors"
          title="Refresh"
          aria-label="Refresh audit log"
        >
          ↻
        </button>
      </div>

      {/* Scrollable timeline */}
      <div className="overflow-y-auto flex-1 px-4 pb-4">
        {auditLog.length === 0 ? (
          <p className="font-mono text-slate-400 text-xs">No actions recorded.</p>
        ) : (
          <div className="border-l border-slate-200 ml-2 pl-4 space-y-4 text-xs font-mono">
            {auditLog.map((entry) => (
              <AuditRow key={entry.id} entry={entry} spans={spans} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────

function AuditRow({
  entry,
  spans,
}: {
  entry: AuditEntry;
  spans: PiiSpan[];
}): React.ReactElement {
  const span = spans.find((s) => s.id === entry.spanId);
  // Deleted spans carry their metadata in previousState; live spans are found above
  const spanType: PiiType | undefined =
    span?.type ?? (entry.previousState as Partial<PiiSpan> | null)?.type;

  const label = actionLabel(entry.action, spanType);
  const { text: velocityText, reckless } = formatVelocity(entry.msSincePreviousAction);

  return (
    <div className="space-y-0.5">
      {/* Action label — inverted (black bg / white text) when reckless */}
      <div
        className={
          reckless
            ? "inline-block bg-slate-950 text-white px-1 py-px"
            : "text-slate-700"
        }
      >
        {label}
      </div>

      {/* Velocity — bold black when reckless, muted otherwise */}
      <div
        className={
          reckless
            ? "text-slate-950 font-bold tracking-tight"
            : "text-slate-400"
        }
      >
        {velocityText}
        {reckless && (
          <span className="ml-1 text-slate-500 font-normal" title="Action under 500ms">
            ◄
          </span>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function actionLabel(action: AuditAction, type: PiiType | undefined): string {
  const t = type ?? "?";
  switch (action) {
    case "toggled_redacted":  return `■ ${t} REDACTED`;
    case "toggled_visible":   return `▷ ${t} REVEALED`;
    case "boundary_adjusted": return `◊ BOUNDARY ADJUSTED`;
    case "added":             return `＋ ${t} ADDED`;
    case "removed":           return `✕ ${t} REMOVED`;
    case "undo":              return `↩ UNDO`;
    case "redo":              return `↪ REDO`;
    default:                  return (action as string).toUpperCase();
  }
}

function formatVelocity(ms: number | null): { text: string; reckless: boolean } {
  if (ms === null) return { text: "–", reckless: false };
  const reckless = ms < 500;
  const text =
    ms < 1000
      ? `[+${ms}ms]`
      : `[+${(ms / 1000).toFixed(1)}s]`;
  return { text, reckless };
}
