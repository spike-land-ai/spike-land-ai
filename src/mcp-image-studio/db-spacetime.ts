import {
    type DbConnection,
    typedTables as tables,
    typedReducers as reducers,
    type Image as SpacetimeImage,
    type EnhancementJob as SpacetimeEnhancementJob,
    type Album as SpacetimeAlbum,
    type AlbumImage as SpacetimeAlbumImage,
    type Pipeline as SpacetimePipeline,
    type GenerationJob as SpacetimeGenerationJob,
    type Subject as SpacetimeSubject,
} from "@spike-land-ai/spacetimedb-platform";
import {
    type ImageStudioDeps,
    type ImageRow,
    type EnhancementJobRow,
    type AlbumRow,
    type AlbumImageRow,
    type PipelineRow,
    type GenerationJobRow,
    type SubjectRow,
    type ImageId,
    type JobId,
    type PipelineId,
    type AlbumHandle,
    type EnhancementTier,
    type JobStatus,
    type AlbumPrivacy,
    type PipelineVisibility,
    type SubjectType,
    ImageStudioResolverError,
    errorResult,
    type ImageStudioResolvers,
} from "./types.js";

function fromMicros(micros: bigint): Date {
    return new Date(Number(micros) / 1000);
}

function toImageRow(row: SpacetimeImage): ImageRow {
    return {
        id: row.id as ImageId,
        userId: row.userIdentity.toHexString(),
        name: row.name,
        description: row.description || null,
        originalUrl: row.originalUrl,
        originalR2Key: row.originalR2Key,
        originalWidth: row.originalWidth,
        originalHeight: row.originalHeight,
        originalSizeBytes: Number(row.originalSizeBytes),
        originalFormat: row.originalFormat,
        isPublic: row.isPublic,
        viewCount: Number(row.viewCount),
        tags: row.tags,
        shareToken: row.shareToken || null,
        createdAt: fromMicros(row.createdAt),
        updatedAt: fromMicros(row.updatedAt),
    };
}

function toJobRow(row: SpacetimeEnhancementJob): EnhancementJobRow {
    return {
        id: row.id as JobId,
        imageId: row.imageId as ImageId,
        userId: row.userIdentity.toHexString(),
        tier: row.tier as EnhancementTier,
        creditsCost: Number(row.creditsCost),
        status: row.status as JobStatus,
        enhancedUrl: row.enhancedUrl || null,
        enhancedR2Key: row.enhancedR2Key || null,
        enhancedWidth: row.enhancedWidth || null,
        enhancedHeight: row.enhancedHeight || null,
        enhancedSizeBytes: row.enhancedSizeBytes ? Number(row.enhancedSizeBytes) : null,
        errorMessage: row.errorMessage || null,
        retryCount: row.retryCount,
        metadata: row.metadataJson ? JSON.parse(row.metadataJson) : null,
        processingStartedAt: row.processingStartedAt ? fromMicros(row.processingStartedAt) : null,
        processingCompletedAt: row.processingCompletedAt ? fromMicros(row.processingCompletedAt) : null,
        createdAt: fromMicros(row.createdAt),
        updatedAt: fromMicros(row.updatedAt),
    };
}

function toAlbumRow(row: SpacetimeAlbum): AlbumRow {
    return {
        id: row.id.toString(),
        handle: row.handle as AlbumHandle,
        userId: row.userIdentity.toHexString(),
        name: row.name,
        description: row.description || null,
        coverImageId: (row.coverImageId as ImageId) || null,
        privacy: row.privacy as AlbumPrivacy,
        defaultTier: row.defaultTier as EnhancementTier,
        shareToken: row.shareToken || null,
        sortOrder: row.sortOrder,
        pipelineId: (row.pipelineId as PipelineId) || null,
        createdAt: fromMicros(row.createdAt),
        updatedAt: fromMicros(row.updatedAt),
    };
}

function toAlbumImageRow(row: SpacetimeAlbumImage): AlbumImageRow {
    return {
        id: row.id.toString(),
        albumId: row.albumId.toString(),
        imageId: row.imageId as ImageId,
        sortOrder: row.sortOrder,
        addedAt: fromMicros(row.addedAt),
    };
}

