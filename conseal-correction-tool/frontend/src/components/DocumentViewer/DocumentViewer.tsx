import React, { useRef, useLayoutEffect, useState } from "react";
import { PiiSpan } from "../../types/pii";
import { RedactionSpan } from "./RedactionSpan";
import { RapidActionBanner } from "../Nudges/RapidActionBanner";

interface Props {
  rawText: string;
  spans: PiiSpan[];
  onSpanClick: (span: PiiSpan) => void;
  onBoundaryAdjust: (spanId: string, newStart: number, newEnd: number) => void;
  highlightedSpanIds: Set<string>;
  rapidBurstSpanIds?: string[];
  onClearRapidBurst?: () => void;
}

export function DocumentViewer({
  rawText,
  spans,
  onSpanClick,
  onBoundaryAdjust,
  highlightedSpanIds,
  rapidBurstSpanIds = [],
  onClearRapidBurst,
}: Props): React.ReactElement {
  // Measure actual character width of the monospace font once on mount.
  // A hidden ruler span with "M" gives the true per-char px width so drag
  // delta → char delta conversion is accurate regardless of system font size.
  const rulerRef = useRef<HTMLSpanElement>(null);
  const [charWidth, setCharWidth] = useState(7.8); // sensible default until measured

  useLayoutEffect(() => {
    if (rulerRef.current) {
      // 10 chars → divide by 10 for sub-pixel accuracy
      setCharWidth(rulerRef.current.getBoundingClientRect().width / 10);
    }
  }, []);

  const segments = buildSegments(rawText, spans);
  const burstActive = rapidBurstSpanIds.length > 0;
  const burstSet = new Set(rapidBurstSpanIds);

  return (
    <>
      {/* Fixed velocity intercept banner — renders at viewport top when burst fires */}
      {burstActive && onClearRapidBurst && (
        <RapidActionBanner onDismiss={onClearRapidBurst} />
      )}

      <div className="relative font-sans text-lg leading-relaxed p-8 bg-white border border-slate-200 rounded-sm shadow-sm whitespace-pre-wrap break-words text-slate-900">
        {/* Hidden ruler — must match outer font exactly for drag calibration */}
        <span
          ref={rulerRef}
          aria-hidden
          className="absolute opacity-0 pointer-events-none font-sans text-lg"
          style={{ top: "-9999px", left: "-9999px" }}
        >
          {"M".repeat(10)}
        </span>

        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <React.Fragment key={i}>{seg.content}</React.Fragment>
          ) : (
            <RedactionSpan
              key={seg.span.id}
              span={seg.span}
              onClick={() => onSpanClick(seg.span)}
              highlighted={highlightedSpanIds.has(seg.span.id)}
              burstHighlighted={burstSet.has(seg.span.id)}
              onBoundaryAdjust={(newStart, newEnd) =>
                onBoundaryAdjust(seg.span.id, newStart, newEnd)
              }
              rawTextLength={rawText.length}
              charWidth={charWidth}
            />
          )
        )}
      </div>
    </>
  );
}

type Segment =
  | { type: "text"; content: string }
  | { type: "span"; span: PiiSpan };

/**
 * Character-pointer loop: walks rawText from 0 → length, emitting plain-text
 * fragments between spans and a span entry for each annotated range.
 * Overlapping spans are resolved by taking the leftmost; the rest are skipped.
 */
function buildSegments(rawText: string, spans: PiiSpan[]): Segment[] {
  const sorted = [...spans].sort((a, b) =>
    a.startOffset !== b.startOffset
      ? a.startOffset - b.startOffset
      : b.endOffset - a.endOffset // tie-break: longer span first
  );

  const segments: Segment[] = [];
  let pointer = 0;

  for (const span of sorted) {
    if (span.startOffset < pointer) continue; // overlap — skip
    const start = Math.max(0, span.startOffset);
    const end = Math.min(rawText.length, span.endOffset);
    if (start >= end) continue;

    if (start > pointer) {
      segments.push({ type: "text", content: rawText.slice(pointer, start) });
    }
    segments.push({ type: "span", span });
    pointer = end;
  }

  if (pointer < rawText.length) {
    segments.push({ type: "text", content: rawText.slice(pointer) });
  }

  return segments;
}
