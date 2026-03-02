import { useSyncExternalStore } from "react";
import { stdbClient } from "@/lib/stdb";

export function useStdb() {
  const connectionState = useSyncExternalStore(stdbClient.subscribe, stdbClient.getSnapshot);

  return {
    connected: connectionState === "connected",
    connecting: connectionState === "connecting",
    error: stdbClient.error,
    client: stdbClient,
  };
}