function toPipelineRow(row: SpacetimePipeline): PipelineRow {
    return {
        id: row.id as PipelineId,
        name: row.name,
        description: row.description || null,
        userId: row.userIdentity ? row.userIdentity.toHexString() : null,
        visibility: row.visibility as PipelineVisibility,
        shareToken: row.shareToken || null,
        tier: row.tier as EnhancementTier,
        analysisConfig: row.analysisConfigJson ? JSON.parse(row.analysisConfigJson) : null,
        autoCropConfig: row.autoCropConfigJson ? JSON.parse(row.autoCropConfigJson) : null,
        promptConfig: row.promptConfigJson ? JSON.parse(row.promptConfigJson) : null,
        generationConfig: row.generationConfigJson ? JSON.parse(row.generationConfigJson) : null,
        usageCount: Number(row.usageCount),
        createdAt: fromMicros(row.createdAt),
        updatedAt: fromMicros(row.updatedAt),
    };
}

function toGenerationJobRow(row: SpacetimeGenerationJob): GenerationJobRow {
    return {
        id: row.id as JobId,
        userId: row.userIdentity.toHexString(),
        type: row.jobType as "GENERATE" | "MODIFY",
        tier: row.tier as EnhancementTier,
        creditsCost: Number(row.creditsCost),
        status: row.status as JobStatus,
        prompt: row.prompt,
        inputImageUrl: row.inputImageUrl || null,
        outputImageUrl: row.outputImageUrl || null,
        outputWidth: row.outputWidth || null,
        outputHeight: row.outputHeight || null,
        outputSizeBytes: row.outputSizeBytes ? Number(row.outputSizeBytes) : null,
        errorMessage: row.errorMessage || null,
        createdAt: fromMicros(row.createdAt),
        updatedAt: fromMicros(row.updatedAt),
    };
}

function toSubjectRow(row: SpacetimeSubject): SubjectRow {
    return {
        id: row.id.toString(),
        userId: row.userIdentity.toHexString(),
        imageId: row.imageId as ImageId,
        label: row.label,
        type: row.subjectType as SubjectType,
        description: row.description || null,
        createdAt: fromMicros(row.createdAt),
    };
}

