import { PiiType, PiiSpan, RiskTier } from "../types/pii";
import { config } from "../config/env";

const BASE_RISK: Record<PiiType, RiskTier> = {
  PHONE: "high",
  SSN: "high",
  EMAIL: "high",
  ADDRESS: "high",
  NAME: "medium",
  ORG: "medium",
  DATE: "low",
  OTHER: "low",
};

export function baseRisk(type: PiiType): RiskTier {
  return BASE_RISK[type];
}

/**
 * After all spans are created, apply proximity bump:
 * if a high-risk span and a NAME span are within riskProximityChars characters
 * of each other AND both are not redacted, bump both to "high".
 *
 * An unredacted name next to an unredacted phone/SSN is materially more dangerous
 * than either alone — the UI should surface this explicitly.
 */
export function applyProximityBumps(spans: PiiSpan[]): PiiSpan[] {
  const result = spans.map((s) => ({ ...s }));

  const highRiskVisible = result.filter(
    (s) => s.riskTier === "high" && s.status !== "redacted"
  );
  const nameVisible = result.filter(
    (s) => s.type === "NAME" && s.status !== "redacted"
  );

  for (const highSpan of highRiskVisible) {
    for (const nameSpan of nameVisible) {
      const dist = Math.min(
        Math.abs(nameSpan.startOffset - highSpan.endOffset),
        Math.abs(highSpan.startOffset - nameSpan.endOffset)
      );
      if (dist <= config.riskProximityChars) {
        // Bump the NAME span to high — it was already medium
        nameSpan.riskTier = "high";
      }
    }
  }

  return result;
}
