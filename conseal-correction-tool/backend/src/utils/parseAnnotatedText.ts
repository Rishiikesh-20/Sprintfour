import { PiiType } from "../types/pii";

export interface ParsedAnnotation {
  text: string;
  type: PiiType;
  startOffset: number;
  endOffset: number;
  confidence: number;
}

export interface ParseResult {
  plainText: string;
  annotations: ParsedAnnotation[];
  isAnnotated: boolean;
}

const VALID_PII_TYPES: Set<string> = new Set([
  "NAME", "PHONE", "EMAIL", "ADDRESS", "SSN", "DATE", "ORG", "OTHER",
  // lowercase aliases used in sample files
  "name", "phone", "email", "address", "ssn", "date", "org", "other",
  // non-PII annotation types we still surface as OTHER
  "dob", "id", "condition",
]);

const ANNOTATION_RE = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

/**
 * Parses text containing [[text|type]] annotations.
 * Returns the stripped plain text and an array of spans with exact character offsets
 * into that plain text.
 *
 * If the input contains no annotations, isAnnotated=false and annotations=[].
 */
export function parseAnnotatedText(input: string): ParseResult {
  const annotations: ParsedAnnotation[] = [];
  let plainText = "";
  let lastIndex = 0;
  let found = false;

  ANNOTATION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ANNOTATION_RE.exec(input)) !== null) {
    found = true;
    const [full, spanText, rawType] = match as RegExpExecArray & [string, string, string];

    // Append plain text before this annotation
    plainText += input.slice(lastIndex, match.index);
    const startOffset = plainText.length;
    plainText += spanText;
    const endOffset = plainText.length;
    lastIndex = match.index + full.length;

    const normalizedType = rawType.toUpperCase() as PiiType;
    const piiType: PiiType = [
      "NAME", "PHONE", "EMAIL", "ADDRESS", "SSN", "DATE", "ORG", "OTHER",
    ].includes(normalizedType)
      ? normalizedType
      : "OTHER";

    // Assign confidence: non-PII annotation types (dob→DATE, id, condition) get
    // lower confidence to surface them as ambiguous in the UI
    const isDobOrId = rawType === "dob" || rawType === "id";
    const isCondition = rawType === "condition";
    const confidence = isCondition ? 0.45 : isDobOrId ? 0.72 : 0.90;

    annotations.push({
      text: spanText,
      type: piiType,
      startOffset,
      endOffset,
      confidence,
    });
  }

  if (!found) {
    return { plainText: input, annotations: [], isAnnotated: false };
  }

  // Append any trailing plain text after the last annotation
  plainText += input.slice(lastIndex);

  return { plainText, annotations, isAnnotated: true };
}
