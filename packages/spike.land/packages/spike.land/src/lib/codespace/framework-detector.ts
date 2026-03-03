import { tryCatch } from "@/lib/try-catch";
import { parseGithubUrl } from "./github-resolver";
import type { BuildOptions } from "@spike-land-ai/esbuild-wasm";

export type Framework = "vite" | "next" | "cra" | "remix" | "plain";

export async function detectFramework(
  repoUrl: string,
  branchOrCommit?: string,
): Promise<Framework> {
  const parsed = parseGithubUrl(repoUrl, branchOrCommit);
  if (!parsed) return "plain";

  const pkgUrl = new URL("package.json", parsed.rawBaseUrl).href;
  const { data: response, error } = await tryCatch(fetch(pkgUrl));
  if (error || !response || !response.ok) {
    return "plain"; // no package.json found
  }

  const { data: pkg } = await tryCatch(response.json());
  if (!pkg) return "plain";

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps.next) return "next";
  if (deps["@remix-run/react"] || deps["@remix-run/node"]) return "remix";
  if (deps.vite) return "vite";
  if (deps["react-scripts"]) return "cra";

  return "plain";
}

export async function guessEntryPoint(
  repoUrl: string,
  framework: Framework,
  branchOrCommit?: string,
): Promise<string> {
  const parsed = parseGithubUrl(repoUrl, branchOrCommit);
  if (!parsed) return "index.js";

  // A simplistic sequence of entry points to check based on framework
  let possibleEntries: string[] = ["index.js"];

  switch (framework) {
    case "vite":
      possibleEntries = [
        "src/main.tsx",
        "src/main.ts",
        "src/main.jsx",
        "src/index.tsx",
        "src/index.ts",
      ];
      break;
    case "cra":
      possibleEntries = [
        "src/index.tsx",
        "src/index.ts",
        "src/index.jsx",
        "src/index.js",
      ];
      break;
    case "next":
      possibleEntries = [
        "app/layout.tsx",
        "app/page.tsx",
        "pages/_app.tsx",
        "pages/index.tsx",
      ];
      break;
    case "remix":
      possibleEntries = ["app/entry.client.tsx", "app/root.tsx"];
      break;
    case "plain":
      possibleEntries = [
        "index.ts",
        "index.tsx",
        "index.js",
        "src/index.ts",
        "src/index.tsx",
      ];
      break;
  }

  // Probe github to see which exists
  for (const entry of possibleEntries) {
    const probeUrl = new URL(entry, parsed.rawBaseUrl).href;
    const { data: res } = await tryCatch(fetch(probeUrl, { method: "HEAD" }));
    if (res && res.ok) {
      return entry;
    }
  }

  // Default fallback
  return possibleEntries[0] || "index.js";
}

export function generateEsbuildConfig(
  framework: Framework,
): Partial<BuildOptions> {
  const baseConfig: Partial<BuildOptions> = {
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    treeShaking: true,
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  };

  switch (framework) {
    case "vite":
    case "cra":
      return { ...baseConfig, jsx: "automatic" };
    case "next":
      return { ...baseConfig, jsx: "automatic" };
    case "remix":
      return { ...baseConfig, jsx: "automatic" };
    default:
      return { ...baseConfig };
  }
}
