import {
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import { createReadStream, createWriteStream, existsSync } from "fs";
import { unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";

export interface BackupConfig {
  bucketName: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface BackupDependencies {
  s3Client: S3Client;
  config: BackupConfig;
  dryRun?: boolean;
}

export interface BackupOptions {
  dryRun?: boolean;
  maxRetries?: number;
  initialRetryDelayMs?: number;
}

const REQUIRED_ENV_VARS = [
  "CLOUDFLARE_R2_BUCKET_NAME",
  "CLOUDFLARE_R2_ENDPOINT",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "DATABASE_URL",
] as const;

/**
 * Validates required environment variables and returns configuration
 * @throws Error if any required environment variable is missing or empty
 */
export function getConfigFromEnv(): BackupConfig {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    if (value === undefined) {
      missing.push(varName);
    } else if (value.trim() === "") {
      empty.push(varName);
    }
  }

  if (missing.length > 0 || empty.length > 0) {
    const errors: string[] = [];
    if (missing.length > 0) {
      errors.push(`Missing environment variables: ${missing.join(", ")}`);
    }
    if (empty.length > 0) {
      errors.push(
        `Empty environment variables (check GitHub secrets configuration): ${empty.join(", ")}`,
      );
    }
    throw new Error(errors.join("\n"));
  }

  return {
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  };
}

/**
 * Creates an S3 client configured for Cloudflare R2
 */
export function createS3Client(config: BackupConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Check if pg_dump is available on the system
 */
export async function checkPgDumpAvailable(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn("pg_dump", ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: stderr || "pg_dump not found or failed",
        });
      }
    });
    proc.on("error", (err) => {
      resolve({ success: false, error: `pg_dump not found: ${err.message}` });
    });
  });
}

/**
 * Check R2 connectivity by attempting to access the bucket
 */
export async function checkR2Connectivity(
  s3Client: S3Client,
  bucketName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      error: `R2 connectivity check failed: ${error.message}`,
    };
  }
}

/**
 * Check database connectivity using pg_isready
 */
export async function checkDatabaseConnectivity(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      resolve({ success: false, error: "DATABASE_URL not set" });
      return;
    }

    // Parse DATABASE_URL to extract host and port for pg_isready
    let host = "localhost";
    let port = "5432";
    try {
      const url = new URL(databaseUrl);
      host = url.hostname;
      port = url.port || "5432";
    } catch {
      resolve({ success: false, error: "Invalid DATABASE_URL format" });
      return;
    }

    const proc = spawn("pg_isready", ["-h", host, "-p", port], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: `Database connectivity check failed: ${
            stderr || stdout || "pg_isready returned non-zero"
          }`,
        });
      }
    });

    proc.on("error", (err) => {
      // pg_isready not found - fall back to assuming connection is okay
      // The actual pg_dump will fail with a clearer error if DB is unreachable
      console.log(
        `pg_isready not available: ${err.message}. Skipping database connectivity check.`,
      );
      resolve({ success: true });
    });
  });
}

/**
 * Run pre-flight checks before starting backup with retry logic for network-related checks
 */
