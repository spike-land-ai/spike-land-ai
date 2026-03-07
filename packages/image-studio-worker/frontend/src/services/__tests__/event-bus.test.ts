import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventBus } from "../event-bus";

describe("eventBus", () => {
  beforeEach(() => {
    eventBus.clear();
    vi.restoreAllMocks();
  });

  it("should successfully instantiate and expose methods", () => {
    expect(eventBus).toBeDefined();
    expect(typeof eventBus.on).toBe("function");
    expect(typeof eventBus.emit).toBe("function");
    expect(typeof eventBus.off).toBe("function");
    expect(typeof eventBus.clear).toBe("function");
  });

  it("should allow subscribing and emitting events", () => {
    const handler = vi.fn();
    eventBus.on("album:created", handler);

    eventBus.emit("album:created", { albumId: "123", name: "Vacation" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ albumId: "123", name: "Vacation" });
  });

  it("should allow unsubscribing from events using off()", () => {
    const handler = vi.fn();
    eventBus.on("image:deleted", handler);
    eventBus.off("image:deleted", handler);

    eventBus.emit("image:deleted", { imageId: "abc" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should allow unsubscribing from events using the returned function", () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.on("gallery:updated", handler);

    unsubscribe();

    eventBus.emit("gallery:updated", { reason: "refresh" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should execute multiple handlers for the same event", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.on("image:uploaded", handler1);
    eventBus.on("image:uploaded", handler2);

    eventBus.emit("image:uploaded", { imageId: "img1", url: "http://example.com/img1.jpg", name: "img1.jpg" });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("should not crash if a handler throws an error, and should execute subsequent handlers", () => {
    const failingHandler = vi.fn(() => {
      throw new Error("Handler failed");
    });
    const successfulHandler = vi.fn();

    // Mock console.error to avoid test output noise
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    eventBus.on("image:generated", failingHandler);
    eventBus.on("image:generated", successfulHandler);

    expect(() => {
      eventBus.emit("image:generated", { imageId: "gen1", url: "http://example.com/gen1.jpg", prompt: "A dog" });
    }).not.toThrow();

    expect(failingHandler).toHaveBeenCalledTimes(1);
    expect(successfulHandler).toHaveBeenCalledTimes(1);

    // Verify console.error was called with the correct message and error object
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[EventBus] Error in handler for image:generated:",
      expect.any(Error)
    );
  });

  it("should clear all handlers when clear() is called", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.on("album:updated", handler1);
    eventBus.on("chat:image-attached", handler2);

    eventBus.clear();

    eventBus.emit("album:updated", { albumId: "1" });
    eventBus.emit("chat:image-attached", { file: new File([""], "test.png") });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });
});
