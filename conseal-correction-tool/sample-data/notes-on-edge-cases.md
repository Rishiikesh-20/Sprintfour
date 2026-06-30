# Edge Case Map — sample-document.txt

## Edge case 1: Name appearing 3 times in different phrasings
- "Robert Harmon" — line 7, line 36, line 43
- "Rob Harmon" — line 17, line 43 (shorter alias)
- Tests: consistency engine groups all three; changing one surfaces alert for the others

## Edge case 2: Phone model correctly flags + nearby phone model misses
- (415) 882-3947 — line 11, format model should flag
- 415.882.3948 — line 17, different format; model may miss
- Tests: patternMatcher finds 415.882.3948 as pattern-flagged pending_review

## Edge case 3: Span in 40-70% confidence band (ambiguous)
- The date "March 14, 2024" in the header — model likely gives ~55% confidence
  (dates are ambiguous: is a memo date PII?)
- Tests: shows amber/pending_review state; appears in export gate "still unresolved"

## Edge case 4: Boundary off by 1-2 characters
- Email "robert.harmon@gmail.com" — model may clip to "robert.harmon@gmail.co"
  (missing trailing character) or include trailing space
- Tests: BoundaryHandle drag, boundary_adjusted audit entry

## Edge case 5: False positive — common phrase over-redacted
- "the main office" — model may flag as ORG at high confidence; it's not PII
- Tests: user deletes span entirely; "removed" audit entry; false-positive correction story

## Edge case 6: Name adjacent to phone — proximity high-risk bump
- "Robert Harmon" + "(415) 882-3947" appear within the same paragraph (both visible initially)
- Tests: riskClassifier.applyProximityBumps marks both as high risk
