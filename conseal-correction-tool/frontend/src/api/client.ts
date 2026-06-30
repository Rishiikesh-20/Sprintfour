import { Document, PiiSpan, AuditEntry, ConsistencyGroup, DiffSummary } from "../types/pii";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export const api = {
  createDocument: (filename: string, rawText: string) =>
    request<{ document: Document; isAnnotated: boolean; preloadedAnnotations?: unknown[] }>(
      "/documents",
      { method: "POST", body: JSON.stringify({ filename, rawText }) }
    ),

  getDocument: (id: string) =>
    request<{ document: Document; spans: PiiSpan[] }>(`/documents/${id}`),

  detect: (id: string, preloadedAnnotations?: unknown[]) =>
    request<{ spans: PiiSpan[] }>(`/documents/${id}/detect`, {
      method: "POST",
      body: JSON.stringify({ preloadedAnnotations }),
    }),

  patchSpan: (docId: string, spanId: string, updates: Partial<PiiSpan>) =>
    request<{ span: PiiSpan; inconsistentPeers: PiiSpan[]; elevatedSpans: PiiSpan[] }>(
      `/documents/${docId}/spans/${spanId}`,
      { method: "PATCH", body: JSON.stringify(updates) }
    ),

  addSpan: (docId: string, span: Omit<PiiSpan, "id" | "createdAt" | "updatedAt">) =>
    request<{ span: PiiSpan }>(`/documents/${docId}/spans`, {
      method: "POST",
      body: JSON.stringify(span),
    }),

  deleteSpan: (docId: string, spanId: string) =>
    request<{ success: boolean }>(`/documents/${docId}/spans/${spanId}`, {
      method: "DELETE",
    }),

  getConsistency: (docId: string) =>
    request<{ groups: ConsistencyGroup[] }>(`/documents/${docId}/consistency`),

  getAuditLog: (docId: string) =>
    request<{ auditLog: AuditEntry[] }>(`/documents/${docId}/audit`),

  logUndoRedo: (docId: string, action: "undo" | "redo") =>
    request<{ ok: boolean }>(`/documents/${docId}/audit`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  getDiff: (docId: string) =>
    request<{ diff: DiffSummary }>(`/documents/${docId}/diff`),

  exportDocument: (docId: string) =>
    request<{ redactedText: string; diff: DiffSummary }>(
      `/documents/${docId}/export`,
      { method: "POST" }
    ),
};
