import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

async function run() {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => "test-session"
  });

  const headers = new Headers();
  headers.set("Accept", "text/event-stream");

  const req = new Request("http://localhost/mcp", {
    method: "GET",
    headers,
  });

  const res = await transport.handleRequest(req);
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get("content-type"));
}
run().catch(console.error);
