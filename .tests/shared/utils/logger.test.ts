import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, type LogEntry } from "../../../src/shared/utils/logger";

describe("createLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("JSON output format", () => {
    it("should output valid JSON with required fields", () => {
      const logger = createLogger("test-service");
      logger.info("hello");

      expect(console.log).toHaveBeenCalledOnce();
      const raw = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const entry = JSON.parse(raw) as LogEntry;

      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(entry.level).toBe("info");
      expect(entry.service).toBe("test-service");
      expect(entry.message).toBe("hello");
      expect(entry.requestId).toBeUndefined();
      expect(entry.data).toBeUndefined();
    });

    it("should include data when provided", () => {
      const logger = createLogger("svc");
      logger.warn("something bad", { code: 42 });

      const raw = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const entry = JSON.parse(raw) as LogEntry;

      expect(entry.data).toEqual({ code: 42 });
    });

    it("should not include data key when not provided", () => {
      const logger = createLogger("svc");
      logger.info("no data");

      const raw = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const entry = JSON.parse(raw) as LogEntry;

      expect(Object.prototype.hasOwnProperty.call(entry, "data")).toBe(false);
    });
  });

  describe("log level routing", () => {
    it("debug calls console.debug", () => {
      createLogger("svc").debug("d");
      expect(console.debug).toHaveBeenCalledOnce();
    });

    it("info calls console.log", () => {
      createLogger("svc").info("i");
      expect(console.log).toHaveBeenCalledOnce();
    });

    it("warn calls console.warn", () => {
      createLogger("svc").warn("w");
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it("error calls console.error", () => {
      createLogger("svc").error("e");
      expect(console.error).toHaveBeenCalledOnce();
    });
  });

  describe("level filtering", () => {
    it("should skip debug and info when level is warn", () => {
      const logger = createLogger("svc", { level: "warn" });
      logger.debug("skip");
      logger.info("skip");
      logger.warn("pass");
      logger.error("pass");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledOnce();
    });

    it("should skip debug when level is info", () => {
      const logger = createLogger("svc", { level: "info" });
      logger.debug("skip");
      logger.info("pass");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledOnce();
    });

    it("should only emit error when level is error", () => {
      const logger = createLogger("svc", { level: "error" });
      logger.debug("skip");
      logger.info("skip");
      logger.warn("skip");
      logger.error("pass");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledOnce();
    });

    it("should emit all levels when level is debug (default)", () => {
      const logger = createLogger("svc");
      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      expect(console.debug).toHaveBeenCalledOnce();
      expect(console.log).toHaveBeenCalledOnce();
      expect(console.warn).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledOnce();
    });
  });

  describe("withRequestId", () => {
    it("should return a child logger with bound requestId", () => {
      const logger = createLogger("svc");
      const child = logger.withRequestId("req-123");
      child.info("with id");

      const raw = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const entry = JSON.parse(raw) as LogEntry;

      expect(entry.requestId).toBe("req-123");
      expect(entry.service).toBe("svc");
    });

    it("should not affect parent logger", () => {
      const logger = createLogger("svc");
      logger.withRequestId("req-456");
      logger.info("no id");

      const raw = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const entry = JSON.parse(raw) as LogEntry;

      expect(Object.prototype.hasOwnProperty.call(entry, "requestId")).toBe(false);
    });

    it("should inherit level filtering from parent", () => {
      const logger = createLogger("svc", { level: "warn" });
      const child = logger.withRequestId("req-789");
      child.info("should be filtered");

      expect(console.log).not.toHaveBeenCalled();
    });

    it("child logger should include requestId in every log call", () => {
      const logger = createLogger("svc");
      const child = logger.withRequestId("req-abc");
      child.debug("d");
      child.warn("w");
      child.error("e");

      const debugRaw = (console.debug as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const warnRaw = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const errorRaw = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;

      expect((JSON.parse(debugRaw) as LogEntry).requestId).toBe("req-abc");
      expect((JSON.parse(warnRaw) as LogEntry).requestId).toBe("req-abc");
      expect((JSON.parse(errorRaw) as LogEntry).requestId).toBe("req-abc");
    });
  });
});
