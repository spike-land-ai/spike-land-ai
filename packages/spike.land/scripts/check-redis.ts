import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function main() {
  console.log("Checking Redis config...");
  if (!url || !token) {
    console.warn("Redis env vars missing");
    return;
  }
  console.log("URL:", url);

  const redis = new Redis({ url, token });

  console.log("Pinging Redis...");
  try {
    const start = Date.now();
    const result = await redis.ping();
    console.log("Ping successful:", result, "in", Date.now() - start, "ms");
  } catch (e) {
    console.error("Ping failed:", e);
  }
}

main();
