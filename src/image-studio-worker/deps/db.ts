import type {
  AlbumHandle,
  AlbumImageRow,
  AlbumRow,
  EnhancementJobRow,
  GenerationJobRow,
  ImageId,
  ImageRow,
  JobId,
  PipelineId,
  PipelineRow,
  ImageStudioDeps,
  SubjectRow,
} from "@spike-land-ai/mcp-image-studio";
import type { Env } from "../env.d.ts";
import { nanoid } from "./nanoid.ts";

// ─── Row mappers (D1 rows → typed rows) ───

function parseDate(v: string | null): Date {
  return v ? new Date(v) : new Date();
}

function parseDateOrNull(v: string | null | undefined): Date | null {
  return v ? new Date(v) : null;
}

function parseTags(v: string | null): string[] {
  if (!v) return [];
  try {
    return JSON.parse(v) as string[];
  } catch {
    return [];
  }
}

function parseJson(v: string | null): unknown {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

interface D1ImageRow {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  originalUrl: string;
  originalR2Key: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  originalFormat: string;
  isPublic: number;
  viewCount: number;
  tags: string;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapImageRow(r: D1ImageRow): ImageRow {
  return {
    id: r.id as ImageId,
    userId: r.userId,
    name: r.name,
    description: r.description,
    originalUrl: r.originalUrl,
    originalR2Key: r.originalR2Key,
    originalWidth: r.originalWidth,
    originalHeight: r.originalHeight,
    originalSizeBytes: r.originalSizeBytes,
    originalFormat: r.originalFormat,
    isPublic: r.isPublic === 1,
    viewCount: r.viewCount,
    tags: parseTags(r.tags),
    shareToken: r.shareToken,
    createdAt: parseDate(r.createdAt),
    updatedAt: parseDate(r.updatedAt),
  };
}

interface D1JobRow {
  id: string;
  imageId: string;
  userId: string;
  tier: string;
  creditsCost: number;
  status: string;
  enhancedUrl: string | null;
  enhancedR2Key: string | null;
  enhancedWidth: number | null;
  enhancedHeight: number | null;
  enhancedSizeBytes: number | null;
  errorMessage: string | null;
  retryCount: number;
  metadata: string | null;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapJobRow(r: D1JobRow): EnhancementJobRow {
  return {
    ...r,
    id: r.id as JobId,
    imageId: r.imageId as ImageId,
    tier: r.tier as EnhancementJobRow["tier"],
    status: r.status as EnhancementJobRow["status"],
    metadata: parseJson(r.metadata),
    processingStartedAt: parseDateOrNull(r.processingStartedAt),
    processingCompletedAt: parseDateOrNull(r.processingCompletedAt),
    createdAt: parseDate(r.createdAt),
    updatedAt: parseDate(r.updatedAt),
  };
}

interface D1AlbumRow {
  id: string;
  handle: string;
  userId: string;
  name: string;
  description: string | null;
  coverImageId: string | null;
  privacy: string;
  defaultTier: string;
  shareToken: string | null;
  sortOrder: number;
  pipelineId: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapAlbumRow(r: D1AlbumRow): AlbumRow {
  return {
    ...r,
    handle: r.handle as AlbumHandle,
    coverImageId: r.coverImageId as ImageId | null,
    privacy: r.privacy as AlbumRow["privacy"],
    defaultTier: r.defaultTier as AlbumRow["defaultTier"],
    pipelineId: r.pipelineId as PipelineId | null,
    createdAt: parseDate(r.createdAt),
    updatedAt: parseDate(r.updatedAt),
  };
}

interface D1PipelineRow {
  id: string;
  name: string;
  description: string | null;
  userId: string | null;
  visibility: string;
  shareToken: string | null;
  tier: string;
  analysisConfig: string | null;
  autoCropConfig: string | null;
  promptConfig: string | null;
  generationConfig: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

function mapPipelineRow(r: D1PipelineRow): PipelineRow {
  return {
    ...r,
    id: r.id as PipelineId,
    visibility: r.visibility as PipelineRow["visibility"],
    tier: r.tier as PipelineRow["tier"],
    analysisConfig: parseJson(r.analysisConfig),
    autoCropConfig: parseJson(r.autoCropConfig),
    promptConfig: parseJson(r.promptConfig),
    generationConfig: parseJson(r.generationConfig),
    createdAt: parseDate(r.createdAt),
    updatedAt: parseDate(r.updatedAt),
  };
}

interface D1GenJobRow {
  id: string;
  userId: string;
  type: string;
  tier: string;
  creditsCost: number;
  status: string;
  prompt: string;
  inputImageUrl: string | null;
  outputImageUrl: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  outputSizeBytes: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapGenJobRow(r: D1GenJobRow): GenerationJobRow {
  return {
    ...r,
    id: r.id as JobId,
    type: r.type as GenerationJobRow["type"],
    tier: r.tier as GenerationJobRow["tier"],
    status: r.status as GenerationJobRow["status"],
    createdAt: parseDate(r.createdAt),
    updatedAt: parseDate(r.updatedAt),
  };
}

interface D1SubjectRow {
  id: string;
  userId: string;
  imageId: string;
  label: string;
  type: string;
  description: string | null;
  createdAt: string;
}

function mapSubjectRow(r: D1SubjectRow): SubjectRow {
  return {
    ...r,
    imageId: r.imageId as ImageId,
    type: r.type as SubjectRow["type"],
    createdAt: parseDate(r.createdAt),
  };
}

// ─── D1 Database Implementation ───

export function createD1Db(env: Env): ImageStudioDeps["db"] {
  const db = env.IMAGE_DB;

  return {
    // ── Image CRUD ──

    async imageCreate(data) {
      const id = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO images (id, userId, name, description, originalUrl, originalR2Key,
           originalWidth, originalHeight, originalSizeBytes, originalFormat,
           isPublic, viewCount, tags, shareToken, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          data.userId,
          data.name,
          data.description ?? null,
          data.originalUrl,
          data.originalR2Key,
          data.originalWidth,
          data.originalHeight,
          data.originalSizeBytes,
          data.originalFormat,
          data.isPublic ? 1 : 0,
          JSON.stringify(data.tags),
          data.shareToken ?? null,
          now,
          now,
        )
        .run();

      return mapImageRow({
        id,
        userId: data.userId,
        name: data.name,
        description: data.description ?? null,
        originalUrl: data.originalUrl,
        originalR2Key: data.originalR2Key,
        originalWidth: data.originalWidth,
        originalHeight: data.originalHeight,
        originalSizeBytes: data.originalSizeBytes,
        originalFormat: data.originalFormat,
        isPublic: data.isPublic ? 1 : 0,
        viewCount: 0,
        tags: JSON.stringify(data.tags),
        shareToken: data.shareToken ?? null,
        createdAt: now,
        updatedAt: now,
      });
    },

    async imageFindById(id) {
      const row = await db
        .prepare("SELECT * FROM images WHERE id = ?")
        .bind(id)
        .first<D1ImageRow>();
      return row ? mapImageRow(row) : null;
    },

    async imageFindMany(opts) {
      let sql = "SELECT * FROM images WHERE userId = ?";
      const params: unknown[] = [opts.userId];

      if (opts.search) {
        sql += " AND (name LIKE ? OR description LIKE ?)";
        const term = `%${opts.search}%`;
        params.push(term, term);
      }

      sql += " ORDER BY createdAt DESC";

      if (opts.limit) {
        sql += " LIMIT ?";
        params.push(opts.limit);
      }
      // offset is removed in new types, use cursor if needed in future

      const result = await db
        .prepare(sql)
        .bind(...params)
        .all<D1ImageRow>();
      return result.results.map(mapImageRow);
    },

    async imageDelete(id) {
      await db.prepare("DELETE FROM images WHERE id = ?").bind(id).run();
    },

    async imageUpdate(id, data) {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (data.name !== undefined) {
        sets.push("name = ?");
        params.push(data.name);
      }
      if (data.description !== undefined) {
        sets.push("description = ?");
        params.push(data.description);
      }
      if (data.tags !== undefined) {
        sets.push("tags = ?");
        params.push(JSON.stringify(data.tags));
      }
      if (data.isPublic !== undefined) {
        sets.push("isPublic = ?");
        params.push(data.isPublic ? 1 : 0);
      }
      if (data.shareToken !== undefined) {
        sets.push("shareToken = ?");
        params.push(data.shareToken);
      }

      const now = new Date().toISOString();
      sets.push("updatedAt = ?");
      params.push(now);
      params.push(id);

      await db
        .prepare(`UPDATE images SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();

      const row = await db
        .prepare("SELECT * FROM images WHERE id = ?")
        .bind(id)
        .first<D1ImageRow>();
      return mapImageRow(row!);
    },

    async imageCount(userId) {
      const row = await db
        .prepare("SELECT COUNT(*) as count FROM images WHERE userId = ?")
        .bind(userId)
        .first<{ count: number }>();
      return row?.count ?? 0;
    },

    // ── Enhancement Job CRUD ──

    async jobCreate(data) {
      const id = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO enhancement_jobs (id, imageId, userId, tier, creditsCost, status,
           processingStartedAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          data.imageId,
          data.userId,
          data.tier,
          data.creditsCost,
          data.status,
          data.processingStartedAt?.toISOString() ?? null,
          now,
          now,
        )
        .run();

      const row = await db
        .prepare("SELECT * FROM enhancement_jobs WHERE id = ?")
        .bind(id)
        .first<D1JobRow>();
      return mapJobRow(row!);
    },

    async jobFindById(id) {
      const row = await db
        .prepare("SELECT * FROM enhancement_jobs WHERE id = ?")
        .bind(id)
        .first<D1JobRow>();
      if (!row) return null;
      const job = mapJobRow(row);

      // Also fetch associated image info
      const img = await db
        .prepare("SELECT id, name, originalUrl FROM images WHERE id = ?")
        .bind(row.imageId)
        .first<{ id: string; name: string; originalUrl: string }>();

      return {
        ...job,
        image: img
          ? { id: img.id as ImageId, name: img.name, originalUrl: img.originalUrl }
          : undefined,
      };
    },

    async jobFindMany(opts) {
      let sql = "SELECT * FROM enhancement_jobs WHERE userId = ?";
      const params: unknown[] = [opts.userId];

      if (opts.imageId) {
        sql += " AND imageId = ?";
        params.push(opts.imageId);
      }
      if (opts.status) {
        sql += " AND status = ?";
        params.push(opts.status);
      }

      sql += " ORDER BY createdAt DESC";

      if (opts.limit) {
        sql += " LIMIT ?";
        params.push(opts.limit);
      }

      const result = await db
        .prepare(sql)
        .bind(...params)
        .all<D1JobRow>();
      return result.results.map(mapJobRow);
    },

    async jobUpdate(id, data) {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (data.status !== undefined) {
        sets.push("status = ?");
        params.push(data.status);
      }
      if (data.enhancedUrl !== undefined) {
        sets.push("enhancedUrl = ?");
        params.push(data.enhancedUrl);
      }
      if (data.enhancedR2Key !== undefined) {
        sets.push("enhancedR2Key = ?");
        params.push(data.enhancedR2Key);
      }
      if (data.enhancedWidth !== undefined) {
        sets.push("enhancedWidth = ?");
        params.push(data.enhancedWidth);
      }
      if (data.enhancedHeight !== undefined) {
        sets.push("enhancedHeight = ?");
        params.push(data.enhancedHeight);
      }
      if (data.enhancedSizeBytes !== undefined) {
        sets.push("enhancedSizeBytes = ?");
        params.push(data.enhancedSizeBytes);
      }
      if (data.errorMessage !== undefined) {
        sets.push("errorMessage = ?");
        params.push(data.errorMessage);
      }
      if (data.processingCompletedAt !== undefined) {
        sets.push("processingCompletedAt = ?");
        params.push(data.processingCompletedAt?.toISOString() ?? null);
      }

      const now = new Date().toISOString();
      sets.push("updatedAt = ?");
      params.push(now);
      params.push(id);

      await db
        .prepare(`UPDATE enhancement_jobs SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();

      const row = await db
        .prepare("SELECT * FROM enhancement_jobs WHERE id = ?")
        .bind(id)
        .first<D1JobRow>();
      return mapJobRow(row!);
    },

    // ── Album CRUD ──

    async albumCreate(data) {
      const id = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO albums (id, handle, userId, name, description, coverImageId,
           privacy, defaultTier, shareToken, sortOrder, pipelineId, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          data.handle,
          data.userId,
          data.name,
          data.description ?? null,
          data.coverImageId ?? null,
          data.privacy,
          data.defaultTier,
          data.shareToken ?? null,
          data.sortOrder,
          data.pipelineId ?? null,
          now,
          now,
        )
        .run();

      const row = await db
        .prepare("SELECT * FROM albums WHERE id = ?")
        .bind(id)
        .first<D1AlbumRow>();
      return mapAlbumRow(row!);
    },

    async albumFindByHandle(handle) {
      const row = await db
        .prepare("SELECT * FROM albums WHERE handle = ?")
        .bind(handle)
        .first<D1AlbumRow>();
      if (!row) return null;

      const countRow = await db
        .prepare("SELECT COUNT(*) as count FROM album_images WHERE albumId = ?")
        .bind(row.id)
        .first<{ count: number }>();

      return {
        ...mapAlbumRow(row),
        _count: { albumImages: countRow?.count ?? 0 },
      };
    },

    async albumFindById(id) {
      const row = await db
        .prepare("SELECT * FROM albums WHERE id = ?")
        .bind(id)
        .first<D1AlbumRow>();
      if (!row) return null;

      const countRow = await db
        .prepare("SELECT COUNT(*) as count FROM album_images WHERE albumId = ?")
        .bind(row.id)
        .first<{ count: number }>();

      return {
        ...mapAlbumRow(row),
        _count: { albumImages: countRow?.count ?? 0 },
      };
    },

    async albumFindMany(opts) {
      let sql = "SELECT * FROM albums WHERE userId = ? ORDER BY sortOrder ASC";
      const params: unknown[] = [opts.userId];

      if (opts.limit) {
        sql += " LIMIT ?";
        params.push(opts.limit);
      }

      const result = await db
        .prepare(sql)
        .bind(...params)
        .all<D1AlbumRow>();

      return Promise.all(
        result.results.map(async (row) => {
          const countRow = await db
            .prepare("SELECT COUNT(*) as count FROM album_images WHERE albumId = ?")
            .bind(row.id)
            .first<{ count: number }>();
          return {
            ...mapAlbumRow(row),
            _count: { albumImages: countRow?.count ?? 0 },
          };
        }),
      );
    },

    async albumUpdate(handle, data) {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (data.name !== undefined) {
        sets.push("name = ?");
        params.push(data.name);
      }
      if (data.description !== undefined) {
        sets.push("description = ?");
        params.push(data.description);
      }
      if (data.coverImageId !== undefined) {
        sets.push("coverImageId = ?");
        params.push(data.coverImageId);
      }
      if (data.privacy !== undefined) {
        sets.push("privacy = ?");
        params.push(data.privacy);
      }
      if (data.defaultTier !== undefined) {
        sets.push("defaultTier = ?");
        params.push(data.defaultTier);
      }
      if (data.shareToken !== undefined) {
        sets.push("shareToken = ?");
        params.push(data.shareToken);
      }
      if (data.pipelineId !== undefined) {
        sets.push("pipelineId = ?");
        params.push(data.pipelineId);
      }

      const now = new Date().toISOString();
      sets.push("updatedAt = ?");
      params.push(now);
      params.push(handle);

      await db
        .prepare(`UPDATE albums SET ${sets.join(", ")} WHERE handle = ?`)
        .bind(...params)
        .run();

      const row = await db
        .prepare("SELECT * FROM albums WHERE handle = ?")
        .bind(handle)
        .first<D1AlbumRow>();
      return mapAlbumRow(row!);
    },

    async albumDelete(handle) {
      await db.prepare("DELETE FROM albums WHERE handle = ?").bind(handle).run();
    },

    async albumMaxSortOrder(userId) {
      const row = await db
        .prepare("SELECT MAX(sortOrder) as maxSort FROM albums WHERE userId = ?")
        .bind(userId)
        .first<{ maxSort: number | null }>();
      return row?.maxSort ?? 0;
    },

    // ── AlbumImage operations ──

    async albumImageAdd(albumId, imageId, sortOrder) {
      const id = nanoid();
      const now = new Date().toISOString();
      try {
        await db
          .prepare(
            "INSERT INTO album_images (id, albumId, imageId, sortOrder, addedAt) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(id, albumId, imageId, sortOrder, now)
          .run();

        return {
          id,
          albumId,
          imageId,
          sortOrder,
          addedAt: new Date(now),
        } as AlbumImageRow;
      } catch {
        // UNIQUE constraint violation — image already in album
        return null;
      }
    },

    async albumImageRemove(albumId, imageIds) {
      let removed = 0;
      for (const imageId of imageIds) {
        const result = await db
          .prepare("DELETE FROM album_images WHERE albumId = ? AND imageId = ?")
          .bind(albumId, imageId)
          .run();
        removed += result.meta.changes ?? 0;
      }
      return removed;
    },

    async albumImageReorder(albumId, imageOrder) {
      for (let i = 0; i < imageOrder.length; i++) {
        await db
          .prepare("UPDATE album_images SET sortOrder = ? WHERE albumId = ? AND imageId = ?")
          .bind(i, albumId, imageOrder[i])
          .run();
      }
    },

    async albumImageList(albumId) {
      const result = await db
        .prepare(
          `SELECT ai.*, i.id as img_id, i.name as img_name, i.originalUrl as img_url,
           i.originalWidth as img_w, i.originalHeight as img_h
           FROM album_images ai
           JOIN images i ON ai.imageId = i.id
           WHERE ai.albumId = ?
           ORDER BY ai.sortOrder ASC`,
        )
        .bind(albumId)
        .all<{
          id: string;
          albumId: string;
          imageId: string;
          sortOrder: number;
          addedAt: string;
          img_id: string;
          img_name: string;
          img_url: string;
          img_w: number;
          img_h: number;
        }>();

      return result.results.map((r) => ({
        id: r.id,
        albumId: r.albumId,
        imageId: r.imageId as ImageId,
        sortOrder: r.sortOrder,
        addedAt: parseDate(r.addedAt),
        image: {
          id: r.img_id as ImageId,
          name: r.img_name,
          originalUrl: r.img_url,
          originalWidth: r.img_w,
          originalHeight: r.img_h,
        },
      }));
    },

    async albumImageMaxSortOrder(albumId) {
      const row = await db
        .prepare("SELECT MAX(sortOrder) as maxSort FROM album_images WHERE albumId = ?")
        .bind(albumId)
        .first<{ maxSort: number | null }>();
      return row?.maxSort ?? 0;
    },

    // ── Pipeline CRUD ──

    async pipelineCreate(data) {
      const id = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO pipelines (id, name, description, userId, visibility, tier,
           analysisConfig, autoCropConfig, promptConfig, generationConfig,
           usageCount, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(
          id,
          data.name,
          data.description ?? null,
          data.userId ?? null,
          data.visibility,
          data.tier,
          data.analysisConfig ? JSON.stringify(data.analysisConfig) : null,
          data.autoCropConfig ? JSON.stringify(data.autoCropConfig) : null,
          data.promptConfig ? JSON.stringify(data.promptConfig) : null,
          data.generationConfig ? JSON.stringify(data.generationConfig) : null,
          now,
          now,
        )
        .run();

      const row = await db
        .prepare("SELECT * FROM pipelines WHERE id = ?")
        .bind(id)
        .first<D1PipelineRow>();
      return mapPipelineRow(row!);
    },

    async pipelineFindById(id) {
      const row = await db
        .prepare("SELECT * FROM pipelines WHERE id = ?")
        .bind(id)
        .first<D1PipelineRow>();
      if (!row) return null;

      const countRow = await db
        .prepare("SELECT COUNT(*) as count FROM albums WHERE pipelineId = ?")
        .bind(id)
        .first<{ count: number }>();

      return {
        ...mapPipelineRow(row),
        _count: { albums: countRow?.count ?? 0 },
      };
    },

    async pipelineFindMany(opts) {
      let sql = "SELECT * FROM pipelines WHERE userId = ? ORDER BY createdAt DESC";
      const params: unknown[] = [opts.userId];

      if (opts.limit) {
        sql += " LIMIT ?";
        params.push(opts.limit);
      }

      const result = await db
        .prepare(sql)
        .bind(...params)
        .all<D1PipelineRow>();
      return result.results.map(mapPipelineRow);
    },

    async pipelineUpdate(id, data) {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (data.name !== undefined) {
        sets.push("name = ?");
        params.push(data.name);
      }
      if (data.description !== undefined) {
        sets.push("description = ?");
        params.push(data.description);
      }
      if (data.visibility !== undefined) {
        sets.push("visibility = ?");
        params.push(data.visibility);
      }
      if (data.tier !== undefined) {
        sets.push("tier = ?");
        params.push(data.tier);
      }
      if (data.analysisConfig !== undefined) {
        sets.push("analysisConfig = ?");
        params.push(JSON.stringify(data.analysisConfig));
      }
      if (data.autoCropConfig !== undefined) {
        sets.push("autoCropConfig = ?");
        params.push(JSON.stringify(data.autoCropConfig));
      }
      if (data.promptConfig !== undefined) {
        sets.push("promptConfig = ?");
        params.push(JSON.stringify(data.promptConfig));
      }
      if (data.generationConfig !== undefined) {
        sets.push("generationConfig = ?");
        params.push(JSON.stringify(data.generationConfig));
      }

      const now = new Date().toISOString();
      sets.push("updatedAt = ?");
      params.push(now);
      params.push(id);

      await db
        .prepare(`UPDATE pipelines SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();

      const row = await db
        .prepare("SELECT * FROM pipelines WHERE id = ?")
        .bind(id)
        .first<D1PipelineRow>();
      return mapPipelineRow(row!);
    },

    async pipelineDelete(id) {
      await db.prepare("DELETE FROM pipelines WHERE id = ?").bind(id).run();
    },

    // ── GenerationJob CRUD ──

    async generationJobCreate(data) {
      const id = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO generation_jobs (id, userId, type, tier, creditsCost, status,
           prompt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          data.userId,
          data.type,
          data.tier,
          data.creditsCost,
          data.status,
          data.prompt,
          now,
          now,
        )
        .run();

      const row = await db
        .prepare("SELECT * FROM generation_jobs WHERE id = ?")
        .bind(id)
        .first<D1GenJobRow>();
      return mapGenJobRow(row!);
    },

    async generationJobFindById(id) {
      const row = await db
        .prepare("SELECT * FROM generation_jobs WHERE id = ?")
        .bind(id)
        .first<D1GenJobRow>();
      return row ? mapGenJobRow(row) : null;
    },

    async toolCallCreate(data) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO tool_calls (id, userId, toolName, args, durationMs, isError, status, result, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          data.id,
          data.userId,
          data.toolName,
          data.args,
          data.durationMs,
          data.isError ? 1 : 0,
          data.status,
          data.result || null,
          now,
          now,
        )
        .run();

      return data.id;
    },

    async toolCallUpdate(id, data) {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (data.durationMs !== undefined) {
        sets.push("durationMs = ?");
        params.push(data.durationMs);
      }
      if (data.isError !== undefined) {
        sets.push("isError = ?");
        params.push(data.isError ? 1 : 0);
      }
      if (data.status !== undefined) {
        sets.push("status = ?");
        params.push(data.status);
      }
      if (data.result !== undefined) {
        sets.push("result = ?");
        params.push(data.result);
      }

      const now = new Date().toISOString();
      sets.push("updatedAt = ?");
      params.push(now);
      params.push(id);

      await db
        .prepare(`UPDATE tool_calls SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();
    },

    async toolCallList({ limit }) {
      const result = await db
        .prepare("SELECT * FROM tool_calls ORDER BY createdAt DESC LIMIT ?")
        .bind(limit)
        .all<{
          id: string;
          userId: string;
          toolName: string;
          args: string;
          durationMs: number;
          isError: number;
          status: string;
          result: string | null;
          createdAt: string;
          updatedAt: string;
        }>();

      return result.results.map((r) => ({
        id: r.id,
        userId: r.userId,
        toolName: r.toolName,
        args: r.args,
        durationMs: r.durationMs,
        isError: r.isError === 1,
        status: r.status as "PENDING" | "COMPLETED" | "ERROR",
        result: r.result,
        createdAt: parseDate(r.createdAt),
        updatedAt: parseDate(r.updatedAt),
      }));
    },

    async generationJobUpdate(id, data) {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (data.status !== undefined) {
        sets.push("status = ?");
        params.push(data.status);
      }
      if (data.outputImageUrl !== undefined) {
        sets.push("outputImageUrl = ?");
        params.push(data.outputImageUrl);
      }
      if (data.outputWidth !== undefined) {
        sets.push("outputWidth = ?");
        params.push(data.outputWidth);
      }
      if (data.outputHeight !== undefined) {
        sets.push("outputHeight = ?");
        params.push(data.outputHeight);
      }
      if (data.outputSizeBytes !== undefined) {
        sets.push("outputSizeBytes = ?");
        params.push(data.outputSizeBytes);
      }
      if (data.errorMessage !== undefined) {
        sets.push("errorMessage = ?");
        params.push(data.errorMessage);
      }
      if (data.inputImageUrl !== undefined) {
        sets.push("inputImageUrl = ?");
        params.push(data.inputImageUrl);
      }

      const now = new Date().toISOString();
      sets.push("updatedAt = ?");
      params.push(now);
      params.push(id);

      await db
        .prepare(`UPDATE generation_jobs SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();

      const row = await db
        .prepare("SELECT * FROM generation_jobs WHERE id = ?")
        .bind(id)
        .first<D1GenJobRow>();
      return mapGenJobRow(row!);
    },

    // ── Subject CRUD (optional methods) ──

    async subjectCreate(data) {
      const id = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(
          "INSERT INTO subjects (id, userId, imageId, label, type, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id, data.userId, data.imageId, data.label, data.type, data.description ?? null, now)
        .run();

      const row = await db
        .prepare("SELECT * FROM subjects WHERE id = ?")
        .bind(id)
        .first<D1SubjectRow>();
      return mapSubjectRow(row!);
    },

    async subjectFindMany(opts) {
      const result = await db
        .prepare("SELECT * FROM subjects WHERE userId = ? ORDER BY createdAt DESC")
        .bind(opts.userId)
        .all<D1SubjectRow>();
      return result.results.map(mapSubjectRow);
    },

    async subjectDelete(id) {
      await db.prepare("DELETE FROM subjects WHERE id = ?").bind(id).run();
    },
  };
}
