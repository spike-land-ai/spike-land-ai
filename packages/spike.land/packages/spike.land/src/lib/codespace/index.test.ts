import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/upstash", () => ({
  redis: {
    publish: vi.fn(),
    lpush: vi.fn(),
    expire: vi.fn(),
    ltrim: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn().mockReturnValue({
    codespace: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    codeVersion: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    codespace: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    codeVersion: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe("codespace index barrel exports", () => {
  it("should export computeSessionHash", async () => {
    const mod = await import("./index");
    expect(typeof mod.computeSessionHash).toBe("function");
  });

  it("should export getOrCreateSession", async () => {
    const mod = await import("./index");
    expect(typeof mod.getOrCreateSession).toBe("function");
  });

  it("should export getSession", async () => {
    const mod = await import("./index");
    expect(typeof mod.getSession).toBe("function");
  });

  it("should export upsertSession", async () => {
    const mod = await import("./index");
    expect(typeof mod.upsertSession).toBe("function");
  });

  it("should export CORS_HEADERS", async () => {
    const mod = await import("./index");
    expect(mod.CORS_HEADERS).toBeDefined();
  });

  it("should export corsOptions", async () => {
    const mod = await import("./index");
    expect(typeof mod.corsOptions).toBe("function");
  });

  it("should export broadcastToCodespace", async () => {
    const mod = await import("./index");
    expect(typeof mod.broadcastToCodespace).toBe("function");
  });

  it("should export getCodespaceInstanceId", async () => {
    const mod = await import("./index");
    expect(typeof mod.getCodespaceInstanceId).toBe("function");
  });

  it("should export getCodespaceSSEEvents", async () => {
    const mod = await import("./index");
    expect(typeof mod.getCodespaceSSEEvents).toBe("function");
  });
});
