import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { registerImageStudioTools } from "./register.js";
import type { ImageStudioDeps, ImageStudioToolRegistry, ToolDefinition } from "./types.js";
import { asAlbumHandle, asImageId, asJobId, asPipelineId } from "./types.js";

// --- 1. Mock the Dependencies so the tools can run without a real DB ---

function createMockDeps(): ImageStudioDeps {
  const mockImage = {
    id: asImageId("mock-image-id"),
    userId: "test-user",
    name: "test-image.jpg",
    description: null,
    originalUrl: "https://example.com/image.jpg",
    originalR2Key: "image.jpg",
    originalFormat: "jpeg",
    originalWidth: 1024,
    originalHeight: 1024,
    originalSizeBytes: 100000,
    isPublic: false,
    viewCount: 0,
    tags: [] as string[],
    shareToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultMockHandler = {
    get: (target: Record<string, unknown>, prop: string) => {
      if (prop in target) {
        return target[prop];
      }
      return async (..._args: unknown[]) => {
        if (prop.includes("Many") || prop.includes("List")) return [];
        if (prop.includes("FindById") || prop.includes("FindByHandle")) {
          return mockImage;
        }
        return { id: "mock-id", success: true };
      };
    },
  };

  return {
    db: new Proxy(
      {
        imageFindById: async () => mockImage,
        jobFindById: async () => ({
          id: asJobId("mock-job"),
          userId: "test-user",
          status: "COMPLETED",
          enhancedUrl: "https://example.com/out.jpg",
          enhancedR2Key: "out.jpg",
          enhancedWidth: 2048,
          enhancedHeight: 2048,
          enhancedSizeBytes: 200000,
          errorMessage: null,
          retryCount: 0,
          processingStartedAt: new Date(),
          processingCompletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: null,
        }),
        generationJobFindById: async () => ({
          id: asJobId("mock-gen"),
          userId: "test-user",
          type: "GENERATE" as const,
          tier: "TIER_1K" as const,
          creditsCost: 2,
          status: "COMPLETED" as const,
          prompt: "mock",
          inputImageUrl: null,
          outputImageUrl: "https://example.com/out.jpg",
          outputWidth: 1024,
          outputHeight: 1024,
          outputSizeBytes: 100000,
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      defaultMockHandler,
    ) as ImageStudioDeps["db"],

    credits: {
      hasEnough: async () => true,
      consume: async () => ({ success: true, remaining: 100 }),
      refund: async () => true,
      getBalance: async () => ({ remaining: 100 }),
      estimate: () => 1,
      calculateGenerationCost: () => 1,
    },

    storage: new Proxy(
      {
        download: async () => Buffer.from("mock image data"),
      },
      defaultMockHandler,
    ) as ImageStudioDeps["storage"],

    generation: {
      createGenerationJob: async () => ({
        success: true,
        jobId: "mock-gen-job",
        creditsCost: 2,
      }),
      createModificationJob: async () => ({
        success: true,
        jobId: "mock-mod-job",
        creditsCost: 2,
      }),
      createAdvancedGenerationJob: async () => ({
        success: true,
        jobId: "mock-adv-job",
        creditsCost: 3,
      }),
      createReferenceGenerationJob: async () => ({
        success: true,
        jobId: "mock-ref-job",
        creditsCost: 4,
      }),
      describeImage: async () => ({
        description: "A beautifully mocked picture of a sunset.",
        tags: ["mock", "sunset"],
      }),
      extractPalette: async () => ({
        palette: ["#FFFFFF", "#000000", "#FF0000"],
      }),
      compareImages: async () => ({
        comparison: { similarity: 0.95, differences: [] },
      }),
    },

    resolvers: {
      resolveImage: async (id: string) => ({ ...mockImage, id: asImageId(id) }),
      resolveAlbum: async (handle: string) => ({
        id: "mock-album-id",
        handle: asAlbumHandle(handle),
        userId: "test-user",
        name: "Mock Album",
        description: null,
        coverImageId: null,
        privacy: "PRIVATE" as const,
        defaultTier: "FREE" as const,
        shareToken: null,
        sortOrder: 0,
        pipelineId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      resolvePipeline: async (id: string) => ({
        id: asPipelineId(id),
        name: "Mock Pipeline",
        description: null,
        userId: "test-user",
        visibility: "PRIVATE" as const,
        shareToken: null,
        tier: "FREE" as const,
        analysisConfig: null,
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: null,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      resolveJob: async (id: string) => ({
        id: asJobId(id),
        imageId: asImageId("mock-image-id"),
        userId: "test-user",
        tier: "TIER_1K" as const,
        creditsCost: 2,
        status: "COMPLETED" as const,
        enhancedUrl: "https://example.com/out.jpg",
        enhancedR2Key: "out.jpg",
        enhancedWidth: 2048,
        enhancedHeight: 2048,
        enhancedSizeBytes: 200000,
        errorMessage: null,
        retryCount: 0,
        processingStartedAt: new Date(),
        processingCompletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
      }),
      resolveGenerationJob: async (id: string) => ({
        id: asJobId(id),
        userId: "test-user",
        type: "GENERATE" as const,
        tier: "TIER_1K" as const,
        creditsCost: 2,
        status: "COMPLETED" as const,
        prompt: "mock",
        inputImageUrl: null,
        outputImageUrl: "https://example.com/out.jpg",
        outputWidth: 1024,
        outputHeight: 1024,
        outputSizeBytes: 100000,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      resolveImages: async (ids: string[]) =>
        ids.map((id: string) => ({ ...mockImage, id: asImageId(id) })),
    },

    nanoid: () => "mock-nano-123",
  };
}

// --- 2. Setup Deps ---

const DEFAULT_USER_ID = process.env.IMAGE_STUDIO_USER_ID || "test-user";
const deps = createMockDeps();

// --- 3. Setup the MCP Server & Registry ---

const server = new Server(
  { name: "mcp-image-studio-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

const tools: ToolDefinition<unknown>[] = [];
const registry: ImageStudioToolRegistry = {
  register: <T = unknown>(def: ToolDefinition<T>) => {
    tools.push(def as ToolDefinition<unknown>);
  },
};

// Register all tools
registerImageStudioTools(registry, DEFAULT_USER_ID, deps);

// --- 4. Wire tools to Server ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    inputSchema: (t as ToolDefinition<unknown>).inputSchema ?? {
      type: "object" as const,
      properties: {},
    },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((t) => t.name === request.params.name);
  if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
  const result = await Promise.resolve(tool.handler((request.params.arguments ?? {}) as never));
  return {
    content: result.content,
    isError: result.isError,
  };
});

// --- 5. Start Server on Stdio ---

const transport = new StdioServerTransport();
server
  .connect(transport)
  .then(() => {
    console.log("Image Studio MCP Server running on stdio.");
  })
  .catch((err: unknown) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
