import { Buffer } from "node:buffer";
import type { ImageStudioDeps } from "@spike-land-ai/mcp-image-studio";
import type { Env } from "../env.d.ts";
import { nanoid } from "./nanoid.ts";

export function createR2Storage(env: Env, baseUrl: string): ImageStudioDeps["storage"] {
  return {
    async upload(userId, data, opts) {
      /* v8 ignore next */
      const parts = opts.filename.split(".");
      const ext = parts.length > 1 ? parts.pop() : "bin";
      const key = `${userId}/${nanoid()}.${ext}`;
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

      await env.IMAGE_R2.put(key, bytes, {
        httpMetadata: {
          contentType: opts.contentType,
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          userId,
          contentType: opts.contentType,
          uploadedAt: new Date().toISOString(),
        },
      });

      return {
        url: `${baseUrl}/${key}`,
        r2Key: key,
        sizeBytes: bytes.byteLength,
      };
    },

    async download(r2Key) {
      const obj = await env.IMAGE_R2.get(r2Key);
      if (!obj) throw new Error(`R2 object not found: ${r2Key}`);
      const ab = await obj.arrayBuffer();
      return Buffer.from(ab);
    },

    async delete(r2Key) {
      await env.IMAGE_R2.delete(r2Key);
    },
  };
}
