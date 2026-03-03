import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  imageEnhancementJob: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
    count: vi.fn(),
  },
  mcpGenerationJob: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import type { JobSource } from "@/types/admin-jobs";
import {
  getUnifiedJobs,
  transformEnhancementJob,
  transformMcpJob,
  VALID_STATUSES,
  VALID_TYPES,
} from "./jobs";

// Helper to create a mock enhancement job
function createMockEnhancementJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "enh-1",
    status: "COMPLETED" as const,
    tier: "STANDARD",
    creditsCost: 10,
    enhancedUrl: "https://example.com/enhanced.jpg",
    enhancedWidth: 1920,
    enhancedHeight: 1080,
    enhancedSizeBytes: 500000,
    errorMessage: null,
    userId: "user-1",
    createdAt: new Date("2025-01-15T10:00:00Z"),
    updatedAt: new Date("2025-01-15T10:05:00Z"),
    processingStartedAt: new Date("2025-01-15T10:01:00Z"),
    processingCompletedAt: new Date("2025-01-15T10:04:00Z"),
    retryCount: 0,
    maxRetries: 3,
    geminiPrompt: "Enhance this image",
    geminiModel: "gemini-2.0-flash",
    geminiTemp: 0.7,
    workflowRunId: "wf-123",
    imageId: "img-1",
    currentStage: "complete",
    image: {
      name: "photo.jpg",
      originalUrl: "https://example.com/original.jpg",
    },
    user: { email: "alice@example.com", name: "Alice" },
    ...overrides,
  };
}

// Helper to create a mock MCP job
function createMockMcpJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-1",
    status: "PROCESSING" as const,
    tier: "PRO",
    creditsCost: 25,
    type: "GENERATE",
    prompt: "Generate a landscape",
    inputImageUrl: "https://example.com/input.jpg",
    inputImageR2Key: "r2/input.jpg",
    outputImageUrl: null,
    outputImageR2Key: null,
    outputWidth: null,
    outputHeight: null,
    outputSizeBytes: null,
    errorMessage: null,
    userId: "user-2",
    apiKeyId: "key-1",
    geminiModel: "gemini-2.0-flash",
    createdAt: new Date("2025-01-15T11:00:00Z"),
    updatedAt: new Date("2025-01-15T11:02:00Z"),
    processingStartedAt: new Date("2025-01-15T11:01:00Z"),
    processingCompletedAt: null,
    user: { email: "bob@example.com", name: "Bob" },
    apiKey: { name: "My API Key" },
    ...overrides,
  };
}

describe("VALID_STATUSES", () => {
  it("contains expected job statuses", () => {
    expect(VALID_STATUSES).toEqual([
      "PENDING",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
      "REFUNDED",
      "CANCELLED",
    ]);
  });
});

describe("VALID_TYPES", () => {
  it("contains expected job types", () => {
    expect(VALID_TYPES).toEqual(["all", "enhancement", "mcp"]);
  });
});

describe("transformEnhancementJob", () => {
  it("maps fields correctly to UnifiedJob", () => {
    const job = createMockEnhancementJob();
    const result = transformEnhancementJob(job);

    expect(result.id).toBe("enh-1");
    expect(result.source).toBe("enhancement" as JobSource);
    expect(result.status).toBe("COMPLETED");
    expect(result.tier).toBe("STANDARD");
    expect(result.creditsCost).toBe(10);
    expect(result.prompt).toBe("Enhance this image");
    expect(result.inputUrl).toBe("https://example.com/original.jpg");
    expect(result.outputUrl).toBe("https://example.com/enhanced.jpg");
    expect(result.outputWidth).toBe(1920);
    expect(result.outputHeight).toBe(1080);
    expect(result.outputSizeBytes).toBe(500000);
    expect(result.errorMessage).toBeNull();
    expect(result.userId).toBe("user-1");
    expect(result.userEmail).toBe("alice@example.com");
    expect(result.userName).toBe("Alice");
    expect(result.createdAt).toBe("2025-01-15T10:00:00.000Z");
    expect(result.updatedAt).toBe("2025-01-15T10:05:00.000Z");
    expect(result.processingStartedAt).toBe("2025-01-15T10:01:00.000Z");
    expect(result.processingCompletedAt).toBe("2025-01-15T10:04:00.000Z");
    expect(result.imageId).toBe("img-1");
    expect(result.imageName).toBe("photo.jpg");
    expect(result.retryCount).toBe(0);
    expect(result.maxRetries).toBe(3);
    expect(result.geminiModel).toBe("gemini-2.0-flash");
    expect(result.geminiTemp).toBe(0.7);
    expect(result.workflowRunId).toBe("wf-123");
    expect(result.currentStage).toBe("complete");
  });

  it("defaults userEmail to Unknown when null", () => {
    const job = createMockEnhancementJob({
      user: { email: null, name: null },
    });
    const result = transformEnhancementJob(job);

    expect(result.userEmail).toBe("Unknown");
    expect(result.userName).toBeNull();
  });

  it("handles null processing timestamps", () => {
    const job = createMockEnhancementJob({
      processingStartedAt: null,
      processingCompletedAt: null,
    });
    const result = transformEnhancementJob(job);

    expect(result.processingStartedAt).toBeNull();
    expect(result.processingCompletedAt).toBeNull();
  });
});

