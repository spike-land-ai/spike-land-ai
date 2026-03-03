import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAudioMetadata = vi.fn();
const mockGetAudioPublicUrl = vi.fn();
const mockUploadAudioToR2 = vi.fn();

vi.mock("@/lib/storage/audio-r2-client", () => ({
  getAudioMetadata: (...args: unknown[]) => mockGetAudioMetadata(...args),
  getAudioPublicUrl: (...args: unknown[]) => mockGetAudioPublicUrl(...args),
  uploadAudioToR2: (...args: unknown[]) => mockUploadAudioToR2(...args),
}));

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

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { cacheTTSAudio, generateTTSCacheKey, getCachedTTSUrl } from "./tts-cache";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateTTSCacheKey", () => {
  it("should return a key with tts/ prefix and .mp3 suffix", () => {
    const key = generateTTSCacheKey("Hello world");
    expect(key).toMatch(/^tts\/[a-f0-9]{64}\.mp3$/);
  });

  it("should normalize text by trimming and lowercasing", () => {
    const key1 = generateTTSCacheKey("  Hello World  ");
    const key2 = generateTTSCacheKey("hello world");
    expect(key1).toBe(key2);
  });

  it("should produce different keys for different text", () => {
    const key1 = generateTTSCacheKey("Hello");
    const key2 = generateTTSCacheKey("World");
    expect(key1).not.toBe(key2);
  });

  it("should produce consistent keys for same text", () => {
    const key1 = generateTTSCacheKey("test input");
    const key2 = generateTTSCacheKey("test input");
    expect(key1).toBe(key2);
  });
});

describe("getCachedTTSUrl", () => {
  it("should return URL when audio exists in cache", async () => {
    mockGetAudioMetadata.mockResolvedValue({ size: 1024 });
    mockGetAudioPublicUrl.mockReturnValue("https://cdn.example.com/tts/abc.mp3");

    const result = await getCachedTTSUrl("Hello");
    expect(result).toBe("https://cdn.example.com/tts/abc.mp3");
    expect(mockGetAudioMetadata).toHaveBeenCalledWith(
      expect.stringMatching(/^tts\/[a-f0-9]+\.mp3$/),
    );
  });

  it("should return null when metadata is null (cache miss)", async () => {
    mockGetAudioMetadata.mockResolvedValue(null);

    const result = await getCachedTTSUrl("Not cached");
    expect(result).toBeNull();
  });

  it("should return null when metadata lookup fails", async () => {
    mockGetAudioMetadata.mockRejectedValue(new Error("R2 error"));

    const result = await getCachedTTSUrl("Test");
    expect(result).toBeNull();
  });

  it("should return null when URL generation returns falsy", async () => {
    mockGetAudioMetadata.mockResolvedValue({ size: 1024 });
    mockGetAudioPublicUrl.mockReturnValue(null);

    const result = await getCachedTTSUrl("Test");
    expect(result).toBeNull();
  });
});

describe("cacheTTSAudio", () => {
  it("should upload audio and return URL on success", async () => {
    mockUploadAudioToR2.mockResolvedValue({
      success: true,
      url: "https://cdn.example.com/tts/xyz.mp3",
    });

    const buffer = Buffer.from("audio-data");
    const result = await cacheTTSAudio("Hello", buffer);
    expect(result).toBe("https://cdn.example.com/tts/xyz.mp3");
    expect(mockUploadAudioToR2).toHaveBeenCalledWith({
      key: expect.stringMatching(/^tts\/[a-f0-9]+\.mp3$/),
      buffer,
      contentType: "audio/mpeg",
      metadata: {
        source: "elevenlabs",
        textLength: "5",
        generatedAt: expect.any(String),
      },
    });
  });

  it("should return null when upload throws", async () => {
    mockUploadAudioToR2.mockRejectedValue(new Error("Upload failed"));

    const result = await cacheTTSAudio("Test", Buffer.from("data"));
    expect(result).toBeNull();
  });

  it("should return null when upload returns success: false", async () => {
    mockUploadAudioToR2.mockResolvedValue({
      success: false,
      error: "Quota exceeded",
    });

    const result = await cacheTTSAudio("Test", Buffer.from("data"));
    expect(result).toBeNull();
  });
});
