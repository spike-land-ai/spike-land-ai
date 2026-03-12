import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ContentBlock, Message } from "../../ai/client";
import { ChatClient } from "../../ai/client";
import { saveConversation } from "../../node-sys/conversation-store";
import { discoverConfig } from "../../node-sys/discovery";
import { AssertionRuntime } from "../chat/assertion-runtime";
import { continueAgentLoop, runAgentLoop } from "../chat/loop";
import { SessionState } from "../chat/session-state";
import { handleSlashCommand, trackToolCallForSession } from "../chat/slash-commands";
import { DynamicToolRegistry } from "../chat/tool-registry";
import { ServerManager } from "../multiplexer/server-manager";
import { resolveTerminalChatClientOptions } from "./auth";
import type {
  PendingToolCallSnapshot,
  PendingTurnSnapshot,
  RepoMetadata,
  SupervisorToWorkerMessage,
  TerminalSessionSnapshot,
  WorkerInputReadyMessage,
  WorkerLaunchOptions,
  WorkerToSupervisorMessage,
} from "./types";

class TerminalWorkerRuntime {
  private readonly sessionState = new SessionState();
  private readonly assertionRuntime = new AssertionRuntime();
  private messages: Message[] = [];
  private registry = new DynamicToolRegistry();
  private manager: ServerManager | null = null;
  private client: ChatClient | null = null;
  private currentTurn: PendingTurnSnapshot | null = null;
  private launchOptions: WorkerLaunchOptions | null = null;
  private conversationId = "";
  private createdAt = new Date().toISOString();
  private busy = false;

  async handle(message: SupervisorToWorkerMessage): Promise<void> {
    switch (message.type) {
      case "init":
        await this.initialize(message.options, message.snapshot ?? null);
        return;
      case "user_input":
        await this.handleUserInput(message.input);
        return;
      case "shutdown":
        await this.shutdown();
        return;
    }
  }

  private async initialize(
    options: WorkerLaunchOptions,
    snapshot: TerminalSessionSnapshot | null,
  ): Promise<void> {
    this.launchOptions = options;
    process.chdir(options.cwd);

    const config = await discoverConfig({
      ...(options.configPath ? { configPath: options.configPath } : {}),
      ...(options.inlineServers ? { inlineServers: options.inlineServers } : {}),
      ...(options.inlineUrls ? { inlineUrls: options.inlineUrls } : {}),
    });

    const manager = new ServerManager();
    await manager.connectAll(config);
    this.manager = manager;

    const client = new ChatClient(
      resolveTerminalChatClientOptions(options.model ? { model: options.model } : {}),
    );
    this.client = client;

    this.registry.refresh(manager.getAllTools());
    this.conversationId = snapshot?.conversationId ?? options.sessionId;
    this.createdAt = snapshot?.createdAt ?? new Date().toISOString();
    this.messages = snapshot?.messages ? [...snapshot.messages] : [];
    this.sessionState.loadSnapshot(snapshot?.sessionState);
    this.assertionRuntime.loadSnapshot(snapshot?.runtime);
    this.registry.loadSnapshot(snapshot?.registry);
    this.currentTurn = isResumablePendingTurn(snapshot?.pendingTurn) ? snapshot.pendingTurn : null;

    this.send({
      type: "child_ready",
      sessionId: options.sessionId,
      conversationId: this.conversationId,
      resumed: !!snapshot,
    });

    if (this.currentTurn) {
      this.send({
        type: "child_restored",
        sessionId: options.sessionId,
        pendingTurn: this.currentTurn,
      });
      await this.resumePendingTurn(this.currentTurn);
      return;
    }

    this.sendInputReady(false);
  }

  private async handleUserInput(input: string): Promise<void> {
    if (!this.manager || !this.client || !this.launchOptions) {
      throw new Error("Worker not initialized");
    }
    if (this.busy) {
      this.send({
        type: "status",
        level: "error",
        message: "Session is busy. Wait for the current turn to finish.",
      });
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      this.sendInputReady(false);
      return;
    }

    if (trimmed.startsWith("/")) {
      this.busy = true;
      try {
        const result = await handleSlashCommand(trimmed, {
          manager: this.manager,
          client: this.client,
          messages: this.messages,
          sessionState: this.sessionState,
          registry: this.registry,
          assertionRuntime: this.assertionRuntime,
        });

        await this.persistSnapshot();
        this.send({
          type: "slash_output",
          text: result.output,
          ...(result.exit ? { exit: true } : {}),
        });
      } finally {
        this.busy = false;
        this.sendInputReady(false);
      }
      return;
    }

    await this.runUserTurn(trimmed);
  }

  private async resumePendingTurn(pendingTurn: PendingTurnSnapshot): Promise<void> {
    this.busy = true;
    this.currentTurn = pendingTurn;
    this.send({
      type: "status",
      level: "info",
      message: `Restoring in-flight turn ${pendingTurn.id} from journal`,
    });

    try {
      await continueAgentLoop(this.buildAgentLoopContext());
      await this.completeTurn();
    } catch (error) {
      await this.failTurn(error);
    }
  }

  private async runUserTurn(input: string): Promise<void> {
    this.busy = true;
    this.currentTurn = {
      id: randomUUID(),
      userInput: input,
      status: "requesting-model",
      assistantText: "",
      toolCalls: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };

    await this.persistSnapshot();

    try {
      await runAgentLoop(input, this.buildAgentLoopContext());
      await this.completeTurn();
    } catch (error) {
      await this.failTurn(error);
    }
  }

