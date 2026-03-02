import dotenv from "dotenv";

dotenv.config({ path: "../../.env.local" });

const API_KEY = "test_token_123";

const url = "https://image-studio-mcp.spike.land/api/mcp";

async function makeRequest(id: number) {
  console.log(`[Agent ${id}] Starting request...`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "X-User-Id": "agent-test-user-id",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: id,
        method: "tools/list",
      }),
    });

    if (!res.ok) {
      console.error(`[Agent ${id}] Failed with status ${res.status} ${res.statusText}`);
      const txt = await res.text();
      console.error(`[Agent ${id}] Body: ${txt}`);
      return false;
    }

    const data = await res.json();
    console.log(
      `[Agent ${id}] Success! Proxied tool list length: ${data.result?.tools?.length || 0}`,
    );
    return true;
  } catch (error) {
    console.error(
      `[Agent ${id}] Request error:`,
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

async function run() {
  console.log("Testing local connection to: " + url);
  console.log("Starting 8 parallel agent requests...");
  const promises = [];
  for (let i = 1; i <= 8; i++) {
    promises.push(makeRequest(i));
  }

  const results = await Promise.all(promises);
  const successCount = results.filter((r) => r).length;
  console.log(`\nFinal Result: ${successCount}/8 requests completed successfully.`);

  if (successCount < 8) {
    process.exit(1);
  }
}

run().catch(console.error);
