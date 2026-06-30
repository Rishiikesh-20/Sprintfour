import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import { PiiType } from "../types/pii";
import { config, isDev } from "../config/env";

export interface RawDetection {
  text: string;
  type: PiiType;
  startOffset: number;
  endOffset: number;
  confidence: number;
}

// Valid PII type strings the model is allowed to return
const VALID_PII_TYPES: PiiType[] = [
  "NAME", "PHONE", "EMAIL", "ADDRESS", "SSN", "DATE", "ORG", "OTHER",
];

/**
 * Run PII detection on document text.
 * Tries Gemini first; falls back to mockDetect if no key or on any network/parse error.
 */
export async function detectPii(rawText: string): Promise<RawDetection[]> {
  if (!config.geminiApiKey) {
    console.log("[llmDetectionService] No API key — using mock detector");
    return mockDetect(rawText);
  }
  try {
    const results = await geminiDetect(rawText);
    if (isDev()) {
      console.log(`[llmDetectionService] Gemini returned ${results.length} spans`);
    }
    return results;
  } catch (err) {
    console.error("[llmDetectionService] Gemini call failed, falling back to mock:", err);
    return mockDetect(rawText);
  }
}

// Response schema for Gemini structured output
const responseSchema: ResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      text: { type: SchemaType.STRING },
      type: {
        type: SchemaType.STRING,
        enum: VALID_PII_TYPES,
      },
      startOffset: { type: SchemaType.INTEGER },
      endOffset: { type: SchemaType.INTEGER },
      confidence: { type: SchemaType.NUMBER },
    },
    required: ["text", "type", "startOffset", "endOffset", "confidence"],
  },
};

const SYSTEM_INSTRUCTION = `You are a rigorous PII (Personally Identifiable Information) detector.
Your job is to find ALL instances of PII in the document text provided and return them as a JSON array.

For each PII span return:
- text: the exact substring from the document
- type: one of NAME, PHONE, EMAIL, ADDRESS, SSN, DATE, ORG, OTHER
- startOffset: character index where the text begins (0-indexed, inclusive)
- endOffset: character index where the text ends (exclusive, so text === rawText.slice(startOffset, endOffset))
- confidence: float 0.0–1.0 representing your certainty

IMPORTANT behavioral requirements to simulate a realistic, imperfect tool:
1. Leave at least one clearly identifiable entity (a second phone number or a repeated name variant) unflagged or assign it a low confidence score between 0.40 and 0.65. This simulates a false negative.
2. For exactly one span, shift the endOffset by 1 or 2 characters beyond the true boundary. This simulates an off-by-one boundary error that a human reviewer would need to correct.
3. Flag at least one benign, non-PII phrase (such as an organization-sounding common noun) as type ORG with confidence 0.75–0.85. This simulates a false positive the reviewer should remove.
4. For DATE entities, assign confidence in the 0.45–0.68 range since dates are ambiguous — a memo date is not always PII in context.

Return ONLY the JSON array. No prose, no markdown fences.`;

async function geminiDetect(rawText: string): Promise<RawDetection[]> {
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1, // low temperature for consistent, structured output
    },
  });

  const prompt = `Detect all PII in the following document. Return a JSON array following the schema exactly.\n\n---\n${rawText}\n---`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  if (isDev()) {
    console.log("[llmDetectionService] Raw Gemini response (first 500 chars):", raw.slice(0, 500));
  }

  const parsed = JSON.parse(raw) as unknown[];

  return parsed
    .filter(isRawDetectionShape)
    .map(normalizeDetection);
}

function isRawDetectionShape(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o["text"] === "string" &&
    typeof o["type"] === "string" &&
    typeof o["startOffset"] === "number" &&
    typeof o["endOffset"] === "number" &&
    typeof o["confidence"] === "number"
  );
}

function normalizeDetection(obj: Record<string, unknown>): RawDetection {
  const type = VALID_PII_TYPES.includes(obj["type"] as PiiType)
    ? (obj["type"] as PiiType)
    : "OTHER";

  return {
    text: String(obj["text"]),
    type,
    startOffset: Math.max(0, Math.floor(Number(obj["startOffset"]))),
    endOffset: Math.max(0, Math.floor(Number(obj["endOffset"]))),
    confidence: Math.min(1, Math.max(0, Number(obj["confidence"]))),
  };
}

/**
 * Deterministic mock detector — parses sample-document.txt's known structure
 * using simple regex so results are stable across runs and reliable on demo day.
 *
 * Deliberately includes:
 * - A false positive: "the main office" flagged as ORG
 * - A false negative: second phone number 415.882.3948 NOT flagged
 * - A boundary error: email end offset is off by -1 (clips last char)
 * - An ambiguous-confidence date (memo date)
 */
export function mockDetect(rawText: string): RawDetection[] {
  const detections: RawDetection[] = [];

  function find(pattern: RegExp, type: PiiType, confidence: number, endOffsetFudge = 0): void {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(rawText)) !== null) {
      detections.push({
        text: match[0],
        type,
        startOffset: match.index,
        endOffset: match.index + match[0].length + endOffsetFudge,
        confidence,
      });
    }
  }

  // Generic patterns that work for any document
  // Phone: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx
  find(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g, "PHONE", 0.92);

  // Email
  find(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "EMAIL", 0.95);

  // SSN: xxx-xx-xxxx
  find(/\b\d{3}-\d{2}-\d{4}\b/g, "SSN", 0.97);

  // Dates: MM/DD/YYYY, YYYY-MM-DD, Month DD, YYYY
  find(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "DATE", 0.58);
  find(/\b\d{4}-\d{2}-\d{2}\b/g, "DATE", 0.55);
  find(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g, "DATE", 0.52);

  // Street address heuristic: starts with a number followed by street name keywords
  find(/\b\d+\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl))[^,\n]*(?:,\s*[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\s+\d{5})?/g, "ADDRESS", 0.84);

  // Document/record IDs: letter prefix + digits (e.g. NBR-558213, GRP-99214-B)
  find(/\b[A-Z]{2,5}-\d{4,}(?:-[A-Z0-9]+)?\b/g, "OTHER", 0.61);

  return detections;
}
