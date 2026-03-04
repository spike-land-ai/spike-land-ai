/**
 * WhatsApp Cloud API client.
 */

import type {
  WhatsAppConfig,
  SendMessageResult,
  TemplateListResult,
  TemplateComponent,
} from "../types.js";
import { META_GRAPH_BASE } from "../types.js";

export class WhatsAppClient {
  private readonly config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  private get messagesUrl(): string {
    return `${META_GRAPH_BASE}/${this.config.phoneNumberId}/messages`;
  }

  async sendMessage(to: string, body: string): Promise<SendMessageResult> {
    const resp = await fetch(this.messagesUrl, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`WhatsApp API error (${resp.status}): ${err}`);
    }

    return resp.json() as Promise<SendMessageResult>;
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components?: TemplateComponent[],
  ): Promise<SendMessageResult> {
    const template: Record<string, unknown> = {
      name: templateName,
      language: { code: languageCode },
    };
    if (components) {
      template.components = components;
    }

    const resp = await fetch(this.messagesUrl, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`WhatsApp API error (${resp.status}): ${err}`);
    }

    return resp.json() as Promise<SendMessageResult>;
  }

  async getTemplates(businessId: string): Promise<TemplateListResult> {
    const url = `${META_GRAPH_BASE}/${businessId}/message_templates`;
    const resp = await fetch(url, {
      method: "GET",
      headers: this.headers,
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`WhatsApp API error (${resp.status}): ${err}`);
    }

    return resp.json() as Promise<TemplateListResult>;
  }

  async markAsRead(messageId: string): Promise<void> {
    const resp = await fetch(this.messagesUrl, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`WhatsApp API error (${resp.status}): ${err}`);
    }
  }
}
