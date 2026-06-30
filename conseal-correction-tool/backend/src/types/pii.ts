export type PiiType =
  | "NAME"
  | "PHONE"
  | "EMAIL"
  | "ADDRESS"
  | "SSN"
  | "DATE"
  | "ORG"
  | "OTHER";

export type SpanStatus = "redacted" | "visible" | "pending_review";
export type RiskTier = "high" | "medium" | "low";
export type SpanSource = "model" | "user_added" | "user_modified";

export interface PiiSpan {
  id: string;
  documentId: string;
  text: string;
  type: PiiType;
  startOffset: number;
  endOffset: number;
  confidence: number;
  status: SpanStatus;
  riskTier: RiskTier;
  source: SpanSource;
  relatedSpanIds: string[];
  patternFlagged: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus = "detecting" | "reviewing" | "exported";

export interface Document {
  id: string;
  filename: string;
  rawText: string;
  status: DocumentStatus;
  createdAt: string;
  exportedAt: string | null;
}

export type AuditAction =
  | "toggled_redacted"
  | "toggled_visible"
  | "boundary_adjusted"
  | "added"
  | "removed"
  | "undo"
  | "redo";

export interface AuditEntry {
  id: string;
  documentId: string;
  spanId: string;
  action: AuditAction;
  previousState: Partial<PiiSpan> | null;
  msSincePreviousAction: number | null;
  timestamp: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface ConsistencyGroup {
  canonicalText: string;
  spanIds: string[];
  inconsistent: boolean;
}

export interface DiffSummary {
  totalSpans: number;
  modifiedCount: number;
  pendingReviewCount: number;
  unresolvedHighRisk: Array<{ spanId: string; text: string; type: PiiType }>;
  unresolvedInconsistencies: Array<{
    spanId: string;
    text: string;
    type: PiiType;
    status: SpanStatus;
  }>;
  unresolvedPatternFlags: number;
}