export function createSpacetimeDb(_conn: DbConnection): ImageStudioDeps["db"] {
    return {
        async imageCreate(data) {
            reducers.imageCreate(
                data.userId,
                data.name,
                data.description || "",
                data.originalUrl,
                data.originalR2Key,
                data.originalWidth,
                data.originalHeight,
                BigInt(data.originalSizeBytes),
                data.originalFormat,
                data.isPublic,
                data.tags,
                data.shareToken || "",
            );

            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = Array.from(tables.image.iter()).find(
                    (img) => img.originalR2Key === data.originalR2Key && img.userIdentity.toHexString() === data.userId
                );
                if (found) return toImageRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for image creation");
        },

        async imageFindById(id) {
            const found = tables.image.id.find(id);
            return found ? toImageRow(found) : null;
        },

        async imageFindMany(opts) {
            let results = Array.from(tables.image.iter())
                .filter((img) => img.userIdentity.toHexString() === opts.userId)
                .map((img) => toImageRow(img));

            if (opts.search) {
                const q = opts.search.toLowerCase();
                results = results.filter(
                    (img) =>
                        img.name.toLowerCase().includes(q) ||
                        (img.description && img.description.toLowerCase().includes(q)) ||
                        img.tags.some((t) => t.toLowerCase().includes(q)),
                );
            }

            results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            if (opts.limit) {
                results = results.slice(0, opts.limit);
            }

            return results;
        },

        async imageDelete(id) {
            reducers.imageDelete(id);
        },

        async imageUpdate(id, data) {
            reducers.imageUpdate(
                id,
                data.name ?? "",
                data.description ?? "",
                data.tags ?? [],
                data.isPublic ?? false,
                data.shareToken ?? "",
            );
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = tables.image.id.find(id);
                if (found) return toImageRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for image update");
        },

        async imageCount(userId) {
            return Array.from(tables.image.iter()).filter((img) => img.userIdentity.toHexString() === userId)
                .length;
        },

        async jobCreate(data) {
            reducers.enhancementJobCreate(
                data.imageId,
                data.userId,
                data.tier,
                data.creditsCost,
                data.status,
                data.metadata ? JSON.stringify(data.metadata) : "",
            );
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = Array.from(tables.enhancement_job.iter()).find(
                    (j) => j.imageId === data.imageId && j.userIdentity.toHexString() === data.userId && j.status === data.status
                );
                if (found) return toJobRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for job creation");
        },

        async jobFindById(id) {
            const found = tables.enhancement_job.id.find(id);
            if (!found) return null;
            const row = toJobRow(found);
            const img = tables.image.id.find(found.imageId);
            return {
                ...row,
                image: img ? { id: img.id as ImageId, name: img.name, originalUrl: img.originalUrl } : undefined,
            };
        },

        async jobFindMany(opts) {
            let results = Array.from(tables.enhancement_job.iter()).filter(
                (j) => j.userIdentity.toHexString() === opts.userId,
            );
            if (opts.imageId) results = results.filter((j) => j.imageId === opts.imageId);
            if (opts.status) results = results.filter((j) => j.status === opts.status);

            let rows = results.map((j) => toJobRow(j));
            rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            if (opts.limit) rows = rows.slice(0, opts.limit);
            return rows;
        },

        async jobUpdate(id, data) {
            reducers.enhancementJobUpdate(
                id,
                data.status ?? "",
                data.enhancedUrl ?? "",
                data.enhancedR2Key ?? "",
                data.enhancedWidth ?? 0,
                data.enhancedHeight ?? 0,
                data.enhancedSizeBytes ? BigInt(data.enhancedSizeBytes) : 0n,
                data.errorMessage ?? "",
            );
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = tables.enhancement_job.id.find(id);
                if (found) return toJobRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for job update");
        },

        async albumCreate(data) {
            reducers.albumCreate(
                data.handle,
                data.userId,
                data.name,
                data.description || "",
                data.coverImageId || "",
                data.privacy,
                data.defaultTier,
                data.shareToken || "",
                data.sortOrder,
                data.pipelineId || "",
            );
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = tables.album.handle.find(data.handle);
                if (found) return toAlbumRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for album creation");
        },

        async albumFindByHandle(handle) {
            const found = tables.album.handle.find(handle);
            if (!found) return null;
            const row = toAlbumRow(found);
            const count = Array.from(tables.album_image.iter()).filter(
                (ai) => ai.albumId === found.id,
            ).length;
            return { ...row, _count: { albumImages: count } };
        },

        async albumFindById(id) {
            const found = tables.album.id.find(BigInt(id));
            if (!found) return null;
            const row = toAlbumRow(found);
            const count = Array.from(tables.album_image.iter()).filter(
                (ai) => ai.albumId === found.id,
            ).length;
            return { ...row, _count: { albumImages: count } };
        },

        async albumFindMany(opts) {
            const results = Array.from(tables.album.iter()).filter(
                (a) => a.userIdentity.toHexString() === opts.userId,
            );
            let rows = results.map((a) => {
                const row = toAlbumRow(a);
                const count = Array.from(tables.album_image.iter()).filter(
                    (ai) => ai.albumId === a.id,
                ).length;
                return { ...row, _count: { albumImages: count } };
            });
            rows.sort((a, b) => a.sortOrder - b.sortOrder);
            if (opts.limit) rows = rows.slice(0, opts.limit);
            return rows;
        },

        async albumUpdate(handle, data) {
            reducers.albumUpdate(
                handle,
                data.name ?? "",
                data.description ?? "",
                data.coverImageId ?? "",
                data.privacy ?? "",
                data.defaultTier ?? "",
                data.shareToken ?? "",
                data.sortOrder ?? 0,
                data.pipelineId ?? "",
            );
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = tables.album.handle.find(handle);
                if (found) return toAlbumRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for album update");
        },

        async albumDelete(handle) {
            reducers.albumDelete(handle);
        },

        async albumMaxSortOrder(userId) {
            const results = Array.from(tables.album.iter()).filter(
                (a) => a.userIdentity.toHexString() === userId,
            );
            if (results.length === 0) return 0;
            return Math.max(...results.map((a) => a.sortOrder));
        },

        async albumImageAdd(albumId, imageId, sortOrder) {
            reducers.albumImageAdd(BigInt(albumId), imageId, sortOrder);
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = Array.from(tables.album_image.iter()).find(
                    (ai) => ai.albumId === BigInt(albumId) && ai.imageId === imageId
                );
                if (found) return toAlbumImageRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            return null;
        },

        async albumImageRemove(albumId, imageIds) {
            let count = 0;
            for (const imageId of imageIds) {
                reducers.albumImageRemove(BigInt(albumId), imageId);
                count++;
            }
            return count;
        },

        async albumImageReorder(_albumId, _imageOrder) {
            // Not implemented in reducers yet
        },

        async albumImageList(albumId) {
            const results = Array.from(tables.album_image.iter()).filter(
                (ai) => ai.albumId === BigInt(albumId),
            );
            const rows = results.map((ai) => {
                const row = toAlbumImageRow(ai);
                const img = tables.image.id.find(ai.imageId);
                return {
                    ...row,
                    image: img
                        ? {
                            id: img.id as ImageId,
                            name: img.name,
                            originalUrl: img.originalUrl,
                            originalWidth: img.originalWidth,
                            originalHeight: img.originalHeight,
                        }
                        : {
                            id: ai.imageId as ImageId,
                            name: "Unknown",
                            originalUrl: "",
                            originalWidth: 0,
                            originalHeight: 0,
                        },
                };
            });
            rows.sort((a, b) => a.sortOrder - b.sortOrder);
            return rows;
        },

        async albumImageMaxSortOrder(albumId) {
            const results = Array.from(tables.album_image.iter()).filter(
                (ai) => ai.albumId === BigInt(albumId),
            );
            if (results.length === 0) return 0;
            return Math.max(...results.map((ai) => ai.sortOrder));
        },

        async pipelineCreate(data) {
            reducers.pipelineCreate(
                data.name,
                data.description || "",
                data.userId || "",
                data.visibility,
                data.tier,
                JSON.stringify(data.analysisConfig),
                JSON.stringify(data.autoCropConfig),
                JSON.stringify(data.promptConfig),
                JSON.stringify(data.generationConfig),
            );
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = Array.from(tables.pipeline.iter()).find(
                    (p) => p.name === data.name && (data.userId ? p.userIdentity && p.userIdentity.toHexString() === data.userId : !p.userIdentity)
                );
                if (found) return toPipelineRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for pipeline creation");
        },

        async pipelineFindById(id) {
            const found = tables.pipeline.id.find(id);
            if (!found) return null;
            const row = toPipelineRow(found);
            const count = Array.from(tables.album.iter()).filter((a) => a.pipelineId === id).length;
            return { ...row, _count: { albums: count } };
        },

        async pipelineFindMany(opts) {
            const results = Array.from(tables.pipeline.iter()).filter(
                (p) => p.userIdentity && p.userIdentity.toHexString() === opts.userId,
            );
            let rows = results.map((p) => toPipelineRow(p));
            rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            if (opts.limit) rows = rows.slice(0, opts.limit);
            return rows;
        },

        async pipelineUpdate(id, data) {
            reducers.pipelineUpdate(
                id,
                data.name ?? "",
                data.description ?? "",
                data.visibility ?? "",
                data.tier ?? "",
                data.analysisConfig ? JSON.stringify(data.analysisConfig) : "",
                data.autoCropConfig ? JSON.stringify(data.autoCropConfig) : "",
                data.promptConfig ? JSON.stringify(data.promptConfig) : "",
                data.generationConfig ? JSON.stringify(data.generationConfig) : "",
            );
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = tables.pipeline.id.find(id);
                if (found) return toPipelineRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for pipeline update");
        },

        async pipelineDelete(id) {
            reducers.pipelineDelete(id);
        },

        async generationJobCreate(data) {
            reducers.generationJobCreate(
                data.userId,
                data.type,
                data.tier,
                data.creditsCost,
                data.status,
                data.prompt,
            );
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = Array.from(tables.generation_job.iter()).find(
                    (j) => j.prompt === data.prompt && j.userIdentity.toHexString() === data.userId && j.status === data.status
                );
                if (found) return toGenerationJobRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for generation job creation");
        },

        async generationJobFindById(id) {
            const found = tables.generation_job.id.find(id);
            return found ? toGenerationJobRow(found) : null;
        },

        async generationJobUpdate(id, data) {
            reducers.generationJobUpdate(
                id,
                data.status ?? "",
                data.outputImageUrl ?? "",
                data.outputWidth ?? 0,
                data.outputHeight ?? 0,
                data.outputSizeBytes ? BigInt(data.outputSizeBytes) : 0n,
                data.errorMessage ?? "",
            );
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = tables.generation_job.id.find(id);
                if (found) return toGenerationJobRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for generation job update");
        },

        async subjectCreate(data) {
            reducers.subjectCreate(data.userId, data.imageId, data.label, data.type, data.description || "");
            const start = Date.now();
            while (Date.now() - start < 5000) {
                const found = Array.from(tables.subject.iter()).find(
                    (s) => s.imageId === data.imageId && s.label === data.label && s.userIdentity.toHexString() === data.userId
                );
                if (found) return toSubjectRow(found);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            throw new Error("Timeout waiting for subject creation");
        },

        async subjectFindMany(opts) {
            return Array.from(tables.subject.iter())
                .filter((s) => s.userIdentity.toHexString() === opts.userId)
                .map((s) => toSubjectRow(s));
        },

        async subjectDelete(id) {
            reducers.subjectDelete(BigInt(id));
        },

        async toolCallCreate(data) {
            reducers.recordPlatformEvent(
                "image-studio",
                "tool_call",
                JSON.stringify({
                    callId: data.id,
                    userId: data.userId,
                    toolName: data.toolName,
                    args: data.args,
                    status: data.status,
                    durationMs: data.durationMs,
                    isError: data.isError,
                }),
            );
            return data.id;
        },

        async toolCallUpdate(id, data) {
            reducers.recordPlatformEvent(
                "image-studio",
                "tool_call_update",
                JSON.stringify({
                    callId: id,
                    status: data.status,
                    durationMs: data.durationMs,
                    isError: data.isError,
                    result: data.result,
                }),
            );
        },
    };
}

export function createSpacetimeCredits(_conn: DbConnection): ImageStudioDeps["credits"] {
    return {
        async hasEnough(userId, amount) {
            const creds = Array.from(tables.credits.iter()).find(
                (c) => c.userIdentity.toHexString() === userId,
            );
            return (creds?.balance ?? 0n) >= BigInt(amount);
        },

        async consume(opts) {
            const creds = Array.from(tables.credits.iter()).find(
                (c) => c.userIdentity.toHexString() === opts.userId,
            );
            if (!creds || creds.balance < BigInt(opts.amount)) {
                return { success: false, remaining: Number(creds?.balance ?? 0n), error: "Insufficient balance" };
            }
            reducers.creditsConsume(BigInt(opts.amount));
            return { success: true, remaining: Number(creds.balance) - opts.amount };
        },

        async refund(userId, amount) {
            reducers.creditsAdd(userId, BigInt(amount));
            return true;
        },

        async getBalance(userId) {
            const creds = Array.from(tables.credits.iter()).find(
                (c) => c.userIdentity.toHexString() === userId,
            );
            return creds ? { remaining: Number(creds.balance) } : null;
        },

        estimate(tier, count = 1) {
            const BASE_COSTS: Record<EnhancementTier, number> = {
                FREE: 0,
                TIER_0_5K: 1,
                TIER_1K: 2,
                TIER_2K: 4,
                TIER_4K: 8,
            };
            return (BASE_COSTS[tier] || 0) * count;
        },

        calculateGenerationCost(opts) {
            const BASE_COSTS: Record<EnhancementTier, number> = {
                FREE: 0,
                TIER_0_5K: 1,
                TIER_1K: 2,
                TIER_2K: 4,
                TIER_4K: 8,
            };
            let cost = (BASE_COSTS[opts.tier] || 0) * (opts.numImages || 1);
            if (opts.hasGrounding) cost += 2;
            if (opts.hasTextRender) cost += 1;
            if (opts.numSubjects) cost += opts.numSubjects * 5;
            if (opts.numReferences) cost += opts.numReferences * 2;
            return cost;
        },
    };
}

export function createSpacetimeResolvers(
    db: ImageStudioDeps["db"],
    userId: string,
): ImageStudioResolvers {
    return {
        async resolveImage(id) {
            const img = await db.imageFindById(id);
            if (!img) {
                throw new ImageStudioResolverError(errorResult("IMAGE_NOT_FOUND", `Image ${id} not found`));
            }
            return img;
        },
        async resolveAlbum(handle) {
            const album = await db.albumFindByHandle(handle);
            if (!album) {
                throw new ImageStudioResolverError(errorResult("ALBUM_NOT_FOUND", `Album ${handle} not found`));
            }
            return album;
        },
        async resolvePipeline(id, opts) {
            const pipeline = await db.pipelineFindById(id);
            if (!pipeline) {
                throw new ImageStudioResolverError(
                    errorResult("PIPELINE_NOT_FOUND", `Pipeline ${id} not found`),
                );
            }
            if (opts?.requireOwnership && pipeline.userId !== userId) {
                throw new ImageStudioResolverError(
                    errorResult("UNAUTHORIZED", "You do not own this pipeline"),
                );
            }
            return pipeline;
        },
        async resolveJob(id) {
            const job = await db.jobFindById(id);
            if (!job) {
                throw new ImageStudioResolverError(errorResult("NOT_FOUND", `Job ${id} not found`));
            }
            return job;
        },
        async resolveGenerationJob(id) {
            const job = await db.generationJobFindById(id);
            if (!job) {
                throw new ImageStudioResolverError(errorResult("NOT_FOUND", `Job ${id} not found`));
            }
            return job;
        },
        async resolveImages(ids) {
            const results = await Promise.all(ids.map((id) => db.imageFindById(id)));
            const found = results.filter((img): img is ImageRow => img !== null);
            if (found.length !== ids.length) {
                throw new ImageStudioResolverError(
                    errorResult("IMAGES_NOT_FOUND", "One or more images not found"),
                );
            }
            return found;
        },
    };
}
