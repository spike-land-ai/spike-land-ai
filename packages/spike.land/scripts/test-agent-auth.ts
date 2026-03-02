/**
 * Agent Auth Test Script
 *
 * Quick utility to verify AGENT_API_KEY authentication works against
 * the specified environment.
 *
 * Usage:
 *   yarn agent:test-auth        # Test against localhost:3000
 *   yarn agent:test-auth:prod   # Test against spike.land
 *   tsx scripts/test-agent-auth.ts --url=https://custom.url
 *
 * This script helps diagnose the common issue where AGENT_API_KEY
 * differs between local .env.local and Vercel production environment.
 */

import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

interface AuthTestResult {
  success: boolean;
  message: string;
  details?: {
    url: string;
    keyPrefix: string;
    keySuffix: string;
    statusCode?: number;
    errorBody?: string;
  };
}

// Parse CLI arguments
const args = process.argv.slice(2);
const isProd = args.includes("--prod");
const customUrlArg = args.find((a) => a.startsWith("--url="));
const verbose = args.includes("--verbose") || args.includes("-v");

// Determine target URL
const PROD_URL = "https://spike.land";
const LOCAL_URL = "http://localhost:3000";
let targetUrl = isProd ? PROD_URL : LOCAL_URL;

if (customUrlArg) {
  const eqIndex = customUrlArg.indexOf("=");
  const urlValue = eqIndex !== -1 ? customUrlArg.slice(eqIndex + 1) : "";

  if (!urlValue) {
    console.error("[ERROR] --url flag requires a value (e.g., --url=https://example.com)");
    process.exit(1);
  }
  targetUrl = urlValue;
}

/**
 * Mask an API key for safe display
 * Shows first 4 and last 4 characters
 */
function maskKey(key: string): { prefix: string; suffix: string; full: string } {
  if (!key || key.length < 12) {
    return {
      prefix: key?.substring(0, 4) || "????",
      suffix: "????",
      full: key ? `${key.substring(0, 4)}...` : "(not set)",
    };
  }
  const prefix = key.substring(0, 4);
  const suffix = key.substring(key.length - 4);
  return {
    prefix,
    suffix,
    full: `${prefix}...${suffix}`,
  };
}

/**
 * Test authentication against /api/agent/queue endpoint
 */
