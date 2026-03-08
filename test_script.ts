import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

async function run() {
  const mcpServer = new Server({ name: "test", version: "1" }, { capabilities: {} });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => "session-123"
  });

  await mcpServer.connect(transport);

  // Send an initialization POST request to set `_initialized = true`
  const initReq = new Request("http://localhost/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } }
    })
  });
  const initRes = await transport.handleRequest(initReq);
  console.log("Init Status:", initRes.status);
<<<<<<< HEAD

  // Now try GET for SSE
  const req = new Request("http://localhost/mcp", {
    method: "GET",
    headers: {
=======
  
  // Now try GET for SSE
  const req = new Request("http://localhost/mcp", {
    method: "GET",
    headers: { 
>>>>>>> auto-pr-1772961809
      "Accept": "text/event-stream",
      "Mcp-Session-Id": "session-123",
      "Mcp-Protocol-Version": "2024-11-05"
    }
  });

  const res = await transport.handleRequest(req);
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
<<<<<<< HEAD

=======
  
>>>>>>> auto-pr-1772961809
  await mcpServer.close();
}
run().catch(console.error);
