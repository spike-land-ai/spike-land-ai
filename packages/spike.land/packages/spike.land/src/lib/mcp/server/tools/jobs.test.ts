import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  imageEnhancementJob: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  toolInvocation: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock(
  "@/lib/logger",
  () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }),
);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerJobsTools } from "./jobs";

describe("jobs tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerJobsTools(registry, userId);
    mockPrisma.toolInvocation.create.mockResolvedValue({});
  });

  it("should register 4 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
  });

  describe("jobs_get", () => {
    it("should return job details", async () => {
      const job = { id: "job-1", userId, status: "COMPLETED" };
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue(job);

      const handler = registry.handlers.get("jobs_get")!;
      const result = await handler({ jobId: "job-1" });

      expect(getText(result)).toContain("job-1");
    });

    it("should error when job not found", async () => {
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("jobs_get")!;
      const result = await handler({ jobId: "nonexistent" });

      expect(isError(result)).toBe(true);
    });
  });

  describe("jobs_batch_status", () => {
    it("should return statuses for multiple jobs", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([
        { id: "j1", status: "COMPLETED", errorMessage: null },
        { id: "j2", status: "PENDING", errorMessage: null },
      ]);

      const handler = registry.handlers.get("jobs_batch_status")!;
      const result = await handler({ jobIds: ["j1", "j2"] });

      expect(getText(result)).toContain("j1");
      expect(getText(result)).toContain("j2");
    });
  });

  describe("jobs_mix_history", () => {
    it("should return mix history", async () => {
      mockPrisma.imageEnhancementJob.findMany.mockResolvedValue([
        { id: "mix-1", enhancementType: "BLEND" },
      ]);

      const handler = registry.handlers.get("jobs_mix_history")!;
      const result = await handler({ limit: 20, offset: 0 });

      expect(getText(result)).toContain("mix-1");
    });
  });

  describe("jobs_cancel", () => {
    it("should atomically cancel a pending job", async () => {
      mockPrisma.imageEnhancementJob.updateMany.mockResolvedValue({ count: 1 });

      const handler = registry.handlers.get("jobs_cancel")!;
      const result = await handler({ jobId: "job-1" });

      expect(mockPrisma.imageEnhancementJob.updateMany).toHaveBeenCalledWith({
        where: {
          id: "job-1",
          userId,
          status: { in: ["PENDING", "PROCESSING"] },
        },
        data: { status: "CANCELLED" },
      });
      expect(getText(result)).toContain("CANCELLED");
    });

    it("should error when job not found (count=0, no job exists)", async () => {
      mockPrisma.imageEnhancementJob.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("jobs_cancel")!;
      const result = await handler({ jobId: "nonexistent" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });

    it("should error when job is not in cancellable state", async () => {
      mockPrisma.imageEnhancementJob.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.imageEnhancementJob.findUnique.mockResolvedValue({
        id: "job-1",
        status: "COMPLETED",
      });

      const handler = registry.handlers.get("jobs_cancel")!;
      const result = await handler({ jobId: "job-1" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("cannot be cancelled");
    });
  });
});
