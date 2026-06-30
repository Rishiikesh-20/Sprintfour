export function verifySpanOffsets(
  rawText: string,
  text: string,
  startOffset: number,
  endOffset: number
): boolean {
  return rawText.slice(startOffset, endOffset) === text;
}

export function findAllOffsets(
  haystack: string,
  needle: string
): Array<{ start: number; end: number }> {
  const results: Array<{ start: number; end: number }> = [];
  let idx = 0;
  while (idx < haystack.length) {
    const pos = haystack.indexOf(needle, idx);
    if (pos === -1) break;
    results.push({ start: pos, end: pos + needle.length });
    idx = pos + 1;
  }
  return results;
}

/**
 * Validate a proposed boundary adjustment and extract the new text slice.
 * Returns the fresh text on success; throws with a user-facing message on failure.
 */
export function validateAndExtractBoundary(
  rawText: string,
  startOffset: number,
  endOffset: number
): { text: string } {
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    throw Object.assign(new Error("Offsets must be integers"), { code: "INVALID_OFFSETS" });
  }
  if (startOffset < 0 || endOffset > rawText.length) {
    throw Object.assign(
      new Error(`Offsets out of range: document length is ${rawText.length}`),
      { code: "OFFSETS_OUT_OF_RANGE" }
    );
  }
  if (startOffset >= endOffset) {
    throw Object.assign(
      new Error("startOffset must be less than endOffset"),
      { code: "INVERTED_OFFSETS" }
    );
  }
  return { text: rawText.slice(startOffset, endOffset) };
}
