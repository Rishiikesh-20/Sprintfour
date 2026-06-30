-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'detecting' CHECK(status IN ('detecting', 'reviewing', 'exported')),
  created_at TEXT NOT NULL,
  exported_at TEXT
);

-- PII spans table
CREATE TABLE IF NOT EXISTS spans (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('NAME','PHONE','EMAIL','ADDRESS','SSN','DATE','ORG','OTHER')),
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('redacted','visible','pending_review')),
  risk_tier TEXT NOT NULL DEFAULT 'low' CHECK(risk_tier IN ('high','medium','low')),
  source TEXT NOT NULL DEFAULT 'model' CHECK(source IN ('model','user_added','user_modified')),
  related_span_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array of span IDs
  pattern_flagged INTEGER NOT NULL DEFAULT 0,   -- SQLite boolean
  original_status TEXT NOT NULL,               -- snapshot of model's initial suggestion
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  span_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('toggled_redacted','toggled_visible','boundary_adjusted','added','removed','undo','redo')),
  previous_state TEXT,  -- JSON blob of Partial<PiiSpan>
  ms_since_previous_action INTEGER,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spans_document ON spans(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_document ON audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_span ON audit_log(span_id);
