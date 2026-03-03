import {
  type AlbumHandle,
  type ImageId,
  type JobId,
  type PipelineId,
  type ImageStudioDeps,
  type ImageStudioResolvers,
  ImageStudioResolverError,
  errorResult,
} from "@spike-land-ai/mcp-image-studio";

export function createResolvers(db: ImageStudioDeps["db"], userId: string): ImageStudioResolvers {
  return {
    async resolveImage(id: ImageId) {
      const img = await db.imageFindById(id);
      if (!img) {
        throw new ImageStudioResolverError(errorResult("IMAGE_NOT_FOUND", `Image ${id} not found`));
      }
      if (img.userId !== userId) {
        throw new ImageStudioResolverError(
          errorResult("UNAUTHORIZED", `Image ${id} does not belong to you`),
        );
      }
      return img;
    },

    async resolveAlbum(handle: AlbumHandle) {
      const album = await db.albumFindByHandle(handle);
      if (!album) {
        throw new ImageStudioResolverError(
          errorResult("ALBUM_NOT_FOUND", `Album ${handle} not found`),
        );
      }
      if (album.userId !== userId) {
        throw new ImageStudioResolverError(
          errorResult("UNAUTHORIZED", `Album ${handle} does not belong to you`),
        );
      }
      return album;
    },

    async resolvePipeline(id: PipelineId, opts?: { requireOwnership?: boolean }) {
      const pipeline = await db.pipelineFindById(id);
      if (!pipeline) {
        throw new ImageStudioResolverError(
          errorResult("PIPELINE_NOT_FOUND", `Pipeline ${id} not found`),
        );
      }
      if (opts?.requireOwnership !== false && pipeline.userId !== userId) {
        throw new ImageStudioResolverError(
          errorResult("UNAUTHORIZED", `Pipeline ${id} does not belong to you`),
        );
      }
      return pipeline;
    },

    async resolveJob(id: JobId) {
      const job = await db.jobFindById(id);
      if (!job) {
        throw new ImageStudioResolverError(errorResult("NOT_FOUND", `Job ${id} not found`));
      }
      if (job.userId !== userId) {
        throw new ImageStudioResolverError(
          errorResult("UNAUTHORIZED", `Job ${id} does not belong to you`),
        );
      }
      return job;
    },

    async resolveGenerationJob(id: JobId) {
      const job = await db.generationJobFindById(id);
      if (!job) {
        throw new ImageStudioResolverError(
          errorResult("NOT_FOUND", `Generation job ${id} not found`),
        );
      }
      if (job.userId !== userId) {
        throw new ImageStudioResolverError(
          errorResult("UNAUTHORIZED", `Generation job ${id} does not belong to you`),
        );
      }
      return job;
    },

    async resolveImages(ids: ImageId[]) {
      const results = await Promise.all(
        ids.map(async (id) => {
          const img = await db.imageFindById(id);
          if (!img) {
            throw new ImageStudioResolverError(
              errorResult("IMAGE_NOT_FOUND", `Image ${id} not found`),
            );
          }
          if (img.userId !== userId) {
            throw new ImageStudioResolverError(
              errorResult("UNAUTHORIZED", `Image ${id} does not belong to you`),
            );
          }
          return img;
        }),
      );
      return results;
    },
  };
}
