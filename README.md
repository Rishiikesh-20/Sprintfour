# Conseal — Problem 3: Fixing the Tool's Mistakes

**Sprintfour Hackathon Submission**

A PII correction interface for reviewers who move fast and trust automated suggestions slightly too much. The core thesis: friction applied uniformly fails Sam. Friction applied selectively — only when behavioral signals say he has stopped reading — is the only lever that actually works.

---

## The Problem

Sam is reviewing a document where the PII detection tool has already run. Most suggestions are correct, which trains him to approve without reading. The mistakes that slip through are the ones he does not stop to look at: a missed phone number, a name that appears three times and only gets redacted once, an email address whose boundary is clipped by one character.

A tool that puts a confirmation dialog on every single item either gets abandoned or gets clicked through mindlessly — both outcomes are worse than no friction at all. The product has to know *when* Sam is drifting and intervene only then.

---

## What's Built

### 1. Document Viewer with Risk-Weighted Spans
The detection output is rendered inline with visual hierarchy by risk tier. High-risk spans (SSN, phone, email, address) are fully filled. Medium-risk (name, org) are outlined. Low-risk (date, other) are lighter. An unredacted name sitting next to an unredacted phone number gets a proximity bump — that combination is materially more dangerous than either alone and the UI reflects that immediately.

