import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { 
  mapTestToSource, 
  getFileHash, 
  loadCache, 
  saveCache, 
  runVitestWithCoverage 
} from "./logic.js";

const CACHE_PATH = "incremental-coverage.json";

const server = new Server(
  {
    name: "incremental-test-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const RunTestSchema = z.object({
  testFilePath: z.string().describe("Path to the test file (e.g. .tests/shared/utils.test.ts)"),
  force: z.boolean().optional().describe("Force re-run even if cached"),
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "run_incremental_test",
        description: "Run a single test file and return results and coverage, with caching.",
        inputSchema: {
          type: "object",
          properties: {
            testFilePath: { type: "string" },
            force: { type: "boolean" },
          },
          required: ["testFilePath"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "run_incremental_test") {
    throw new Error(`Tool not found: ${request.params.name}`);
  }

  const { testFilePath, force } = RunTestSchema.parse(request.params.arguments);
  const srcFilePath = mapTestToSource(testFilePath);

  try {
    const [testHash, srcHash, cache] = await Promise.all([
      getFileHash(testFilePath),
      getFileHash(srcFilePath),
      loadCache(CACHE_PATH),
    ]);

    const existing = cache[testFilePath];
    if (!force && existing && existing.testHash === testHash && existing.sourceHash === srcHash && existing.success) {
      return {
        content: [
          {
            type: "text",
            text: `CACHED: Test passed with ${existing.coverage}% coverage.\nSource: ${srcFilePath}\nTest: ${testFilePath}`,
          },
        ],
      };
    }

    const result = await runVitestWithCoverage(testFilePath, srcFilePath);

    cache[testFilePath] = {
      testHash,
      sourceHash: srcHash,
      coverage: result.coverage,
      success: result.success,
    };

    await saveCache(CACHE_PATH, cache);

    return {
      content: [
        {
          type: "text",
          text: `RESULT: ${result.success ? "PASSED" : "FAILED"}\nCOVERAGE: ${result.coverage}%\n\nSTDOUT:\n${result.output}\n\nSTDERR:\n${result.stderr}`,
        },
      ],
      isError: !result.success,
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `ERROR: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
