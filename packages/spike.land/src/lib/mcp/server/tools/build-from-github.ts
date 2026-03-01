import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import { workspaceTool } from "../tool-builder/procedures.js";

export function registerBuildFromGithubTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        workspaceTool(userId)
            .tool("build_from_github", "Build a frontend application directly from a GitHub URL using esbuild-wasm. Frameworks like Vite, CRA, Next.js, and Remix are supported. You must be authenticated to use this tool.", {
                repoUrl: z.string().url().describe("GitHub URL to build from"),
                branchOrCommit: z.string().optional().describe(
                    "Branch or commit to build from, defaults to main",
                ),
                minify: z.boolean().default(true).describe("Whether to minify the output"),
                npmMode: z.enum(["external", "bundle"]).default("bundle").describe(
                    "Whether to bundle bare imports or externalize them to esm.sh",
                ),
            })
            .meta({ category: "esbuild", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    repoUrl,
                    branchOrCommit,
                    minify = true,
                    npmMode = "bundle",
                } = input;
                return safeToolCall("build_from_github", async () => {
                    const { ensureEsbuildReady } = await import(
                        "@/lib/codespace/esbuild-init"
                    );
                    await ensureEsbuildReady();

                    const { detectFramework, generateEsbuildConfig, guessEntryPoint } = await import(
                        "@/lib/codespace/framework-detector"
                    );
                    const { githubResolverPlugin, parseGithubUrl } = await import(
                        "@/lib/codespace/github-resolver"
                    );
                    const { npmResolverPlugin } = await import(
                        "@/lib/codespace/npm-resolver"
                    );
                    const { BROWSER_DEFINE } = await import("@/lib/codespace/bundler");
                    const esbuild = await import("@spike-land-ai/esbuild-wasm");

                    const parsed = parseGithubUrl(repoUrl, branchOrCommit);
                    if (!parsed) {
                        throw new Error("Invalid GitHub URL format");
                    }

                    const framework = await detectFramework(repoUrl, branchOrCommit);
                    const entryPoint = await guessEntryPoint(
                        repoUrl,
                        framework,
                        branchOrCommit,
                    );

                    const config = generateEsbuildConfig(framework);
                    const cache = new Map<string, string | Uint8Array>();

                    const result = await esbuild.build({
                        ...config,
                        entryPoints: [entryPoint],
                        minify,
                        plugins: [
                            githubResolverPlugin({ repoUrl, ...(branchOrCommit !== undefined ? { branchOrCommit } : {}), cache }),
                            npmResolverPlugin({ mode: npmMode, cache }),
                        ],
                        define: {
                            ...BROWSER_DEFINE,
                            ...config.define,
                        },
                        write: false,
                    });

                    let code = "";
                    if (result.outputFiles && result.outputFiles.length > 0) {
                        code = result.outputFiles[0]!.text;
                    }

                    return textResult(
                        `**Successfully built** ${repoUrl} (${framework})\n\n**Bundled Code Length:** ${code.length} characters\n\n\`\`\`js\n${code}\n\`\`\``,
                    );
                }, { userId });
            })
    );
}
