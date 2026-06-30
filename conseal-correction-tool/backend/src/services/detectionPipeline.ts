import { getDb } from "../db/client";
import { getDocument, updateDocumentStatus, getPreloadedDetections } from "../models/document";
import { insertSpan, getSpansByDocument } from "../models/span";
import { writeAuditEntry } from "./auditLogService";
import { detectPii } from "./llmDetectionService";
import { scanForMissedPatterns } from "./patternMatcher";
import { baseRisk, applyProximityBumps } from "./riskClassifier";
import { PiiSpan, SpanStatus } from "../types/pii";
import { ParsedAnnotation } from "../utils/parseAnnotatedText";

export interface DetectionResult {
  spans: PiiSpan[];
}

/**
 * Full detection pipeline:
 * 1. Fetch document text
 * 2. Run LLM detection (Gemini or mock fallback)
 * 3. Classify risk tiers
 * 4. Persist spans to DB
 * 5. Write audit entries
 * 6. Apply proximity bumps and update if needed
 * 7. Mark document as "reviewing"
 */
export async function runDetectionPipeline(
  documentId: string,
  preloaded?: ParsedAnnotation[]
): Promise<DetectionResult> {
  const doc = getDocument(documentId);
  if (!doc) {
    throw Object.assign(new Error("Document not found"), { code: "NOT_FOUND", status: 404 });
  }

  // Clear any existing spans for idempotent re-detection
  const db = getDb();
  db.prepare("DELETE FROM spans WHERE document_id = ?").run(documentId);

  // Use pre-parsed annotations if provided via API, or fall back to DB-stored ones
  // (set at upload time from [[text|type]] format), otherwise call the LLM
  const storedAnnotations = (!preloaded || preloaded.length === 0)
    ? (getPreloadedDetections(documentId) as ParsedAnnotation[] | null)
    : null;
  const source = preloaded && preloaded.length > 0 ? preloaded : storedAnnotations;
  const rawDetections = source && source.length > 0
    ? source
    : await detectPii(doc.rawText);

  // Insert all spans with initial pending_review status
  const insertedSpans: PiiSpan[] = rawDetections.map((det) => {
    const initialStatus: SpanStatus = "pending_review";
    return insertSpan({
      documentId,
      text: det.text,
      type: det.type,
      startOffset: det.startOffset,
      endOffset: det.endOffset,
      confidence: det.confidence,
      status: initialStatus,
      riskTier: baseRisk(det.type),
      source: "model",
      relatedSpanIds: [],
      patternFlagged: false,
      originalStatus: initialStatus,
    });
  });

  // Pattern matcher: find missed PII the model didn't flag
  const patternDetections = scanForMissedPatterns(doc.rawText, insertedSpans);
  for (const det of patternDetections) {
    const initialStatus: SpanStatus = "pending_review";
    const patternSpan = insertSpan({
      documentId,
      text: det.text,
      type: det.type,
      startOffset: det.startOffset,
      endOffset: det.endOffset,
      confidence: det.confidence,
      status: initialStatus,
      riskTier: baseRisk(det.type),
      source: "model",
      relatedSpanIds: [],
      patternFlagged: true,
      originalStatus: initialStatus,
    });
    insertedSpans.push(patternSpan);
  }

  // Apply proximity bumps and persist any risk tier changes
  const bumped = applyProximityBumps(insertedSpans);
  for (const span of bumped) {
    const original = insertedSpans.find((s) => s.id === span.id);
    if (original && original.riskTier !== span.riskTier) {
      db.prepare("UPDATE spans SET risk_tier = ? WHERE id = ?").run(span.riskTier, span.id);
    }
  }

  // Write one audit entry per span recording the model's initial suggestion
  for (const span of bumped) {
    writeAuditEntry({ documentId, spanId: span.id, action: "added", previousState: null });
  }

  // Mark document as ready for review
  updateDocumentStatus(documentId, "reviewing");

  // Return final spans from DB so IDs and risk tiers are authoritative
  const finalSpans = getSpansByDocument(documentId);
  return { spans: finalSpans };
}