async function testAuth(apiUrl: string, apiKey: string): Promise<AuthTestResult> {
  const masked = maskKey(apiKey);

  console.log(`\nTesting authentication...`);
  console.log(`  Target URL: ${apiUrl}`);
  console.log(`  Key preview: [masked]`);

  if (!apiKey) {
    return {
      success: false,
      message: "AGENT_API_KEY is not set in environment",
      details: {
        url: apiUrl,
        keyPrefix: "N/A",
        keySuffix: "N/A",
      },
    };
  }

  try {
    // Test the queue endpoint which requires auth
    const response = await fetch(`${apiUrl}/api/agent/queue`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const body = await response.text();

    if (response.ok) {
      return {
        success: true,
        message: "Authentication successful",
        details: {
          url: `${apiUrl}/api/agent/queue`,
          keyPrefix: masked.prefix,
          keySuffix: masked.suffix,
          statusCode: response.status,
        },
      };
    }

    // Auth failed
    return {
      success: false,
      message: `Authentication failed: HTTP ${response.status}`,
      details: {
        url: `${apiUrl}/api/agent/queue`,
        keyPrefix: masked.prefix,
        keySuffix: masked.suffix,
        statusCode: response.status,
        errorBody: body.substring(0, 200),
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Connection error: ${errorMsg}`,
      details: {
        url: `${apiUrl}/api/agent/queue`,
        keyPrefix: masked.prefix,
        keySuffix: masked.suffix,
        errorBody: errorMsg,
      },
    };
  }
}

/**
 * Test the respond endpoint (write operation)
 */
async function testRespondEndpoint(apiUrl: string, apiKey: string): Promise<AuthTestResult> {
  console.log(`\nTesting respond endpoint auth...`);

  const testAppId = "test-auth-check-" + Date.now();

  try {
    const response = await fetch(`${apiUrl}/api/agent/apps/${testAppId}/respond`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Auth test - this should fail with 404 if app doesn't exist",
        codeUpdated: false,
        processedMessageIds: [],
      }),
    });

    const body = await response.text();
    const masked = maskKey(apiKey);

    // 401 = auth failed, 404 = auth passed but app not found (expected)
    if (response.status === 404) {
      return {
        success: true,
        message: "Respond endpoint auth successful (404 = app not found, which is expected)",
        details: {
          url: `${apiUrl}/api/agent/apps/{appId}/respond`,
          keyPrefix: masked.prefix,
          keySuffix: masked.suffix,
          statusCode: response.status,
        },
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: `Respond endpoint auth FAILED: HTTP ${response.status}`,
        details: {
          url: `${apiUrl}/api/agent/apps/{appId}/respond`,
          keyPrefix: masked.prefix,
          keySuffix: masked.suffix,
          statusCode: response.status,
          errorBody: body.substring(0, 200),
        },
      };
    }

    // Other status codes - depends on the specific case
    return {
      success: response.ok,
      message: `Respond endpoint returned HTTP ${response.status}`,
      details: {
        url: `${apiUrl}/api/agent/apps/{appId}/respond`,
        keyPrefix: masked.prefix,
        keySuffix: masked.suffix,
        statusCode: response.status,
        errorBody: body.substring(0, 200),
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Connection error: ${errorMsg}`,
      details: {
        url: `${apiUrl}/api/agent/apps/{appId}/respond`,
        keyPrefix: maskKey(apiKey).prefix,
        keySuffix: maskKey(apiKey).suffix,
        errorBody: errorMsg,
      },
    };
  }
}

async function main(): Promise<void> {
  console.log("Agent Auth Test");
  console.log("================");
  console.log(`Environment: ${isProd ? "PRODUCTION" : "LOCAL"}`);
  console.log(`Target: ${targetUrl}`);

  const apiKey = process.env.AGENT_API_KEY;

  if (!apiKey) {
    console.error("\n[ERROR] AGENT_API_KEY is not set!");
    console.error("Make sure it's defined in .env.local or .env\n");
    process.exit(1);
  }

  // Test queue endpoint (read)
  const queueResult = await testAuth(targetUrl, apiKey);
  printResult("Queue Endpoint (GET)", queueResult);

  // Test respond endpoint (write)
  const respondResult = await testRespondEndpoint(targetUrl, apiKey);
  printResult("Respond Endpoint (POST)", respondResult);

  // Summary
  console.log("\n================");
  const allPassed = queueResult.success && respondResult.success;

  if (allPassed) {
    console.log("[SUCCESS] All auth tests passed\n");
    console.log("Your AGENT_API_KEY is correctly configured for", isProd ? "production" : "local");

    if (!isProd) {
      console.log("\nTo test production auth:");
      console.log("  yarn agent:test-auth:prod");
    }
  } else {
    console.error("[FAILED] Some auth tests failed\n");

    console.log("Troubleshooting steps:");
    console.log("1. Verify AGENT_API_KEY in .env.local matches Vercel environment");
    console.log(
      "2. Check Vercel dashboard: https://vercel.com/[team]/spike.land/settings/environment-variables",
    );
    console.log("3. Pull Vercel env: vercel env pull --environment=production");
    console.log("4. Compare keys: diff .env.local .env.local.vercel\n");

    process.exit(1);
  }
}

function printResult(testName: string, result: AuthTestResult): void {
  const status = result.success ? "[PASS]" : "[FAIL]";
  console.log(`\n${status} ${testName}`);
  console.log(`  ${result.message}`);

  if (verbose && result.details) {
    console.log(`  URL: ${result.details.url}`);
    console.log(`  Key: ${result.details.keyPrefix}...${result.details.keySuffix}`);
    if (result.details.statusCode) {
      console.log(`  Status: ${result.details.statusCode}`);
    }
    if (result.details.errorBody && !result.success) {
      console.log(`  Error: ${result.details.errorBody}`);
    }
  }
}

main().catch(console.error);
