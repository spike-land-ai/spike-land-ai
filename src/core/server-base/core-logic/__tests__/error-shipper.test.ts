import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createErrorShipper } from "../error-shipper.js";

describe("createErrorShipper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("batches and ships errors after timeout", async () => {
    const shipper = createErrorShipper({ flushIntervalMs: 1000 });

    shipper.shipError({
      service_name: "test-service",
      message: "Test error",
    });

    expect(fetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://spike.land/api/errors/ingest",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify([
          {
            service_name: "test-service",
            message: "Test error",
          },
        ]),
      }),
    );
  });

  it("flushes immediately when batch size is reached", async () => {
    const shipper = createErrorShipper({ batchSize: 2 });

    shipper.shipError({ service_name: "test-service", message: "Error 1" });
    expect(fetch).not.toHaveBeenCalled();

    shipper.shipError({ service_name: "test-service", message: "Error 2" });
    // Since flush() is async and we mock fetch to resolve, we just await a microtask
    await vi.advanceTimersByTimeAsync(0);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify([
          { service_name: "test-service", message: "Error 1" },
          { service_name: "test-service", message: "Error 2" },
        ]),
      }),
    );
  });

  it("manual flush sends remaining items", async () => {
    const shipper = createErrorShipper({ batchSize: 10 });

    shipper.shipError({ service_name: "test-service", message: "Error 1" });
    expect(fetch).not.toHaveBeenCalled();

    await shipper.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
