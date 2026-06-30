import React from "react";
import { useConsealStore } from "./state/store";
import { useCorrectionHistory } from "./hooks/useCorrectionHistory";
import { useRapidActionDetector } from "./hooks/useRapidActionDetector";
import { DocumentViewer } from "./components/DocumentViewer/DocumentViewer";
import { StatsPanel } from "./components/Sidebar/StatsPanel";
import { RiskLegend } from "./components/Sidebar/RiskLegend";
import { AuditTimeline } from "./components/Sidebar/AuditTimeline";
import { ConsistencyAlert } from "./components/Nudges/ConsistencyAlert";
import { ExportConfirmModal } from "./components/ExportGate/ExportConfirmModal";
import { PiiSpan, SpanStatus, DiffSummary } from "./types/pii";
import { api } from "./api/client";

export default function App(): React.ReactElement {
  const document = useConsealStore((s) => s.document);
  const spans = useConsealStore((s) => s.spans);
  const highlightedSpanIds = useConsealStore((s) => s.highlightedSpanIds);
  const rapidBurstSpanIds = useConsealStore((s) => s.rapidBurstSpanIds);
  const setDocument = useConsealStore((s) => s.setDocument);
  const setSpans = useConsealStore((s) => s.setSpans);
  const updateSpan = useConsealStore((s) => s.updateSpan);
  const setHighlightedSpanIds = useConsealStore((s) => s.setHighlightedSpanIds);
  const setRapidBurstSpanIds = useConsealStore((s) => s.setRapidBurstSpanIds);
  const clearRapidBurst = useConsealStore((s) => s.clearRapidBurst);
  const setAuditLog = useConsealStore((s) => s.setAuditLog);
  const [consistencyState, setConsistencyState] = React.useState<{
    changedSpan: PiiSpan;
    peers: PiiSpan[];
  } | null>(null);
  const [exportDiff, setExportDiff] = React.useState<DiffSummary | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [detecting, setDetecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fire-and-forget refresh of the audit log after any mutation
  function refreshAuditLog() {
    if (!document) return;
    api.getAuditLog(document.id).then(({ auditLog }) => setAuditLog(auditLog)).catch(() => {});
  }

  const { undo, redo, canUndo, canRedo } = useCorrectionHistory({
    onUndo: () => {
      if (document) {
        api.logUndoRedo(document.id, "undo").catch(() => {});
        refreshAuditLog();
      }
    },
    onRedo: () => {
      if (document) {
        api.logUndoRedo(document.id, "redo").catch(() => {});
        refreshAuditLog();
      }
    },
  });

  const { recordAction } = useRapidActionDetector((burstIds) => {
    setRapidBurstSpanIds(burstIds);
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const rawText = await file.text();
      const { document: doc, isAnnotated, preloadedAnnotations } = await api.createDocument(file.name, rawText);
      setDocument(doc);

      // If the file already had [[text|type]] annotations, auto-run detection
      // using the pre-parsed spans (no LLM call needed — offsets are exact)
      if (isAnnotated && preloadedAnnotations) {
        setDetecting(true);
        try {
          const { spans: detected } = await api.detect(doc.id, preloadedAnnotations);
          setSpans(detected);
          refreshAuditLog();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Detection failed");
        } finally {
          setDetecting(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDetect() {
    if (!document) return;
    setDetecting(true);
    setError(null);
    try {
      const { spans: detected } = await api.detect(document.id);
      setSpans(detected);
      refreshAuditLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function handleSpanClick(span: PiiSpan) {
    if (!document) return;

    // Determine next status: pending_review → redacted, redacted ↔ visible
    const nextStatus: SpanStatus =
      span.status === "redacted" ? "visible" :
      span.status === "visible"  ? "redacted" :
      "redacted"; // pending_review → redacted (first explicit decision)

    // 1. Optimistic update — UI responds instantly
    const optimistic: PiiSpan = { ...span, status: nextStatus };
    const description = `${nextStatus === "redacted" ? "Redacted" : "Revealed"} ${span.type} "${span.text.slice(0, 20)}"`;
    updateSpan(optimistic, description);

    // 2. Record for rapid-action heuristic
    recordAction(span.id);

    // 3. Persist to backend (non-blocking, rollback on failure)
    try {
      const { span: confirmed, inconsistentPeers, elevatedSpans } = await api.patchSpan(
        document.id,
        span.id,
        { status: nextStatus }
      );
      // Reconcile with server truth (confidence, relatedSpanIds, etc. may have changed)
      updateSpan(confirmed, description);

      // Apply any proximity-driven risk tier elevations to other spans
      for (const elevated of elevatedSpans ?? []) {
        updateSpan(elevated, `Risk tier elevated to ${elevated.riskTier} by proximity`);
      }

      // Surface consistency alert if related spans have differing statuses
      if (inconsistentPeers.length > 0) {
        setConsistencyState({ changedSpan: confirmed, peers: inconsistentPeers });
      }

      refreshAuditLog();
    } catch (err) {
      // Rollback on network failure — restore original
      updateSpan(span, "Rollback after network error");
      setError(err instanceof Error ? err.message : "Toggle failed");
    }
  }

  async function handleBoundaryAdjust(spanId: string, newStart: number, newEnd: number) {
    if (!document) return;

    const span = spans.find((s) => s.id === spanId);
    if (!span) return;

    // Extract fresh text slice from the document we already have in state
    const newText = document.rawText.slice(newStart, newEnd);
    if (!newText) return; // degenerate — offsets collapsed

    // 1. Optimistic update with history snapshot (enables ⌘Z rollback)
    const optimistic: PiiSpan = {
      ...span,
      startOffset: newStart,
      endOffset: newEnd,
      text: newText,
      source: "user_modified",
    };
    const description = `Boundary adjusted: "${span.text}" → "${newText}"`;
    updateSpan(optimistic, description);

    // 2. Persist; rollback to original on failure
    try {
      const { span: confirmed } = await api.patchSpan(document.id, spanId, {
        startOffset: newStart,
        endOffset: newEnd,
      } as Partial<PiiSpan>);
      // Reconcile with server truth (source field, updatedAt, etc.)
      updateSpan(confirmed, description);
      refreshAuditLog();
    } catch (err) {
      updateSpan(span, "Rollback boundary adjustment");
      setError(err instanceof Error ? err.message : "Boundary adjustment failed");
    }
  }

  async function handleFixAllConsistency() {
    if (!consistencyState || !document) return;
    const { changedSpan, peers } = consistencyState;
    setConsistencyState(null);
    for (const peer of peers) {
      try {
        const { span: updated } = await api.patchSpan(document.id, peer.id, {
          status: changedSpan.status,
        });
        updateSpan(updated, `Consistency fix: ${changedSpan.status} "${peer.text.slice(0, 20)}"`);
      } catch {
        // Best-effort; individual failures don't block the rest
      }
    }
  }

  async function handleExport() {
    if (!document) return;
    setError(null);
    try {
      const { diff } = await api.getDiff(document.id);
      setExportDiff(diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export prep failed");
    }
  }

  async function handleConfirmExport() {
    if (!document) return;
    try {
      const { redactedText } = await api.exportDocument(document.id);
      const blob = new Blob([redactedText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `redacted-${document.filename}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDiff(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <h1 className="font-mono font-bold text-slate-950 tracking-tight uppercase text-sm">
          Conseal
        </h1>
        {document && (
          <span className="text-slate-400 text-xs font-mono border-l border-slate-200 pl-4">
            {document.filename}
          </span>
        )}
        {error && (
          <span className="ml-auto text-xs font-mono text-slate-700 bg-slate-100 border border-slate-300 px-2 py-1">
            ⚠ {error}
            <button className="ml-2 opacity-50 hover:opacity-100" onClick={() => setError(null)}>✕</button>
          </span>
        )}
      </header>

      {/* Consistency nudge banner — inline, contextual */}
      {consistencyState && (
        <div className="px-6 pt-3">
          <ConsistencyAlert
            changedSpan={consistencyState.changedSpan}
            inconsistentPeers={consistencyState.peers}
            onFixAll={handleFixAllConsistency}
            onDismiss={() => setConsistencyState(null)}
            onHighlight={(ids) => setHighlightedSpanIds(ids)}
          />
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document area */}
        <main className="flex-1 p-6 overflow-auto">
          {!document ? (
            <UploadPrompt uploading={uploading} onUpload={handleFileUpload} />
          ) : spans.length === 0 ? (
            <PreDetectionView
              document={document}
              detecting={detecting}
              onDetect={handleDetect}
            />
          ) : (
            <DocumentViewer
              rawText={document.rawText}
              spans={spans}
              onSpanClick={handleSpanClick}
              onBoundaryAdjust={handleBoundaryAdjust}
              highlightedSpanIds={highlightedSpanIds}
              rapidBurstSpanIds={rapidBurstSpanIds}
              onClearRapidBurst={clearRapidBurst}
            />
          )}
        </main>

        {/* Sidebar */}
        <aside className="w-64 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-hidden">
          <StatsPanel
            spans={spans}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onExport={handleExport}
          />
          <RiskLegend />
          <AuditTimeline onRefresh={refreshAuditLog} />
        </aside>
      </div>

      <ExportConfirmModal
        diff={exportDiff}
        onConfirm={handleConfirmExport}
        onClose={() => setExportDiff(null)}
      />
    </div>
  );
}

// --- Sub-views extracted to keep App readable ---

function UploadPrompt({
  uploading,
  onUpload,
}: {
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
      <div className="w-14 h-14 border-2 border-slate-300 flex items-center justify-center select-none">
        <span className="font-mono text-slate-400 text-xs uppercase tracking-widest">doc</span>
      </div>
      <div>
        <p className="font-mono text-slate-800 text-sm uppercase tracking-widest">Upload a document</p>
        <p className="font-mono text-slate-400 text-xs mt-1">Plain text (.txt)</p>
      </div>
      <label className="cursor-pointer px-6 py-2 bg-slate-950 text-white font-mono text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors">
        {uploading ? "uploading…" : "choose file"}
        <input type="file" accept=".txt" className="hidden" onChange={onUpload} />
      </label>
    </div>
  );
}

function PreDetectionView({
  document,
  detecting,
  onDetect,
}: {
  document: { filename: string; rawText: string };
  detecting: boolean;
  onDetect: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">{document.filename}</span>
        <button
          onClick={onDetect}
          disabled={detecting}
          className="px-4 py-1.5 font-mono text-xs uppercase tracking-widest bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
        >
          {detecting ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              detecting…
            </span>
          ) : (
            "run pii detection"
          )}
        </button>
      </div>
      <div className="font-sans text-lg leading-relaxed p-8 bg-white border border-slate-200 whitespace-pre-wrap text-slate-700 shadow-sm">
        {document.rawText}
      </div>
    </div>
  );
}
