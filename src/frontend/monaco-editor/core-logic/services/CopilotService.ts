import { tryCatch } from "../../lazy-imports/try-catch";
import type { CopilotStatus, ICopilotService } from "./types";

const STORAGE_KEY = "copilot_enabled";
const COOLDOWN_MS = 30_000;

class CopilotService implements ICopilotService {
  private status: CopilotStatus;
  private listeners = new Set<(status: CopilotStatus) => void>();
  private offlineUntil = 0;

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    this.status = stored === "false" ? "disabled" : "active";
  }

  isEnabled(): boolean {
    return this.status !== "disabled";
  }

  toggle(): void {
    if (this.status === "disabled") {
      localStorage.setItem(STORAGE_KEY, "true");
      this.setStatus("active");
    } else {
      localStorage.setItem(STORAGE_KEY, "false");
      this.setStatus("disabled");
    }
  }

  getStatus(): CopilotStatus {
    return this.status;
  }

  onStatusChange(cb: (status: CopilotStatus) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  async requestCompletion(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    if (this.status === "disabled") return null;

    if (Date.now() < this.offlineUntil) return null;

    this.setStatus("loading");

    const { data: response, error } = await tryCatch(
      fetch(`${location.origin}/anthropic/v1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 256,
          system:
            "You are a code completion engine. Given the code prefix and suffix, output ONLY the code that fills the gap. No explanation, no markdown fences.",
          messages: [
            {
              role: "user",
              content: `<code_prefix>${prefix}</code_prefix>\n<code_suffix>${suffix}</code_suffix>\nFill in the code between prefix and suffix.`,
            },
          ],
        }),
      }),
    );

    if (error) {
      if (signal.aborted) {
        this.setStatus("active");
        return null;
      }
      this.goOffline();
      return null;
    }

    if (!response.ok) {
      this.goOffline();
      return null;
    }

    const { data: body, error: parseError } = await tryCatch(
      response.json() as Promise<{ content: Array<{ text: string }> }>,
    );

    if (parseError || !body?.content?.[0]?.text) {
      this.goOffline();
      return null;
    }

    this.setStatus("active");
    return body.content[0].text;
  }

  private setStatus(next: CopilotStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const cb of this.listeners) {
      cb(next);
    }
  }

  private goOffline(): void {
    this.offlineUntil = Date.now() + COOLDOWN_MS;
    this.setStatus("offline");
  }
}

export const copilotService = new CopilotService();
