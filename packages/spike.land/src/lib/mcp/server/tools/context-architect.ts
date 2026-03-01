/**
 * Context Architect Tools (Server-Side)
 *
 * MCP tools for indexing GitHub repositories, selecting relevant files
 * for a task, and analyzing import dependency graphs.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

interface FileEntry {
    path: string;
    size: number;
    type: string;
}

interface RepoIndexData {
    url: string;
    branch: string;
    files: FileEntry[];
    indexedAt: Date;
}

interface GitHubTreeEntry {
    path?: string;
    mode?: string;
    type?: string;
    sha?: string;
    size?: number;
    url?: string;
}

interface GitHubTreeResponse {
    sha: string;
    url: string;
    tree: GitHubTreeEntry[];
    truncated: boolean;
}

// In-memory storage for indexed repos, keyed by `${userId}:${repoUrl}`
const repoIndex = new Map<string, RepoIndexData>();

function repoKey(userId: string, repoUrl: string): string {
    return `${userId}:${repoUrl}`;
}

function parseGitHubUrl(url: string): { owner: string; repo: string; } | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    const repo = match[2]!.replace(/\.git$/, "");
    return { owner: match[1]!, repo };
}

function getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf(".");
    if (lastDot === -1) return "";
    const lastSlash = filePath.lastIndexOf("/");
    if (lastDot < lastSlash) return "";
    return filePath.slice(lastDot + 1).toLowerCase();
}

function detectTechStack(files: FileEntry[]): string[] {
    const stack = new Set<string>();
    const extensions = new Set(files.map(f => f.type));
    const paths = files.map(f => f.path);

    if (extensions.has("ts") || extensions.has("tsx")) stack.add("TypeScript");
    if (extensions.has("js") || extensions.has("jsx")) stack.add("JavaScript");
    if (extensions.has("py")) stack.add("Python");
    if (extensions.has("rs")) stack.add("Rust");
    if (extensions.has("go")) stack.add("Go");
    if (extensions.has("java")) stack.add("Java");
    if (extensions.has("rb")) stack.add("Ruby");
    if (extensions.has("php")) stack.add("PHP");
    if (extensions.has("cs")) stack.add("C#");
    if (extensions.has("swift")) stack.add("Swift");
    if (extensions.has("kt")) stack.add("Kotlin");

    if (paths.some(p => p === "package.json")) stack.add("Node.js");
    if (
        paths.some(p =>
            p === "next.config.js" || p === "next.config.ts"
            || p === "next.config.mjs"
        )
    ) stack.add("Next.js");
    if (paths.some(p => p === "vite.config.ts" || p === "vite.config.js")) {
        stack.add("Vite");
    }
    if (paths.some(p => p === "Cargo.toml")) stack.add("Rust/Cargo");
    if (paths.some(p => p === "go.mod")) stack.add("Go Modules");
    if (paths.some(p => p === "pyproject.toml")) stack.add("Python");
    if (paths.some(p => p === "Dockerfile" || p === "docker-compose.yml")) {
        stack.add("Docker");
    }
    if (
        paths.some(p => p === "tailwind.config.ts" || p === "tailwind.config.js")
    ) stack.add("Tailwind CSS");

    return Array.from(stack);
}

function getTopDirectories(files: FileEntry[], count: number): string[] {
    const dirCounts = new Map<string, number>();
    for (const file of files) {
        const slashIdx = file.path.indexOf("/");
        if (slashIdx !== -1) {
            const topDir = file.path.slice(0, slashIdx);
            dirCounts.set(topDir, (dirCounts.get(topDir) ?? 0) + 1);
        }
    }
    return Array.from(dirCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([dir, cnt]) => `${dir}/ (${cnt} files)`);
}

// Scoring constants for context_pack
const SOURCE_DIR_PATTERNS = [
    "src/",
    "lib/",
    "app/",
    "routes/",
    "components/",
    "pages/",
    "utils/",
    "helpers/",
    "services/",
    "api/",
    "hooks/",
    "models/",
];
const PENALTY_PATTERNS = [
    ".test.",
    ".spec.",
    "__tests__/",
    "__mocks__/",
    ".config.",
    "jest.",
    "vitest.",
    "eslint",
    "prettier",
    "node_modules/",
    ".github/",
    "dist/",
    "build/",
    ".lock",
    "package-lock",
    "yarn.lock",
];

function scoreFile(file: FileEntry, keywords: string[]): number {
    const pathLower = file.path.toLowerCase();
    let score = 0;

    for (const kw of keywords) {
        if (pathLower.includes(kw)) score += 3;
    }

    for (const pattern of SOURCE_DIR_PATTERNS) {
        if (pathLower.includes(pattern)) {
            score += 2;
            break;
        }
    }

    for (const pattern of PENALTY_PATTERNS) {
        if (pathLower.includes(pattern)) {
            score -= 5;
            break;
        }
    }

    const codeExtensions = new Set([
        "ts",
        "tsx",
        "js",
        "jsx",
        "py",
        "rs",
        "go",
        "java",
        "rb",
    ]);
    if (codeExtensions.has(file.type)) {
        score += 1;
    }

    return score;
}

const IMPORT_PATTERN =
    /(?:import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]|from\s+['"]([^'"]+)['"]\s+import)/g;

function parseImports(content: string): string[] {
    const imports: string[] = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(IMPORT_PATTERN.source, IMPORT_PATTERN.flags);
    while ((match = regex.exec(content)) !== null) {
        const imp = match[1] ?? match[2];
        if (imp) imports.push(imp);
    }
    return imports;
}

export function registerContextArchitectTools(
    registry: ToolRegistry,
    userId: string,
): void {
    // context_index_repo
    registry.registerBuilt(
        freeTool(userId)
            .tool("context_index_repo", "Index a GitHub repository file tree for later context packing. "
                + "Stores file paths, sizes, and types in memory for the session. "
                + "Returns a summary of indexed files including count, top directories, and detected tech stack.", {
                repo_url: z.string().url().describe(
                    "GitHub repository URL (e.g. https://github.com/owner/repo)",
                ),
                branch: z.string().optional().default("main").describe(
                    "Branch to index (default: main)",
                ),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { repo_url, branch } = input;

                const parsed = parseGitHubUrl(repo_url);
                if (!parsed) {
                    return {
                        content: [{
                            type: "text",
                            text: "Invalid GitHub URL. Expected format: https://github.com/owner/repo",
                        }],
                        isError: true,
                    };
                }

                const apiUrl =
                    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`;
                const response = await fetch(apiUrl, {
                    headers: {
                        Accept: "application/vnd.github.v3+json",
                        "User-Agent": "spike-land-mcp",
                    },
                });

                if (!response.ok) {
                    const status = response.status;
                    if (status === 404) {
                        return {
                            content: [{
                                type: "text",
                                text: `Repository or branch not found: ${parsed.owner}/${parsed.repo}@${branch}`,
                            }],
                            isError: true,
                        };
                    }
                    return {
                        content: [{
                            type: "text",
                            text: `GitHub API error: ${status} ${response.statusText}`,
                        }],
                        isError: true,
                    };
                }

                const data = (await response.json()) as GitHubTreeResponse;

                const files: FileEntry[] = data.tree
                    .filter(entry => entry.type === "blob" && entry.path)
                    .map(entry => ({
                        path: entry.path!,
                        size: entry.size ?? 0,
                        type: getExtension(entry.path!),
                    }));

                const key = repoKey(userId, repo_url);
                repoIndex.set(key, {
                    url: repo_url,
                    branch,
                    files,
                    indexedAt: new Date(),
                });

                const topDirs = getTopDirectories(files, 10);
                const techStack = detectTechStack(files);
                const totalSize = files.reduce((sum, f) => sum + f.size, 0);

                let text =
                    `**Indexed ${files.length} files** from \`${parsed.owner}/${parsed.repo}@${branch}\`\n\n`;
                text += `**Total size:** ${(totalSize / 1024).toFixed(1)} KB\n`;
                if (data.truncated) {
                    text += `**Warning:** Repository tree was truncated by GitHub API (very large repo)\n`;
                }
                text += `\n**Top directories:**\n`;
                for (const dir of topDirs) {
                    text += `- ${dir}\n`;
                }
                if (techStack.length > 0) {
                    text += `\n**Detected tech stack:** ${techStack.join(", ")}\n`;
                }

                return textResult(text);
            })
    );

    // context_pack
    registry.registerBuilt(
        freeTool(userId)
            .tool("context_pack", "Given an indexed repository and a task description, select the most relevant files. "
                + "Scores files by keyword matching, boosts source directories, and penalizes test/config files. "
                + "Returns an ordered list of file paths with relevance scores.", {
                repo_url: z.string().url().describe(
                    "GitHub repository URL (must be indexed first)",
                ),
                task_description: z.string().min(3).describe(
                    "Description of the task to find relevant files for",
                ),
                max_files: z.number().min(1).max(100).optional().default(20).describe(
                    "Maximum files to return (default: 20)",
                ),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { repo_url, task_description, max_files } = input;

                const key = repoKey(userId, repo_url);
                const indexed = repoIndex.get(key);
                if (!indexed) {
                    return {
                        content: [{
                            type: "text",
                            text: "Repository not indexed. Call `context_index_repo` first.",
                        }],
                        isError: true,
                    };
                }

                const keywords = task_description
                    .toLowerCase()
                    .split(/[\s,;.!?]+/)
                    .filter(w => w.length > 2)
                    .map(w => w.replace(/[^a-z0-9-_]/g, ""))
                    .filter(Boolean);

                if (keywords.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: "Task description too short or no meaningful keywords found.",
                        }],
                        isError: true,
                    };
                }

                const scored = indexed.files
                    .map(file => ({ file, score: scoreFile(file, keywords) }))
                    .filter(entry => entry.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, max_files);

                if (scored.length === 0) {
                    return textResult(
                        "No relevant files found for the given task description. Try using different keywords.",
                    );
                }

                let text = `**${scored.length} relevant file(s)** for: _${task_description}_\n\n`;
                text += `| # | Score | Path | Size |\n`;
                text += `|---|-------|------|------|\n`;
                for (let i = 0; i < scored.length; i++) {
                    const { file, score } = scored[i]!;
                    const sizeStr = file.size > 1024
                        ? `${(file.size / 1024).toFixed(1)} KB`
                        : `${file.size} B`;
                    text += `| ${i + 1} | ${score} | \`${file.path}\` | ${sizeStr} |\n`;
                }

                return textResult(text);
            })
    );

    // context_get_deps
    registry.registerBuilt(
        freeTool(userId)
            .tool("context_get_deps", "Get the import/dependency graph for a specific file in an indexed repository. "
                + "Parses import/from statements and finds sibling files in the same directory. "
                + "The repository must be indexed first with context_index_repo.", {
                repo_url: z.string().url().describe(
                    "GitHub repository URL (must be indexed first)",
                ),
                file_path: z.string().min(1).describe(
                    "File path within the repository (e.g. src/lib/utils.ts)",
                ),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { repo_url, file_path } = input;

                const key = repoKey(userId, repo_url);
                const indexed = repoIndex.get(key);
                if (!indexed) {
                    return {
                        content: [{
                            type: "text",
                            text: "Repository not indexed. Call `context_index_repo` first.",
                        }],
                        isError: true,
                    };
                }

                const targetFile = indexed.files.find(f => f.path === file_path);
                if (!targetFile) {
                    return {
                        content: [{
                            type: "text",
                            text: `File not found in index: \`${file_path}\``,
                        }],
                        isError: true,
                    };
                }

                const parsed = parseGitHubUrl(repo_url);
                if (!parsed) {
                    return {
                        content: [{ type: "text", text: "Invalid GitHub URL." }],
                        isError: true,
                    };
                }

                // Fetch file content from GitHub to parse imports
                const rawUrl =
                    `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${indexed.branch}/${file_path}`;
                const response = await fetch(rawUrl, {
                    headers: { "User-Agent": "spike-land-mcp" },
                });

                let directDeps: string[] = [];
                if (response.ok) {
                    const content = await response.text();
                    directDeps = parseImports(content);
                }

                // Find sibling files in the same directory
                const targetDir = file_path.slice(0, file_path.lastIndexOf("/"));
                const codeExtensions = new Set([
                    "ts",
                    "tsx",
                    "js",
                    "jsx",
                    "mjs",
                    "cjs",
                ]);
                const siblingFiles: string[] = [];

                for (const file of indexed.files) {
                    if (file.path === file_path) continue;
                    if (!codeExtensions.has(file.type)) continue;
                    const fileDir = file.path.slice(0, file.path.lastIndexOf("/"));
                    if (fileDir === targetDir) {
                        siblingFiles.push(file.path);
                    }
                }

                let text = `**Dependencies for** \`${file_path}\`\n\n`;

                if (directDeps.length > 0) {
                    text += `**Direct imports (${directDeps.length}):**\n`;
                    for (const dep of directDeps) {
                        text += `- \`${dep}\`\n`;
                    }
                } else {
                    text += `**Direct imports:** None found\n`;
                }

                text += `\n**Sibling files (same directory, ${siblingFiles.length}):**\n`;
                if (siblingFiles.length > 0) {
                    for (const dep of siblingFiles.slice(0, 20)) {
                        text += `- \`${dep}\`\n`;
                    }
                    if (siblingFiles.length > 20) {
                        text += `- _...and ${siblingFiles.length - 20} more_\n`;
                    }
                } else {
                    text += `- None\n`;
                }

                return textResult(text);
            })
    );
}

// Exported for testing
export {
    detectTechStack,
    getExtension,
    parseGitHubUrl,
    parseImports,
    repoIndex,
    repoKey,
    scoreFile,
};
