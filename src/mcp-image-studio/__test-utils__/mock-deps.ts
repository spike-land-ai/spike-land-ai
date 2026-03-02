/**
 * Mock ImageStudioDeps factory for testing.
 * Returns a fully mocked ImageStudioDeps with vi.fn() for every method.
 */

import { vi } from "vitest";
import type {
  AlbumRow,
  EnhancementJobRow,
  EnhancementTier,
  GenerationJobRow,
  ImageRow,
  ImageStudioDeps,
  ImageStudioResolvers,
  PipelineRow,
  SubjectRow,
} from "../types.js";
import { asAlbumHandle, asImageId, asJobId, asPipelineId, ENHANCEMENT_COSTS } from "../types.js";

/** Create a minimal valid ImageRow for tests */
export function mockImageRow(overrides: Partial<ImageRow> & { userId: string }): ImageRow {
  return {
    id: asImageId("img-1"),
    name: "test-image.jpg",
    description: null,
    originalUrl: "https://r2.spike.land/test.jpg",
    originalR2Key: "test-key",
    originalWidth: 1024,
    originalHeight: 1024,
    originalSizeBytes: 100000,
    originalFormat: "jpeg",
    isPublic: false,
    viewCount: 0,
    tags: [],
    shareToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Create a minimal valid AlbumRow for tests */
export function mockAlbumRow(overrides: Partial<AlbumRow> & { userId: string }): AlbumRow {
  return {
    id: "album-uuid-1",
    handle: asAlbumHandle("my-album"),
    name: "Test Album",
    description: null,
    coverImageId: null,
    privacy: "PRIVATE",
    defaultTier: "FREE",
    shareToken: null,
    sortOrder: 0,
    pipelineId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Create a minimal valid PipelineRow for tests */
export function mockPipelineRow(overrides: Partial<PipelineRow> = {}): PipelineRow {
  return {
    id: asPipelineId("pipe-1"),
    name: "Test Pipeline",
    description: null,
    userId: "test-user-123",
    visibility: "PRIVATE",
    shareToken: null,
    tier: "FREE",
    analysisConfig: null,
    autoCropConfig: null,
    promptConfig: null,
    generationConfig: null,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Create a minimal valid EnhancementJobRow for tests */
export function mockJobRow(overrides: Partial<EnhancementJobRow> = {}): EnhancementJobRow {
  return {
    id: asJobId("job-1"),
    imageId: asImageId("img-1"),
    userId: "test-user-123",
    tier: "TIER_1K",
    creditsCost: 2,
    status: "COMPLETED",
    enhancedUrl: "https://r2.spike.land/enhanced.jpg",
    enhancedR2Key: "enhanced-key",
    enhancedWidth: 2048,
    enhancedHeight: 2048,
    enhancedSizeBytes: 200000,
    errorMessage: null,
    retryCount: 0,
    processingStartedAt: new Date(),
    processingCompletedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: null,
    ...overrides,
  };
}

/** Create a minimal valid GenerationJobRow for tests */
export function mockGenerationJobRow(overrides: Partial<GenerationJobRow> = {}): GenerationJobRow {
  return {
    id: asJobId("gen-job-1"),
    userId: "test-user-123",
    type: "GENERATE",
    tier: "TIER_1K",
    creditsCost: 2,
    status: "COMPLETED",
    prompt: "test prompt",
    inputImageUrl: null,
    outputImageUrl: "https://r2.spike.land/output.jpg",
    outputWidth: 1024,
    outputHeight: 1024,
    outputSizeBytes: 100000,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Create a minimal valid SubjectRow for tests */
export function mockSubjectRow(overrides: Partial<SubjectRow> & { userId: string }): SubjectRow {
  return {
    id: "sub-1",
    imageId: asImageId("img-1"),
    label: "Test Subject",
    type: "character",
    description: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockResolvers(): {
  resolvers: ImageStudioResolvers;
  resolverMocks: Record<string, ReturnType<typeof vi.fn>>;
} {
  const resolverMocks = {
    resolveImage: vi.fn(),
    resolveAlbum: vi.fn(),
    resolvePipeline: vi.fn(),
    resolveJob: vi.fn(),
    resolveGenerationJob: vi.fn(),
    resolveImages: vi.fn(),
  };

  // Sensible defaults — tests override as needed
  resolverMocks.resolveImage.mockImplementation(async (id: string) =>
    mockImageRow({ id: asImageId(id), userId: "test-user-123" }),
  );
  resolverMocks.resolveAlbum.mockImplementation(async (handle: string) =>
    mockAlbumRow({ handle: asAlbumHandle(handle), userId: "test-user-123" }),
  );
  resolverMocks.resolvePipeline.mockImplementation(async (id: string) =>
    mockPipelineRow({ id: asPipelineId(id) }),
  );
  resolverMocks.resolveJob.mockImplementation(async (id: string) =>
    mockJobRow({ id: asJobId(id) }),
  );
  resolverMocks.resolveGenerationJob.mockImplementation(async (id: string) =>
    mockGenerationJobRow({ id: asJobId(id) }),
  );
  resolverMocks.resolveImages.mockImplementation(async (ids: string[]) =>
    ids.map((id) => mockImageRow({ id: asImageId(id), userId: "test-user-123" })),
  );

  return {
    resolvers: resolverMocks as unknown as ImageStudioResolvers,
    resolverMocks,
  };
}

export function createMockImageStudioDeps(): {
  deps: ImageStudioDeps;
  mocks: {
    db: Record<string, ReturnType<typeof vi.fn>>;
    credits: Record<string, ReturnType<typeof vi.fn>>;
    storage: Record<string, ReturnType<typeof vi.fn>>;
    generation: Record<string, ReturnType<typeof vi.fn>>;
    resolverMocks: Record<string, ReturnType<typeof vi.fn>>;
  };
} {
  const db = {
    imageCreate: vi.fn(),
    imageFindById: vi.fn(),
    imageFindMany: vi.fn(),
    imageDelete: vi.fn(),
    imageUpdate: vi.fn(),
    imageCount: vi.fn(),
    jobCreate: vi.fn(),
    jobFindById: vi.fn(),
    jobFindMany: vi.fn(),
    jobUpdate: vi.fn(),
    albumCreate: vi.fn(),
    albumFindByHandle: vi.fn(),
    albumFindById: vi.fn(),
    albumFindMany: vi.fn(),
    albumUpdate: vi.fn(),
    albumDelete: vi.fn(),
    albumMaxSortOrder: vi.fn(),
    albumImageAdd: vi.fn(),
    albumImageRemove: vi.fn(),
    albumImageReorder: vi.fn(),
    albumImageList: vi.fn(),
    albumImageMaxSortOrder: vi.fn(),
    pipelineCreate: vi.fn(),
    pipelineFindById: vi.fn(),
    pipelineFindMany: vi.fn(),
    pipelineUpdate: vi.fn(),
    pipelineDelete: vi.fn(),
    generationJobCreate: vi.fn(),
    generationJobFindById: vi.fn(),
    generationJobUpdate: vi.fn(),
    subjectCreate: vi.fn(),
    subjectFindMany: vi.fn(),
    subjectDelete: vi.fn(),
  };

  const credits = {
    hasEnough: vi.fn().mockResolvedValue(true),
    consume: vi.fn().mockResolvedValue({ success: true, remaining: 100 }),
    refund: vi.fn().mockResolvedValue(true),
    getBalance: vi.fn().mockResolvedValue({ remaining: 100 }),
    estimate: vi
      .fn()
      .mockImplementation((tier: EnhancementTier, count = 1) => ENHANCEMENT_COSTS[tier] * count),
    calculateGenerationCost: vi
      .fn()
      .mockImplementation((opts: { tier: EnhancementTier; numImages?: number }) => {
        const count = opts.numImages ?? 1;
        return ENHANCEMENT_COSTS[opts.tier] * count;
      }),
  };

  const storage = {
    upload: vi.fn().mockResolvedValue({
      url: "https://r2.spike.land/test.jpg",
      r2Key: "test-key",
      sizeBytes: 1024,
    }),
    download: vi.fn().mockResolvedValue(Buffer.from("test")),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const generation = {
    createGenerationJob: vi.fn().mockResolvedValue({
      success: true,
      jobId: "gen-job-1",
      creditsCost: 2,
    }),
    createModificationJob: vi.fn().mockResolvedValue({
      success: true,
      jobId: "mod-job-1",
      creditsCost: 2,
    }),
    createAdvancedGenerationJob: vi.fn().mockResolvedValue({
      success: true,
      jobId: "adv-gen-job-1",
      creditsCost: 3,
    }),
    createReferenceGenerationJob: vi.fn().mockResolvedValue({
      success: true,
      jobId: "ref-gen-job-1",
      creditsCost: 3,
    }),
    describeImage: vi.fn().mockResolvedValue({
      description: "A detailed description",
      tags: ["tag1", "tag2"],
    }),
    extractPalette: vi.fn().mockResolvedValue({
      palette: ["#ffffff", "#000000"],
    }),
    compareImages: vi.fn().mockResolvedValue({
      comparison: {
        similarity: 0.95,
        differences: ["Slight color variation"],
      },
    }),
    removeBackground: vi.fn().mockResolvedValue({
      id: "bg-job-1",
      status: "PENDING",
      creditsCost: 1,
      imageId: "img-1",
    }),
  };

  const { resolvers, resolverMocks } = createMockResolvers();

  const deps: ImageStudioDeps = {
    db: db as unknown as ImageStudioDeps["db"],
    credits: credits as unknown as ImageStudioDeps["credits"],
    storage: storage as unknown as ImageStudioDeps["storage"],
    generation: generation as unknown as ImageStudioDeps["generation"],
    resolvers,
    nanoid: vi.fn().mockReturnValue("abc123nanoid"),
  };

  return { deps, mocks: { db, credits, storage, generation, resolverMocks } };
}
