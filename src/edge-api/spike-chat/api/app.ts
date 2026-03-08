import { Hono } from "hono";
import { Env } from "../core-logic/env";
import { ChannelDurableObject } from "../edge/channel-do";
import { PresenceDurableObject } from "../edge/presence-do";
import { embedRouter } from "./routes/embed";
import { channelsRouter } from "./routes/channels";
import { messagesRouter } from "./routes/messages";
import { threadsRouter } from "./routes/threads";
import { reactionsRouter } from "./routes/reactions";
import { pinsRouter } from "./routes/pins";
import { bookmarksRouter } from "./routes/bookmarks";
import { readCursorsRouter } from "./routes/read-cursors";
import { presenceRouter } from "./routes/presence";
import { dmRouter } from "./routes/dm";
import { webhooksRouter } from "./routes/webhooks";
import { websocketRouter } from "./routes/websocket";
import { authMiddleware, Variables } from "./middleware";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/", (c) => c.text("spike-chat API is running"));

// Embed routes might not require auth, or they handle it differently
app.route("/embed", embedRouter);

// WebSocket connections (can handle their own auth or use URL params)
app.route("/api/v1", websocketRouter);

// Webhooks
app.route("/webhooks", webhooksRouter);

// Protected routes
const protectedApp = new Hono<{ Bindings: Env; Variables: Variables }>();
protectedApp.use("*", authMiddleware);

protectedApp.route("/channels", channelsRouter);
protectedApp.route("/messages", messagesRouter);
protectedApp.route("/messages", threadsRouter);
protectedApp.route("/messages", reactionsRouter);
protectedApp.route("/channels", pinsRouter);
protectedApp.route("/bookmarks", bookmarksRouter);
protectedApp.route("/channels", readCursorsRouter);
protectedApp.route("/presence", presenceRouter);
protectedApp.route("/", dmRouter);

app.route("/api/v1", protectedApp);

export default {
  fetch: app.fetch,
};

export { ChannelDurableObject, PresenceDurableObject };
