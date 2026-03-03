import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectFramework,
  generateEsbuildConfig,
  guessEntryPoint,
} from "./framework-detector";

describe("framework-detector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectFramework", () => {
    it("returns plain when URL cannot be parsed", async () => {
      const framework = await detectFramework("invalid-url");
      expect(framework).toBe("plain");
    });

    it("returns plain when fetch fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("network error"),
      );
      const framework = await detectFramework(
        "https://github.com/user/repo",
      );
      expect(framework).toBe("plain");
    });

    it("returns plain when response is not ok", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);
      const framework = await detectFramework(
        "https://github.com/user/repo",
      );
      expect(framework).toBe("plain");
    });

    it("returns plain when JSON parse fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("invalid json")),
      } as unknown as Response);
      const framework = await detectFramework(
        "https://github.com/user/repo",
      );
      expect(framework).toBe("plain");
    });

    it("detects next framework", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            dependencies: { next: "^14.0.0", react: "^18.0.0" },
          }),
      } as unknown as Response);
      const framework = await detectFramework(
        "https://github.com/user/repo",
      );
      expect(framework).toBe("next");
    });

    it("detects remix framework", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            dependencies: { "@remix-run/react": "^2.0.0" },
          }),
      } as unknown as Response);
      const framework = await detectFramework(
        "https://github.com/user/repo",
      );
      expect(framework).toBe("remix");
    });

    it("detects vite framework", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            devDependencies: { vite: "^5.0.0" },
          }),
      } as unknown as Response);
      const framework = await detectFramework(
        "https://github.com/user/repo",
      );
      expect(framework).toBe("vite");
    });

    it("detects cra framework", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            dependencies: { "react-scripts": "^5.0.0" },
          }),
      } as unknown as Response);
      const framework = await detectFramework(
        "https://github.com/user/repo",
      );
      expect(framework).toBe("cra");
    });

    it("returns plain when no framework deps found", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            dependencies: { lodash: "^4.0.0" },
          }),
      } as unknown as Response);
      const framework = await detectFramework(
        "https://github.com/user/repo",
      );
      expect(framework).toBe("plain");
    });

    it("uses custom branchOrCommit parameter", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            dependencies: { next: "^14.0.0" },
          }),
      } as unknown as Response);
      await detectFramework(
        "https://github.com/user/repo",
        "develop",
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("develop"),
      );
    });
  });

  describe("guessEntryPoint", () => {
    it("returns index.js for invalid URL", async () => {
      const entry = await guessEntryPoint("invalid-url", "plain");
      expect(entry).toBe("index.js");
    });

    it("returns first matching vite entry", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
      } as Response);
      const entry = await guessEntryPoint(
        "https://github.com/user/repo",
        "vite",
      );
      expect(entry).toBe("src/main.tsx");
    });

    it("returns first matching cra entry", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
      } as Response);
      const entry = await guessEntryPoint(
        "https://github.com/user/repo",
        "cra",
      );
      expect(entry).toBe("src/index.tsx");
    });

    it("returns first matching next entry", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
      } as Response);
      const entry = await guessEntryPoint(
        "https://github.com/user/repo",
        "next",
      );
      expect(entry).toBe("app/layout.tsx");
    });

    it("returns first matching remix entry", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
      } as Response);
      const entry = await guessEntryPoint(
        "https://github.com/user/repo",
        "remix",
      );
      expect(entry).toBe("app/entry.client.tsx");
    });

    it("returns first matching plain entry", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
      } as Response);
      const entry = await guessEntryPoint(
        "https://github.com/user/repo",
        "plain",
      );
      expect(entry).toBe("index.ts");
    });

    it("falls back to first entry when none found", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(() =>
        Promise.resolve({ ok: false } as Response)
      );
      const entry = await guessEntryPoint(
        "https://github.com/user/repo",
        "vite",
      );
      expect(entry).toBe("src/main.tsx");
    });

    it("uses branchOrCommit parameter", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({ ok: true } as Response);
      await guessEntryPoint(
        "https://github.com/user/repo",
        "vite",
        "feature-branch",
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("feature-branch"),
        expect.objectContaining({ method: "HEAD" }),
      );
    });
  });

  describe("generateEsbuildConfig", () => {
    it("generates correct base config for vite", () => {
      const config = generateEsbuildConfig("vite");
      expect(config.format).toBe("esm");
      expect(config.platform).toBe("browser");
      expect(config.target).toBe("es2022");
      expect(config.bundle).toBe(true);
      expect(config.treeShaking).toBe(true);
      expect(config.jsx).toBe("automatic");
    });

    it("generates config with jsx for cra", () => {
      const config = generateEsbuildConfig("cra");
      expect(config.jsx).toBe("automatic");
    });

    it("generates config with jsx for next", () => {
      const config = generateEsbuildConfig("next");
      expect(config.jsx).toBe("automatic");
    });

    it("generates config with jsx for remix", () => {
      const config = generateEsbuildConfig("remix");
      expect(config.jsx).toBe("automatic");
    });

    it("generates config without jsx for plain", () => {
      const config = generateEsbuildConfig("plain");
      expect(config.jsx).toBeUndefined();
      expect(config.format).toBe("esm");
    });

    it("includes NODE_ENV production define", () => {
      const config = generateEsbuildConfig("vite");
      expect(config.define).toBeDefined();
      expect(config.define!["process.env.NODE_ENV"]).toBe(
        JSON.stringify("production"),
      );
    });
  });
});
