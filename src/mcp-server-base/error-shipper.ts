declare const process: any;

export interface ErrorEntry {
  service_name: string;
  error_code?: string;
  message: string;
  stack_trace?: string;
  severity?: "low" | "medium" | "high" | "critical";
  metadata?: string;
}

export interface ErrorShipperOptions {
  baseUrl?: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

export interface ErrorShipper {
  shipError(entry: ErrorEntry): void;
  flush(): Promise<void>;
}

export function createErrorShipper(options: ErrorShipperOptions = {}): ErrorShipper {
  const baseUrl = options.baseUrl ?? "https://spike.land/api";
  const batchSize = options.batchSize ?? 10;
  const flushIntervalMs = options.flushIntervalMs ?? 5000;

  let buffer: ErrorEntry[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    if (buffer.length === 0) return;
    
    const entries = [...buffer];
    buffer = [];
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    try {
      await fetch(`${baseUrl}/errors/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ errors: entries }),
      });
    } catch (err) {
      console.error("[mcp-server-base] Failed to ship errors:", err);
    }
  };

  const shipError = (entry: ErrorEntry) => {
    buffer.push(entry);
    
    if (buffer.length >= batchSize) {
      flush();
    } else if (!timeoutId) {
      timeoutId = setTimeout(flush, flushIntervalMs);
    }
  };

  if (typeof process !== "undefined" && typeof process.on === "function") {
    process.on("beforeExit", () => {
      flush();
    });
  }

  return { shipError, flush };
}
