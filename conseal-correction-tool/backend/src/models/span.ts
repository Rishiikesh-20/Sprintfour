import { PiiSpan, SpanStatus, SpanSource, RiskTier, PiiType } from "../types/pii";
import { getDb } from "../db/client";
import { v4 as uuidv4 } from "uuid";

export function insertSpan(span: Omit<PiiSpan, "id" | "createdAt" | "updatedAt"> & { originalStatus: SpanStatus }): PiiSpan {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO spans
      (id, document_id, text, type, start_offset, end_offset, confidence, status,
       risk_tier, source, related_span_ids, pattern_flagged, original_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    span.documentId,
    span.text,
    span.type,
    span.startOffset,
    span.endOffset,
    span.confidence,
    span.status,
    span.riskTier,
    span.source,
    JSON.stringify(span.relatedSpanIds),
    span.patternFlagged ? 1 : 0,
    span.originalStatus,
    now,
    now
  );

  return { ...span, id, createdAt: now, updatedAt: now };
}

export function getSpansByDocument(documentId: string): PiiSpan[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM spans WHERE document_id = ? ORDER BY start_offset ASC")
    .all(documentId) as any[];
  return rows.map(rowToSpan);
}

export function getSpan(id: string): PiiSpan | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM spans WHERE id = ?").get(id) as any;
  return row ? rowToSpan(row) : null;
}

export function updateSpan(id: string, updates: Partial<PiiSpan>): PiiSpan | null {
  const db = getDb();
  const existing = getSpan(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const merged = { ...existing, ...updates, updatedAt: now };

  db.prepare(`
    UPDATE spans
    SET text = ?, type = ?, start_offset = ?, end_offset = ?, confidence = ?,
        status = ?, risk_tier = ?, source = ?, related_span_ids = ?,
        pattern_flagged = ?, updated_at = ?
    WHERE id = ?
  `).run(
    merged.text,
    merged.type,
    merged.startOffset,
    merged.endOffset,
    merged.confidence,
    merged.status,
    merged.riskTier,
    merged.source,
    JSON.stringify(merged.relatedSpanIds),
    merged.patternFlagged ? 1 : 0,
    now,
    id
  );

  return merged;
}

export function deleteSpan(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM spans WHERE id = ?").run(id);
  return result.changes > 0;
}

export function updateRelatedSpanIds(id: string, relatedIds: string[]): void {
  const db = getDb();
  db.prepare("UPDATE spans SET related_span_ids = ? WHERE id = ?")
    .run(JSON.stringify(relatedIds), id);
}

function rowToSpan(row: any): PiiSpan {
  return {
    id: row.id,
    documentId: row.document_id,
    text: row.text,
    type: row.type as PiiType,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    confidence: row.confidence,
    status: row.status as SpanStatus,
    riskTier: row.risk_tier as RiskTier,
    source: row.source as SpanSource,
    relatedSpanIds: JSON.parse(row.related_span_ids ?? "[]"),
    patternFlagged: row.pattern_flagged === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
