/**
 * A/B Test Variant Assignment
 *
 * Deterministic hash-based variant assignment using existing
 * AbTest/AbTestVariant Prisma models.
 */

/**
 * Simple deterministic hash for consistent variant assignment.
 * Same visitorId + testId always gets the same variant.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

interface VariantOption {
  id: string;
  name: string;
  splitPercentage: number;
}

/**
 * Assign a visitor to a variant deterministically.
 * Uses hash of visitorId + testId to pick a variant
 * based on split percentages.
 */
export function assignVariant(
  visitorId: string,
  testId: string,
  variants: VariantOption[],
): VariantOption | null {
  if (variants.length === 0) return null;
  if (variants.length === 1) return variants[0]!;

  const hash = simpleHash(`${visitorId}:${testId}`);
  const bucket = hash % 100; // 0-99

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.splitPercentage;
    if (bucket < cumulative) {
      return variant;
    }
  }

  // Fallback to last variant
  return variants[variants.length - 1]!;
}
