import { computeSessionHash } from "@spike-land-ai/code";
import type { Code } from "../chatRoom";

export class WebsocketRoutes {
  constructor(private code: Code) {}

  async handleWebsocketRoute(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Use Hibernation API: acceptWebSocket on the DO state
    this.code.getState().acceptWebSocket(server);

    // Store initial session metadata as attachment
    server.serializeAttachment({
      name: null,
      subscribedTopics: [],
      blockedMessages: [],
      swarmAgent: null,
    });

    // Send initial handshake
    server.send(JSON.stringify({
      type: "handshake",
      hash: computeSessionHash(this.code.getSession()),
    }));

    return new Response(null, {
      status: 101,
      statusText: "Switching Protocols",
      webSocket: client,
    });
  }

  async handleUsersRoute(_request: Request, url: URL): Promise<Response> {
    const codeSpace = url.searchParams.get("room");
    const activeUsers = this.code.wsHandler.getActiveUsers(codeSpace || "");

    return new Response(JSON.stringify({ users: activeUsers }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  }
}
