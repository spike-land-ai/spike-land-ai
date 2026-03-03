/**
 * A/B Test Assignment Utilities
 *
 * Cookie management and API assignment logic extracted
 * from AbTestProvider for testability and reuse.
 */

/** Read ab_variant cookie value */
export function getVariantFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/ab_variant=([^;]+)/);
  return match ? match[1]! : null;
}

/** Set ab_variant cookie for 30 days */
export function setVariantCookie(variant: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `ab_variant=${variant};path=/;max-age=${30 * 24 * 60 * 60};samesite=lax`;
}

/** Fetch variant assignment from API, returns "control" on failure */
export async function fetchVariantAssignment(
  testId: string,
  visitorId: string,
): Promise<string> {
  try {
    const res = await fetch(
      `/api/ab-test/assign?testId=${testId}&visitorId=${visitorId}`,
    );
    if (!res.ok) throw new Error("Not found");
    const data = (await res.json()) as { variantName?: string; };
    return data.variantName || "control";
  } catch {
    return "control";
  }
}