describe("transformMcpJob", () => {
  it("maps fields correctly to UnifiedJob", () => {
    const job = createMockMcpJob();
    const result = transformMcpJob(job);

    expect(result.id).toBe("mcp-1");
    expect(result.source).toBe("mcp" as JobSource);
    expect(result.status).toBe("PROCESSING");
    expect(result.tier).toBe("PRO");
    expect(result.creditsCost).toBe(25);
    expect(result.prompt).toBe("Generate a landscape");
    expect(result.inputUrl).toBe("https://example.com/input.jpg");
    expect(result.outputUrl).toBeNull();
    expect(result.outputWidth).toBeNull();
    expect(result.outputHeight).toBeNull();
    expect(result.outputSizeBytes).toBeNull();
    expect(result.errorMessage).toBeNull();
    expect(result.userId).toBe("user-2");
    expect(result.userEmail).toBe("bob@example.com");
    expect(result.userName).toBe("Bob");
    expect(result.createdAt).toBe("2025-01-15T11:00:00.000Z");
    expect(result.updatedAt).toBe("2025-01-15T11:02:00.000Z");
    expect(result.processingStartedAt).toBe("2025-01-15T11:01:00.000Z");
    expect(result.processingCompletedAt).toBeNull();
    expect(result.mcpJobType).toBe("GENERATE");
    expect(result.apiKeyId).toBe("key-1");
    expect(result.apiKeyName).toBe("My API Key");
    expect(result.inputR2Key).toBe("r2/input.jpg");
    expect(result.outputR2Key).toBeNull();
    expect(result.geminiModel).toBe("gemini-2.0-flash");
  });

  it("defaults userEmail to Unknown when null", () => {
    const job = createMockMcpJob({
      user: { email: null, name: null },
    });
    const result = transformMcpJob(job);

    expect(result.userEmail).toBe("Unknown");
    expect(result.userName).toBeNull();
  });

  it("handles null apiKey", () => {
    const job = createMockMcpJob({ apiKey: null });
    const result = transformMcpJob(job);

    expect(result.apiKeyName).toBeNull();
  });
});

