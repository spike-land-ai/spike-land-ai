import { Hono } from "hono";
import { SpikeDatabase } from "../server/database-do.js";
import type { Env } from "./env.js";

export { SpikeDatabase };

const app = new Hono<{ Bindings: Env }>();

/** Route all /db/:name/* requests to the named Durable Object. */
app.all("/db/:name/*", async (c) => {
  const name = c.req.param("name");
  const id = c.env.SPIKE_DATABASE.idFromName(name);
  const stub = c.env.SPIKE_DATABASE.get(id);

  // Strip /db/:name prefix and forward the rest
  const url = new URL(c.req.url);
  const suffix = url.pathname.replace(`/db/${name}`, "") || "/";
  const forwardUrl = new URL(suffix, url.origin);
  forwardUrl.search = url.search;

  const request = new Request(forwardUrl.toString(), c.req.raw);
  return stub.fetch(request);
});

app.get("/health", (c) => {
  return c.json({ ok: true });
});

export default app;
