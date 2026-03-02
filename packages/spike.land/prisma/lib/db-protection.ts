/**
 * Database Protection Utilities
 *
 * Prevents accidental operations on production databases.
 * All E2E seed/cleanup scripts MUST use these utilities.
 */

// Staging environment patterns - these are SAFE for E2E operations
// Checked BEFORE production patterns to allow staging subdomains
const STAGING_PATTERNS = [
  "next.spike.land", // Staging environment (next.spike.land)
  "staging", // General staging pattern
  "-staging", // Branch-based staging
  "_staging", // Branch-based staging (underscore variant)
];

// Known production database patterns - ADD YOUR PRODUCTION IDENTIFIERS HERE
// These patterns are checked AFTER staging patterns
const PRODUCTION_PATTERNS = [
  // URL patterns
  "production",
  "prod-",
  "prod.",
  // Neon project identifiers for production (main branch only)
  // Note: Staging branch of the same project is allowed via STAGING_PATTERNS
  // Host patterns
  "spike.land", // Production domain (staging handled by STAGING_PATTERNS first)
  "spike-land", // Alternative spelling
  // Add more patterns as needed
];

// E2E test database patterns - these are ALLOWED
const E2E_SAFE_PATTERNS = ["e2e", "test", "staging", "dev", "local", "preview"];

interface ProtectionResult {
  safe: boolean;
  reason: string;
  connectionString: string;
}

/**
 * Validates that a database connection string is safe for E2E operations.
 * Returns detailed information about why it's safe or unsafe.
 *
 * Check order:
 * 1. Explicit CI override (E2E_DATABASE_CONFIRMED)
 * 2. Dedicated E2E database (DATABASE_URL_E2E)
 * 3. Staging patterns (next.spike.land, etc.) - ALLOWED
 * 4. Production patterns (spike.land, etc.) - BLOCKED
 * 5. E2E-safe patterns (e2e, test, dev, etc.) - ALLOWED
 * 6. Default: BLOCKED (unknown patterns are rejected for safety)
 */
export function validateE2EDatabase(connectionString: string): ProtectionResult {
  const lowercaseUrl = connectionString.toLowerCase();

  // Check for explicit E2E override (only for CI environments)
  if (process.env.E2E_DATABASE_CONFIRMED === "true") {
    if (!process.env.CI) {
      return {
        safe: false,
        reason:
          "E2E_DATABASE_CONFIRMED can only be used in CI environments (CI env var must be set)",
        connectionString,
      };
    }
    console.warn("⚠️  E2E_DATABASE_CONFIRMED is set - bypassing production checks");
    return {
      safe: true,
      reason: "Explicitly confirmed via E2E_DATABASE_CONFIRMED in CI",
      connectionString,
    };
  }

  // Check if DATABASE_URL_E2E is being used (preferred)
  if (process.env.DATABASE_URL_E2E) {
    // If DATABASE_URL_E2E is set and we're using it, that's a good sign
    if (connectionString === process.env.DATABASE_URL_E2E) {
      return {
        safe: true,
        reason: "Using DATABASE_URL_E2E (dedicated E2E database)",
        connectionString,
      };
    }
  }

  // Check for staging patterns FIRST (before production patterns)
  // This allows "next.spike.land" to be safe even though "spike.land" is blocked
  const hasStagingPattern = STAGING_PATTERNS.some((pattern) =>
    lowercaseUrl.includes(pattern.toLowerCase()),
  );

  if (hasStagingPattern) {
    return {
      safe: true,
      reason: "Connection string matches staging environment pattern",
      connectionString,
    };
  }

  // Check for production patterns (after staging check)
  for (const pattern of PRODUCTION_PATTERNS) {
    if (lowercaseUrl.includes(pattern.toLowerCase())) {
      return {
        safe: false,
        reason: `Connection string contains production pattern: "${pattern}"`,
        connectionString,
      };
    }
  }

  // Check for E2E-safe patterns
  const hasE2EPattern = E2E_SAFE_PATTERNS.some((pattern) =>
    lowercaseUrl.includes(pattern.toLowerCase()),
  );

  if (hasE2EPattern) {
    return {
      safe: true,
      reason: "Connection string contains E2E-safe pattern",
      connectionString,
    };
  }

  // If we get here, we're not sure - be safe and reject
  return {
    safe: false,
    reason:
      "Connection string doesn't match any known E2E patterns. " +
      "Use DATABASE_URL_E2E for E2E tests or add 'e2e', 'test', 'staging', 'dev' to the database name.",
    connectionString,
  };
}

/**
 * Asserts that the database is safe for E2E operations.
 * Throws an error if the database appears to be production.
 */
export function assertE2EDatabase(connectionString: string): void {
  const result = validateE2EDatabase(connectionString);

  if (!result.safe) {
    console.error("\n" + "=".repeat(70));
    console.error("🛑 PRODUCTION DATABASE PROTECTION TRIGGERED");
    console.error("=".repeat(70));
    console.error(`\nReason: ${result.reason}`);
    console.error("\nThe connection string appears to be a production database.");
    console.error("E2E scripts are NOT allowed to run against production.\n");
    console.error("To fix this:");
    console.error("  1. Set DATABASE_URL_E2E to point to a test database");
    console.error("  2. Or use a database with 'e2e', 'test', 'staging', or 'dev' in the name");
    console.error("  3. In CI, set E2E_DATABASE_CONFIRMED=true (use with caution!)\n");
    console.error("=".repeat(70) + "\n");

    throw new Error(
      `SAFETY: Refusing to run E2E script against potential production database. ${result.reason}`,
    );
  }

  console.log(`✅ Database protection check passed: ${result.reason}`);
}

/**
 * Gets the E2E database connection string with safety checks.
 */
export function getE2EDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL_E2E || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL_E2E or DATABASE_URL environment variable is required");
  }

  assertE2EDatabase(connectionString);

  return connectionString;
}
