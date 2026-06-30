import { Router, Request, Response } from "express";
import { getSpan, updateSpan, insertSpan, deleteSpan, getSpansByDocument } from "../models/span";
import { getDocument } from "../models/document";
import { writeAuditEntry } from "../services/auditLogService";
import { findInconsistentPeers } from "../services/consistencyEngine";
import { SpanStatus, AuditAction, PiiType, PiiSpan } from "../types/pii";
import { baseRisk, applyProximityBumps } from "../services/riskClassifier";
import { validateAndExtractBoundary } from "../utils/textOffsets";

const router = Router({ mergeParams: true });

// PATCH /api/documents/:id/spans/:spanId — toggle status or adjust boundary
router.patch("/:spanId", (req: Request, res: Response) => {
  const { id: documentId, spanId } = req.params as { id: string; spanId: string };
  const body = req.body as Partial<{
    status: SpanStatus;
    startOffset: number;
    endOffset: number;
  }>;

  const existing = getSpan(spanId);
  if (!existing || existing.documentId !== documentId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Span not found" } });
    return;
  }

  // Build the updates object; boundary changes need re-extraction from rawText
  const updates: Parameters<typeof updateSpan>[1] = {};

  const isBoundaryChange =
    (body.startOffset !== undefined && body.startOffset !== existing.startOffset) ||
    (body.endOffset !== undefined && body.endOffset !== existing.endOffset);

  if (isBoundaryChange) {
    const doc = getDocument(documentId);
    if (!doc) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Document not found" } });
      return;
    }

    const newStart = body.startOffset ?? existing.startOffset;
    const newEnd = body.endOffset ?? existing.endOffset;

    let extracted: { text: string };
    try {
      extracted = validateAndExtractBoundary(doc.rawText, newStart, newEnd);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      res.status(400).json({ error: { code: e.code ?? "INVALID_BOUNDARY", message: e.message ?? "Invalid boundary" } });
      return;
    }

    updates.startOffset = newStart;
    updates.endOffset = newEnd;
    updates.text = extracted.text;
    updates.source = "user_modified";
  }

  if (body.status !== undefined) {
    updates.status = body.status;
  }

  // Determine audit action
  let action: AuditAction = "boundary_adjusted";
  if ("status" in updates && updates.status !== existing.status) {
    action = updates.status === "redacted" ? "toggled_redacted" : "toggled_visible";
  }

  const previousState = {
    status: existing.status,
    startOffset: existing.startOffset,
    endOffset: existing.endOffset,
    text: existing.text,
  };

  const updated = updateSpan(spanId, updates);
  if (!updated) {
    res.status(500).json({ error: { code: "UPDATE_FAILED", message: "Failed to update span" } });
    return;
  }

  // msSincePreviousAction is now computed inside writeAuditEntry
  writeAuditEntry({ documentId, spanId, action, previousState });

  const isStatusChange = "status" in updates && updates.status !== existing.status;

  // Fetch all document spans once — used for both consistency and proximity checks
  const allSpans = isStatusChange ? getSpansByDocument(documentId) : [];

  const inconsistentPeers: PiiSpan[] = isStatusChange
    ? findInconsistentPeers(updated, allSpans)
    : [];

  // Re-run proximity bumps after any status change: revealing a high-risk span
  // may push adjacent NAME spans from "medium" → "high" in real time.
  const elevatedSpans: PiiSpan[] = [];
  if (isStatusChange) {
    const bumped = applyProximityBumps(allSpans);
    for (const bumpedSpan of bumped) {
      const original = allSpans.find((s) => s.id === bumpedSpan.id);
      if (original && original.riskTier !== bumpedSpan.riskTier) {
        const persisted = updateSpan(bumpedSpan.id, { riskTier: bumpedSpan.riskTier });
        if (persisted) elevatedSpans.push(persisted);
      }
    }
  }

  res.json({ span: updated, inconsistentPeers, elevatedSpans });
});

// POST /api/documents/:id/spans — manually add a span Sam noticed himself
router.post("/", (req: Request, res: Response) => {
  const { id: documentId } = req.params as { id: string };
  const body = req.body as {
    text?: string;
    type?: PiiType;
    startOffset?: number;
    endOffset?: number;
    confidence?: number;
  };

  if (!body.text || !body.type || body.startOffset == null || body.endOffset == null) {
    res.status(400).json({ error: { code: "MISSING_FIELDS", message: "text, type, startOffset, endOffset are required" } });
    return;
  }

  const doc = getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Document not found" } });
    return;
  }

  const span = insertSpan({
    documentId,
    text: body.text,
    type: body.type,
    startOffset: body.startOffset,
    endOffset: body.endOffset,
    confidence: body.confidence ?? 1.0,
    status: "redacted",
    riskTier: baseRisk(body.type),
    source: "user_added",
    relatedSpanIds: [],
    patternFlagged: false,
    originalStatus: "redacted",
  });

  writeAuditEntry({ documentId, spanId: span.id, action: "added", previousState: null });

  res.status(201).json({ span });
});

// DELETE /api/documents/:id/spans/:spanId — remove a false-positive span
router.delete("/:spanId", (req: Request, res: Response) => {
  const { id: documentId, spanId } = req.params as { id: string; spanId: string };

  const existing = getSpan(spanId);
  if (!existing || existing.documentId !== documentId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Span not found" } });
    return;
  }

  deleteSpan(spanId);
  writeAuditEntry({ documentId, spanId, action: "removed", previousState: existing });

  res.json({ success: true });
});

export default router;
