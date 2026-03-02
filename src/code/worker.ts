import { Hono } from "hono";

type Bindings = {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/ping", (c) => c.text("pong"));

// SPA fallback - serve all routes from static assets
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
