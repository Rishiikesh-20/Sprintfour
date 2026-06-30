import React from "react";
import { PiiSpan } from "../../types/pii";

interface Props {
  spans: PiiSpan[];
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
}

export function StatsPanel({ spans, onUndo, onRedo, canUndo, canRedo, onExport }: Props): React.ReactElement {
  const exposedHighRisk = spans.filter(
    (s) => s.riskTier === "high" && s.status !== "redacted"
  ).length;

  const cleanRedactions = spans.filter((s) => s.status === "redacted").length;
  const pendingReview = spans.filter((s) => s.status === "pending_review").length;
  const total = spans.length;
  const progress = total === 0 ? 0 : Math.round((cleanRedactions / total) * 100);

  return (
    <div className="p-4 space-y-5 flex-shrink-0">
      <h2 className="font-mono tracking-tight text-slate-900 text-xs uppercase border-b border-slate-200 pb-2">
        Review Status
      </h2>

      {/* Redaction progress bar */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs text-slate-400">
            <span>Redacted</span>
            <span className="text-slate-700 font-semibold">{progress}%</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-none overflow-hidden">
            <div
              className="h-full bg-slate-950 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Three key stats */}
      <div className="space-y-2.5">
        <StatRow
          label="Exposed high-risk"
          value={exposedHighRisk}
          urgency={exposedHighRisk > 0 ? "critical" : "clear"}
        />
        <StatRow
          label="Clean redactions"
          value={cleanRedactions}
          urgency="neutral"
        />
        <StatRow
          label="Pending review"
          value={pendingReview}
          urgency={pendingReview > 0 ? "warn" : "clear"}
        />
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-2">
        <div className="flex gap-1.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            className="flex-1 font-mono text-xs py-1.5 border border-slate-200 text-slate-500 disabled:opacity-25 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-colors"
          >
            ↩ undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            className="flex-1 font-mono text-xs py-1.5 border border-slate-200 text-slate-500 disabled:opacity-25 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-colors"
          >
            ↪ redo
          </button>
        </div>

        <button
          onClick={onExport}
          disabled={total === 0}
          className="w-full py-2 font-mono text-xs font-bold tracking-widest uppercase bg-slate-950 text-white disabled:opacity-30 hover:bg-slate-800 transition-colors"
        >
          export →
        </button>
      </div>
    </div>
  );
}

type Urgency = "critical" | "warn" | "clear" | "neutral";

function StatRow({ label, value, urgency }: { label: string; value: number; urgency: Urgency }) {
  // Monochrome indicator squares — no color, only fill weight signals severity
  const indicator: Record<Urgency, React.ReactElement> = {
    critical: (
      // Solid black square — high risk exposed
      <span className="inline-block w-2.5 h-2.5 bg-slate-950 flex-shrink-0" title="Critical" />
    ),
    warn: (
      // Charcoal square — pending items need attention
      <span className="inline-block w-2.5 h-2.5 bg-slate-600 flex-shrink-0" title="Warning" />
    ),
    clear: (
      // Dotted outline — all clear
      <span className="inline-block w-2.5 h-2.5 border-2 border-dotted border-slate-300 flex-shrink-0" title="Clear" />
    ),
    neutral: (
      // Solid medium gray — informational
      <span className="inline-block w-2.5 h-2.5 bg-slate-300 flex-shrink-0" title="Count" />
    ),
  };

  const valueClass: Record<Urgency, string> = {
    critical: value > 0 ? "text-slate-950 font-bold" : "text-slate-400",
    warn: value > 0 ? "text-slate-700 font-semibold" : "text-slate-400",
    clear: "text-slate-400",
    neutral: "text-slate-700 font-semibold",
  };

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-2 text-slate-500 font-mono">
        {indicator[urgency]}
        {label}
      </span>
      <span className={`font-mono tabular-nums ${valueClass[urgency]}`}>{value}</span>
    </div>
  );
}
