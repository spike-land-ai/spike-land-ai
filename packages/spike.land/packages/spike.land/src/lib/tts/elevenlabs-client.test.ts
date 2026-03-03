import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

import {
  characterTimestampsToWords,
  MAX_TEXT_LENGTH,
  synthesizeSpeech,
  synthesizeSpeechWithTimestamps,
} from "./elevenlabs-client";

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    ELEVENLABS_API_KEY: "test-api-key",
  };
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
});

describe("characterTimestampsToWords", () => {
  it("should convert single word", () => {
    const result = characterTimestampsToWords({
      characters: ["H", "i"],
      character_start_times_seconds: [0.0, 0.1],
      character_end_times_seconds: [0.1, 0.2],
    });
    expect(result).toEqual([{ word: "Hi", start: 0.0, end: 0.2 }]);
  });

  it("should split on spaces", () => {
    const result = characterTimestampsToWords({
      characters: ["H", "i", " ", "y", "o"],
      character_start_times_seconds: [0.0, 0.1, 0.2, 0.3, 0.4],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5],
    });
    expect(result).toEqual([
      { word: "Hi", start: 0.0, end: 0.2 },
      { word: "yo", start: 0.3, end: 0.5 },
    ]);
  });

  it("should split on newlines and tabs", () => {
    const result = characterTimestampsToWords({
      characters: ["a", "\n", "b", "\t", "c"],
      character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5],
    });
    expect(result).toEqual([
      { word: "a", start: 0, end: 0.1 },
      { word: "b", start: 0.2, end: 0.3 },
      { word: "c", start: 0.4, end: 0.5 },
    ]);
  });

  it("should handle multiple consecutive spaces", () => {
    const result = characterTimestampsToWords({
      characters: ["a", " ", " ", "b"],
      character_start_times_seconds: [0, 0.1, 0.2, 0.3],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4],
    });
    expect(result).toEqual([
      { word: "a", start: 0, end: 0.1 },
      { word: "b", start: 0.3, end: 0.4 },
    ]);
  });

  it("should handle leading spaces", () => {
    const result = characterTimestampsToWords({
      characters: [" ", "a"],
      character_start_times_seconds: [0, 0.1],
      character_end_times_seconds: [0.1, 0.2],
    });
    expect(result).toEqual([{ word: "a", start: 0.1, end: 0.2 }]);
  });

  it("should handle empty input", () => {
    const result = characterTimestampsToWords({
      characters: [],
      character_start_times_seconds: [],
      character_end_times_seconds: [],
    });
    expect(result).toEqual([]);
  });

  it("should handle trailing spaces", () => {
    const result = characterTimestampsToWords({
      characters: ["a", " "],
      character_start_times_seconds: [0, 0.1],
      character_end_times_seconds: [0.1, 0.2],
    });
    expect(result).toEqual([{ word: "a", start: 0, end: 0.1 }]);
  });
});

describe("synthesizeSpeech", () => {
  it("should throw when ELEVENLABS_API_KEY is missing", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    await expect(synthesizeSpeech("Hello")).rejects.toThrow(
      "ELEVENLABS_API_KEY is not configured",
    );
  });

  it("should throw for empty text", async () => {
    await expect(synthesizeSpeech("")).rejects.toThrow("Text cannot be empty");
  });

  it("should throw for whitespace-only text", async () => {
    await expect(synthesizeSpeech("   ")).rejects.toThrow(
      "Text cannot be empty",
    );
  });

  it("should throw for text exceeding max length", async () => {
    const longText = "a".repeat(MAX_TEXT_LENGTH + 1);
    await expect(synthesizeSpeech(longText)).rejects.toThrow(
      `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
    );
  });

  it("should call fetch with correct URL and headers", async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse as unknown as Response);

    const result = await synthesizeSpeech("Hello world");
    expect(result).toBeInstanceOf(Buffer);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("text-to-speech/"),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": "test-api-key",
        },
      }),
    );
  });

  it("should use custom voiceId when provided", async () => {
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse as unknown as Response);

    await synthesizeSpeech("Test", { voiceId: "custom-voice" });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/custom-voice"),
      expect.anything(),
    );
  });

  it("should use ELEVENLABS_VOICE_ID env var as fallback", async () => {
    process.env.ELEVENLABS_VOICE_ID = "env-voice";
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse as unknown as Response);

    await synthesizeSpeech("Test");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/env-voice"),
      expect.anything(),
    );
  });

  it("should throw on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue("Unauthorized"),
    } as unknown as Response);

    await expect(synthesizeSpeech("Hello")).rejects.toThrow(
      "ElevenLabs API returned 401: Unauthorized",
    );
  });

  it("should throw on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Network error"),
    );

    await expect(synthesizeSpeech("Hello")).rejects.toThrow(
      "ElevenLabs API request failed: Network error",
    );
  });
});

describe("synthesizeSpeechWithTimestamps", () => {
  it("should return audio buffer, words, and duration", async () => {
    const timestampResponse = {
      audio_base64: Buffer.from("audio-data").toString("base64"),
      alignment: {
        characters: ["H", "i"],
        character_start_times_seconds: [0.0, 0.1],
        character_end_times_seconds: [0.1, 0.2],
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(timestampResponse),
    } as unknown as Response);

    const result = await synthesizeSpeechWithTimestamps("Hi");
    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.words).toEqual([{ word: "Hi", start: 0.0, end: 0.2 }]);
    expect(result.audioDurationSeconds).toBe(0.2);
  });

  it("should use /with-timestamps URL", async () => {
    const timestampResponse = {
      audio_base64: Buffer.from("data").toString("base64"),
      alignment: {
        characters: ["A"],
        character_start_times_seconds: [0],
        character_end_times_seconds: [0.1],
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(timestampResponse),
    } as unknown as Response);

    await synthesizeSpeechWithTimestamps("A");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/with-timestamps"),
      expect.anything(),
    );
  });

  it("should return 0 duration for empty alignment", async () => {
    const timestampResponse = {
      audio_base64: Buffer.from("").toString("base64"),
      alignment: {
        characters: [],
        character_start_times_seconds: [],
        character_end_times_seconds: [],
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(timestampResponse),
    } as unknown as Response);

    const result = await synthesizeSpeechWithTimestamps("Test");
    expect(result.audioDurationSeconds).toBe(0);
    expect(result.words).toEqual([]);
  });
});

describe("MAX_TEXT_LENGTH", () => {
  it("should be 5000", () => {
    expect(MAX_TEXT_LENGTH).toBe(5000);
  });
});
