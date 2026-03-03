import { applySessionDelta, computeSessionHash, tryCatch } from "@spike-land-ai/code";
import type { SessionDelta } from "@spike-land-ai/code";
import type { Code } from "./chatRoom";

/**
 * Metadata for a registered swarm agent connected via WebSocket.
 */
export interface SwarmAgentInfo {
  agentId: string;
  displayName: string;
  capabilities: string[];
  registeredAt: number;
}

/**
 * Attachment stored on each WebSocket via the Hibernation API.
 * Replaces the old in-memory WebsocketSession interface.
 */
export interface WsAttachment {
  name: string | null;
  subscribedTopics: string[];
  blockedMessages: (string | object)[];
  swarmAgent: SwarmAgentInfo | null;
}

/**
 * Legacy export kept for type compatibility in updateAndBroadcastSession signature.
 * With Hibernation API, we pass the raw WebSocket instead.
 */
export type WebsocketSession = WebSocket;

export class WebSocketHandler {
  private topics = new Map<string, Set<WebSocket>>();
  private code: Code;
  private state: DurableObjectState;

  constructor(code: Code, state: DurableObjectState) {
    this.code = code;
    this.state = state;
  }

  /**
   * Utility to safely send a message over a WebSocket.
   */
  private safeSend(ws: WebSocket, message: string | object) {
    try {
      ws.send(typeof message === "string" ? message : JSON.stringify(message));
    } catch (err) {
      console.error("WebSocket send error:", err);
    }
  }

  /**
   * Get the attachment for a WebSocket, with a safe fallback.
   */
  private getAttachment(ws: WebSocket): WsAttachment {
    try {
      const attachment = ws.deserializeAttachment() as WsAttachment | null;
      if (attachment) return attachment;
    } catch {
      // Attachment may not exist yet
    }
    return { name: null, subscribedTopics: [], blockedMessages: [], swarmAgent: null };
  }