export async function runPreflightChecks(
  s3Client: S3Client,
  config: BackupConfig,
  options: { maxRetries?: number; initialDelayMs?: number } = {},
): Promise<{ success: boolean; errors: string[] }> {
  const { maxRetries = 3, initialDelayMs = 1000 } = options;
  const errors: string[] = [];

  // Check pg_dump availability (no retry needed - local binary check)
  const pgDumpCheck = await checkPgDumpAvailable();
  if (!pgDumpCheck.success) {
    errors.push(`pg_dump check failed: ${pgDumpCheck.error}`);
  }

  // Check database connectivity with retry
  try {
    await withRetry(
      async () => {
        const dbCheck = await checkDatabaseConnectivity();
        if (!dbCheck.success) {
          throw new Error(dbCheck.error);
        }
      },
      {
        maxRetries,
        initialDelayMs,
        operationName: "Database connectivity check",
      },
    );
  } catch (err) {
    const error = err as Error;
    errors.push(`Database connectivity failed: ${error.message}`);
  }

  // Check R2 connectivity with retry
  try {
    await withRetry(
      async () => {
        const r2Check = await checkR2Connectivity(s3Client, config.bucketName);
        if (!r2Check.success) {
          throw new Error(r2Check.error);
        }
      },
      { maxRetries, initialDelayMs, operationName: "R2 connectivity check" },
    );
  } catch (err) {
    const error = err as Error;
    errors.push(`R2 connectivity failed: ${error.message}`);
  }

  return { success: errors.length === 0, errors };
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an operation with exponential backoff retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelayMs: number;
    operationName: string;
  },
): Promise<T> {
  const { maxRetries, initialDelayMs, operationName } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(
          `${operationName} attempt ${attempt} failed: ${lastError.message}. Retrying in ${delayMs}ms...`,
        );
        await sleep(delayMs);
      }
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): BackupOptions {
  const options: BackupOptions = {};
  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--max-retries=")) {
      const value = parseInt(arg.split("=")[1] ?? "", 10);
      if (!isNaN(value) && value > 0) {
        options.maxRetries = value;
      }
    } else if (arg.startsWith("--retry-delay=")) {
      const value = parseInt(arg.split("=")[1] ?? "", 10);
      if (!isNaN(value) && value > 0) {
        options.initialRetryDelayMs = value;
      }
    }
  }
  return options;
}

/**
 * Safely clean up local files
 */
async function cleanupFiles(files: string[]): Promise<void> {
  for (const file of files) {
    try {
      if (existsSync(file)) {
        await unlink(file);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Filters and validates backup objects from S3 listing
 */
export function filterValidBackups(
  contents: { Key?: string; LastModified?: Date }[] | undefined,
): { Key: string; LastModified: Date }[] {
  return (contents || []).filter(
    (obj): obj is { Key: string; LastModified: Date } =>
      !!obj.Key && !!obj.LastModified && obj.Key.endsWith(".sql.gz"),
  );
}

/**
 * Main backup function that can be called with injected dependencies for testing
 */
export async function runBackup(
  deps: BackupDependencies,
  options: BackupOptions = {},
): Promise<void> {
  const { s3Client, config } = deps;
  const dryRun = options.dryRun ?? deps.dryRun ?? false;
  const maxRetries = options.maxRetries ?? 3;
  const initialRetryDelayMs = options.initialRetryDelayMs ?? 1000;

  if (dryRun) {
    console.log("=== DRY-RUN MODE - No actual changes will be made ===\n");
  }

  // Run pre-flight checks
  console.log("Running pre-flight checks...");
  const preflightResult = await runPreflightChecks(s3Client, config);
  if (!preflightResult.success) {
    throw new Error(`Pre-flight checks failed:\n  - ${preflightResult.errors.join("\n  - ")}`);
  }
  console.log("Pre-flight checks passed.\n");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql`;
  const compressedFilename = `${filename}.gz`;
  const filepath = `/tmp/${filename}`;
  const compressedFilepath = `/tmp/${compressedFilename}`;

  try {
    // pg_dump with retry logic
    console.log("Starting database backup...");
    if (dryRun) {
      console.log(`[DRY-RUN] Would execute: pg_dump --format=p --file=${filepath}`);
    } else {
      await withRetry(
        () =>
          new Promise<void>((resolve, reject) => {
            const proc = spawn(
              "pg_dump",
              ["--format=p", `--file=${filepath}`, process.env.DATABASE_URL!],
              {
                stdio: "inherit",
                env: process.env,
              },
            );
            proc.on("close", (code) => {
              if (code === 0) resolve();
              else reject(new Error(`pg_dump exited with code ${code}`));
            });
            proc.on("error", reject);
          }),
        {
          maxRetries,
          initialDelayMs: initialRetryDelayMs,
          operationName: "Database dump",
        },
      );
    }
    console.log("Database backup completed.\n");

    // Compress backup
    console.log("Compressing backup file...");
    if (dryRun) {
      console.log(`[DRY-RUN] Would compress: ${filepath} -> ${compressedFilepath}`);
    } else {
      const source = createReadStream(filepath);
      const destination = createWriteStream(compressedFilepath);
      await pipeline(source, createGzip(), destination);
    }
    console.log("Backup file compressed.\n");

    // Upload with retry logic
    console.log("Uploading backup to R2...");
    if (dryRun) {
      console.log(
        `[DRY-RUN] Would upload: ${compressedFilepath} -> s3://${config.bucketName}/${compressedFilename}`,
      );
    } else {
      await withRetry(
        async () => {
          const fileStream = createReadStream(compressedFilepath);
          const uploadParams = {
            Bucket: config.bucketName,
            Key: compressedFilename,
            Body: fileStream,
          };
          await s3Client.send(new PutObjectCommand(uploadParams));
        },
        {
          maxRetries,
          initialDelayMs: initialRetryDelayMs,
          operationName: "R2 upload",
        },
      );
    }
    console.log("Backup uploaded to R2.\n");

    // Clean up local files
    console.log("Cleaning up local files...");
    if (dryRun) {
      console.log(`[DRY-RUN] Would delete: ${filepath}, ${compressedFilepath}`);
    } else {
      await unlink(filepath);
      await unlink(compressedFilepath);
    }
    console.log("Local files cleaned up.\n");

    // Apply rotation policy with retry
    console.log("Applying rotation policy (keeping last 7 backups)...");
    const { Contents } = await s3Client.send(
      new ListObjectsCommand({ Bucket: config.bucketName, Prefix: "backup-" }),
    );

    const validBackups = filterValidBackups(Contents);

    if (validBackups.length > 7) {
      const sortedBackups = [...validBackups].sort(
        (a, b) => new Date(a.LastModified).getTime() - new Date(b.LastModified).getTime(),
      );
      const backupsToDelete = sortedBackups.slice(0, sortedBackups.length - 7);
      for (const backup of backupsToDelete) {
        if (dryRun) {
          console.log(`[DRY-RUN] Would delete old backup: ${backup.Key}`);
        } else {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: config.bucketName,
              Key: backup.Key,
            }),
          );
          console.log(`Deleted old backup: ${backup.Key}`);
        }
      }
    }
    console.log("Rotation policy applied.\n");

    console.log("Backup process completed successfully.");
  } catch (error) {
    // Clean up on failure
    await cleanupFiles([filepath, compressedFilepath]);
    throw error;
  }
}

