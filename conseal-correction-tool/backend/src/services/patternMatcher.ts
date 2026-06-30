import { RawDetection } from "./llmDetectionService";
import { PiiSpan, PiiType } from "../types/pii";

const PATTERNS: Partial<Record<PiiType, RegExp>> = {
  PHONE: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s.]?\d{3}[-.\s.]?\d{4}\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
};

/**
 * Pipeline integration point: scan rawText for pattern matches the model missed.
 * Returns RawDetections ready to be inserted with patternFlagged=true.
 */
export function scanForMissedPatterns(
  rawText: string,
  existingSpans: PiiSpan[]
): RawDetection[] {
  const alreadyFlagged: RawDetection[] = existingSpans.map((s) => ({
    text: s.text,
    type: s.type,
    startOffset: s.startOffset,
    endOffset: s.endOffset,
    confidence: s.confidence,
  }));
  return findPatternMatches(rawText, alreadyFlagged);
}

/**
 * Low-level scanner: runs each pattern regex over rawText, skips matches that
 * overlap any entry in alreadyFlagged. Returns confidence=0.65 (ambiguous band).
 */
export function findPatternMatches(
  rawText: string,
  alreadyFlagged: RawDetection[]
): RawDetection[] {
  const results: RawDetection[] = [];
  // Work on a local copy so cross-type deduplication works without mutating caller's array
  const seen: RawDetection[] = [...alreadyFlagged];

  for (const [piiType, pattern] of Object.entries(PATTERNS) as [PiiType, RegExp][]) {
    // Clone regex so lastIndex resets each invocation (the const keeps state between calls)
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(rawText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (!overlaps(start, end, seen)) {
        const det: RawDetection = {
          text: match[0],
          type: piiType,
          startOffset: start,
          endOffset: end,
          confidence: 0.65,
        };
        results.push(det);
        seen.push(det);
      }
    }
  }

  return results;
}

function overlaps(start: number, end: number, existing: RawDetection[]): boolean {
  return existing.some((e) => start < e.endOffset && end > e.startOffset);
}
