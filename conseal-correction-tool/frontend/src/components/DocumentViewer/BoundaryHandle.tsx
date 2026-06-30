import React, { useRef, useState } from "react";

interface Props {
  side: "left" | "right";
  currentOffset: number;
  minOffset: number;
  maxOffset: number;
  charWidth: number; // measured px width of one character in the viewer font
  onAdjust: (newOffset: number) => void;
}

/**
 * Thin grab bar sitting on the left or right edge of a highlighted span.
 *
 * Two interaction modes:
 *   Keyboard — click/focus, then ← → to shift the boundary by ±1 char.
 *              Each keypress is one undoable step (each calls onAdjust once).
 *   Drag     — pointer capture, accumulate px delta, commit one call on release.
 *              Only fires onAdjust if ≥1 char moved (prevents spurious history entries).
 */
export function BoundaryHandle({ side, currentOffset, minOffset, maxOffset, charWidth, onAdjust }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef({ startX: 0, startOffset: currentOffset });

  function clamp(v: number) {
    return Math.max(minOffset, Math.min(maxOffset, v));
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      onAdjust(clamp(currentOffset - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      onAdjust(clamp(currentOffset + 1));
    }
  }

  // ── Drag (pointer capture) ────────────────────────────────────────────────

  function handlePointerDown(e: React.PointerEvent<HTMLSpanElement>) {
    // Prevent the span's own onClick from firing
    e.stopPropagation();
    e.preventDefault();
    drag.current = { startX: e.clientX, startOffset: currentOffset };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLSpanElement>) {
    if (!isDragging) return;
    // Visual-only feedback: the bar shifts with the pointer.
    // Actual commit happens on release so there's only one history entry.
    e.stopPropagation();
  }

  function handlePointerUp(e: React.PointerEvent<HTMLSpanElement>) {
    if (!isDragging) return;
    setIsDragging(false);
    e.stopPropagation();

    const pixelDelta = e.clientX - drag.current.startX;
    const charDelta = Math.round(pixelDelta / charWidth);
    if (charDelta !== 0) {
      onAdjust(clamp(drag.current.startOffset + charDelta));
    }
  }

  // Dragging cursor offset for visual feedback during drag
  const dragStyle: React.CSSProperties = isDragging
    ? { transform: `translateX(${(currentOffset - drag.current.startOffset) * charWidth}px)` }
    : {};

  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label={`Adjust ${side} boundary (← → keys or drag)`}
      aria-valuenow={currentOffset}
      aria-valuemin={minOffset}
      aria-valuemax={maxOffset}
      style={dragStyle}
      className={[
        // Positioning — absolute on the edge of the parent (which must be relative)
        "absolute top-0 bottom-0 z-20 flex items-center justify-center",
        "w-4 touch-none select-none",
        side === "left" ? "-left-2" : "-right-2",

        // Visibility — hidden until group hover or keyboard focus
        "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-100",
        isDragging ? "opacity-100 cursor-grabbing" : "cursor-col-resize",
      ]
        .filter(Boolean)
        .join(" ")}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* The visible grab bar */}
      <span
        className={[
          "block w-0.5 rounded-full transition-all duration-100",
          isDragging ? "h-5 bg-slate-700 w-1" : "h-3.5 bg-slate-400 group-hover:bg-slate-700",
        ].join(" ")}
      />
    </span>
  );
}
