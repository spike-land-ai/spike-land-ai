import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import type { DeployState, Phase3Plan, Phase3Result, VersionInfo } from "./types.js";

const DATA_DIR = join(process.cwd(), ".bazdmeg");
const DEPLOY_STATE_FILE = join(DATA_DIR, "deploy-state.json");
const R2_BUCKET = "spike-app-assets";
const VERSION_URL = "https://spike.land/api/version";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
};

function loadDeployState(): DeployState {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DEPLOY_STATE_FILE)) {
    return { lastSha: "", workerHashes: {}, lastDeployedAt: "" };
  }
  return JSON.parse(readFileSync(DEPLOY_STATE_FILE, "utf-8")) as DeployState;
}

function saveDeployState(state: DeployState): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DEPLOY_STATE_FILE, JSON.stringify(state, null, 2));
}

function md5File(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash("md5").update(content).digest("hex");
}

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function getContentType(filePath: string): string {
  return CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
}

function fetchDeployedVersion(): VersionInfo | null {
  try {
    const output = execSync(`curl -sf --max-time 10 "${VERSION_URL}"`, {
      encoding: "utf-8",
    });
    return JSON.parse(output) as VersionInfo;
  } catch {
    return null;
  }
}

function getGitTreeHash(path: string): string {
  try {
    return execSync(`git ls-tree -r HEAD -- "${path}" | git hash-object --stdin`, {
      encoding: "utf-8",
      cwd: process.cwd(),
    }).trim();
  } catch {
    return "";
  }
}

function getHeadSha(): string {
  return execSync("git rev-parse HEAD", {
    encoding: "utf-8",
    cwd: process.cwd(),
  }).trim();
}

function getCommitTime(): string {
  return execSync("git log -1 --format=%cI HEAD", {
    encoding: "utf-8",
    cwd: process.cwd(),
  }).trim();
}

function injectBuildMeta(distDir: string, sha: string, time: string): void {
  const indexPath = join(distDir, "index.html");
  if (!existsSync(indexPath)) return;
  let html = readFileSync(indexPath, "utf-8");
  html = html.replace(
    "</head>",
    `<meta name="build-sha" content="${sha}" /><meta name="build-time" content="${time}" /></head>`,
  );
  writeFileSync(indexPath, html);
}

function uploadFile(filePath: string, key: string): void {
  const contentType = getContentType(filePath);
  execFileSync(
    "yarn",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${R2_BUCKET}/${key}`,
      "--file",
      filePath,
      "--content-type",
      contentType,
      "--remote",
    ],
    { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] },
  );
}

export function deploySPA(): { uploaded: number; skipped: number } {
  const distDir = join(process.cwd(), "packages/spike-web/dist");
  const sha = getHeadSha();
  const commitTime = getCommitTime();

  // Build spike-app
  console.log("  Building spike-app...");
  execSync("npm run build", {
    cwd: join(process.cwd(), "packages/spike-web"),
    stdio: "inherit",
  });

  // Inject build metadata
  injectBuildMeta(distDir, sha, commitTime);

  // Get deployed assets for hash comparison
  const deployed = fetchDeployedVersion();
  const deployedEtags = new Map<string, string>();
  if (deployed) {
    for (const asset of deployed.assets) {
      // R2 ETags are quoted MD5 hex — strip quotes
      deployedEtags.set(asset.key, asset.etag.replace(/"/g, ""));
    }
  }

  // Compare and upload
  const localFiles = getAllFiles(distDir);
  let uploaded = 0;
  let skipped = 0;

  for (const filePath of localFiles) {
    const key = relative(distDir, filePath);
    const localMd5 = md5File(filePath);
    const remoteMd5 = deployedEtags.get(key);

    if (localMd5 === remoteMd5) {
      skipped++;
    } else {
      uploadFile(filePath, key);
      uploaded++;
    }
  }

  // Update deploy state
  const state = loadDeployState();
  state.lastSha = sha;
  state.lastDeployedAt = new Date().toISOString();
  saveDeployState(state);

  return { uploaded, skipped };
}

const WORKER_PACKAGES = [
  "spike-edge",
  "spike-land-mcp",
  "mcp-auth",
  "spike-land-backend",
  "transpile",
];

export function getPhase3Plan(): Phase3Plan {
  const state = loadDeployState();
  const currentSha = getHeadSha();
  const spaDistExists = existsSync(join(process.cwd(), "packages/spike-web/dist/index.html"));
  const workersPending = WORKER_PACKAGES.filter((pkg) => {
    const pkgDir = join(process.cwd(), "src", pkg);
    if (!existsSync(pkgDir)) return false;
    const treeHash = getGitTreeHash(join("src", pkg));
    return treeHash !== state.workerHashes[pkg];
  });

  return {
    currentSha,
    lastDeployedSha: state.lastSha,
    spaDistExists,
    spaNeedsDeploy: state.lastSha !== currentSha || !spaDistExists,
    workersPending,
  };
}

export function deployWorkers(): string[] {
  const state = loadDeployState();
  const deployed: string[] = [];

  for (const pkg of WORKER_PACKAGES) {
    const pkgDir = join(process.cwd(), "src", pkg);
    if (!existsSync(pkgDir)) continue;

    const treeHash = getGitTreeHash(join("src", pkg));
    const lastHash = state.workerHashes[pkg];

    if (treeHash === lastHash) {
      console.log(`  ${pkg}: skip (unchanged)`);
      continue;
    }

    console.log(`  ${pkg}: deploying...`);
    try {
      execSync("npm run deploy", {
        cwd: pkgDir,
        stdio: "inherit",
        timeout: 120_000,
      });
      state.workerHashes[pkg] = treeHash;
      deployed.push(pkg);
    } catch {
      console.error(`  ${pkg}: deploy failed`);
    }
  }

  saveDeployState(state);
  return deployed;
}

interface SmokeResult {
  endpoint: string;
  passed: boolean;
  status: number | null;
  error?: string;
}

function smokeTest(): SmokeResult[] {
  const endpoints: Array<{ url: string; expect: (status: number) => boolean }> = [
    { url: "https://spike.land", expect: (s) => s === 200 },
    { url: "https://spike.land/api/version", expect: (s) => s === 200 },
    { url: "https://auth-mcp.spike.land/", expect: (s) => s >= 200 && s < 400 },
    { url: "https://mcp.spike.land/", expect: (s) => s >= 200 && s < 500 },
  ];

  const results: SmokeResult[] = [];

  for (const { url, expect } of endpoints) {
    try {
      const output = execSync(`curl -sf -o /dev/null -w "%{http_code}" --max-time 15 "${url}"`, {
        encoding: "utf-8",
      });
      const status = parseInt(output.trim(), 10);
      const passed = expect(status);
      results.push({ endpoint: url, passed, status });
      console.log(`  ${passed ? "PASS" : "FAIL"} ${url} → ${status}`);
    } catch {
      results.push({ endpoint: url, passed: false, status: null, error: "unreachable" });
      console.log(`  FAIL ${url} → unreachable`);
    }
  }

  return results;
}

export function runPhase3(): Phase3Result {
  const start = Date.now();

  console.log("  SPA deploy:");
  const { uploaded, skipped } = deploySPA();
  console.log(`  SPA: ${uploaded} upload, ${skipped} skip (hash match)`);

  console.log("  Worker deploy:");
  const workersDeployed = deployWorkers();

  console.log("  Smoke tests:");
  smokeTest();

  return {
    spaUploaded: uploaded,
    spaSkipped: skipped,
    workersDeployed,
    durationMs: Date.now() - start,
  };
}
