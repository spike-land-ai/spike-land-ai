import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function setMockLocation(url: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: new URL(url),
  });
}

function clearServiceWorker() {
  Reflect.deleteProperty(navigator, "serviceWorker");
}

function setServiceWorkerContainer(
  container:
    | ServiceWorkerContainer
    | (Partial<ServiceWorkerContainer> & { controller?: ServiceWorker | null }),
) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
}

function createWorkerTarget(
  onPostMessage?: (message: unknown, transfer?: Transferable[]) => void,
): ServiceWorker {
  return {
    postMessage: vi.fn(onPostMessage),
  } as unknown as ServiceWorker;
}

function setCacheStorage(cacheStorage: CacheStorage | undefined) {
  if (cacheStorage) {
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: cacheStorage,
    });
    return;
  }

  Reflect.deleteProperty(window, "caches");
}

describe("serviceWorkerCache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    setMockLocation("https://dev.spike.land/vibe-code");
    clearServiceWorker();
    setCacheStorage(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearServiceWorker();
  });

  it("builds the service worker URL with an absolute manifest reference", async () => {
    const { buildServiceWorkerScriptUrl } = await import("@/core-logic/lib/serviceWorkerCache");
    const url = buildServiceWorkerScriptUrl({
      manifestUrl: "https://assets.dev.spike.land/cache-policy.json",
    });

    expect(url.startsWith("/spike-cache-worker.js?")).toBe(true);
    expect(decodeURIComponent(url)).toContain("https://assets.dev.spike.land/cache-policy.json");
  });

  it("handles enablement overrides for dev and production", async () => {
    const { shouldEnableServiceWorkerCacheController } = await import(
      "@/core-logic/lib/serviceWorkerCache"
    );

    expect(shouldEnableServiceWorkerCacheController({ isDev: true })).toBe(false);
    expect(shouldEnableServiceWorkerCacheController({ isDev: true, enableInDev: true })).toBe(true);
    expect(shouldEnableServiceWorkerCacheController({ isDev: false })).toBe(true);
    expect(shouldEnableServiceWorkerCacheController({ enabled: true, isDev: true })).toBe(true);
    expect(shouldEnableServiceWorkerCacheController({ enabled: false })).toBe(false);
  });

  it("returns null when registration is not supported or disabled", async () => {
    const { registerServiceWorkerCacheController } = await import(
      "@/core-logic/lib/serviceWorkerCache"
    );

    expect(await registerServiceWorkerCacheController({ enabled: true })).toBeNull();

    setServiceWorkerContainer({
      controller: null,
      register: vi.fn(),
      getRegistration: vi.fn(),
    });

    expect(await registerServiceWorkerCacheController({ isDev: true })).toBeNull();
  });

  it("registers the worker and sends an initial manifest sync", async () => {
    const postMessage = vi.fn();
    const register = vi.fn().mockResolvedValue({
      active: createWorkerTarget(),
      waiting: null,
      installing: null,
    });
    const getRegistration = vi.fn().mockResolvedValue({
      active: createWorkerTarget(),
      waiting: null,
      installing: null,
    });

    setServiceWorkerContainer({
      controller: createWorkerTarget((message) => {
        postMessage(message);
      }),
      register,
      getRegistration,
    });

    const { registerServiceWorkerCacheController } = await import(
      "@/core-logic/lib/serviceWorkerCache"
    );
    const registration = await registerServiceWorkerCacheController({
      enabled: true,
      manifestUrl: "/service-worker/cache-policy.json",
    });

    expect(registration).not.toBeNull();
    expect(register).toHaveBeenCalledOnce();
    expect(register.mock.calls[0]?.[0]).toContain("/spike-cache-worker.js?");
    expect(register.mock.calls[0]?.[1]).toEqual({ scope: "/" });
    expect(postMessage).toHaveBeenCalledWith({ type: "sync-manifest" });
  });

  it("can register without forcing an initial manifest sync", async () => {
    const postMessage = vi.fn();
    const register = vi.fn().mockResolvedValue({
      active: createWorkerTarget(),
      waiting: null,
      installing: null,
    });

    setServiceWorkerContainer({
      controller: createWorkerTarget((message) => {
        postMessage(message);
      }),
      register,
      getRegistration: vi.fn().mockResolvedValue({
        active: createWorkerTarget(),
        waiting: null,
        installing: null,
      }),
    });

    const { registerServiceWorkerCacheController } = await import(
      "@/core-logic/lib/serviceWorkerCache"
    );
    await expect(
      registerServiceWorkerCacheController({
        enabled: true,
        syncOnStart: false,
      }),
    ).resolves.not.toBeNull();
    expect(register).toHaveBeenCalledOnce();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("unregisters existing service workers and clears managed caches", async () => {
    const unregisterRoot = vi.fn().mockResolvedValue(true);
    const unregisterApp = vi.fn().mockResolvedValue(false);
    const deleteCache = vi.fn().mockResolvedValue(true);

    setServiceWorkerContainer({
      controller: null,
      getRegistrations: vi.fn().mockResolvedValue([
        {
          scope: "https://dev.spike.land/",
          unregister: unregisterRoot,
        },
        {
          scope: "https://dev.spike.land/app/",
          unregister: unregisterApp,
        },
      ]),
    });
    setCacheStorage({
      keys: vi
        .fn()
        .mockResolvedValue([
          "spike-cache-control-plane",
          "spike-cache-v1-pages",
          "unrelated-cache",
        ]),
      delete: deleteCache,
    } as unknown as CacheStorage);

    const { disableServiceWorkerCacheController } = await import(
      "@/core-logic/lib/serviceWorkerCache"
    );
    await expect(disableServiceWorkerCacheController()).resolves.toBe(1);

    expect(unregisterRoot).toHaveBeenCalledOnce();
    expect(unregisterApp).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenCalledWith("spike-cache-control-plane");
    expect(deleteCache).toHaveBeenCalledWith("spike-cache-v1-pages");
  });

  it("can disable a specific scope without clearing caches", async () => {
    const unregisterRoot = vi.fn().mockResolvedValue(true);
    const unregisterApp = vi.fn().mockResolvedValue(true);
    const deleteCache = vi.fn().mockResolvedValue(true);

    setServiceWorkerContainer({
      controller: null,
      getRegistrations: vi.fn().mockResolvedValue([
        {
          scope: "https://dev.spike.land/",
          unregister: unregisterRoot,
        },
        {
          scope: "https://dev.spike.land/app/",
          unregister: unregisterApp,
        },
      ]),
    });
    setCacheStorage({
      keys: vi.fn().mockResolvedValue(["spike-cache-v1-pages"]),
      delete: deleteCache,
    } as unknown as CacheStorage);

    const { disableServiceWorkerCacheController } = await import(
      "@/core-logic/lib/serviceWorkerCache"
    );
    await expect(
      disableServiceWorkerCacheController({
        clearManagedCaches: false,
        scope: "/app/",
      }),
    ).resolves.toBe(1);

    expect(unregisterRoot).not.toHaveBeenCalled();
    expect(unregisterApp).toHaveBeenCalledOnce();
    expect(deleteCache).not.toHaveBeenCalled();
  });

  it("returns false when commands cannot be delivered", async () => {
    const { sendServiceWorkerCacheCommand } = await import("@/core-logic/lib/serviceWorkerCache");

    expect(await sendServiceWorkerCacheCommand({ type: "sync-manifest" })).toBe(false);

    setServiceWorkerContainer({
      controller: null,
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: null,
        waiting: null,
        installing: null,
      }),
    });

    expect(await sendServiceWorkerCacheCommand({ type: "sync-manifest" })).toBe(false);
  });

  it("returns false when the worker throws during command delivery", async () => {
    const throwingTarget = createWorkerTarget(() => {
      throw new Error("postMessage failed");
    });

    setServiceWorkerContainer({
      controller: throwingTarget,
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: throwingTarget,
        waiting: null,
        installing: null,
      }),
    });

    const { sendServiceWorkerCacheCommand } = await import("@/core-logic/lib/serviceWorkerCache");
    await expect(sendServiceWorkerCacheCommand({ type: "sync-manifest" })).resolves.toBe(false);
  });

  it("purges caches through the active worker", async () => {
    const postMessage = vi.fn();
    setServiceWorkerContainer({
      controller: createWorkerTarget((message) => {
        postMessage(message);
      }),
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: createWorkerTarget(),
        waiting: null,
        installing: null,
      }),
    });

    const { purgeServiceWorkerCaches } = await import("@/core-logic/lib/serviceWorkerCache");
    const sent = await purgeServiceWorkerCaches();

    expect(sent).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: "purge-cache" });
  });

  it("reads status replies from the worker", async () => {
    const statusPayload = {
      manifestUrl: "https://dev.spike.land/service-worker/cache-policy.json",
      version: "2026-03-10-cache-v2",
      cacheNamespace: "spike-app",
      lastUpdatedAt: Date.now(),
      cacheNames: ["spike-app-2026-03-10-cache-v2-pages"],
    };
    const target = createWorkerTarget((message, transfer) => {
      expect(message).toEqual({ type: "get-status" });
      const responsePort = transfer?.[0] as MessagePort | undefined;
      responsePort?.postMessage({
        type: "sw-cache-status",
        payload: statusPayload,
      });
    });

    setServiceWorkerContainer({
      controller: target,
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: target,
        waiting: null,
        installing: null,
      }),
    });

    const { getServiceWorkerCacheStatus } = await import("@/core-logic/lib/serviceWorkerCache");
    await expect(getServiceWorkerCacheStatus()).resolves.toEqual(statusPayload);
  });

  it("returns null for invalid status replies", async () => {
    const target = createWorkerTarget((_, transfer) => {
      const responsePort = transfer?.[0] as MessagePort | undefined;
      responsePort?.postMessage({
        type: "sw-cache-status",
      });
    });

    setServiceWorkerContainer({
      controller: target,
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: target,
        waiting: null,
        installing: null,
      }),
    });

    const { getServiceWorkerCacheStatus } = await import("@/core-logic/lib/serviceWorkerCache");
    await expect(getServiceWorkerCacheStatus()).resolves.toBeNull();
  });

  it("returns null when the worker answers with the wrong message type", async () => {
    const target = createWorkerTarget((_, transfer) => {
      const responsePort = transfer?.[0] as MessagePort | undefined;
      responsePort?.postMessage({
        type: "not-a-status",
        payload: { ok: true },
      });
    });

    setServiceWorkerContainer({
      controller: target,
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: target,
        waiting: null,
        installing: null,
      }),
    });

    const { getServiceWorkerCacheStatus } = await import("@/core-logic/lib/serviceWorkerCache");
    await expect(getServiceWorkerCacheStatus()).resolves.toBeNull();
  });

  it("returns null when status support is unavailable, missing, or times out", async () => {
    const { getServiceWorkerCacheStatus } = await import("@/core-logic/lib/serviceWorkerCache");

    expect(await getServiceWorkerCacheStatus()).toBeNull();

    setServiceWorkerContainer({
      controller: createWorkerTarget(),
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: createWorkerTarget(),
        waiting: null,
        installing: null,
      }),
    });
    vi.stubGlobal("MessageChannel", undefined);
    expect(await getServiceWorkerCacheStatus()).toBeNull();

    vi.unstubAllGlobals();
    setServiceWorkerContainer({
      controller: null,
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: null,
        waiting: null,
        installing: null,
      }),
    });
    expect(await getServiceWorkerCacheStatus()).toBeNull();

    vi.useFakeTimers();

    const timeoutTarget = createWorkerTarget();
    setServiceWorkerContainer({
      controller: timeoutTarget,
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: timeoutTarget,
        waiting: null,
        installing: null,
      }),
    });

    const pendingStatus = getServiceWorkerCacheStatus("/", 10);
    await vi.advanceTimersByTimeAsync(10);
    await expect(pendingStatus).resolves.toBeNull();
  });

  it("returns null when the worker throws while requesting status", async () => {
    const throwingTarget = createWorkerTarget(() => {
      throw new Error("status postMessage failed");
    });

    setServiceWorkerContainer({
      controller: throwingTarget,
      register: vi.fn(),
      getRegistration: vi.fn().mockResolvedValue({
        active: throwingTarget,
        waiting: null,
        installing: null,
      }),
    });

    const { getServiceWorkerCacheStatus } = await import("@/core-logic/lib/serviceWorkerCache");
    await expect(getServiceWorkerCacheStatus()).resolves.toBeNull();
  });
});
