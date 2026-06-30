import React from "react";
import { PiiSpan, RiskTier, SpanStatus } from "../../types/pii";
import { BoundaryHandle } from "./BoundaryHandle";

interface Props {
  span: PiiSpan;
  onClick: () => void;
  highlighted: boolean;
  burstHighlighted: boolean;
  onBoundaryAdjust: (newStart: number, newEnd: number) => void;
  rawTextLength: number;
  charWidth: number;
}

export function RedactionSpan({
  span,
  onClick,
  highlighted,
  burstHighlighted,
  onBoundaryAdjust,
  rawTextLength,
  charWidth,
}: Props): React.ReactElement {
  const { status, riskTier, type, confidence, patternFlagged, startOffset, endOffset } = span;

  const showHandles = status === "visible" || status === "pending_review";

  const tooltip = `${type} · ${Math.round(confidence * 100)}% confidence${patternFlagged ? " · pattern-flagged" : ""}`;

  return (
    <span
      className={[
        // Base — group enables handle visibility on hover
        "group relative inline-block cursor-pointer transition-all duration-100",
        // Consistency engine / manual highlight: slate pulse animation
        highlighted ? "ring-2 ring-slate-950 ring-offset-1 span-pulse" : "",
        // Rapid-action burst: reviewer moved too fast — soft pulsing ring prompts re-check
        burstHighlighted && !highlighted
          ? "ring-2 ring-offset-2 ring-slate-950 duration-500 animate-pulse"
          : "",
        // Pattern-flagged extra ring (model missed it, pattern matcher caught it)
        patternFlagged && !highlighted && !burstHighlighted
          ? "ring-2 ring-slate-950 ring-offset-1"
          : "",
        // Wrapper-level animation for pending high/medium
        pendingWrapperClass(status, riskTier),
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      title={tooltip}
      role="button"
      aria-label={`${status === "redacted" ? "Redacted" : "Visible"} ${type}: ${span.text}`}
      data-span-id={span.id}
    >
      {showHandles && (
        <BoundaryHandle
          side="left"
          currentOffset={startOffset}
          minOffset={0}
          maxOffset={endOffset - 1}
          charWidth={charWidth}
          onAdjust={(v) => onBoundaryAdjust(v, endOffset)}
        />
      )}

      <SpanContent status={status} riskTier={riskTier} type={type} text={span.text} />

      {showHandles && (
        <BoundaryHandle
          side="right"
          currentOffset={endOffset}
          minOffset={startOffset + 1}
          maxOffset={rawTextLength}
          charWidth={charWidth}
          onAdjust={(v) => onBoundaryAdjust(startOffset, v)}
        />
      )}
    </span>
  );
}

// ── Content switcher ──────────────────────────────────────────────────────────

function SpanContent({
  status,
  riskTier,
  type,
  text,
}: {
  status: SpanStatus;
  riskTier: RiskTier;
  type: string;
  text: string;
}) {
  if (status === "redacted") return <RedactedBlock riskTier={riskTier} type={type} />;
  if (status === "pending_review") return <PendingSpan riskTier={riskTier} text={text} />;
  return <VisibleSpan riskTier={riskTier} text={text} />;
}

// ── Redacted block ────────────────────────────────────────────────────────────

function RedactedBlock({ riskTier, type }: { riskTier: RiskTier; type: string }) {
  const label = riskTier === "high" ? `[!!! ${type}]` : `[${type}]`;

  return (
    <span
      className={[
        "inline-flex items-center px-1.5 py-0 font-mono text-xs font-bold tracking-tight select-none",
        redactedClass(riskTier),
      ].join(" ")}
    >
      {label}
    </span>
  );
}

// ── Visible highlight ─────────────────────────────────────────────────────────

function VisibleSpan({ riskTier, text }: { riskTier: RiskTier; text: string }) {
  return (
    <span className={visibleClass(riskTier)}>{text}</span>
  );
}

// ── Pending review ────────────────────────────────────────────────────────────

function PendingSpan({ riskTier, text }: { riskTier: RiskTier; text: string }) {
  return (
    <span className={pendingClass(riskTier)}>{text}</span>
  );
}

// ── Style tables — monochrome precision ───────────────────────────────────────

function pendingWrapperClass(status: SpanStatus, risk: RiskTier): string {
  if (status !== "pending_review") return "";
  // High and medium pulse at wrapper level; low is subtle
  return risk !== "low" ? "animate-pulse" : "";
}

function visibleClass(risk: RiskTier): string {
  return {
    // HIGH — stark high-contrast: near-black background, white text
    high: "bg-slate-950 text-white font-mono px-1 rounded-xs border border-slate-950",
    // MEDIUM — charcoal highlight
    medium: "bg-slate-800 text-slate-100 px-1 border border-slate-600 rounded-xs",
    // LOW — minimal dotted outline only, no intense fill
    low: "border border-dashed border-slate-400 bg-slate-50 text-slate-800 px-1 rounded-xs",
  }[risk];
}

function pendingClass(risk: RiskTier): string {
  return {
    // HIGH — near-black background, white, dashed border
    high: "bg-slate-900 text-slate-100 font-mono border-2 border-dashed border-slate-950",
    // MEDIUM — light background, dark text, dark dashed border
    medium: "bg-slate-100 text-slate-800 border-2 border-dashed border-slate-600",
    // LOW — near-white, subtle dotted border
    low: "border border-dotted border-slate-400 bg-slate-50 text-slate-500",
  }[risk];
}

function redactedClass(risk: RiskTier): string {
  return {
    // HIGH — pitch-black block, white label
    high: "bg-slate-950 text-white",
    // MEDIUM — charcoal block, light gray label
    medium: "bg-slate-800 text-slate-200",
    // LOW — matte gray block, white label
    low: "bg-slate-400 text-white",
  }[risk];
}