/**
 * Main entry point that reads config from environment
 */
export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);

  console.log("===========================================");
  console.log("Database Backup Script");
  console.log("===========================================\n");

  if (options.dryRun) {
    console.log("Mode: DRY-RUN (no actual changes will be made)\n");
  }

  // Environment variable diagnostics
  console.log("Environment check:");
  console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? "[SET]" : "[MISSING]"}`);
  console.log(
    `- CLOUDFLARE_R2_BUCKET_NAME: ${process.env.CLOUDFLARE_R2_BUCKET_NAME ? "[SET]" : "[MISSING]"}`,
  );
  console.log(
    `- CLOUDFLARE_R2_ENDPOINT: ${process.env.CLOUDFLARE_R2_ENDPOINT ? "[SET]" : "[MISSING]"}`,
  );
  console.log(
    `- CLOUDFLARE_R2_ACCESS_KEY_ID: ${
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ? "[SET]" : "[MISSING]"
    }`,
  );
  console.log(
    `- CLOUDFLARE_R2_SECRET_ACCESS_KEY: ${
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ? "[SET]" : "[MISSING]"
    }\n`,
  );

  try {
    const config = getConfigFromEnv();
    const s3Client = createS3Client(config);
    await runBackup({ s3Client, config }, options);
  } catch (error) {
    console.error("\n===========================================");
    console.error("BACKUP FAILED");
    console.error("===========================================");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("===========================================\n");
    process.exit(1);
  }
}

// Only run when executed directly (not when imported for testing)
const isMainModule = typeof require !== "undefined" && require.main === module;
const isDirectExecution = process.argv[1]?.endsWith("backup.ts");

if (isMainModule || isDirectExecution) {
  main();
}
