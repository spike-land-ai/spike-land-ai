import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processGeminiStream } from "./gemini-stream";

vi.mock("@/lib/try-catch", () => ({
  tryCatch: vi.fn(async (p) => {
    try {
      const data = await p;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }),
}));

describe("gemini-stream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockAi = (responseOrError: unknown, isError = false) => {
    return {
      models: {
        generateContentStream: vi.fn().mockImplementation(() => {
          if (isError) return Promise.reject(responseOrError);
          return Promise.resolve(responseOrError);
        }),
      },
    } as unknown as Awaited<ReturnType<typeof import("./gemini-client").getGeminiClient>>;
  };

  const createAsyncIterable = (chunks: unknown[]) => {
    return {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    };
  };

  it("processes a valid stream successfully", async () => {
    const mockStream = createAsyncIterable([
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: { data: Buffer.from("chunk1").toString("base64") },
                },
              ],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: { data: Buffer.from("chunk2").toString("base64") },
                },
              ],
            },
          },
        ],
      },
    ]);

    const ai = createMockAi(mockStream);

    const promise = processGeminiStream({
      ai,
      model: "test-model",
      config: { responseModalities: ["IMAGE"] },
      contents: [],
      operationType: "generation",
    });

    // Wait for next tick so promises resolve
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result.toString()).toBe("chunk1chunk2");
  });

  it("throws if stream initiation fails", async () => {
    const ai = createMockAi(new Error("init failed"), true);

    await expect(
      processGeminiStream({
        ai,
        model: "test",
        config: { responseModalities: [] },
        contents: [],
        operationType: "enhancement",
      }),
    ).rejects.toThrow("Failed to start image enhancement: init failed");
  });

  it("throws if stream initiation throws non-error", async () => {
    const ai = createMockAi("string error", true);

    await expect(
      processGeminiStream({
        ai,
        model: "test",
        config: { responseModalities: [] },
        contents: [],
        operationType: "modification",
      }),
    ).rejects.toThrow("Failed to start image modification: Unknown error");
  });

  it("throws if no image data received", async () => {
    const mockStream = createAsyncIterable([]);
    const ai = createMockAi(mockStream);

    const expectPromise = expect(
      processGeminiStream({
        ai,
        model: "test",
        config: { responseModalities: [] },
        contents: [],
      }),
    ).rejects.toThrow("No image data received from Gemini API");

    await vi.runAllTimersAsync();
    await expectPromise;
  });

  it("skips invalid chunks and succeeds if it finds valid ones", async () => {
    const mockStream = createAsyncIterable([
      { candidates: [] }, // invalid
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: { data: Buffer.from("valid").toString("base64") },
                },
              ],
            },
          },
        ],
      },
    ]);

    const ai = createMockAi(mockStream);
    const promise = processGeminiStream({
      ai,
      model: "test",
      config: { responseModalities: [] },
      contents: [],
    });
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result.toString()).toBe("valid");
  });

  it("throws on chunk stream error", async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield {
          candidates: [
            {
              content: { parts: [{ inlineData: { data: "MQA=" } }] },
            },
          ],
        };
        throw new Error("Stream read failed");
      },
    };

    const ai = createMockAi(mockStream);
    const expectPromise = expect(
      processGeminiStream({
        ai,
        model: "test",
        config: { responseModalities: [] },
        contents: [],
      }),
    ).rejects.toThrow("Stream processing failed: Stream read failed");
    await vi.runAllTimersAsync();
    await expectPromise;
  });

  it("throws on timeout", async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        // hang forever
        await new Promise(() => {});
      },
    };

    const ai = createMockAi(mockStream);
    const expectPromise = expect(
      processGeminiStream({
        ai,
        model: "test",
        config: { responseModalities: [] },
        contents: [],
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("Gemini API request timed out");

    // Fast forward past timeout
    await vi.advanceTimersByTimeAsync(1500);

    await expectPromise;
  });
});
