import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Redis
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockIncr = vi.fn();
const mockExpire = vi.fn();

vi.mock("@/lib/upstash/client", () => ({
  redis: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
    incr: (...args: unknown[]) => mockIncr(...args),
    expire: (...args: unknown[]) => mockExpire(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  getCircuitState,
  recordCircuitFailure,
  recordCircuitSuccess,
} from "./circuit-breaker";

describe("circuit-breaker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCircuitState", () => {
    it("should return CLOSED when no state in Redis", async () => {
      mockGet.mockResolvedValue(null);

      const state = await getCircuitState();

      expect(state).toBe("CLOSED");
    });

    it("should return CLOSED when state is CLOSED", async () => {
      mockGet
        .mockResolvedValueOnce("CLOSED") // state
        .mockResolvedValueOnce(null); // lastFailure

      const state = await getCircuitState();

      expect(state).toBe("CLOSED");
    });

    it("should return OPEN when state is OPEN and cooldown not expired", async () => {
      mockGet
        .mockResolvedValueOnce("OPEN") // state
        .mockResolvedValueOnce(Date.now() - 10_000); // lastFailure 10s ago (< 60s cooldown)

      const state = await getCircuitState();

      expect(state).toBe("OPEN");
    });

    it("should return HALF_OPEN when state is OPEN and cooldown expired", async () => {
      mockGet
        .mockResolvedValueOnce("OPEN") // state
        .mockResolvedValueOnce(Date.now() - 120_000); // lastFailure 120s ago (> 60s cooldown)

      const state = await getCircuitState();

      expect(state).toBe("HALF_OPEN");
    });

    it("should return HALF_OPEN when state is HALF_OPEN", async () => {
      mockGet
        .mockResolvedValueOnce("HALF_OPEN") // state
        .mockResolvedValueOnce(null); // lastFailure

      const state = await getCircuitState();

      expect(state).toBe("HALF_OPEN");
    });

    it("should return CLOSED when Redis throws", async () => {
      mockGet.mockRejectedValue(new Error("Redis down"));

      const state = await getCircuitState();

      expect(state).toBe("CLOSED");
    });

    it("should return CLOSED for unknown state value", async () => {
      mockGet
        .mockResolvedValueOnce("UNKNOWN") // state
        .mockResolvedValueOnce(null); // lastFailure

      const state = await getCircuitState();

      expect(state).toBe("CLOSED");
    });

    it("should return OPEN when state is OPEN but no lastFailure stored", async () => {
      mockGet
        .mockResolvedValueOnce("OPEN") // state
        .mockResolvedValueOnce(null); // lastFailure missing

      // Without lastFailure the condition `state === "OPEN" && lastFailure` is false
      // Falls through to the default CLOSED return
      const state = await getCircuitState();

      expect(state).toBe("CLOSED");
    });
  });

  describe("recordCircuitFailure", () => {
    it("should increment failure counter and set expiry", async () => {
      mockIncr.mockResolvedValue(1);
      mockExpire.mockResolvedValue(true);

      await recordCircuitFailure();

      expect(mockIncr).toHaveBeenCalledWith("circuit_breaker:claude:failures");
      expect(mockExpire).toHaveBeenCalledWith(
        "circuit_breaker:claude:failures",
        300,
      );
    });

    it("should NOT open circuit when below threshold", async () => {
      mockIncr.mockResolvedValue(2); // Below threshold of 3
      mockExpire.mockResolvedValue(true);

      await recordCircuitFailure();

      expect(mockSet).not.toHaveBeenCalled();
    });

    it("should open circuit when failures reach threshold", async () => {
      mockIncr.mockResolvedValue(3); // Equals threshold
      mockExpire.mockResolvedValue(true);
      mockSet.mockResolvedValue("OK");

      await recordCircuitFailure();

      expect(mockSet).toHaveBeenCalledWith(
        "circuit_breaker:claude:state",
        "OPEN",
        { ex: 300 },
      );
      expect(mockSet).toHaveBeenCalledWith(
        "circuit_breaker:claude:last_failure",
        expect.any(Number),
        { ex: 300 },
      );
    });

    it("should open circuit when failures exceed threshold", async () => {
      mockIncr.mockResolvedValue(5); // Above threshold
      mockExpire.mockResolvedValue(true);
      mockSet.mockResolvedValue("OK");

      await recordCircuitFailure();

      expect(mockSet).toHaveBeenCalledWith(
        "circuit_breaker:claude:state",
        "OPEN",
        { ex: 300 },
      );
    });

    it("should swallow Redis errors gracefully", async () => {
      mockIncr.mockRejectedValue(new Error("Redis down"));

      // Should not throw
      await recordCircuitFailure();
    });
  });

  describe("recordCircuitSuccess", () => {
    it("should reset state to CLOSED and failures to 0", async () => {
      mockSet.mockResolvedValue("OK");

      await recordCircuitSuccess();

      expect(mockSet).toHaveBeenCalledWith(
        "circuit_breaker:claude:state",
        "CLOSED",
        { ex: 300 },
      );
      expect(mockSet).toHaveBeenCalledWith(
        "circuit_breaker:claude:failures",
        0,
        { ex: 300 },
      );
    });

    it("should swallow Redis errors gracefully", async () => {
      mockSet.mockRejectedValue(new Error("Redis down"));

      // Should not throw
      await recordCircuitSuccess();
    });
  });
});
