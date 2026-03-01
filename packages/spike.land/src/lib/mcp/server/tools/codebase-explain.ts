/**
 * Codebase Explain Tools
 *
 * Pure analysis tools for understanding unfamiliar repositories.
 * No filesystem access — all data comes through inputs.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

export function registerCodebaseExplainTools(
    registry: ToolRegistry,
    _userId: string,
): void {
    // explain_overview
    registry.registerBuilt(
        freeTool(_userId)
            .tool("explain_overview", "Get a high-level codebase overview from file listing and package.json. Detects tech stack, analyzes directory structure, and provides statistics.", {
                files: z
                    .array(z.string())
                    .min(1)
                    .describe("List of file paths in the repository"),
                package_json: z
                    .string()
                    .optional()
                    .describe("Contents of package.json if available"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    files,
                    package_json,
                } = input;

                const analysis = analyzeOverview(files, package_json);
                return textResult(analysis);
            })
    );

    // explain_module
    registry.registerBuilt(
        freeTool(_userId)
            .tool("explain_module", "Deep dive into a specific module. Analyzes purpose, exports, dependencies, and patterns from its files and optional entry content.", {
                module_path: z.string().min(1).describe("Path to the module directory"),
                files: z
                    .array(z.string())
                    .min(1)
                    .describe("Files within the module"),
                entry_content: z
                    .string()
                    .optional()
                    .describe("Content of the module's index/main file"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    module_path,
                    files,
                    entry_content,
                } = input;

                const analysis = analyzeModule(module_path, files, entry_content);
                return textResult(analysis);
            })
    );

    // explain_flow
    registry.registerBuilt(
        freeTool(_userId)
            .tool("explain_flow", "Trace execution flow from source code. Extracts imports, exports, function definitions, and builds a dependency chain.", {
                file_content: z.string().min(1).describe("Source code content"),
                file_path: z.string().min(1).describe("File path for context"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    file_content,
                    file_path,
                } = input;

                const analysis = analyzeFlow(file_content, file_path);
                return textResult(analysis);
            })
    );
}

// ── Tech Stack Detection ──────────────────────────────────────────

interface TechStackEntry {
    name: string;
    version?: string;
}

const FRAMEWORK_DETECTORS: Array<{
    key: string;
    name: string;
}> = [
        { key: "next", name: "Next.js" },
        { key: "react", name: "React" },
        { key: "vue", name: "Vue" },
        { key: "@angular/core", name: "Angular" },
        { key: "svelte", name: "Svelte" },
        { key: "express", name: "Express" },
        { key: "fastify", name: "Fastify" },
        { key: "hono", name: "Hono" },
        { key: "nestjs", name: "NestJS" },
        { key: "@nestjs/core", name: "NestJS" },
        { key: "prisma", name: "Prisma" },
        { key: "@prisma/client", name: "Prisma" },
        { key: "drizzle-orm", name: "Drizzle" },
        { key: "tailwindcss", name: "Tailwind CSS" },
        { key: "@tailwindcss/vite", name: "Tailwind CSS" },
        { key: "typescript", name: "TypeScript" },
        { key: "vitest", name: "Vitest" },
        { key: "jest", name: "Jest" },
        { key: "mocha", name: "Mocha" },
        { key: "vite", name: "Vite" },
        { key: "webpack", name: "webpack" },
        { key: "esbuild", name: "esbuild" },
        { key: "turbo", name: "Turborepo" },
        { key: "storybook", name: "Storybook" },
        { key: "@storybook/react", name: "Storybook" },
        { key: "zod", name: "Zod" },
        { key: "trpc", name: "tRPC" },
        { key: "@trpc/server", name: "tRPC" },
        { key: "graphql", name: "GraphQL" },
        { key: "shadcn", name: "shadcn/ui" },
    ];

function detectTechStack(packageJson: string): TechStackEntry[] {
    let parsed: {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    try {
        parsed = JSON.parse(packageJson) as typeof parsed;
    } catch {
        return [];
    }

    const allDeps: Record<string, string> = {
        ...parsed.dependencies,
        ...parsed.devDependencies,
    };

    const seen = new Set<string>();
    const stack: TechStackEntry[] = [];

    for (const detector of FRAMEWORK_DETECTORS) {
        const version = allDeps[detector.key];
        if (version && !seen.has(detector.name)) {
            seen.add(detector.name);
            stack.push({ name: detector.name, version });
        }
    }

    return stack;
}

function detectTechFromFiles(files: string[]): string[] {
    const hints = new Set<string>();

    for (const file of files) {
        const lower = file.toLowerCase();
        if (
            lower === "next.config.ts" || lower === "next.config.js"
            || lower === "next.config.mjs"
        ) {
            hints.add("Next.js");
        }
        if (lower === "tsconfig.json") hints.add("TypeScript");
        if (lower === "vitest.config.ts" || lower === "vitest.config.js") {
            hints.add("Vitest");
        }
        if (lower === "jest.config.ts" || lower === "jest.config.js") {
            hints.add("Jest");
        }
        if (lower === "vite.config.ts" || lower === "vite.config.js") {
            hints.add("Vite");
        }
        if (lower === "webpack.config.js" || lower === "webpack.config.ts") {
            hints.add("webpack");
        }
        if (lower === "tailwind.config.ts" || lower === "tailwind.config.js") {
            hints.add("Tailwind CSS");
        }
        if (
            lower === "docker-compose.yml" || lower === "docker-compose.yaml"
            || lower === "dockerfile"
        ) hints.add("Docker");
        if (
            lower === ".github/workflows" || lower.startsWith(".github/workflows/")
        ) hints.add("GitHub Actions");
        if (lower === "turbo.json") hints.add("Turborepo");
        if (lower === "prisma/schema.prisma") hints.add("Prisma");
        if (lower === ".storybook" || lower.startsWith(".storybook/")) {
            hints.add("Storybook");
        }
    }

    return Array.from(hints);
}

// ── File Statistics ───────────────────────────────────────────────

interface FileStats {
    total: number;
    byExtension: Map<string, number>;
    directories: Set<string>;
}

function computeFileStats(files: string[]): FileStats {
    const byExtension = new Map<string, number>();
    const directories = new Set<string>();

    for (const file of files) {
        // Extension
        const dotIdx = file.lastIndexOf(".");
        const slashIdx = file.lastIndexOf("/");
        if (dotIdx > slashIdx && dotIdx > 0) {
            const ext = file.slice(dotIdx);
            byExtension.set(ext, (byExtension.get(ext) ?? 0) + 1);
        }

        // Top-level directories
        const firstSlash = file.indexOf("/");
        if (firstSlash > 0) {
            directories.add(file.slice(0, firstSlash));
        }

        // Second-level directories for deeper structure
        const parts = file.split("/");
        if (parts.length >= 2) {
            directories.add(parts.slice(0, 2).join("/"));
        }
    }

    return { total: files.length, byExtension, directories };
}

// ── Overview Analysis ─────────────────────────────────────────────

function analyzeOverview(files: string[], packageJson?: string): string {
    const stats = computeFileStats(files);

    // Tech stack from package.json
    const pkgStack = packageJson ? detectTechStack(packageJson) : [];
    // Tech stack from file patterns
    const fileHints = detectTechFromFiles(files);

    // Merge (deduplicate)
    const allTechNames = new Set(pkgStack.map(t => t.name));
    const additionalFromFiles = fileHints.filter(h => !allTechNames.has(h));

    let md = "# Codebase Overview\n\n";

    // Tech stack section
    md += "## Tech Stack\n\n";
    if (pkgStack.length > 0 || additionalFromFiles.length > 0) {
        for (const t of pkgStack) {
            md += `- **${t.name}** ${t.version ?? ""}\n`;
        }
        for (const name of additionalFromFiles) {
            md += `- **${name}** (detected from files)\n`;
        }
    } else {
        md += "- No tech stack detected\n";
    }

    // Directory structure
    md += "\n## Directory Structure\n\n";
    const sortedDirs = Array.from(stats.directories).sort();
    const topLevelDirs = sortedDirs.filter(d => !d.includes("/"));
    const secondLevelDirs = sortedDirs.filter(d => d.includes("/"));

    for (const dir of topLevelDirs) {
        const childDirs = secondLevelDirs.filter(d => d.startsWith(dir + "/"));
        const fileCount = files.filter(f => f.startsWith(dir + "/") || f === dir).length;
        md += `- \`${dir}/\` (${fileCount} files)\n`;
        for (const child of childDirs) {
            const childCount = files.filter(f => f.startsWith(child + "/")).length;
            if (childCount > 0) {
                md += `  - \`${child}/\` (${childCount} files)\n`;
            }
        }
    }

    // File statistics
    md += "\n## Statistics\n\n";
    md += `- **Total files:** ${stats.total}\n`;

    // Sort extensions by count desc
    const extEntries = Array.from(stats.byExtension.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    if (extEntries.length > 0) {
        md += "\n### Files by Extension\n\n";
        md += "| Extension | Count |\n";
        md += "|-----------|-------|\n";
        for (const [ext, count] of extEntries) {
            md += `| ${ext} | ${count} |\n`;
        }
    }

    return md;
}

// ── Module Analysis ───────────────────────────────────────────────

function analyzeModule(
    modulePath: string,
    files: string[],
    entryContent?: string,
): string {
    const moduleName = modulePath.split("/").pop() ?? modulePath;

    let md = `# Module: ${moduleName}\n\n`;
    md += `**Path:** \`${modulePath}\`\n\n`;

    // Purpose heuristic from directory name
    const purpose = inferPurpose(moduleName);
    md += `## Purpose\n\n${purpose}\n\n`;

    // File listing
    md += "## Files\n\n";
    const sortedFiles = [...files].sort();
    for (const file of sortedFiles) {
        const basename = file.split("/").pop() ?? file;
        const isTest = basename.includes(".test.") || basename.includes(".spec.");
        const isIndex = basename.startsWith("index.")
            || basename.startsWith("main.");
        const marker = isTest ? " (test)" : isIndex ? " (entry)" : "";
        md += `- \`${file}\`${marker}\n`;
    }

    // Entry file analysis
    if (entryContent) {
        md += "\n## Exports\n\n";
        const exports = extractExports(entryContent);
        if (exports.length > 0) {
            for (const exp of exports) {
                md += `- \`${exp}\`\n`;
            }
        } else {
            md += "- No named exports detected\n";
        }

        md += "\n## Dependencies\n\n";
        const imports = extractImports(entryContent);
        const internal = imports.filter(
            i => i.startsWith("./") || i.startsWith("../") || i.startsWith("@/"),
        );
        const external = imports.filter(
            i => !i.startsWith("./") && !i.startsWith("../") && !i.startsWith("@/"),
        );

        if (external.length > 0) {
            md += "**External:**\n";
            for (const dep of external) {
                md += `- \`${dep}\`\n`;
            }
        }
        if (internal.length > 0) {
            md += "\n**Internal:**\n";
            for (const dep of internal) {
                md += `- \`${dep}\`\n`;
            }
        }
        if (imports.length === 0) {
            md += "- No dependencies detected\n";
        }
    }

    // Patterns detected
    md += "\n## Patterns\n\n";
    const patterns = detectPatterns(files, entryContent);
    if (patterns.length > 0) {
        for (const p of patterns) {
            md += `- ${p}\n`;
        }
    } else {
        md += "- No notable patterns detected\n";
    }

    return md;
}

function inferPurpose(dirName: string): string {
    const lower = dirName.toLowerCase();
    const purposes: Record<string, string> = {
        components: "UI components library",
        hooks: "Custom React hooks",
        lib: "Utility/library functions",
        utils: "Utility/helper functions",
        api: "API routes and handlers",
        routes: "Application routing",
        services: "Business logic services",
        models: "Data models and schemas",
        types: "TypeScript type definitions",
        store: "State management",
        stores: "State management",
        middleware: "Request/response middleware",
        config: "Configuration files",
        constants: "Constant values and enums",
        tests: "Test files",
        __tests__: "Test files",
        styles: "Stylesheets and themes",
        assets: "Static assets",
        pages: "Page components (file-based routing)",
        app: "App Router pages and layouts",
        layouts: "Layout components",
        providers: "Context/state providers",
        workers: "Web Workers / background tasks",
        tools: "Tool definitions and handlers",
        server: "Server-side logic",
        client: "Client-side logic",
        shared: "Shared/common code across modules",
        mcp: "Model Context Protocol implementation",
    };

    return purposes[lower]
        ?? `Module \`${dirName}\` — purpose inferred from contained files.`;
}

function detectPatterns(files: string[], entryContent?: string): string[] {
    const patterns: string[] = [];

    const hasTests = files.some(
        f => f.includes(".test.") || f.includes(".spec."),
    );
    if (hasTests) patterns.push("Has test coverage");

    const hasIndex = files.some(f => {
        const base = f.split("/").pop() ?? "";
        return base.startsWith("index.");
    });
    if (hasIndex) patterns.push("Uses barrel exports (index file)");

    const hasTypes = files.some(f => f.endsWith(".d.ts") || f.includes("types.ts"));
    if (hasTypes) patterns.push("Has dedicated type definitions");

    if (entryContent) {
        if (entryContent.includes("export default")) {
            patterns.push("Uses default export");
        }
        if (
            entryContent.includes("export function")
            || entryContent.includes("export const")
        ) {
            patterns.push("Uses named exports");
        }
        if (
            entryContent.includes("React.createContext")
            || entryContent.includes("createContext")
        ) {
            patterns.push("Provides React Context");
        }
        if (
            entryContent.includes("z.object") || entryContent.includes("z.string")
        ) {
            patterns.push("Uses Zod schema validation");
        }
    }

    return patterns;
}

// ── Flow Analysis ─────────────────────────────────────────────────

function analyzeFlow(content: string, filePath: string): string {
    const fileName = filePath.split("/").pop() ?? filePath;

    let md = `# Flow Analysis: ${fileName}\n\n`;
    md += `**Path:** \`${filePath}\`\n\n`;

    // Imports
    const imports = extractImports(content);
    md += "## Imports\n\n";
    if (imports.length > 0) {
        for (const imp of imports) {
            md += `- \`${imp}\`\n`;
        }
    } else {
        md += "- No imports detected\n";
    }

    // Exports
    const exports = extractExports(content);
    md += "\n## Exports\n\n";
    if (exports.length > 0) {
        for (const exp of exports) {
            md += `- \`${exp}\`\n`;
        }
    } else {
        md += "- No exports detected\n";
    }

    // Functions
    const functions = extractFunctions(content);
    md += "\n## Functions\n\n";
    if (functions.length > 0) {
        for (const fn of functions) {
            md += `- \`${fn}\`\n`;
        }
    } else {
        md += "- No function definitions detected\n";
    }

    // Dependency chain
    md += "\n## Dependency Chain\n\n";
    const externalDeps = imports.filter(
        i => !i.startsWith("./") && !i.startsWith("../") && !i.startsWith("@/"),
    );
    const internalDeps = imports.filter(
        i => i.startsWith("./") || i.startsWith("../") || i.startsWith("@/"),
    );

    if (externalDeps.length > 0 || internalDeps.length > 0) {
        md += "```\n";
        md += `${fileName}\n`;
        if (externalDeps.length > 0) {
            md += "  External:\n";
            for (const dep of externalDeps) {
                md += `    <- ${dep}\n`;
            }
        }
        if (internalDeps.length > 0) {
            md += "  Internal:\n";
            for (const dep of internalDeps) {
                md += `    <- ${dep}\n`;
            }
        }
        if (exports.length > 0) {
            md += "  Exports:\n";
            for (const exp of exports) {
                md += `    -> ${exp}\n`;
            }
        }
        md += "```\n";
    } else {
        md += "- No dependency chain (standalone file)\n";
    }

    return md;
}

// ── Import / Export / Function Extraction ──────────────────────────

function extractImports(content: string): string[] {
    const imports: string[] = [];
    const seen = new Set<string>();

    // ES6 static imports: import ... from "module"
    const es6Pattern = /import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    match = es6Pattern.exec(content);
    while (match !== null) {
        const mod = match[1]!;
        if (!seen.has(mod)) {
            seen.add(mod);
            imports.push(mod);
        }
        match = es6Pattern.exec(content);
    }

    // Dynamic imports: import("module") or import('module')
    const dynamicPattern = /import\(\s*["']([^"']+)["']\s*\)/g;
    match = dynamicPattern.exec(content);
    while (match !== null) {
        const mod = match[1]!;
        if (!seen.has(mod)) {
            seen.add(mod);
            imports.push(mod);
        }
        match = dynamicPattern.exec(content);
    }

    // require statements
    const requirePattern = /require\(\s*["']([^"']+)["']\s*\)/g;
    match = requirePattern.exec(content);
    while (match !== null) {
        const mod = match[1]!;
        if (!seen.has(mod)) {
            seen.add(mod);
            imports.push(mod);
        }
        match = requirePattern.exec(content);
    }

    return imports;
}

function extractExports(content: string): string[] {
    const exports: string[] = [];
    const seen = new Set<string>();

    // export function name
    const fnPattern = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match: RegExpExecArray | null;
    match = fnPattern.exec(content);
    while (match !== null) {
        const name = match[1]!;
        if (!seen.has(name)) {
            seen.add(name);
            exports.push(name);
        }
        match = fnPattern.exec(content);
    }

    // export const/let/var name
    const varPattern = /export\s+(?:const|let|var)\s+(\w+)/g;
    match = varPattern.exec(content);
    while (match !== null) {
        const name = match[1]!;
        if (!seen.has(name)) {
            seen.add(name);
            exports.push(name);
        }
        match = varPattern.exec(content);
    }

    // export class name (including export default class Name)
    const classPattern = /export\s+(?:default\s+)?class\s+(\w+)/g;
    match = classPattern.exec(content);
    while (match !== null) {
        const name = match[1]!;
        if (!seen.has(name)) {
            seen.add(name);
            exports.push(name);
        }
        match = classPattern.exec(content);
    }

    // export interface/type name
    const typePattern = /export\s+(?:interface|type)\s+(\w+)/g;
    match = typePattern.exec(content);
    while (match !== null) {
        const name = match[1]!;
        if (!seen.has(name)) {
            seen.add(name);
            exports.push(name);
        }
        match = typePattern.exec(content);
    }

    // export default
    if (/export\s+default\b/.test(content)) {
        if (!seen.has("default")) {
            seen.add("default");
            exports.push("default");
        }
    }

    // export { name1, name2 }
    const namedPattern = /export\s*\{([^}]+)\}/g;
    match = namedPattern.exec(content);
    while (match !== null) {
        const names = match[1]!
            .split(",")
            .map(n => n.trim().split(/\s+as\s+/).pop()?.trim())
            .filter(Boolean);
        for (const name of names) {
            if (name && !seen.has(name)) {
                seen.add(name);
                exports.push(name);
            }
        }
        match = namedPattern.exec(content);
    }

    return exports;
}

function extractFunctions(content: string): string[] {
    const functions: string[] = [];
    const seen = new Set<string>();

    // function declarations (exported or not)
    const fnDeclPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
    let match: RegExpExecArray | null;
    match = fnDeclPattern.exec(content);
    while (match !== null) {
        const name = match[1]!;
        if (!seen.has(name)) {
            seen.add(name);
            functions.push(name);
        }
        match = fnDeclPattern.exec(content);
    }

    // Arrow function assignments: const name = (...) => or const name = async (...) =>
    const arrowPattern =
        /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*\w+(?:<[^>]*>)?\s*)?=>/g;
    match = arrowPattern.exec(content);
    while (match !== null) {
        const name = match[1]!;
        if (!seen.has(name)) {
            seen.add(name);
            functions.push(name);
        }
        match = arrowPattern.exec(content);
    }

    return functions;
}
