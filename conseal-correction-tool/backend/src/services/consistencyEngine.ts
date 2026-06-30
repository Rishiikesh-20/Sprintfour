import { PiiSpan, ConsistencyGroup } from "../types/pii";

/**
 * Group spans by entity identity:
 * - All PII types: exact case-insensitive text match
 * - NAME spans additionally: shared surname (last word) catches "Robert Harmon" / "Rob Harmon"
 *
 * Returns groups with ≥2 members. inconsistent=true when members have differing statuses.
 */
export function groupByEntity(spans: PiiSpan[]): ConsistencyGroup[] {
  const buckets = new Map<string, PiiSpan[]>();

  for (const span of spans) {
    const key = canonicalKey(span);
    const existing = buckets.get(key) ?? [];
    existing.push(span);
    buckets.set(key, existing);
  }

  const groups: ConsistencyGroup[] = [];
  for (const groupSpans of buckets.values()) {
    if (groupSpans.length < 2) continue;
    const statuses = new Set(groupSpans.map((s) => s.status));
    groups.push({
      canonicalText: longestText(groupSpans),
      spanIds: groupSpans.map((s) => s.id),
      inconsistent: statuses.size > 1,
    });
  }
  return groups;
}

/**
 * After a span status changes, find all spans in the same entity group that now
 * disagree with changedSpan's new status. Used by the PATCH route to surface alerts.
 */
export function findInconsistentPeers(
  changedSpan: PiiSpan,
  allSpans: PiiSpan[]
): PiiSpan[] {
  const groups = groupByEntity(allSpans);
  for (const group of groups) {
    if (!group.spanIds.includes(changedSpan.id)) continue;
    return allSpans.filter(
      (s) =>
        group.spanIds.includes(s.id) &&
        s.id !== changedSpan.id &&
        s.status !== changedSpan.status
    );
  }
  return [];
}

// --- helpers ----------------------------------------------------------------

function canonicalKey(span: PiiSpan): string {
  if (span.type === "NAME") {
    // Group by surname so short-form names ("Rob Harmon") cluster with long-form ("Robert Harmon")
    const words = span.text.trim().split(/\s+/);
    const surname = words[words.length - 1].toLowerCase();
    return `name:${surname}`;
  }
  return `${span.type}:${span.text.toLowerCase().trim()}`;
}

function longestText(spans: PiiSpan[]): string {
  return spans.reduce((a, b) => (a.text.length >= b.text.length ? a : b)).text;
}
