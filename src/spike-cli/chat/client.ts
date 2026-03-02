/**
 * Anthropic SDK wrapper for Claude API chat with OAuth Bearer auth.
 */

import Anthropic from "@anthropic-ai/sdk";
import { log } from "../util/logger";

export interface ChatClientOptions {
  apiKey?: string;
  authToken?: string;
  model?: string;
  systemPrompt?: string;
}

export type Message = Anthropic.MessageParam;
export type Tool = Anthropic.Tool;
export type ContentBlock = Anthropic.ContentBlock;

export class ChatClient {
  private client: Anthropic;
  readonly model: string;
  readonly systemPrompt?: string;

  constructor(options: ChatClientOptions) {
    if (!options.apiKey && !options.authToken) {
      throw new Error("ChatClient requires either apiKey or authToken");
    }

    this.client = new Anthropic({
      apiKey: options.apiKey,
      authToken: options.authToken,
      defaultHeaders: options.authToken
        ? {
          "anthropic-beta": "oauth-2025-04-20",
        }
        : undefined,
    });
    this.model = options.model ?? "claude-sonnet-4-6";
    this.systemPrompt = options.systemPrompt;
  }

  createStream(messages: Message[], tools?: Tool[]) {
    log(`Sending ${messages.length} messages to ${this.model}`);

    const params: Anthropic.MessageCreateParamsStreaming = {
      model: this.model,
      max_tokens: 16384,
      messages,
      stream: true,
    };

    if (this.systemPrompt) {
      params.system = this.systemPrompt;
    }

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    return this.client.messages.stream(params);
  }
}
