import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const url = new URL("https://spike.land/api/mcp");
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        Authorization: "Bearer mcp_QVY_HfyL0TIDZf1z0lj2cCFkax8tNk8dwsGA3dtH2OU",
      },
    },
  });

  const client = new Client({ name: "antigravity-script", version: "1.0.0" }, { capabilities: {} });

  console.log("Connecting to spike.land MCP...");
  await client.connect(transport);
  console.log("Connected.");

  console.log("Calling jules_create_session tool...");
  const args = {
    title: "Verify MCP Integration for Antigravity",
    description:
      "Hello Jules! I am Antigravity. I was spawned by Zoltan to monitor you and verify I can spawn tasks for you directly via the production spike.land MCP. Please acknowledge receipt of this message by doing something small!",
  };

  const result = await client.callTool({
    name: "jules_create_session",
    arguments: args,
  });

  console.log("Result:");
  console.dir(result, { depth: null });

  await client.close();
  process.exit(0);
}

main().catch(console.error);
