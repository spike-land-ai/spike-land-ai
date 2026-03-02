/**
 * Automated Review Gate for CreatedApp Pipeline
 *
 * Performs three checks on a generated app:
 * 1. Transpile: Verify code compiles via esbuild
 * 2. Bundle: Verify the codespace serves valid content
 * 3. Health: Verify the codespace has real, non-default content
 *
 * All three must pass for the auto-review to approve.
 */

import { transpileCode } from "@/lib/codespace/transpile";
import { isCodespaceHealthy } from "./codespace-health";
import { getSession } from "@/lib/codespace/session-service";

export interface AutoReviewCheck {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface AutoReviewResult {
  passed: boolean;
  checks: {
    transpile: AutoReviewCheck;
    bundle: AutoReviewCheck;
    health: AutoReviewCheck;
  };
  score: number;
}

/**
 * Run automated review on a codespace.
 *
 * @param codespaceId - The codespace to review
 * @param code - The source code to transpile-check (optional, fetched from session if missing)
 */
export async function runAutoReview(codespaceId: string, code?: string): Promise<AutoReviewResult> {
  const checks = await Promise.all([
    checkTranspile(codespaceId, code),
    checkBundle(codespaceId),
    checkHealth(codespaceId),
  ]);

  const [transpile, bundle, health] = checks;

  const passed = transpile.passed && bundle.passed && health.passed;
  const passedCount = checks.filter((c) => c.passed).length;
  const score = passedCount / checks.length;

  return {
    passed,
    checks: { transpile, bundle, health },
    score,
  };
}

async function checkTranspile(codespaceId: string, code?: string): Promise<AutoReviewCheck> {
  const start = Date.now();
  try {
    let sourceCode = code;
    if (!sourceCode) {
      const session = await getSession(codespaceId);
      sourceCode = session?.code;
    }

    if (!sourceCode) {
      return {
        name: "transpile",
        passed: false,
        error: "No source code available",
        durationMs: Date.now() - start,
      };
    }

    await transpileCode(sourceCode);
    return { name: "transpile", passed: true, durationMs: Date.now() - start };
  } catch (error) {
    return {
      name: "transpile",
      passed: false,
      error: error instanceof Error ? error.message : "Transpilation failed",
      durationMs: Date.now() - start,
    };
  }
}

async function checkBundle(codespaceId: string): Promise<AutoReviewCheck> {
  const start = Date.now();
  try {
    const session = await getSession(codespaceId);

    if (!session) {
      return {
        name: "bundle",
        passed: false,
        error: "Session not found",
        durationMs: Date.now() - start,
      };
    }

    // Verify transpiled output exists and is non-trivial
    const hasTranspiled = Boolean(
      session.transpiled &&
        session.transpiled.length > 50 &&
        !session.transpiled.includes("404 - for now"),
    );

    if (!hasTranspiled) {
      return {
        name: "bundle",
        passed: false,
        error: "No valid transpiled bundle found",
        durationMs: Date.now() - start,
      };
    }

    return { name: "bundle", passed: true, durationMs: Date.now() - start };
  } catch (error) {
    return {
      name: "bundle",
      passed: false,
      error: error instanceof Error ? error.message : "Bundle check failed",
      durationMs: Date.now() - start,
    };
  }
}

async function checkHealth(codespaceId: string): Promise<AutoReviewCheck> {
  const start = Date.now();
  try {
    const healthy = await isCodespaceHealthy(codespaceId);
    return {
      name: "health",
      passed: healthy,
      ...(healthy ? {} : { error: "Codespace is unhealthy" }),
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "health",
      passed: false,
      error: error instanceof Error ? error.message : "Health check failed",
      durationMs: Date.now() - start,
    };
  }
}
