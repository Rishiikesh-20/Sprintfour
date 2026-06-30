import { create } from "zustand";
import { Document, PiiSpan, AuditEntry, ConsistencyGroup } from "../types/pii";

interface HistoryEntry {
  spans: PiiSpan[];
  description: string;
}

interface ConsealStore {
  document: Document | null;
  spans: PiiSpan[];
  auditLog: AuditEntry[];
  consistencyGroups: ConsistencyGroup[];
  highlightedSpanIds: Set<string>;
  rapidBurstSpanIds: string[];

  // Undo/redo history stack
  past: HistoryEntry[];
  future: HistoryEntry[];

  // Actions
  setDocument: (doc: Document) => void;
  setSpans: (spans: PiiSpan[]) => void;
  updateSpan: (updated: PiiSpan, description: string) => void;
  removeSpan: (spanId: string, description: string) => void;
  addSpan: (span: PiiSpan, description: string) => void;
  undo: () => void;
  redo: () => void;
  setAuditLog: (log: AuditEntry[]) => void;
  setConsistencyGroups: (groups: ConsistencyGroup[]) => void;
  setHighlightedSpanIds: (ids: string[]) => void;
  setRapidBurstSpanIds: (ids: string[]) => void;
  clearRapidBurst: () => void;
}

export const useConsealStore = create<ConsealStore>((set, get) => ({
  document: null,
  spans: [],
  auditLog: [],
  consistencyGroups: [],
  highlightedSpanIds: new Set(),
  rapidBurstSpanIds: [],
  past: [],
  future: [],

  setDocument: (doc) => set({ document: doc }),

  setSpans: (spans) => set({ spans, past: [], future: [] }),

  updateSpan: (updated, description) => {
    const { spans, past } = get();
    set({
      past: [...past, { spans, description }],
      future: [],
      spans: spans.map((s) => (s.id === updated.id ? updated : s)),
    });
  },

  removeSpan: (spanId, description) => {
    const { spans, past } = get();
    set({
      past: [...past, { spans, description }],
      future: [],
      spans: spans.filter((s) => s.id !== spanId),
    });
  },

  addSpan: (span, description) => {
    const { spans, past } = get();
    set({
      past: [...past, { spans, description }],
      future: [],
      spans: [...spans, span],
    });
  },

  undo: () => {
    const { past, spans, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1]!;
    set({
      past: past.slice(0, -1),
      future: [{ spans, description: "redo" }, ...future],
      spans: previous.spans,
    });
  },

  redo: () => {
    const { past, spans, future } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    set({
      past: [...past, { spans, description: "undo" }],
      future: future.slice(1),
      spans: next.spans,
    });
  },

  setAuditLog: (log) => set({ auditLog: log }),
  setConsistencyGroups: (groups) => set({ consistencyGroups: groups }),
  setHighlightedSpanIds: (ids) => set({ highlightedSpanIds: new Set(ids) }),
  setRapidBurstSpanIds: (ids) => set({ rapidBurstSpanIds: ids }),
  clearRapidBurst: () => set({ rapidBurstSpanIds: [] }),
}));