  /**
   * Rebuild the topics map from all connected WebSockets' attachments.
   * Called on wake from hibernation or when needed.
   */
  private rebuildTopics(): void {
    this.topics.clear();
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      const attachment = this.getAttachment(ws);
      for (const topic of attachment.subscribedTopics) {
        if (!this.topics.has(topic)) {
          this.topics.set(topic, new Set());
        }
        this.topics.get(topic)!.add(ws);
      }
    }
  }

  /**
   * Called from Code.webSocketMessage() when a message arrives.
   */
  handleMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return; // ignore binary messages

    type WsMessage = Record<string, unknown>;
    let data: WsMessage;
    try {
      const parsed: unknown = JSON.parse(message);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return;
      }
      data = parsed as WsMessage;
    } catch {
      return;
    }

    const attachment = this.getAttachment(ws);

    if (data.type === "ping") {
      this.safeSend(ws, { type: "pong" });
      return;
    }

    if (data.type === "pong") {
      // No-op: Hibernation API handles keepalive
      return;
    }

    if (data.type === "subscribe") {
      const subscribeTopics = Array.isArray(data.topics) ? (data.topics as string[]) : [];
      for (const topic of subscribeTopics) {
        if (!attachment.subscribedTopics.includes(topic)) {
          attachment.subscribedTopics.push(topic);
        }
        if (!this.topics.has(topic)) {
          this.topics.set(topic, new Set());
        }
        this.topics.get(topic)!.add(ws);
      }
      ws.serializeAttachment(attachment);
      this.safeSend(ws, {
        type: "ack",
        action: "subscribe",
        topics: subscribeTopics,
      });
      return;
    }

    if (data.type === "unsubscribe") {
      const unsubscribeTopics = Array.isArray(data.topics) ? (data.topics as string[]) : [];
      for (const topic of unsubscribeTopics) {
        const idx = attachment.subscribedTopics.indexOf(topic);
        if (idx !== -1) {
          attachment.subscribedTopics.splice(idx, 1);
        }
        this.topics.get(topic)?.delete(ws);
      }
      ws.serializeAttachment(attachment);
      this.safeSend(ws, {
        type: "ack",
        action: "unsubscribe",
        topics: unsubscribeTopics,
      });
      return;
    }

    if (data.type === "publish") {
      const subscribers = this.topics.get(data.topic as string);
      if (subscribers) {
        const msg = JSON.stringify({
          type: "message",
          topic: data.topic,
          data: data.data,
        });
        for (const subscriber of subscribers) {
          this.safeSend(subscriber, msg);
        }
      }
      this.safeSend(ws, {
        type: "ack",
        action: "publish",
        topic: data.topic,
      });
      return;
    }

    // --- Swarm protocol messages ---

    if (data.type === "swarm_register") {
      attachment.swarmAgent = {
        agentId:
          (typeof data.agent_id === "string" ? data.agent_id : "") ||
          attachment.name ||
          `agent-${Date.now()}`,
        displayName:
          (typeof data.display_name === "string" ? data.display_name : "") ||
          attachment.name ||
          "anonymous",
        capabilities: Array.isArray(data.capabilities) ? (data.capabilities as string[]) : [],
        registeredAt: Date.now(),
      };
      attachment.name = attachment.swarmAgent.agentId;
      ws.serializeAttachment(attachment);
      this.safeSend(ws, {
        type: "swarm_registered",
        agent_id: attachment.swarmAgent.agentId,
        display_name: attachment.swarmAgent.displayName,
      });
      return;
    }

    if (data.type === "swarm_message") {
      const sockets = this.state.getWebSockets();
      let targetWs: WebSocket | null = null;
      let targetAttachment: WsAttachment | null = null;
      for (const s of sockets) {
        const a = this.getAttachment(s);
        if (a.swarmAgent?.agentId === data.target_agent_id || a.name === data.target_agent_id) {
          targetWs = s;
          targetAttachment = a;
          break;
        }
      }
      const payload = {
        type: "swarm_message",
        from_agent_id: attachment.swarmAgent?.agentId || attachment.name || "unknown",
        content: data.content,
        metadata: data.metadata,
        timestamp: Date.now(),
      };
      if (targetWs) {
        try {
          this.safeSend(targetWs, payload);
          this.safeSend(ws, {
            type: "ack",
            action: "swarm_message",
            target: data.target_agent_id,
          });
        } catch {
          // Socket may have closed, queue the message
          if (targetAttachment) {
            targetAttachment.blockedMessages.push(payload);
            targetWs.serializeAttachment(targetAttachment);
          }
          this.safeSend(ws, {
            type: "swarm_message_queued",
            target_agent_id: data.target_agent_id,
            message: "Target agent offline, message queued.",
          });
        }
      } else {
        // Try to find any socket with this name for offline queuing
        for (const s of sockets) {
          if (s === ws) continue;
          const a = this.getAttachment(s);
          if (a.name === data.target_agent_id) {
            a.blockedMessages.push(payload);
            s.serializeAttachment(a);
            break;
          }
        }
        this.safeSend(ws, {
          type: "swarm_message_queued",
          target_agent_id: data.target_agent_id,
          message: "Target agent offline, message queued.",
        });
      }
      return;
    }

    if (data.type === "swarm_delegate") {
      const sockets = this.state.getWebSockets();
      let targetWs: WebSocket | null = null;
      let targetAttachment: WsAttachment | null = null;
      for (const s of sockets) {
        const a = this.getAttachment(s);
        if (a.swarmAgent?.agentId === data.target_agent_id || a.name === data.target_agent_id) {
          targetWs = s;
          targetAttachment = a;
          break;
        }
      }
      const payload = {
        type: "swarm_task",
        from_agent_id: attachment.swarmAgent?.agentId || attachment.name || "unknown",
        task_description: data.task_description,
        priority: data.priority || "medium",
        context: data.context,
        timestamp: Date.now(),
      };
      if (targetWs) {
        try {
          this.safeSend(targetWs, payload);
          this.safeSend(ws, {
            type: "ack",
            action: "swarm_delegate",
            target: data.target_agent_id,
          });
        } catch {
          if (targetAttachment) {
            targetAttachment.blockedMessages.push(payload);
            targetWs.serializeAttachment(targetAttachment);
          }
          this.safeSend(ws, {
            type: "swarm_delegate_queued",
            target_agent_id: data.target_agent_id,
            message: "Target agent offline, task queued.",
          });
        }
      } else {
        for (const s of sockets) {
          if (s === ws) continue;
          const a = this.getAttachment(s);
          if (a.name === data.target_agent_id) {
            a.blockedMessages.push(payload);
            s.serializeAttachment(a);
            break;
          }
        }
        this.safeSend(ws, {
          type: "swarm_delegate_queued",
          target_agent_id: data.target_agent_id,
          message: "Target agent offline, task queued.",
        });
      }
      return;
    }

    if (data.type === "swarm_list_agents") {
      const agents = this.getSwarmAgents();
      this.safeSend(ws, {
        type: "swarm_agents_list",
        agents,
      });
      return;
    }

    if (data.oldHash) {
      const currentSession = this.code.getSession();
      const currentHash = computeSessionHash(currentSession);

      if (currentHash !== data.oldHash) {
        console.error("Hash mismatch");
        this.safeSend(ws, {
          type: "error",
          message: "Session hash mismatch",
        });
        return;
      }

      const patchedSession = applySessionDelta(currentSession, data as unknown as SessionDelta);
      tryCatch(this.code.updateAndBroadcastSession(patchedSession, ws)).then(({ error }) => {
        if (error) {
          this.safeSend(ws, {
            type: "error",
            message: "Failed to apply patch " + error.message,
          });
          return;
        }
        this.safeSend(ws, {
          type: "ack",
          hashCode: computeSessionHash(patchedSession),
        });
      });
      return;
    }

    if (data.target) {
      const sockets = this.state.getWebSockets();
      for (const s of sockets) {
        const a = this.getAttachment(s);
        if (a.name === data.target) {
          this.safeSend(s, message);
          break;
        }
      }
      return;
    }

    if (data.name && attachment.name !== data.name) {
      attachment.name = typeof data.name === "string" ? data.name : String(data.name);
      ws.serializeAttachment(attachment);

      // Deliver blocked messages from other sockets with matching name
      const sockets = this.state.getWebSockets();
      for (const s of sockets) {
        if (s === ws) continue;
        const a = this.getAttachment(s);
        if (a.name === data.name && a.blockedMessages.length > 0) {
          for (const blockedMsg of a.blockedMessages) {
            try {
              this.safeSend(ws, blockedMsg);
            } catch {
              attachment.blockedMessages.push(blockedMsg);
            }
          }
          a.blockedMessages = [];
          s.serializeAttachment(a);
        }
      }
      ws.serializeAttachment(attachment);

      this.safeSend(ws, {
        type: "ack",
        action: "nameUpdate",
        name: data.name,
      });
    }

    // Catch-all acknowledgment for unhandled message types
    this.safeSend(ws, {
      type: "ack",
      message: "Message received",
      receivedType: data.type || "unknown",
    });
  }

  /**
   * Called from Code.webSocketClose() when a connection closes.
   */
  handleClose(ws: WebSocket): void {
    const attachment = this.getAttachment(ws);
    // Remove from topics
    for (const topic of attachment.subscribedTopics) {
      this.topics.get(topic)?.delete(ws);
    }
  }

  /**
   * Called from Code.webSocketError() when an error occurs.
   */
  handleError(ws: WebSocket, error: unknown): void {
    console.error("WebSocket error:", error);
    this.handleClose(ws);
  }

  getSwarmAgents(): Array<{
    agentId: string;
    displayName: string;
    capabilities: string[];
    online: boolean;
  }> {
    const sockets = this.state.getWebSockets();
    const agents: Array<{
      agentId: string;
      displayName: string;
      capabilities: string[];
      online: boolean;
    }> = [];
    for (const ws of sockets) {
      const attachment = this.getAttachment(ws);
      if (attachment.swarmAgent) {
        agents.push({
          agentId: attachment.swarmAgent.agentId,
          displayName: attachment.swarmAgent.displayName,
          capabilities: attachment.swarmAgent.capabilities,
          online: true, // If getWebSockets() returns it, it's connected
        });
      }
    }
    return agents;
  }

  getActiveUsers(codeSpace: string): string[] {
    const sockets = this.state.getWebSockets();
    const users: string[] = [];
    for (const ws of sockets) {
      const attachment = this.getAttachment(ws);
      if (attachment.subscribedTopics.includes(codeSpace)) {
        users.push(attachment.name || "anonymous");
      }
    }
    return users.filter(Boolean);
  }

  broadcast(message: object | string, excludeWs?: WebSocket) {
    // Rebuild topics on first broadcast after wake (lazy rebuild)
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      if (excludeWs && ws === excludeWs) {
        continue;
      }
      this.safeSend(ws, message);
    }
  }
}
