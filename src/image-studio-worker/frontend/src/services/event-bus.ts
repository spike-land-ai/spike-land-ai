type EventMap = {
  "gallery:updated": { reason: "upload" | "generate" | "enhance" | "delete" | "refresh" };
  "image:uploaded": { imageId: string; url: string; name: string };
  "image:generated": { imageId: string; url: string; prompt: string };
  "image:enhanced": { imageId: string; url: string; originalId: string };
  "image:deleted": { imageId: string };
  "album:created": { albumId: string; name: string };
  "album:updated": { albumId: string };
  "chat:image-attached": { file: File };
  "chat:gallery-link": { imageId: string; url: string };
};

type EventHandler<K extends keyof EventMap> = (data: EventMap[K]) => void;

class EventBus {
  private handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<K>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as EventHandler<K>)(data);
        } catch (err) {
          console.error(`[EventBus] Error in handler for ${event}:`, err);
        }
      }
    }
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    this.handlers.get(event)?.delete(handler);
  }

  clear(): void {
    this.handlers.clear();
  }
}

// Singleton instance
export const eventBus = new EventBus();
export type { EventMap, EventHandler };
