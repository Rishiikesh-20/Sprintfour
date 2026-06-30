import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/client";
import { AuditEntry, AuditAction, PiiSpan } from "../types/pii";

/**
 * Write an audit entry as a side effect of any span mutation.
 * msSincePreviousAction is computed internally — callers do not need to track it.
 */
export function writeAuditEntry(params: {
  documentId: string;
  spanId: string;
  action: AuditAction;
  previousState: Partial<PiiSpan> | null;
}): AuditEntry {
  const db = getDb();
  const nowMs = Date.now();
  const nowISO = new Date(nowMs).toISOString();

  // Auto-compute the delta against the last entry for this document.
  // This runs before the INSERT so we always measure the gap correctly.
  const prevRow = db
    .prepare(
      "SELECT timestamp FROM audit_log WHERE document_id = ? ORDER BY timestamp DESC LIMIT 1"
    )
    .get(params.documentId) as { timestamp: string } | undefined;
  const msSince = prevRow
    ? nowMs - new Date(prevRow.timestamp).getTime()
    : null;

  const id = uuidv4();

  db.prepare(`
    INSERT INTO audit_log
      (id, document_id, span_id, action, previous_state, ms_since_previous_action, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.documentId,
    params.spanId,
    params.action,
    params.previousState ? JSON.stringify(params.previousState) : null,
    msSince,
    nowISO
  );

  return {
    id,
    documentId: params.documentId,
    spanId: params.spanId,
    action: params.action,
    previousState: params.previousState,
    msSincePreviousAction: msSince,
    timestamp: nowISO,
  };
}

/**
 * Lightweight audit marker for client-side undo/redo operations.
 * Uses the sentinel spanId "__session__" since the action is session-scoped.
 */
export function writeUndoRedoEntry(
  documentId: string,
  action: "undo" | "redo"
): void {
  writeAuditEntry({ documentId, spanId: "__session__", action, previousState: null });
}

/**
 * Full audit trail for a document, newest first.
 * DESC order so the timeline component can render top-to-bottom = recent-to-old.
 */
export function getAuditLog(documentId: string): AuditEntry[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM audit_log WHERE document_id = ? ORDER BY timestamp DESC"
    )
    .all(documentId) as any[];

  return rows.map(rowToAuditEntry);
}

function rowToAuditEntry(row: any): AuditEntry {
  return {
    id: row.id,
    documentId: row.document_id,
    spanId: row.span_id,
    action: row.action,
    previousState: row.previous_state ? JSON.parse(row.previous_state) : null,
    msSincePreviousAction: row.ms_since_previous_action,
    timestamp: row.timestamp,
  };
}
