import { Document, DocumentStatus } from "../types/pii";
import { getDb } from "../db/client";
import { v4 as uuidv4 } from "uuid";

export function createDocument(filename: string, rawText: string, preloadedDetections?: unknown[]): Document {
  const db = getDb();
  const doc: Document = {
    id: uuidv4(),
    filename,
    rawText,
    status: "detecting",
    createdAt: new Date().toISOString(),
    exportedAt: null,
  };

  db.prepare(`
    INSERT INTO documents (id, filename, raw_text, status, created_at, exported_at, preloaded_detections)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(doc.id, doc.filename, doc.rawText, doc.status, doc.createdAt, doc.exportedAt,
    preloadedDetections ? JSON.stringify(preloadedDetections) : null);

  return doc;
}

export function getPreloadedDetections(id: string): unknown[] | null {
  const db = getDb();
  const row = db.prepare("SELECT preloaded_detections FROM documents WHERE id = ?").get(id) as any;
  if (!row?.preloaded_detections) return null;
  try {
    return JSON.parse(row.preloaded_detections) as unknown[];
  } catch {
    return null;
  }
}

export function getDocument(id: string): Document | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as any;
  return row ? rowToDocument(row) : null;
}

export function updateDocumentStatus(id: string, status: DocumentStatus, exportedAt?: string): void {
  const db = getDb();
  db.prepare("UPDATE documents SET status = ?, exported_at = ? WHERE id = ?")
    .run(status, exportedAt ?? null, id);
}

function rowToDocument(row: any): Document {
  return {
    id: row.id,
    filename: row.filename,
    rawText: row.raw_text,
    status: row.status,
    createdAt: row.created_at,
    exportedAt: row.exported_at ?? null,
  };
}