  private buildAgentLoopContext() {
    if (!this.manager || !this.client || !this.launchOptions) {
      throw new Error("Worker not initialized");
    }

    return {
      client: this.client,
      manager: this.manager,
      messages: this.messages,
      maxTurns: this.launchOptions.maxTurns ?? 20,
      registry: this.registry,
      assertionRuntime: this.assertionRuntime,
      onModelRequestStart: async () => {
        this.updateCurrentTurn({ status: "requesting-model" });
        await this.persistSnapshot();
      },
      onTextDelta: (text: string) => {
        if (!this.currentTurn || !this.launchOptions) return;
        this.currentTurn.assistantText += text;
        this.currentTurn.status = "streaming";
        this.currentTurn.lastUpdatedAt = new Date().toISOString();
        this.send({
          type: "streamed_delta",
          sessionId: this.launchOptions.sessionId,
          turnId: this.currentTurn.id,
          text,
        });
      },
      onAssistantMessage: async (content: ContentBlock[]) => {
        this.updateCurrentTurn({
          assistantText: extractAssistantText(content),
          status: "awaiting-next-turn",
        });
        await this.persistSnapshot();
      },
      onToolCallStart: async (
        id: string,
        name: string,
        serverName: string,
        input: Record<string, unknown>,
      ) => {
        const toolCall: PendingToolCallSnapshot = {
          id,
          name,
          serverName,
          input,
          status: "running",
        };
        if (this.currentTurn) {
          this.currentTurn.toolCalls.push(toolCall);
          this.currentTurn.lastUpdatedAt = new Date().toISOString();
        }
        if (this.launchOptions && this.currentTurn) {
          this.send({
            type: "tool_start",
            sessionId: this.launchOptions.sessionId,
            turnId: this.currentTurn.id,
            toolCall,
          });
        }
        await this.persistSnapshot();
      },
      onToolCallEnd: async (id: string, result: string, isError: boolean) => {
        if (!this.currentTurn || !this.manager || !this.launchOptions) return;

        const toolCall = this.currentTurn.toolCalls.find((entry) => entry.id === id);
        if (toolCall) {
          toolCall.status = "completed";
          toolCall.result = result;
          toolCall.isError = isError;
        }
        this.currentTurn.lastUpdatedAt = new Date().toISOString();
        this.currentTurn.status = "awaiting-next-turn";

        trackToolCallForSession(
          toolCall?.name ?? "",
          result,
          isError,
          this.manager.getAllTools(),
          this.sessionState,
        );

        if (toolCall) {
          this.send({
            type: "tool_end",
            sessionId: this.launchOptions.sessionId,
            turnId: this.currentTurn.id,
            toolCall,
          });
        }

        await this.persistSnapshot();
      },
      onToolResultsAppended: async () => {
        this.updateCurrentTurn({ status: "requesting-model" });
        await this.persistSnapshot();
      },
    };
  }

  private updateCurrentTurn(update: Partial<PendingTurnSnapshot>): void {
    if (!this.currentTurn) return;
    this.currentTurn = {
      ...this.currentTurn,
      ...update,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  private async persistSnapshot(): Promise<void> {
    if (!this.launchOptions) return;

    saveConversation(this.messages, this.conversationId, this.assertionRuntime.getSnapshot());
    this.send({
      type: "checkpoint",
      snapshot: this.buildSnapshot(),
    });
  }

  private buildSnapshot(): TerminalSessionSnapshot {
    if (!this.launchOptions) {
      throw new Error("Launch options missing");
    }

    return {
      sessionId: this.launchOptions.sessionId,
      conversationId: this.conversationId,
      cwd: this.launchOptions.cwd,
      repo: detectRepoMetadata(this.launchOptions.cwd),
      model: this.client?.model ?? this.launchOptions.model ?? "claude-sonnet-4-6",
      baseUrl: this.launchOptions.baseUrl,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
      messages: this.messages,
      sessionState: this.sessionState.getSnapshot(),
      registry: this.registry.getSnapshot(),
      runtime: this.assertionRuntime.getSnapshot(),
      pendingTurn: this.currentTurn,
    };
  }

  private async completeTurn(): Promise<void> {
    this.currentTurn = null;
    await this.persistSnapshot();
    this.busy = false;
    this.sendInputReady(false);
  }

  private async failTurn(error: unknown): Promise<void> {
    this.currentTurn = null;
    await this.persistSnapshot();
    this.send({
      type: "fatal_error",
      message: error instanceof Error ? error.message : String(error),
    });
    this.busy = false;
    this.sendInputReady(false);
  }

  private async shutdown(): Promise<void> {
    await this.manager?.closeAll();
    process.exit(0);
  }

  private send(message: WorkerToSupervisorMessage): void {
    if (typeof process.send === "function") {
      process.send(message);
    }
  }

  private sendInputReady(busy: boolean): void {
    const message: WorkerInputReadyMessage = { type: "input_ready", busy };
    this.send(message);
  }
}

export function isResumablePendingTurn(
  pendingTurn: PendingTurnSnapshot | null | undefined,
): pendingTurn is PendingTurnSnapshot {
  if (!pendingTurn) return false;
  return pendingTurn.status !== "completed" && pendingTurn.status !== "failed";
}

function extractAssistantText(content: ContentBlock[]): string {
  return content
    .flatMap((block) => {
      if (block.type === "text") {
        return [block.text];
      }
      return [];
    })
    .join("");
}

function detectRepoMetadata(cwd: string): RepoMetadata | null {
  let current = cwd;
  while (true) {
    if (existsSync(join(current, ".git"))) {
      return {
        root: current,
        name: basename(current),
      };
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export async function runTerminalWorkerProcess(): Promise<void> {
  const runtime = new TerminalWorkerRuntime();

  process.on("message", (message: unknown) => {
    void runtime.handle(message as SupervisorToWorkerMessage);
  });

  process.on("disconnect", () => {
    process.exit(0);
  });
}
