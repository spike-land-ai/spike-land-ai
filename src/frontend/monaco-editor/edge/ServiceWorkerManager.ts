import { swVersion } from "../core-logic/lib/sw-version";
import { tryCatch } from "../lazy-imports/try-catch";
import type { IServiceWorkerManager } from "../core-logic/services/types";
import type { Workbox } from "workbox-window";

/**
 * Type definitions for global window extensions
 */
declare global {
  interface Window {
    __WB_INSTANCE?: Workbox;
  }
}

export const setupServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  // Skip if service workers aren't supported
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  // Skip on localhost for development unless explicitly enabled
  if (location.hostname === "localhost" && !localStorage.getItem("enable_sw_dev")) {
    return null;
  }

  const setupPromise = async () => {
    const oldRegistration = await navigator.serviceWorker.getRegistration();

    if (oldRegistration) {
      const oldSwVersion = localStorage.getItem("swVersion");
      const serverVersionResult = await tryCatch(
        fetch("/swVersion.json").then((res) =>
          res.json().then((data: { swVersion: string }) => data.swVersion),
        ),
      );

      if (!serverVersionResult.error && oldSwVersion === swVersion && serverVersionResult.data === swVersion) {
        return oldRegistration;
      }
      await oldRegistration.unregister();
    }

    const { Workbox } = await import("workbox-window");
    const wb = new Workbox("/sw.js");
    configureServiceWorkerEvents(wb);

    const registrationResult = await tryCatch(wb.register());
    if (registrationResult.error) {
      return null;
    }
    localStorage.setItem("swVersion", swVersion);

    if (registrationResult.data) {
      window.__WB_INSTANCE = wb;
      return registrationResult.data;
    }
    return null;
  };

  const { data: registration, error } = await tryCatch(setupPromise());

  if (error) {
    return null;
  }
  return registration;
};

/**
 * Configures event listeners for the service worker
 */
function configureServiceWorkerEvents(wb: Workbox): void {
  // Handle installation events
  wb.addEventListener("installed", (event) => {
    if (event.isUpdate) {
      if (confirm("New version available! Reload to update?")) {
        window.location.reload();
      }
    }
  });

  // Handle messages from service worker
  wb.addEventListener("message", (event) => {
    if (event.data === "reload") {
      window.location.reload();
    }
  });
}

// Setup global service worker message listeners
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data === "reload") {
      window.location.reload();
    }

    if (event.data?.type === "OFFLINE_MODE") {
      window.dispatchEvent(new CustomEvent("sw-offline-mode"));
    }
  });
}

interface IExtendedWindow extends Window {
  __IS_IFRAME__: boolean;
}

export class ServiceWorkerManager implements IServiceWorkerManager {
  async setup(): Promise<ServiceWorker | undefined> {
    // Do not setup service worker when running in an iframe.
    // Additionally, allow tests to simulate iframe mode via window.__IS_IFRAME__
    if (
      (window as unknown as IExtendedWindow).__IS_IFRAME__ === true ||
      window.self !== window.parent
    ) {
      return undefined;
    }
    const { error } = await tryCatch(setupServiceWorker());
    if (error) {
      throw error;
    }
    return undefined;
  }
}

Object.assign(window, { setupServiceWorker });
