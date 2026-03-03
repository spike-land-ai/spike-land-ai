import { useEffect, useCallback } from "react";
import { eventBus, type EventMap } from "../services/event-bus";

export function useEventBus<K extends keyof EventMap>(
  event: K,
  handler: (data: EventMap[K]) => void,
): void {
  useEffect(() => {
    return eventBus.on(event, handler);
  }, [event, handler]);
}

export function useEmitEvent() {
  return useCallback(<K extends keyof EventMap>(event: K, data: EventMap[K]) => {
    eventBus.emit(event, data);
  }, []);
}
