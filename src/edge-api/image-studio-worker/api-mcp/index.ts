import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AlbumHandle, ImageId, ImageStudioDeps } from "@spike-land-ai/mcp-image-studio";
import { createD1Credits } from "../mcp/credits.ts";
import {
  addImageToDefaultAlbum,
  createD1Db,
  galleryRecentImages,
  getOrCreateDefaultAlbum,
} from "../mcp/db.ts";
import { createGeminiGeneration } from "../ai-mcp/generation.ts";
import { nanoid } from "../core-logic/nanoid.ts";
import { createResolvers } from "../mcp/resolvers.ts";
import { createR2Storage } from "../mcp/storage.ts";
import type { Env } from "./env.d.ts";
import { buildMcpServer } from "../mcp/server.ts";
import { createToolRegistry } from "../mcp/tool-registry.ts";
import { validateSession } from "../core-logic/auth.ts";
import { handleChatStream } from "../ai/chat-handler.ts";

declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;

const app = new Hono<{ Bindings: Env }>();

app.get("/version", (c) => c.json({ sha: __BUILD_SHA__, built: __BUILD_TIME__ }));

app.get("/health", (c) => c.json({ status: "ok", service: "image-studio-mcp", timestamp: new Date().toISOString() }));

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Mcp-Session-Id",
      "Mcp-Protocol-Version",
      "X-Gemini-Key",
      "X-Text-Model",
      "X-Image-Model",
      "X-Thinking-Budget",
    ],
    exposeHeaders: ["Mcp-Session-Id"],
    credentials: true,
  }),
);

// Provide R2 image fetching (public)
app.on("HEAD", "/r2/:key", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.IMAGE_R2.head(key);
  if (!obj) return c.notFound();
  return new Response(null, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(obj.size),
      ETag: obj.etag,
      ...(obj.customMetadata?.width ? { "X-Image-Width": obj.customMetadata.width } : {}),
      ...(obj.customMetadata?.height ? { "X-Image-Height": obj.customMetadata.height } : {}),
    },
  });
});

app.get("/r2/:key", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.IMAGE_R2.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
      ETag: obj.etag,
    },
  });
});

app.get("/:userId/:filename{.+\\.\\w+$}", async (c) => {
  const userId = c.req.param("userId");
  const filename = c.req.param("filename");
  const obj = await c.env.IMAGE_R2.get(`${userId}/${filename}`);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
      ETag: obj.etag,
    },
  });
});

