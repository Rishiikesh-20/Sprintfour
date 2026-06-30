import { Router, Request, Response } from "express";
import { getDb } from "../db/client";
import { getDocument, updateDocumentStatus } from "../models/document";
import { getSpansByDocument } from "../models/span";
import { groupByEntity } from "../services/consistencyEngine";
import { PiiSpan, DiffSummary } from "../types/pii";

const router = Router({ mergeParams: true });

// High-risk types that must never be left visible — the core safety gate
const CRITICAL_TYPES = new Set(["PHONE", "EMAIL", "SSN"]);

// GET /api/documents/:id/diff — pre-export safety audit
router.get("/diff", (req: Request, res: Response) => {
  const { id: documentId } = req.params as { id: string };

  const doc = getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Document not found" } });
    return;
  }

  const db = getDb();
  const allSpans = getSpansByDocument(documentId);

  // 1. modifiedCount: user changed the source or altered the model's initial decision
  const modifiedRow = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM spans WHERE document_id = ? AND (source != 'model' OR status != original_status)"
    )
    .get(documentId) as { cnt: number };
  const modifiedCount = modifiedRow.cnt;

  // 2. pendingReviewCount: spans the model flagged that Sam never explicitly decided on
  const pendingReviewCount = allSpans.filter((s) => s.status === "pending_review").length;

  // 3. unresolvedHighRisk: PHONE / EMAIL / SSN still left visible — direct leak vectors
  const unresolvedHighRisk = allSpans
    .filter((s) => CRITICAL_TYPES.has(s.type) && s.status === "visible")
    .map((s) => ({ spanId: s.id, text: s.text, type: s.type }));

  // 4. unresolvedInconsistencies: entities whose occurrences disagree on redaction status
  const groups = groupByEntity(allSpans);
  const inconsistentIds = new Set(
    groups.filter((g) => g.inconsistent).flatMap((g) => g.spanIds)
  );
  const unresolvedInconsistencies = allSpans
    .filter((s) => inconsistentIds.has(s.id))
    .map((s) => ({ spanId: s.id, text: s.text, type: s.type, status: s.status }));

  // 5. unresolvedPatternFlags: pattern-caught spans still sitting at pending_review
  const unresolvedPatternFlags = allSpans.filter(
    (s) => s.patternFlagged && s.status === "pending_review"
  ).length;

  const diff: DiffSummary = {
    totalSpans: allSpans.length,
    modifiedCount,
    pendingReviewCount,
    unresolvedHighRisk,
    unresolvedInconsistencies,
    unresolvedPatternFlags,
  };

  res.json({ diff });
});

// POST /api/documents/:id/export — lock document and produce clean redacted text
router.post("/export", (req: Request, res: Response) => {
  const { id: documentId } = req.params as { id: string };

  const doc = getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Document not found" } });
    return;
  }

  const allSpans = getSpansByDocument(documentId);
  const redactedText = buildRedactedText(doc.rawText, allSpans);

  const exportedAt = new Date().toISOString();
  updateDocumentStatus(documentId, "exported", exportedAt);

  res.json({ redactedText, exportedAt });
});

// Walk rawText with a character pointer, replacing redacted spans with [REDACTED:TYPE] tokens.
// Overlapping spans: first (leftmost) wins, matching the DocumentViewer's buildSegments logic.
function buildRedactedText(rawText: string, spans: PiiSpan[]): string {
  const sorted = [...spans]
    .filter((s) => s.status === "redacted")
    .sort((a, b) =>
      a.startOffset !== b.startOffset
        ? a.startOffset - b.startOffset
        : b.endOffset - a.endOffset // tie-break: longer span first
    );

  let result = "";
  let pointer = 0;

  for (const span of sorted) {
    if (span.startOffset < pointer) continue; // overlap — skip
    result += rawText.slice(pointer, span.startOffset);
    result += `[REDACTED:${span.type}]`;
    pointer = span.endOffset;
  }

  result += rawText.slice(pointer);
  return result;
}

export default router;