### 2. Click-to-Toggle Redaction
Every span cycles through three states: `pending_review` (model's initial suggestion) → `redacted` → `visible`. Sam makes the call; the tool never decides for him.

### 3. Boundary Adjustment
The model's existence-call can be right while its boundary is off by a character — an email clipped at `.co` instead of `.com`, a phone number with a trailing digit missing. Drag handles on span edges let Sam fix this without retyping. A hidden font-ruler measures the exact character width of the monospace font so pixel drags translate to precise character offset changes in the database.

### 4. Consistency Engine
When Sam redacts one occurrence of "Robert Harmon" and leaves "Rob Harmon" visible two lines down, a backend pass catches the inconsistency and surfaces a targeted alert: *"this entity appears 2 more times, still visible — fix those too?"* It never auto-applies the change. Auto-applying removes Sam's judgment from the loop, which defeats the point.

### 5. Pattern Matcher
After the LLM detection pass, a second regex pass scans the full document for PII-shaped strings the model did not flag — a second phone number in dot-delimited format, an SSN-shaped ID. These surface as `pending_review` items, not auto-redactions. Sam needs to see and decide, not have the tool silently correct itself.

### 6. Rapid-Action Nudge
The timing of corrections is itself a signal. If Sam makes 3+ decisions within 2 seconds, a non-blocking banner fires: *"moving fast — want a second look at these?"* It references the specific spans just touched. This fires only on the burst pattern that indicates he has stopped reading each item, not on every action. This is the behavioral implementation of selective friction.

### 7. Undo / Redo
Fast review means misclicks. Full history stack with Cmd+Z / Cmd+Shift+Z, plus buttons in the sidebar.

### 8. Audit Log
Every correction — toggle, boundary adjust, add, remove, undo, redo — is written to SQLite with a millisecond timestamp and the previous state snapshot. The sidebar shows the live log with velocity markers: actions under 500ms are flagged. This doubles as an evidence trail for *why* a span was changed and as a real engineering artifact.

### 9. Export Gate
Before download, Sam sees a forced diff screen: how many spans were changed from the model's original suggestion, which spans are still unresolved (ambiguous confidence band, pattern-flagged, consistency conflicts). He must check an explicit confirmation before export unlocks. No silent one-click download. This is the last save point before a mistake becomes real.

---

## What Was Deliberately Not Built

**No custom-trained PII model.** Detection uses a Gemini API call specifically because a real LLM produces realistic, messy output — false positives, missed entities, off-by-one boundaries. A fixed mock list would have made the demo look cleaner and taught nothing about actual reviewer behavior. This is a deliberate choice, not a shortcut.

**No auth or multi-user support.** Single-session prototype. Auth would have consumed time better spent on the correction workflow itself.

**No batch or multi-document review.** That is Problem 2 (Maya). One document at a time is a scope anchor, not a gap.

**No ML-based behavioral detection.** A timing heuristic — three actions within two seconds — is the right amount of engineering for this signal. A trained classifier would need training data, add latency, and provide no meaningful improvement over a clock.

**No real security layer.** This is a workflow prototype, not a security product. SQLite stores plaintext; there is no encryption at rest. Stated honestly rather than papered over.

---

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────┐
│        Frontend           │  REST   │          Backend          │
│  React + TypeScript       │◄───────►│  Node.js + Express + TS  │
│  Vite · Tailwind · Zustand│  JSON   │  SQLite (better-sqlite3) │
└──────────────────────────┘         └──────────────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │  Gemini API (detect)  │
                                    │  mock fallback if down │
                                    └───────────────────────┘
```

**Why this stack:** TypeScript end-to-end means the `PiiSpan` type is defined once and imported on both sides — no translation layer, no drift. SQLite via `better-sqlite3` gives a real persistence layer (audit log, undo state across a page refresh) for zero infrastructure cost. No Docker needed — two `npm run dev` processes is enough.

---

## Setup

### Prerequisites

- Node.js 18+
- npm
- A Gemini API key from [Google AI Studio](https://aistudio.google.com) — optional; the app falls back to a generic regex-based detector if the key is absent or the quota is exhausted

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_key_here
PORT=3001
NODE_ENV=development
DB_PATH=./data/conseal.db
```

Start the backend:

```bash
npm run dev
```

Backend listens on **http://localhost:3001**

> **nvm users:** `npm run dev` auto-rebuilds `better-sqlite3` against your active Node version on first run. This takes ~10 seconds the first time and is normal.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### 3. Load the sample document

Upload `sample-data/sample-document.txt` from the upload screen. This document is hand-crafted to reliably trigger all six edge cases after detection runs:

| Edge Case | What it demonstrates |
|---|---|
| "Robert Harmon" / "Rob Harmon" (3 occurrences) | Consistency engine alert |
| `(415) 882-3947` flagged · `415.882.3948` missed | Pattern matcher catch |
| `March 14, 2024` at 52% confidence | Ambiguous-state UI + export gate warning |
| Email address clipped by 1 trailing character | Boundary drag-to-fix |
| "the main office" flagged as ORG | False positive removal |
| Name adjacent to phone, both visible | Proximity risk tier bump |

---

## Project Structure

```
conseal-correction-tool/
├── sample-data/
│   ├── sample-document.txt          # hand-crafted demo document (6 baked-in edge cases)
│   └── notes-on-edge-cases.md       # maps each edge case to exact line numbers
│
├── backend/src/
│   ├── index.ts                     # Express entry point + middleware
│   ├── config/env.ts                # all thresholds in one place (confidence bands,
│   │                                #   timing window, risk tiers, proximity distance)
│   ├── db/
│   │   ├── schema.sql               # documents, spans, audit_log tables
│   │   └── client.ts                # better-sqlite3 singleton + migrations
│   ├── routes/                      # thin handlers — logic lives in services/
│   │   ├── documents.ts
│   │   ├── detection.ts
│   │   ├── spans.ts
│   │   ├── consistency.ts
│   │   ├── audit.ts
│   │   └── export.ts
│   ├── services/
│   │   ├── llmDetectionService.ts   # Gemini structured call + generic mock fallback
│   │   ├── detectionPipeline.ts     # orchestrates: LLM → risk classify → pattern pass → audit
│   │   ├── consistencyEngine.ts     # entity grouping + peer conflict detection
│   │   ├── patternMatcher.ts        # regex pass for PII shapes the model missed
│   │   ├── riskClassifier.ts        # base tiers + proximity bump logic
│   │   └── auditLogService.ts       # every mutation written with velocity tracking
│   ├── models/
│   │   ├── document.ts              # CRUD + preloaded annotation storage
│   │   └── span.ts                  # CRUD + related span linking
│   ├── types/pii.ts                 # canonical PiiSpan / Document / AuditEntry types
│   └── utils/
│       ├── textOffsets.ts           # character offset helpers
│       └── parseAnnotatedText.ts    # [[text|type]] → plainText + exact spans parser
│
└── frontend/src/
    ├── App.tsx                       # upload, detect, span interaction orchestration
    ├── api/client.ts                 # typed fetch wrappers for every endpoint
    ├── state/store.ts                # Zustand: document, spans, history, burst state
    ├── hooks/
    │   ├── useCorrectionHistory.ts   # undo/redo history stack
    │   └── useRapidActionDetector.ts # timing heuristic, fires burst callback at 3/2s
    └── components/
        ├── DocumentViewer/           # inline span rendering + drag boundary handles
        ├── Sidebar/                  # stats panel, risk legend, audit timeline
        ├── Nudges/                   # rapid-action banner, consistency alert
        └── ExportGate/               # diff summary modal + export confirmation gate
```

---

## API Reference

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/documents` | Create document — accepts plain text or `[[text\|type]]` annotated format |
| POST | `/api/documents/:id/detect` | Run full detection pipeline (LLM → pattern pass → risk classification) |
| GET | `/api/documents/:id` | Fetch document + current span state |
| PATCH | `/api/documents/:id/spans/:spanId` | Toggle status or adjust boundary; response includes inconsistent peers |
| POST | `/api/documents/:id/spans` | Manually add a span Sam noticed himself |
| DELETE | `/api/documents/:id/spans/:spanId` | Remove a false-positive span |
| GET | `/api/documents/:id/consistency` | Grouped entities + peer conflict details |
| GET | `/api/documents/:id/audit` | Full timestamped audit trail |
| GET | `/api/documents/:id/diff` | Pre-export diff: original suggestions vs current state |
| POST | `/api/documents/:id/export` | Finalize and return redacted text + diff summary |

All errors return `{ error: { code, message } }` — never raw stack traces.

---

## Engineering Decisions

**TypeScript strict mode on both sides.** `PiiSpan`, `Document`, and `AuditEntry` types are defined in `backend/src/types/pii.ts` and mirrored exactly in `frontend/src/types/pii.ts`. One shape, two imports, zero translation.

**Thresholds live in one place.** Confidence bands, the rapid-action timing window, risk tier assignments, and proximity distance are all in `backend/src/config/env.ts`. Tune them in one file, not across five services.

**Audit writes are a service-layer side effect.** Every span mutation goes through `auditLogService.writeAuditEntry` inside the service, not the route handler. The audit trail is not bolted on — it is structurally impossible to mutate a span without writing a log entry.

**Optimistic UI with server rollback.** Span toggles update Zustand state immediately for instant feel, sync to the server in the background, and restore the previous state automatically on failure.

**Annotated input format for demo stability.** The app accepts `[[text|type]]` pre-annotated documents. The parser extracts exact character offsets from the stripped plain text and skips the LLM call entirely — reliable span positions regardless of API availability.
