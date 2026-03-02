import http from "node:http";
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: 6379,
});
const PORT = process.env.PORT || 8079;

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const command = JSON.parse(body);
    if (!Array.isArray(command) || command.length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Expected JSON array" }));
      return;
    }

    const [cmd, ...args] = command;
    const result = await redis.call(cmd, ...args);

    // HGETALL returns a flat array [field, value, field, value, ...] from ioredis
    // The collab worker already handles this format, so pass through as-is.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ result }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => console.log(`Redis REST proxy listening on :${PORT}`));
