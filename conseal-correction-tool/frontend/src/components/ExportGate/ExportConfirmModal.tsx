import React, { useState } from "react";
import { DiffSummary } from "../../types/pii";
import { DiffSummary as DiffSummaryPanel } from "./DiffSummary";

interface Props {
  diff: DiffSummary | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ExportConfirmModal({
  diff,
  onConfirm,
  onClose,
}: Props): React.ReactElement | null {
  const [certified, setCertified] = useState(false);

  // Reset checkbox whenever the modal re-opens with a new diff
  React.useEffect(() => {
    if (diff) setCertified(false);
  }, [diff]);

  if (!diff) return null;

  const hasOpenRisks =
    diff.unresolvedHighRisk.length > 0 ||
    diff.pendingReviewCount > 0 ||
    diff.unresolvedInconsistencies.length > 0 ||
    diff.unresolvedPatternFlags > 0;

  return (
    // Backdrop — click outside to cancel
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-6 overflow-y-auto"
      onClick={onClose}
    >
      {/* Gate panel */}
      <div
        className="bg-white border-4 border-slate-950 p-8 shadow-xl max-w-3xl w-full mx-auto space-y-6 font-mono my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="space-y-1 border-b-2 border-slate-950 pb-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">Security Export Gate</p>
          <h2 className="font-bold text-slate-950 uppercase tracking-tight text-sm leading-snug">
            ▲ CRITICAL VERIFICATION RESUME: SECURITY COMPLIANCE GATE
          </h2>
        </div>

        {/* Metrics + detail lists */}
        <DiffSummaryPanel diff={diff} />

        {/* Open-risk callout — only when there are active issues */}
        {hasOpenRisks && (
          <div className="border-2 border-slate-950 p-4 space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-950">
              ▲ UNRESOLVED ITEMS DETECTED
            </p>
            <p className="text-xs text-slate-600">
              The document contains open risk signals. You may still export, but you must certify
              that you have reviewed each item and accept responsibility for the outcome.
            </p>
          </div>
        )}

        {/* Certification checkbox — the confirmation lock */}
        <label className="flex items-start gap-3 border border-slate-300 p-4 cursor-pointer hover:border-slate-500 transition-colors">
          <input
            type="checkbox"
            checked={certified}
            onChange={(e) => setCertified(e.target.checked)}
            className="mt-0.5 flex-shrink-0 accent-slate-950 w-4 h-4"
          />
          <span className="text-xs text-slate-700 leading-relaxed select-none">
            I certify that I have reviewed the unresolved anomalies and acknowledge responsibility
            for any unredacted leak vectors.
          </span>
        </label>

        {/* Action row */}
        <div className="flex gap-4 pt-2">
          <button
            onClick={onClose}
            className="flex-1 font-mono text-xs uppercase tracking-widest py-2.5 border border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-500 transition-colors"
          >
            ← RETURN TO REVIEW
          </button>

          <button
            disabled={!certified}
            onClick={certified ? onConfirm : undefined}
            className={`flex-1 font-mono text-xs uppercase tracking-widest py-2.5 font-bold transition-colors ${
              certified
                ? "bg-slate-950 text-white hover:bg-slate-800 cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
            aria-disabled={!certified}
          >
            DOWNLOAD COMPLIANT ASSET
          </button>
        </div>
      </div>
    </div>
  );
}
