import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateRequestId, logger, StructuredLogger } from "./structured-logger";

describe("generateRequestId", () => {
  it("returns a 32-character hex string", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns unique values on each call", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateRequestId()));
    expect(ids.size).toBe(20);
  });
});

describe("StructuredLogger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("in development mode", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("info() calls console.info with formatted output", () => {
      const sl = new StructuredLogger();
      sl.info("hello world");
      expect(consoleInfoSpy).toHaveBeenCalledOnce();
      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain("hello world");
      expect(output).toContain("[INFO]");
    });

    it("warn() calls console.warn with formatted output", () => {
      const sl = new StructuredLogger();
      sl.warn("watch out");
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      expect(consoleWarnSpy.mock.calls[0][0]).toContain("[WARN]");
    });

    it("error() calls console.error with formatted output and error details", () => {
      const sl = new StructuredLogger();
      const err = new Error("boom");
      sl.error("something broke", err);
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("[ERROR]");
      expect(output).toContain("boom");
    });

    it("debug() calls console.debug in development mode", () => {
      const sl = new StructuredLogger();
      sl.debug("debug trace");
      expect(consoleDebugSpy).toHaveBeenCalledOnce();
      expect(consoleDebugSpy.mock.calls[0][0]).toContain("[DEBUG]");
    });

    it("info() includes context fields in formatted output", () => {
      const sl = new StructuredLogger();
      sl.info("request handled", { route: "/api/test", statusCode: 200 });
      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain("route");
      expect(output).toContain("/api/test");
      expect(output).toContain("statusCode");
    });

    it("info() uses requestId from context when provided", () => {
      const sl = new StructuredLogger();
      sl.info("with request id", { requestId: "test-req-id-1234567890abcd" });
      const output = consoleInfoSpy.mock.calls[0][0] as string;
      // The output should contain first 8 chars of the provided requestId
      expect(output).toContain("test-req");
    });

    it("error() includes error name and message in output", () => {
      const sl = new StructuredLogger();
      const err = new TypeError("invalid type");
      sl.error("type failure", err);
      const output = consoleErrorSpy.mock.calls[0][0] as string;
      expect(output).toContain("invalid type");
    });
  });

  describe("in production mode", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("info() outputs JSON to console.warn", () => {
      const sl = new StructuredLogger();
      sl.info("prod message");
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const raw = consoleWarnSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(raw);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("prod message");
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.requestId).toBeDefined();
    });

    it("warn() outputs JSON to console.warn", () => {
      const sl = new StructuredLogger();
      sl.warn("prod warning");
      const parsed = JSON.parse(consoleWarnSpy.mock.calls[0][0] as string);
      expect(parsed.level).toBe("warn");
    });

    it("error() outputs JSON with error details to console.warn", () => {
      const sl = new StructuredLogger();
      const err = new Error("prod error");
      sl.error("critical failure", err, { route: "/api/checkout" });
      const parsed = JSON.parse(consoleWarnSpy.mock.calls[0][0] as string);
      expect(parsed.level).toBe("error");
      expect(parsed.error.message).toBe("prod error");
      expect(parsed.context?.route).toBe("/api/checkout");
    });

    it("debug() does NOT output anything in production mode", () => {
      const sl = new StructuredLogger();
      sl.debug("silent debug");
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe("ChildLogger", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("child() creates a logger that merges inherited context", () => {
      const sl = new StructuredLogger();
      const child = sl.child({ requestId: "parent-req", userId: "user-1" });
      child.info("child log");
      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain("user-1");
    });

    it("child log context overrides parent context keys", () => {
      const sl = new StructuredLogger();
      const child = sl.child({ userId: "original", route: "/base" });
      child.info("override test", { route: "/override" });
      const output = consoleInfoSpy.mock.calls[0][0] as string;
      expect(output).toContain("/override");
    });

    it("child.warn() proxies to parent.warn()", () => {
      const sl = new StructuredLogger();
      const child = sl.child({ sessionId: "sess-abc" });
      child.warn("child warning");
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const output = consoleWarnSpy.mock.calls[0][0] as string;
      expect(output).toContain("[WARN]");
    });

    it("child.error() proxies to parent.error()", () => {
      const sl = new StructuredLogger();
      const child = sl.child({ method: "POST" });
      child.error("child error", new Error("sub-error"));
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });

    it("child.child() creates grandchild that merges all contexts", () => {
      vi.stubEnv("NODE_ENV", "production");
      const sl = new StructuredLogger();
      const child = sl.child({ userId: "u1" });
      const grandchild = child.child({ route: "/api/v2" });
      grandchild.info("grandchild log");
      const parsed = JSON.parse(consoleWarnSpy.mock.calls[0][0] as string);
      expect(parsed.context.userId).toBe("u1");
      expect(parsed.context.route).toBe("/api/v2");
    });

    it("child.debug() proxies to parent.debug()", () => {
      const sl = new StructuredLogger();
      const child = sl.child({ route: "/debug" });
      child.debug("child debug");
      expect(consoleDebugSpy).toHaveBeenCalledOnce();
    });
  });

  describe("exported singleton logger", () => {
    it("is an instance that exposes info/warn/error/debug/child", () => {
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.child).toBe("function");
    });
  });
});
