#!/usr/bin/env tsx
/**
 * Apple Sign-In Client Secret Generator
 *
 * Apple OAuth requires a JWT-based client secret instead of a static secret.
 * This script generates the required JWT using your Apple Developer credentials.
 *
 * Usage:
 *   yarn generate:apple-secret
 *
 * Required inputs (will prompt if not provided via env):
 *   - APPLE_TEAM_ID: Your 10-character Apple Team ID
 *   - AUTH_APPLE_ID: Your Services ID (client ID)
 *   - APPLE_KEY_ID: Your 10-character Key ID
 *   - APPLE_PRIVATE_KEY or APPLE_PRIVATE_KEY_PATH: The private key content or path to .p8 file
 *
 * The generated secret is valid for 6 months (maximum allowed by Apple).
 * Set a reminder to regenerate before expiration!
 */

import { importPKCS8, SignJWT } from "jose";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

interface AppleCredentials {
  teamId: string;
  clientId: string;
  keyId: string;
  privateKey: string;
}

function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function getCredentials(): Promise<AppleCredentials> {
  const rl = createPrompt();

  console.log("\n🍎 Apple Sign-In Client Secret Generator\n");
  console.log("This script generates a JWT client secret for Apple OAuth.");
  console.log("The secret will be valid for 6 months.\n");
  console.log("─".repeat(50) + "\n");

  // Team ID (use bracket notation for env vars not in type definitions)
  let teamId = process.env.APPLE_TEAM_ID || "";
  if (!teamId) {
    console.log("Team ID: Found in top-right corner of Apple Developer portal");
    console.log("Example: ABCD123456\n");
    teamId = await prompt(rl, "Enter your Apple Team ID (10 chars): ");
  } else {
    console.log(`✓ Using Team ID from environment: ${teamId}`);
  }

  if (!/^[A-Z0-9]{10}$/.test(teamId)) {
    console.error("\n❌ Error: Team ID must be exactly 10 alphanumeric characters");
    process.exit(1);
  }

  // Client ID (Services ID)
  let clientId = process.env.AUTH_APPLE_ID || "";
  if (!clientId) {
    console.log("\nServices ID: The identifier you created for web Sign in with Apple");
    console.log("Example: com.spike.land.web\n");
    clientId = await prompt(rl, "Enter your Services ID (AUTH_APPLE_ID): ");
  } else {
    console.log(`✓ Using Services ID from environment: ${clientId}`);
  }

  if (!clientId || clientId.length < 3) {
    console.error("\n❌ Error: Services ID is required");
    process.exit(1);
  }

  // Key ID (use bracket notation for env vars not in type definitions)
  let keyId = process.env.APPLE_KEY_ID || "";
  if (!keyId) {
    console.log("\nKey ID: Shown when you create/view a key in Apple Developer portal");
    console.log("Example: ABC123DEFG\n");
    keyId = await prompt(rl, "Enter your Key ID (10 chars): ");
  } else {
    console.log(`✓ Using Key ID from environment: ${keyId}`);
  }

  if (!/^[A-Z0-9]{10}$/.test(keyId)) {
    console.error("\n❌ Error: Key ID must be exactly 10 alphanumeric characters");
    process.exit(1);
  }

  // Private Key (use bracket notation for env vars not in type definitions)
  let privateKey = process.env.APPLE_PRIVATE_KEY || "";
  const privateKeyPath = process.env.APPLE_PRIVATE_KEY_PATH || "";

  if (!privateKey && privateKeyPath) {
    const resolvedPath = path.resolve(privateKeyPath);
    if (fs.existsSync(resolvedPath)) {
      privateKey = fs.readFileSync(resolvedPath, "utf-8");
      console.log(`✓ Loaded private key from: ${resolvedPath}`);
    } else {
      console.error(`\n❌ Error: Private key file not found: ${resolvedPath}`);
      process.exit(1);
    }
  }

  if (!privateKey) {
    console.log("\nPrivate Key: The .p8 file you downloaded from Apple Developer portal");
    console.log("You can either:");
    console.log("  1. Provide the path to your .p8 file");
    console.log("  2. Paste the key content directly\n");

    const keyInput = await prompt(rl, "Enter path to .p8 file or paste key content:\n");

    if (keyInput.includes("-----BEGIN PRIVATE KEY-----")) {
      privateKey = keyInput;
    } else {
      const resolvedPath = path.resolve(keyInput);
      if (fs.existsSync(resolvedPath)) {
        privateKey = fs.readFileSync(resolvedPath, "utf-8");
      } else {
        console.error(`\n❌ Error: File not found: ${resolvedPath}`);
        process.exit(1);
      }
    }
  }

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    console.error("\n❌ Error: Invalid private key format. Must be a PEM-formatted PKCS8 key.");
    process.exit(1);
  }

  rl.close();

  return { teamId, clientId, keyId, privateKey };
}

async function generateClientSecret(credentials: AppleCredentials): Promise<string> {
  const { teamId, clientId, keyId, privateKey } = credentials;

  // Import the private key
  const key = await importPKCS8(privateKey, "ES256");

  // Calculate expiration (6 months from now - maximum allowed by Apple)
  const now = Math.floor(Date.now() / 1000);
  const sixMonthsInSeconds = 6 * 30 * 24 * 60 * 60; // ~180 days
  const expiresAt = now + sixMonthsInSeconds;

  // Generate the JWT
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId)
    .sign(key);

  return jwt;
}

async function main(): Promise<void> {
  try {
    const credentials = await getCredentials();

    console.log("\n─".repeat(50));
    console.log("\n🔐 Generating client secret...\n");

    const clientSecret = await generateClientSecret(credentials);

    const expirationDate = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);

    console.log("✅ Client secret generated successfully!\n");
    console.log("─".repeat(50));
    console.log("\nAUTH_APPLE_SECRET=");
    console.log(clientSecret);
    console.log("\n" + "─".repeat(50));
    console.log(`\n⏰ This secret expires on: ${expirationDate.toISOString().split("T")[0]}`);
    console.log("   Set a calendar reminder to regenerate before this date!\n");
    console.log("📋 Next steps:");
    console.log("   1. Copy the secret above");
    console.log("   2. Add it to your .env.local file as AUTH_APPLE_SECRET");
    console.log("   3. Add it to Vercel Environment Variables for production");
    console.log("   4. Test Sign in with Apple on your site\n");
  } catch (error) {
    console.error("\n❌ Error generating client secret:", error);
    process.exit(1);
  }
}

main();
