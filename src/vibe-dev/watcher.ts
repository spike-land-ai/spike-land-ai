/**
 * File watcher that syncs local changes to testing.spike.land
 */

import chokidar, { type FSWatcher } from "chokidar";
import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { pullCode, pushCode, withRetry } from "./sync.js";

// Default debounce delay (ms)
const DEBOUNCE_MS = 100;

interface WatcherOptions {
  debounceMs?: number;
  onSync?: (codespaceId: string) => void;
  onError?: (codespaceId: string, error: Error) => void;
}

interface CodespaceWatcher {
  codespaceId: string;
  localPath: string;
  watcher: FSWatcher;
  stop: () => Promise<void>;
}

/**
 * Get the live directory path
 */
export function getLiveDir(): string {
  return join(process.cwd(), "live");
}

/**
 * Get local file path for a codespace
 */
export function getLocalPath(codespaceId: string): string {
  // Sanitize to prevent path traversal
  const sanitized = codespaceId.replace(/[^a-z0-9._-]/gi, "-");
  return join(getLiveDir(), `${sanitized}.tsx`);
}

/**
 * Ensure the live directory exists
 */
export function ensureLiveDir(): void {
  const dir = getLiveDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Download code to local file
 */
export async function downloadToLocal(codespaceId: string): Promise<string> {
  ensureLiveDir();

  const code = await pullCode(codespaceId);
  const localPath = getLocalPath(codespaceId);

  await writeFile(localPath, code, "utf-8");
  console.log(`📥 Downloaded ${codespaceId} → ${localPath} (${code.length} bytes)`);

  // Also save metadata
  const metaPath = localPath.replace(".tsx", ".meta.json");
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        codespaceId,
        downloadedAt: new Date().toISOString(),
        originalLength: code.length,
      },
      null,
      2,
    ),
    "utf-8",
  );

  return localPath;
}

/**
 * Start watching a codespace file for changes
 */
export function watchCodespace(
  codespaceId: string,
  options: WatcherOptions = {},
): CodespaceWatcher {
  const { debounceMs = DEBOUNCE_MS, onSync, onError } = options;

  const localPath = getLocalPath(codespaceId);
  console.log(`👀 Watching ${localPath}`);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = chokidar.watch(localPath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 10,
    },
  });

  watcher.on("change", async () => {
    // Debounce rapid changes
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      try {
        const code = await readFile(localPath, "utf-8");
        console.log(`📤 Syncing ${codespaceId} (${code.length} bytes)...`);

        await withRetry(() => pushCode(codespaceId, code));

        console.log(`✅ Synced ${codespaceId}`);
        onSync?.(codespaceId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Sync failed: ${err.message}`);
        onError?.(codespaceId, err);
      }
    }, debounceMs);
  });

  watcher.on("error", (error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`❌ Watcher error: ${err.message}`);
    onError?.(codespaceId, err);
  });

  return {
    codespaceId,
    localPath,
    watcher,
    stop: async () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      await watcher.close();
      console.log(`🛑 Stopped watching ${codespaceId}`);
    },
  };
}

/**
 * Start development mode for one or more codespaces
 */
export async function startDevMode(
  codespaceIds: string[],
  options: WatcherOptions = {},
): Promise<{ watchers: CodespaceWatcher[]; stop: () => Promise<void> }> {
  const watchers: CodespaceWatcher[] = [];

  // Download all codespaces first
  for (const id of codespaceIds) {
    await downloadToLocal(id);
    const watcher = watchCodespace(id, options);
    watchers.push(watcher);
  }

  console.log(`\n🚀 Development mode active for ${codespaceIds.length} codespace(s)`);
  console.log(`   Edit files in ./live/ directory`);
  console.log(`   Changes auto-sync to testing.spike.land\n`);

  return {
    watchers,
    stop: async () => {
      await Promise.all(watchers.map((w) => w.stop()));
    },
  };
}
