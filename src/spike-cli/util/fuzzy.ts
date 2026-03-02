/**
 * Fuzzy matching utility for command/tool name completion.
 */

/**
 * Score a fuzzy match of `query` against `target`.
 * Returns 0 if no match. Higher scores indicate better matches.
 *
 * Scoring:
 * - Consecutive matches: +3
 * - Word-boundary matches (after `_`, `-`, or camelCase transition): +2
 * - Prefix bonus (matching first char): +5
 * - Gap penalty: -0.5 per skipped char
 */
export function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let score = 0;
  let qi = 0;
  let lastMatchIndex = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Prefix bonus
      if (qi === 0 && ti === 0) {
        score += 5;
      }

      // Word boundary bonus
      if (ti > 0 && isWordBoundary(target, ti)) {
        score += 2;
      }

      // Consecutive bonus
      if (lastMatchIndex === ti - 1) {
        score += 3;
      } else if (lastMatchIndex >= 0) {
        // Gap penalty for skipped chars
        score -= (ti - lastMatchIndex - 1) * 0.5;
      }

      // Base match point
      score += 1;

      lastMatchIndex = ti;
      qi++;
    }
  }

  // All query chars must be matched
  if (qi < q.length) return 0;

  return score;
}

function isWordBoundary(target: string, index: number): boolean {
  if (index === 0) return true;
  const prev = target[index - 1];
  const curr = target[index];

  // After separator characters
  if (prev === "_" || prev === "-") return true;

  // camelCase boundary: lowercase followed by uppercase
  if (
    prev &&
    curr &&
    prev === prev.toLowerCase() &&
    curr === curr.toUpperCase() &&
    curr !== curr.toLowerCase()
  ) {
    return true;
  }

  return false;
}

/**
 * Filter and sort items by fuzzy match score against a query.
 * Returns items with score > 0, sorted by score descending.
 */
export function fuzzyFilter<T>(query: string, items: T[], getText: (item: T) => string): T[] {
  if (!query) return [];

  const scored = items
    .map((item) => ({ item, score: fuzzyScore(query, getText(item)) }))
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.map((entry) => entry.item);
}