describe("getUnifiedJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMocks(options?: {
    enhancementJobs?: ReturnType<typeof createMockEnhancementJob>[];
    mcpJobs?: ReturnType<typeof createMockMcpJob>[];
    enhancementStatusCounts?: Array<
      { status: string; _count: { status: number; }; }
    >;
    mcpStatusCounts?: Array<{ status: string; _count: { status: number; }; }>;
    enhancementTotal?: number;
    mcpTotal?: number;
  }) {
    const {
      enhancementJobs = [],
      mcpJobs = [],
      enhancementStatusCounts = [],
      mcpStatusCounts = [],
      enhancementTotal = 0,
      mcpTotal = 0,
    } = options ?? {};

    mockPrisma.imageEnhancementJob.findMany.mockResolvedValue(enhancementJobs);
    mockPrisma.mcpGenerationJob.findMany.mockResolvedValue(mcpJobs);
    mockPrisma.imageEnhancementJob.groupBy.mockResolvedValue(
      enhancementStatusCounts,
    );
    mockPrisma.mcpGenerationJob.groupBy.mockResolvedValue(mcpStatusCounts);
    mockPrisma.imageEnhancementJob.count.mockResolvedValue(enhancementTotal);
    mockPrisma.mcpGenerationJob.count.mockResolvedValue(mcpTotal);
  }

  it("merges and sorts jobs by createdAt descending", async () => {
    const enhJob = createMockEnhancementJob({
      id: "enh-old",
      createdAt: new Date("2025-01-10T10:00:00Z"),
    });
    const mcpJob = createMockMcpJob({
      id: "mcp-new",
      createdAt: new Date("2025-01-15T10:00:00Z"),
    });

    setupMocks({
      enhancementJobs: [enhJob],
      mcpJobs: [mcpJob],
      enhancementTotal: 1,
      mcpTotal: 1,
    });

    const result = await getUnifiedJobs({});

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0]?.id).toBe("mcp-new");
    expect(result.jobs[1]?.id).toBe("enh-old");
  });

  it("filters by status", async () => {
    setupMocks();

    await getUnifiedJobs({ status: "FAILED" });

    expect(mockPrisma.imageEnhancementJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "FAILED" }),
      }),
    );
    expect(mockPrisma.mcpGenerationJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("filters by type enhancement only", async () => {
    setupMocks();

    await getUnifiedJobs({ type: "enhancement" });

    expect(mockPrisma.imageEnhancementJob.findMany).toHaveBeenCalled();
    // MCP findMany should NOT be called with actual query (resolves to empty)
    expect(mockPrisma.mcpGenerationJob.findMany).not.toHaveBeenCalled();
  });

  it("filters by type mcp only", async () => {
    setupMocks();

    await getUnifiedJobs({ type: "mcp" });

    expect(mockPrisma.imageEnhancementJob.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.mcpGenerationJob.findMany).toHaveBeenCalled();
  });

  it("paginates correctly", async () => {
    const jobs = Array.from({ length: 5 }, (_, i) =>
      createMockEnhancementJob({
        id: `enh-${i}`,
        createdAt: new Date(`2025-01-${15 - i}T10:00:00Z`),
      }));

    setupMocks({
      enhancementJobs: jobs,
      enhancementTotal: 5,
    });

    const result = await getUnifiedJobs({ page: 2, limit: 2 });

    expect(result.jobs).toHaveLength(2);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
  });

  it("returns merged status counts", async () => {
    setupMocks({
      enhancementStatusCounts: [
        { status: "COMPLETED", _count: { status: 5 } },
        { status: "FAILED", _count: { status: 2 } },
      ],
      mcpStatusCounts: [
        { status: "COMPLETED", _count: { status: 3 } },
        { status: "PENDING", _count: { status: 1 } },
      ],
      enhancementTotal: 7,
      mcpTotal: 4,
    });

    const result = await getUnifiedJobs({});

    expect(result.statusCounts).toEqual({
      ALL: 11,
      COMPLETED: 8,
      FAILED: 2,
      PENDING: 1,
    });
  });

  it("returns type counts", async () => {
    setupMocks({
      enhancementTotal: 10,
      mcpTotal: 5,
    });

    const result = await getUnifiedJobs({});

    expect(result.typeCounts).toEqual({
      all: 15,
      enhancement: 10,
      mcp: 5,
    });
  });

  it("applies search filter to where clause", async () => {
    setupMocks();

    await getUnifiedJobs({ search: "test@example.com" });

    const expectedOR = [
      { id: { contains: "test@example.com" } },
      {
        user: { email: { contains: "test@example.com", mode: "insensitive" } },
      },
    ];

    expect(mockPrisma.imageEnhancementJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expectedOR }),
      }),
    );
    expect(mockPrisma.mcpGenerationJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expectedOR }),
      }),
    );
  });

  it("returns empty jobs when no results", async () => {
    setupMocks();

    const result = await getUnifiedJobs({});

    expect(result.jobs).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(result.typeCounts).toEqual({ all: 0, enhancement: 0, mcp: 0 });
  });

  it("uses default parameter values", async () => {
    setupMocks();

    const result = await getUnifiedJobs({});

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(20);
  });
});
