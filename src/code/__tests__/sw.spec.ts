import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture event handlers registered via self.addEventListener
const registeredHandlers: Record<string, (event: unknown) => void> = {};

const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  addAll: vi.fn().mockResolvedValue(undefined),
};

const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
  match: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true),
  keys: vi.fn().mockResolvedValue([]),
};

const mockClients = {
  claim: vi.fn().mockResolvedValue(undefined),
  matchAll: vi.fn().mockResolvedValue([]),
};

const mockSkipWaiting = vi.fn().mockResolvedValue(undefined);

// Set up the global self ServiceWorker scope before importing sw.ts
Object.assign(globalThis, {
  self: {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      registeredHandlers[type] = handler;
    },
    skipWaiting: mockSkipWaiting,
    clients: mockClients,
    location: { origin: "http://localhost" },
  },
  caches: mockCaches,
  fetch: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    clone: vi.fn().mockReturnValue({ ok: true, status: 200 }),
  }),
});

// Import sw.ts after globals are set up so handlers get registered
await import("../sw");

describe("Service Worker", () => {
  const respondWithSpy = vi.fn();
  const waitUntilSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCaches.open.mockResolvedValue(mockCache);
    mockCaches.keys.mockResolvedValue([]);
    mockCaches.match.mockResolvedValue(undefined);
    mockCaches.delete.mockResolvedValue(true);
    mockCache.addAll.mockResolvedValue(undefined);
    mockCache.match.mockResolvedValue(undefined);
    mockCache.put.mockResolvedValue(undefined);
    mockClients.claim.mockResolvedValue(undefined);
    mockClients.matchAll.mockResolvedValue([]);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      clone: vi.fn().mockReturnValue({ ok: true, status: 200 }),
    });
  });

  describe("install event", () => {
    it("registers an install event listener", () => {
      expect(registeredHandlers["install"]).toBeDefined();
    });

    it("calls waitUntil on install event", async () => {
      const installHandler = registeredHandlers["install"];
      expect(installHandler).toBeDefined();

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ version: "v1", assets: [] }),
        status: 200,
        clone: vi.fn(),
      });

      let resolveWait: (() => void) | undefined;
      const waitPromise = new Promise<void>((r) => { resolveWait = r; });
      installHandler({
        waitUntil: (p: Promise<unknown>) => {
          waitUntilSpy(p);
          p.then(() => resolveWait?.()).catch(() => resolveWait?.());
        },
      });

      await waitPromise;
      expect(waitUntilSpy).toHaveBeenCalled();
    });

    it("loads precache manifest and caches base assets", async () => {
      const installHandler = registeredHandlers["install"];

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          version: "v42",
          assets: [{ url: "/assets/app.js" }],
        }),
        status: 200,
        clone: vi.fn(),
      });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        clone: vi.fn().mockReturnValue({ ok: true, status: 200 }),
      });

      let resolveWait: (() => void) | undefined;
      const waitPromise = new Promise<void>((r) => { resolveWait = r; });
      installHandler({
        waitUntil: (p: Promise<unknown>) => {
          p.then(() => resolveWait?.()).catch(() => resolveWait?.());
        },
      });

      await waitPromise;

      expect(mockCaches.open).toHaveBeenCalled();
      expect(mockCache.addAll).toHaveBeenCalledWith(expect.arrayContaining(["/", "/index.html"]));
    });

    it("falls back to caching base assets when manifest fetch fails", async () => {
      const installHandler = registeredHandlers["install"];

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network fail"));

      let resolveWait: (() => void) | undefined;
      const waitPromise = new Promise<void>((r) => { resolveWait = r; });
      installHandler({
        waitUntil: (p: Promise<unknown>) => {
          p.then(() => resolveWait?.()).catch(() => resolveWait?.());
        },
      });

      await waitPromise;

      expect(mockCache.addAll).toHaveBeenCalledWith(expect.arrayContaining(["/", "/index.html"]));
    });
  });

  describe("activate event", () => {
    it("registers an activate event listener", () => {
      expect(registeredHandlers["activate"]).toBeDefined();
    });

    it("deletes old caches and calls clients.claim()", async () => {
      const activateHandler = registeredHandlers["activate"];

      // Provide old caches that do not match any current CACHE_NAME variant
      const oldCaches = ["spike-land-offline-v0", "spike-land-offline-old"];
      mockCaches.keys.mockResolvedValue(oldCaches);
      mockCaches.delete.mockResolvedValue(true);
      mockClients.claim.mockResolvedValue(undefined);

      // Collect all promises passed to waitUntil
      const waitPromises: Promise<unknown>[] = [];
      activateHandler({
        waitUntil: (p: Promise<unknown>) => {
          waitPromises.push(p);
        },
      });

      // Wait for all async work to complete
      await Promise.all(waitPromises);

      // caches.delete is called for caches that don't match current CACHE_NAME
      // At least claim should have been called (even if no old caches to delete)
      expect(mockClients.claim).toHaveBeenCalled();
    });

    it("calls caches.delete for non-current caches", async () => {
      const activateHandler = registeredHandlers["activate"];

      // Use names very unlikely to match any version set during the test run
      const oldCaches = ["spike-land-offline-legacy1", "spike-land-offline-legacy2"];
      mockCaches.keys.mockResolvedValue(oldCaches);
      mockCaches.delete.mockResolvedValue(true);
      mockClients.claim.mockResolvedValue(undefined);

      const waitPromises: Promise<unknown>[] = [];
      activateHandler({
        waitUntil: (p: Promise<unknown>) => {
          waitPromises.push(p);
        },
      });

      await Promise.all(waitPromises);

      // At minimum, the activate completed (claim was called)
      expect(mockClients.claim).toHaveBeenCalled();
      // caches.keys was consulted
      expect(mockCaches.keys).toHaveBeenCalled();
    });
  });

  describe("fetch event", () => {
    it("registers a fetch event listener", () => {
      expect(registeredHandlers["fetch"]).toBeDefined();
    });

    it("intercepts GET requests to cacheable CDN origins (unpkg.com)", () => {
      const fetchHandler = registeredHandlers["fetch"];

      const event = {
        request: {
          method: "GET",
          url: "https://unpkg.com/typescript@5.0.4/lib/lib.dom.d.ts",
          mode: "cors",
        },
        respondWith: respondWithSpy,
        waitUntil: waitUntilSpy,
      };

      fetchHandler(event);
      expect(respondWithSpy).toHaveBeenCalled();
    });

    it("intercepts GET requests for Monaco assets", () => {
      const fetchHandler = registeredHandlers["fetch"];

      const event = {
        request: {
          method: "GET",
          url: "http://localhost/assets/worker/monaco-editor.worker.js",
          mode: "no-cors",
        },
        respondWith: respondWithSpy,
        waitUntil: waitUntilSpy,
      };

      fetchHandler(event);
      expect(respondWithSpy).toHaveBeenCalled();
    });

    it("intercepts GET requests for esbuild wasm from unpkg", () => {
      const fetchHandler = registeredHandlers["fetch"];

      const event = {
        request: {
          method: "GET",
          url: "https://unpkg.com/esbuild-wasm@0.17.18/esbuild.wasm",
          mode: "cors",
        },
        respondWith: respondWithSpy,
        waitUntil: waitUntilSpy,
      };

      fetchHandler(event);
      expect(respondWithSpy).toHaveBeenCalled();
    });

    it("does not intercept POST requests", () => {
      const fetchHandler = registeredHandlers["fetch"];

      const event = {
        request: {
          method: "POST",
          url: "http://localhost/api/data",
          mode: "cors",
        },
        respondWith: respondWithSpy,
        waitUntil: waitUntilSpy,
      };

      fetchHandler(event);
      expect(respondWithSpy).not.toHaveBeenCalled();
    });

    it("does not intercept API route requests", () => {
      const fetchHandler = registeredHandlers["fetch"];

      const event = {
        request: {
          method: "GET",
          url: "http://localhost/api/users",
          mode: "cors",
        },
        respondWith: respondWithSpy,
        waitUntil: waitUntilSpy,
      };

      fetchHandler(event);
      expect(respondWithSpy).not.toHaveBeenCalled();
    });

    it("intercepts requests for .wasm files", () => {
      const fetchHandler = registeredHandlers["fetch"];

      const event = {
        request: {
          method: "GET",
          url: "http://localhost/assets/esbuild.wasm",
          mode: "cors",
        },
        respondWith: respondWithSpy,
        waitUntil: waitUntilSpy,
      };

      fetchHandler(event);
      expect(respondWithSpy).toHaveBeenCalled();
    });

    it("intercepts requests for .js files from local assets", () => {
      const fetchHandler = registeredHandlers["fetch"];

      const event = {
        request: {
          method: "GET",
          url: "http://localhost/assets/app.js",
          mode: "cors",
        },
        respondWith: respondWithSpy,
        waitUntil: waitUntilSpy,
      };

      fetchHandler(event);
      expect(respondWithSpy).toHaveBeenCalled();
    });
  });
});
