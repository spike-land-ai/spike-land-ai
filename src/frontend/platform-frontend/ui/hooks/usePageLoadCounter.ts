import { useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  connectPageLoadCounter,
  finishBootstrapPageLoad,
} from "../../core-logic/lib/pageLoadCounter";

/**
 * Connects the page-load performance counter to the TanStack Router lifecycle.
 *
 * - Calls `finishBootstrapPageLoad` once the initial route has finished loading.
 * - Registers a router subscriber via `connectPageLoadCounter` that records
 *   navigation timing for subsequent route transitions.
 *
 * Mount this hook once at the root layout level.
 */
export function usePageLoadCounter() {
  const router = useRouter();
  const isLoading = useRouterState({ select: (state) => state.isLoading });

  useEffect(() => {
    if (!isLoading) {
      finishBootstrapPageLoad();
    }
  }, [isLoading]);

  useEffect(() => {
    return connectPageLoadCounter(router);
  }, [router]);
}
