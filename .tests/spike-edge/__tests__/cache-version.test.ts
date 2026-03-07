/// <reference types="@cloudflare/workers-types" />
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCacheVersion, resetCacheVersionForTesting } from "../../../src/edge-api/main/api/lib/cache-version.js";

function makeR2Object(body: string): R2ObjectBody {
    return {
        body: new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(body));
                controller.close();
            },
        }),
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer),
        text: () => Promise.resolve(body),
        json: () => Promise.resolve(JSON.parse(body)),
        blob: () => Promise.resolve(new Blob([body])),
        key: "index.html",
        version: "1",
        size: body.length,
        etag: "abc",
        httpEtag: '"abc"',
        checksums: { toJSON: () => ({}) } as unknown as R2Checksums,
        uploaded: new Date(),
        httpMetadata: { contentType: "text/html" },
        customMetadata: {},
        storageClass: "Standard",
        writeHttpMetadata: () => { },
        range: undefined as unknown as R2Range,
    } as unknown as R2ObjectBody;
}

function mockR2(getResult: R2ObjectBody | null = null) {
    return {
        get: vi.fn().mockResolvedValue(getResult),
    } as unknown as R2Bucket;
}

describe("getCacheVersion", () => {
    beforeEach(() => {
        resetCacheVersionForTesting();
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 2, 7, 10, 0, 0)); // Fixed time
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("extracts build-sha from index.html", async () => {
        const r2 = mockR2(makeR2Object('<html><head><meta name="build-sha" content="abcdef1234567890" /></head><body></body></html>'));
        const version = await getCacheVersion(r2);

        expect(version).toBe("abcdef123456"); // First 12 chars
        expect(r2.get).toHaveBeenCalledWith("index.html");
        expect(r2.get).toHaveBeenCalledTimes(1);
    });

    it("caches the extracted version and respects TTL", async () => {
        const r2 = mockR2(makeR2Object('<html><head><meta name="build-sha" content="initial12345678" /></head><body></body></html>'));

        // First call reads from R2
        const version1 = await getCacheVersion(r2);
        expect(version1).toBe("initial123456");
        expect(r2.get).toHaveBeenCalledTimes(1);

        // Change mock (should not be called due to cache)
        r2.get = vi.fn().mockResolvedValue(makeR2Object('<html><head><meta name="build-sha" content="changed12345678" /></head><body></body></html>'));

        // Second call within TTL (e.g. 1 minute later) returns cached value
        vi.advanceTimersByTime(60 * 1000);
        const version2 = await getCacheVersion(r2);
        expect(version2).toBe("initial123456");
        expect(r2.get).not.toHaveBeenCalled(); // No new call to R2

        // Third call after TTL expires (e.g. 5 minutes + 1 ms later)
        vi.advanceTimersByTime(4 * 60 * 1000 + 1); // Exact time where it expires
        const version3 = await getCacheVersion(r2);
        expect(version3).toBe("changed123456");
        expect(r2.get).toHaveBeenCalledTimes(1); // Fetched again
    });

    it("falls back to timestamp string if index.html is missing or has no build-sha", async () => {
        // 1. Missing index.html
        const missingR2 = mockR2(null);
        const versionMissing = await getCacheVersion(missingR2);
        expect(versionMissing).toMatch(/^[a-z0-9]+$/);

        // Reset cache by expiring timer
        vi.advanceTimersByTime(10 * 60 * 1000);

        // 2. index.html without build-sha
        const noShaR2 = mockR2(makeR2Object('<html><head><title>No SHA</title></head><body></body></html>'));
        const versionNoSha = await getCacheVersion(noShaR2);
        expect(versionNoSha).toMatch(/^[a-z0-9]+$/);

        // Timestamp fallback returns the same string for same 5-minute bucket
        const versionNoSha2 = await getCacheVersion(noShaR2);
        expect(versionNoSha2).toBe(versionNoSha);
    });
});
