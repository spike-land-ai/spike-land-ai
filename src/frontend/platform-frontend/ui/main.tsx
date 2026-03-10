import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { ToastProvider } from "./components/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { reportError } from "../core-logic/reportError";
import { beginBootstrapPageLoad } from "../core-logic/lib/pageLoadCounter";
import { disableServiceWorkerCacheController } from "../core-logic/lib/serviceWorkerCache";
import "./i18n";
import "./app.css";

// Report unhandled promise rejections to backend
window.addEventListener("unhandledrejection", (event) => {
  const error =
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason ?? "Unhandled rejection"));
  reportError(error, { code: "UNHANDLED_REJECTION" });
});

const queryClient = new QueryClient();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

beginBootstrapPageLoad(window.location.href);

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

void disableServiceWorkerCacheController().catch((error) => {
  const serviceWorkerError =
    error instanceof Error ? error : new Error(String(error ?? "Service worker disable failed"));
  reportError(serviceWorkerError, {
    code: "SERVICE_WORKER_CACHE_DISABLE_FAILED",
  });
});