// Proxy all /api/auth/* requests to the central auth service (auth-mcp.spike.land)
app.all("/api/auth/*", async (c) => {
  const authUrl = c.env.AUTH_SERVICE_URL || "https://auth-mcp.spike.land";
  const url = new URL(c.req.url);
  const targetUrl = `${authUrl}${url.pathname}${url.search}`;

  const forwardHeaders = new Headers(c.req.raw.headers);
  forwardHeaders.delete("host");
  forwardHeaders.set("x-forwarded-host", url.host);
  forwardHeaders.set("x-forwarded-proto", url.protocol.replace(":", ""));

  try {
    const forwardBody = c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : null;
    const res = await fetch(targetUrl, {
      method: c.req.method,
      headers: forwardHeaders,
      ...(forwardBody !== null ? { body: forwardBody } : {}),
      redirect: "manual",
    });

    const ct = res.headers.get("content-type") ?? "";
    const isGetSession = url.pathname.endsWith("/get-session");

    // For get-session: HTML error pages mean "no session" — return null gracefully.
    // For other endpoints (sign-in, callback): forward the actual error so the client can handle it.
    if (!res.ok && ct.includes("text/html")) {
      if (isGetSession) {
        return c.json(null, 200);
      }
      console.error(
        `[auth-proxy] Upstream HTML error on ${url.pathname}: ${res.status} ${res.statusText}`,
      );
      return c.json({ error: `Auth service error: ${res.status}` }, res.status as 400);
    }

    // Forward the response back, preserving status, headers, and cookies
    const responseHeaders = new Headers(res.headers);
    responseHeaders.set("Access-Control-Allow-Origin", url.origin);
    responseHeaders.set("Access-Control-Allow-Credentials", "true");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[auth-proxy] Failed to reach auth service for ${url.pathname}: ${msg}`);

    // For get-session, gracefully return null (no session). For other endpoints, surface the error.
    const isGetSession = url.pathname.endsWith("/get-session");
    if (isGetSession) {
      return c.json(null, 200);
    }
    return c.json({ error: "Auth service unreachable" }, 502);
  }
});

// Build standard deps per request
async function buildDeps(c: {
  req: {
    raw: Request;
    url: string;
    header: (name: string) => string | undefined;
    method: string;
  };
  env: Env;
}) {
  let userId = "demo-user"; // Default for MCP/CLI demo access

  // Validate session via auth-mcp.spike.land
  const session = await validateSession(c.req.raw.headers, c.env);
  if (session) {
    userId = session.user.id;
  } else {
    // Check for DEMO_TOKEN
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token && token !== c.env.DEMO_TOKEN) {
      throw new Error("Unauthorized");
    }
  }

  const baseUrl = new URL(c.req.url).origin;
  const userGeminiKey = c.req.header("X-Gemini-Key");
  const imageModel = c.req.header("X-Image-Model");
  const db = createD1Db(c.env);
  const credits = createD1Credits(c.env);
  const storage = createR2Storage(c.env, baseUrl);
  const generation = createGeminiGeneration(c.env, db, credits, storage, {
    ...(userGeminiKey !== undefined ? { userApiKey: userGeminiKey } : {}),
    ...(imageModel !== undefined ? { modelName: imageModel } : {}),
  });
  const resolvers = createResolvers(db, userId);

  return {
    userId,
    deps: {
      db,
      credits,
      storage,
      generation,
      resolvers,
      nanoid,
    } as ImageStudioDeps,
  };
}

// REST APIs
app.get("/api/tools", async (c) => {
  const { userId, deps } = await buildDeps(c);
  const toolRegistry = createToolRegistry(userId, deps);
  return c.json({ tools: toolRegistry.list() });
});

app.get("/api/monitoring/calls", async (c) => {
  const { deps } = await buildDeps(c);
  if (deps.db.toolCallList) {
    const calls = await deps.db.toolCallList({ limit: 1000 });
    return c.json({ calls });
  }
  return c.json({ calls: [] });
});

app.post("/api/tool", async (c) => {
  const body = await c.req.json<{ name: string; arguments?: Record<string, unknown> }>();
  if (!body.name) return c.json({ error: "Missing tool name" }, 400);

  const { userId, deps } = await buildDeps(c);
  const toolRegistry = createToolRegistry(userId, deps);
  const result = await toolRegistry.call(body.name, body.arguments ?? {});
  return c.json({ result });
});

// ─── Gallery API Routes ───

// GET /api/gallery — user's default gallery with cursor-based pagination
app.get("/api/gallery", async (c) => {
  const { userId } = await buildDeps(c);
  const cursor = c.req.query("cursor");
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  const search = c.req.query("search");
  const tag = c.req.query("tag");

  const result = await galleryRecentImages(c.env.IMAGE_DB, userId, {
    ...(cursor !== undefined ? { cursor } : {}),
    limit,
    ...(search !== undefined ? { search } : {}),
    ...(tag !== undefined ? { tag } : {}),
  });
  const album = await getOrCreateDefaultAlbum(c.env.IMAGE_DB, userId);

  return c.json({
    album: { id: album.id, handle: album.handle, name: "My Gallery" },
    images: result.images,
    nextCursor: result.nextCursor,
  });
});

// GET /api/gallery/albums — list user's albums (enriched with cover URLs)
app.get("/api/gallery/albums", async (c) => {
  const { userId, deps } = await buildDeps(c);
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : undefined;
  const albums = await deps.db.albumFindMany({ userId, limit });

  // Enrich with coverUrl: resolve cover image URL or fall back to first album image
  const enriched = await Promise.all(
    albums.map(async (album) => {
      let coverUrl: string | null = null;
      if (album.coverImageId) {
        const img = await deps.db.imageFindById(album.coverImageId);
        coverUrl = img?.originalUrl ?? null;
      }
      if (!coverUrl) {
        const firstImages = await deps.db.albumImageList(album.id);
        coverUrl = firstImages[0]?.image.originalUrl ?? null;
      }
      return { ...album, coverUrl };
    }),
  );

  return c.json({ albums: enriched });
});

// GET /api/gallery/album/:id — album detail with images
app.get("/api/gallery/album/:id", async (c) => {
  const albumId = c.req.param("id");
  const { deps } = await buildDeps(c);
  const album = await deps.db.albumFindById(albumId);
  if (!album) return c.json({ error: "Album not found" }, 404);

  const images = await deps.db.albumImageList(album.id);
  return c.json({ album, images });
});

// POST /api/gallery/upload — multipart upload → R2 + D1 + default album
app.post("/api/gallery/upload", async (c) => {
  const { userId, deps } = await buildDeps(c);
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "Missing file" }, 400);

  const name = (formData.get("name") as string) || file.name;
  const tagsRaw = formData.get("tags") as string | null;
  const tags: string[] = tagsRaw ? JSON.parse(tagsRaw) : [];
  const albumId = formData.get("albumId") as string | null;

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Upload to R2
  const baseUrl = new URL(c.req.url).origin;
  const storage = createR2Storage(c.env, baseUrl);
  const uploadResult = await storage.upload(userId, bytes, {
    filename: file.name,
    contentType: file.type,
  });

  // Create D1 image record
  const image = await deps.db.imageCreate({
    userId,
    name,
    description: null,
    originalUrl: uploadResult.url,
    originalR2Key: uploadResult.r2Key,
    originalWidth: 0,
    originalHeight: 0,
    originalSizeBytes: uploadResult.sizeBytes,
    originalFormat: file.type.split("/")[1] || "unknown",
    isPublic: false,
    tags,
    shareToken: null,
  });

  // Add to default album (or specified album)
  if (albumId) {
    const maxSort = await deps.db.albumImageMaxSortOrder(albumId);
    await deps.db.albumImageAdd(albumId, image.id, maxSort + 1);
  } else {
    await addImageToDefaultAlbum(c.env.IMAGE_DB, userId, image.id);
  }

  return c.json({
    image,
    url: uploadResult.url,
  });
});

// DELETE /api/gallery/image/:id — remove from gallery
app.delete("/api/gallery/image/:id", async (c) => {
  const imageId = c.req.param("id");
  const { userId, deps } = await buildDeps(c);

  const image = await deps.db.imageFindById(imageId as ImageId);
  if (!image) return c.json({ error: "Image not found" }, 404);
  if (image.userId !== userId) return c.json({ error: "Unauthorized" }, 403);

  // Delete from R2
  if (image.originalR2Key) {
    await deps.storage.delete(image.originalR2Key);
  }
  // Delete from D1 (cascades to album_images)
  await deps.db.imageDelete(imageId as ImageId);

  return c.json({ success: true });
});

// POST /api/gallery/album — create new album
app.post("/api/gallery/album", async (c) => {
  const { userId, deps } = await buildDeps(c);
  const body = await c.req.json<{ name: string; description?: string; privacy?: string }>();
  if (!body.name) return c.json({ error: "Missing album name" }, 400);

  const maxSort = await deps.db.albumMaxSortOrder(userId);
  const handle = `${body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30)}-${nanoid().slice(0, 6)}`;

  const album = await deps.db.albumCreate({
    handle: handle as AlbumHandle,
    userId,
    name: body.name,
    description: body.description ?? null,
    coverImageId: null,
    privacy: (body.privacy as "PUBLIC" | "PRIVATE" | "UNLISTED") ?? "PRIVATE",
    defaultTier: "FREE" as const,
    shareToken: null,
    sortOrder: maxSort + 1,
    pipelineId: null,
  });

  return c.json({ album });
});

// POST /api/gallery/album/:id/images — add images to album
app.post("/api/gallery/album/:id/images", async (c) => {
  const albumId = c.req.param("id");
  const { deps } = await buildDeps(c);
  const body = await c.req.json<{ imageIds: string[] }>();
  if (!body.imageIds?.length) return c.json({ error: "Missing imageIds" }, 400);

  const album = await deps.db.albumFindById(albumId);
  if (!album) return c.json({ error: "Album not found" }, 404);

  let maxSort = await deps.db.albumImageMaxSortOrder(albumId);
  const added: string[] = [];
  for (const imageId of body.imageIds) {
    const result = await deps.db.albumImageAdd(albumId, imageId as ImageId, maxSort + 1);
    if (result) {
      added.push(imageId);
      maxSort++;
    }
  }

  return c.json({ added, albumId });
});

// DELETE /api/gallery/album/:id/images — remove images from album
app.delete("/api/gallery/album/:id/images", async (c) => {
  const albumId = c.req.param("id");
  const { deps } = await buildDeps(c);
  const body = await c.req.json<{ imageIds: string[] }>();
  if (!body.imageIds?.length) return c.json({ error: "Missing imageIds" }, 400);

  const album = await deps.db.albumFindById(albumId);
  if (!album) return c.json({ error: "Album not found" }, 404);

  await deps.db.albumImageRemove(albumId, body.imageIds as ImageId[]);
  return c.json({ removed: body.imageIds, albumId });
});

// PATCH /api/gallery/album/:id — update album metadata (name, description, privacy, coverImageId)
app.patch("/api/gallery/album/:id", async (c) => {
  const albumId = c.req.param("id");
  const { deps } = await buildDeps(c);
  const body = await c.req.json<{
    name?: string;
    description?: string;
    privacy?: string;
    coverImageId?: string | null;
  }>();

  const album = await deps.db.albumFindById(albumId);
  if (!album) return c.json({ error: "Album not found" }, 404);

  const updated = await deps.db.albumUpdate(album.handle as AlbumHandle, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.privacy !== undefined ? { privacy: body.privacy as "PUBLIC" | "PRIVATE" | "UNLISTED" } : {}),
    ...(body.coverImageId !== undefined ? { coverImageId: body.coverImageId as ImageId | null } : {}),
  });

  return c.json({ album: updated });
});

// Chat agent endpoint
app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json<{
      message: string;
      history?: Array<{ role: string; content: string }>;
    }>();
    if (!body.message) return c.json({ error: "Missing message" }, 400);

    const userGeminiKey = c.req.header("X-Gemini-Key");

    const { userId, deps } = await buildDeps(c);
    const toolRegistry = createToolRegistry(userId, deps);
    const textModel = c.req.header("X-Text-Model");
    const thinkingBudget = c.req.header("X-Thinking-Budget");

    const stream = await handleChatStream(body, toolRegistry, c.env, {
      ...(userGeminiKey !== undefined ? { userGeminiKey } : {}),
      ...(textModel !== undefined ? { modelName: textModel } : {}),
      ...(thinkingBudget !== undefined ? { thinkingBudget } : {}),
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Chat failed";
    console.error("Chat endpoint error:", msg);
    return c.json({ error: msg }, 500);
  }
});

// MCP SSE Transport
// Global mapped transports work in Cloudflare Workers because they run per isolate.
// The WebStandardStreamableHTTPServerTransport handles requests natively.
let globalTransport: WebStandardStreamableHTTPServerTransport | null = null;

app.all("/mcp/*", async (c) => {
  const { userId, deps } = await buildDeps(c);
  const server = buildMcpServer(userId, deps);

  if (!globalTransport) {
    globalTransport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: nanoid, // stateful mode, required for SSE
      enableJsonResponse: true,
    });
    await server.connect(globalTransport);
  }

  // WebStandardStreamableHTTPServerTransport automatically handles SSE initialization on GET
  // and message receiving on POST based on request patterns.
  return globalTransport.handleRequest(c.req.raw);
});

// SPA Fallback for static assets
app.all("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
