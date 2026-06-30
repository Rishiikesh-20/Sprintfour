import React from "react";
import { DiffSummary as DiffSummaryType } from "../../types/pii";

interface Props {
  diff: DiffSummaryType;
}

export function DiffSummary({ diff }: Props): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Metrics grid — non-zero risk values invert to solid black */}
      <div className="grid grid-cols-3 gap-3">
        <MetricBox label="TOTAL SPANS"     value={diff.totalSpans}                         />
        <MetricBox label="MODIFIED"        value={diff.modifiedCount}                      />
        <MetricBox label="PENDING REVIEW"  value={diff.pendingReviewCount}  warn={diff.pendingReviewCount > 0}          />
        <MetricBox label="HIGH-RISK OPEN"  value={diff.unresolvedHighRisk.length}  warn={diff.unresolvedHighRisk.length > 0}  />
        <MetricBox label="INCONSISTENCIES" value={diff.unresolvedInconsistencies.length} warn={diff.unresolvedInconsistencies.length > 0} />
        <MetricBox label="PATTERN FLAGS"   value={diff.unresolvedPatternFlags}  warn={diff.unresolvedPatternFlags > 0}   />
      </div>

      {/* Detail lists — only rendered when there are items */}
      {diff.unresolvedHighRisk.length > 0 && (
        <UnresolvedList
          title="UNREDACTED HIGH-RISK ENTITIES"
          items={diff.unresolvedHighRisk.map((s) => `${s.type}: "${s.text}"`)}
        />
      )}

      {diff.unresolvedInconsistencies.length > 0 && (
        <UnresolvedList
          title="INCONSISTENT ENTITY GROUPS"
          items={diff.unresolvedInconsistencies.map(
            (s) => `${s.type}: "${s.text}"  [${s.status.replace("_", " ")}]`
          )}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricBox({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}): React.ReactElement {
  return warn ? (
    // Non-zero risk: inverted black block draws the eye immediately
    <div className="bg-slate-950 text-white p-2 text-center space-y-0.5">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs tracking-tight opacity-80">{label}</div>
    </div>
  ) : (
    // Zero / informational: subtle outline
    <div className="border border-slate-200 p-2 text-center space-y-0.5">
      <div className="text-xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs tracking-tight text-slate-400">{label}</div>
    </div>
  );
}

function UnresolvedList({
  title,
  items,
}: {
  title: string;
  items: string[];
}): React.ReactElement {
  return (
    <div className="border border-slate-300 p-4 space-y-2">
      <h3 className="text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-1">
        {title}
      </h3>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-slate-700 font-mono before:content-['▷_'] before:text-slate-400">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
