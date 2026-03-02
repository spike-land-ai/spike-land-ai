/**
 * Typed wrappers for SpacetimeDB auto-generated table and reducer accessors.
 *
 * The codegen emits `tables: any` and `reducers: any` because internal schema
 * types don't survive the `any` annotation on intermediate variables.
 * This module re-exports them with proper generic interfaces so consumers
 * get full type safety without touching auto-generated code.
 */

import {
  tables as rawTables,
  reducers as rawReducers,
  type Image,
  type Album,
  type AlbumImage,
  type Pipeline,
  type EnhancementJob,
  type GenerationJob,
  type Subject,
  type Credits,
} from "./module_bindings/index.js";

// ─── Table accessor shape ───────────────────────────────────────────

/** A unique-index accessor: `.find(key)` returns the row or undefined. */
interface UniqueIndex<Row, Key = string> {
  find(key: Key): Row | undefined;
}

/** A table handle with `.iter()` and named unique-index accessors. */
interface TableAccessor<Row> {
  iter(): Iterable<Row>;
}

type TableWith<Row, I extends Record<string, unknown>> = TableAccessor<Row> & I;

// ─── Per-table types (only the tables consumers actually use) ────────

export interface TypedTables {
  image: TableWith<Image, {
    id: UniqueIndex<Image>;
    userIdentity: UniqueIndex<Image>;
  }>;
  enhancement_job: TableWith<EnhancementJob, {
    id: UniqueIndex<EnhancementJob>;
    userIdentity: UniqueIndex<EnhancementJob>;
  }>;
  album: TableWith<Album, {
    id: UniqueIndex<Album, bigint>;
    handle: UniqueIndex<Album>;
    userIdentity: UniqueIndex<Album>;
  }>;
  album_image: TableWith<AlbumImage, {
    id: UniqueIndex<AlbumImage>;
    albumId: UniqueIndex<AlbumImage>;
    imageId: UniqueIndex<AlbumImage>;
  }>;
  pipeline: TableWith<Pipeline, {
    id: UniqueIndex<Pipeline>;
  }>;
  generation_job: TableWith<GenerationJob, {
    id: UniqueIndex<GenerationJob>;
    userIdentity: UniqueIndex<GenerationJob>;
  }>;
  subject: TableWith<Subject, {
    id: UniqueIndex<Subject>;
    userIdentity: UniqueIndex<Subject>;
  }>;
  credits: TableWith<Credits, {
    userIdentity: UniqueIndex<Credits>;
  }>;
}

// ─── Reducer signatures (only the reducers consumers actually call) ──

export interface TypedReducers {
  imageCreate(
    userId: string, name: string, description: string,
    originalUrl: string, originalR2Key: string,
    originalWidth: number, originalHeight: number,
    originalSizeBytes: bigint, originalFormat: string,
    isPublic: boolean, tags: string[], shareToken: string,
  ): void;
  imageDelete(id: string): void;
  imageUpdate(
    id: string, name: string, description: string,
    tags: string[], isPublic: boolean, shareToken: string,
  ): void;
  enhancementJobCreate(
    imageId: string, userId: string, tier: string,
    creditsCost: number, status: string, metadataJson: string,
  ): void;
  enhancementJobUpdate(
    id: string, status: string, enhancedUrl: string,
    enhancedR2Key: string, enhancedWidth: number, enhancedHeight: number,
    enhancedSizeBytes: bigint, errorMessage: string,
  ): void;
  albumCreate(
    handle: string, userId: string, name: string, description: string,
    coverImageId: string, privacy: string, defaultTier: string,
    shareToken: string, sortOrder: number, pipelineId: string,
  ): void;
  albumUpdate(
    handle: string, name: string, description: string,
    coverImageId: string, privacy: string, defaultTier: string,
    shareToken: string, sortOrder: number, pipelineId: string,
  ): void;
  albumDelete(handle: string): void;
  albumImageAdd(albumId: bigint, imageId: string, sortOrder: number): void;
  albumImageRemove(albumId: bigint, imageId: string): void;
  pipelineCreate(
    name: string, description: string, userId: string,
    visibility: string, tier: string,
    analysisConfigJson: string, autoCropConfigJson: string,
    promptConfigJson: string, generationConfigJson: string,
  ): void;
  pipelineUpdate(
    id: string, name: string, description: string,
    visibility: string, tier: string,
    analysisConfigJson: string, autoCropConfigJson: string,
    promptConfigJson: string, generationConfigJson: string,
  ): void;
  pipelineDelete(id: string): void;
  generationJobCreate(
    userId: string, jobType: string, tier: string,
    creditsCost: number, status: string, prompt: string,
  ): void;
  generationJobUpdate(
    id: string, status: string, outputImageUrl: string,
    outputWidth: number, outputHeight: number,
    outputSizeBytes: bigint, errorMessage: string,
  ): void;
  subjectCreate(
    userId: string, imageId: string, label: string,
    subjectType: string, description: string,
  ): void;
  subjectDelete(id: bigint): void;
  creditsConsume(amount: bigint): void;
  creditsAdd(userId: string, amount: bigint): void;
  recordPlatformEvent(source: string, eventType: string, metadataJson: string): void;
}

// ─── Typed re-exports ────────────────────────────────────────────────

export const typedTables = rawTables as unknown as TypedTables;
export const typedReducers = rawReducers as unknown as TypedReducers;
