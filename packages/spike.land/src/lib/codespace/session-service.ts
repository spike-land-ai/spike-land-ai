import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { publishSSEEvent, redis } from "@/lib/upstash";
import { DEFAULT_TEMPLATE } from "./default-template";
import { computeSessionHash } from "./hash-utils";
import type { CodeVersion, ICodeSession, Message } from "./types";

const SESSION_CACHE_TTL = 30; // 30 seconds

export class SessionService {
  private static getCacheKey(codeSpace: string) {
    return `codespace:session:${codeSpace}`;
  }

  /**
   * Get a session by codeSpace name.
   * Checks Redis cache first, then PostgreSQL.
   */
  static async getSession(codeSpace: string): Promise<ICodeSession | null> {
    const cacheKey = this.getCacheKey(codeSpace);

    // Try cache first
    try {
      const cached = await redis.get<ICodeSession>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      logger.error(`[SessionService] Redis error for ${codeSpace}`, {
        error: e,
      });
    }

    // Fallback to PostgreSQL
    const dbSession = await prisma.codespaceSession.findUnique({
      where: { codeSpace },
    });

    if (!dbSession) {
      return null;
    }

    const session: ICodeSession = {
      code: dbSession.code,
      codeSpace: dbSession.codeSpace,
      transpiled: dbSession.transpiled,
      html: dbSession.html,
      css: dbSession.css,
      requiresReRender: dbSession.requiresReRender,
      messages: (dbSession.messages as unknown as Message[]) || [],
      hash: dbSession.hash,
    };

    // Cache the session
    try {
      await redis.set(cacheKey, session, { ex: SESSION_CACHE_TTL });
    } catch (e) {
      logger.error(
        `[SessionService] Failed to cache session for ${codeSpace}`,
        { error: e },
      );
    }

    return session;
  }

  /**
   * Check if a codespace session is healthy (has real code and is transpiled).
   * This is a lightweight version of getSession that only fetches required fields.
   */
  static async checkSessionHealth(codeSpace: string): Promise<boolean> {
    const cacheKey = `codespace:health:${codeSpace}`;

    // Try cache first
    try {
      const cached = await redis.get<boolean>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    } catch (e) {
      logger.error(
        `[SessionService] Redis error for ${codeSpace} health check`,
        { error: e },
      );
    }

    // Fallback to PostgreSQL
    // Use raw SQL to avoid fetching megabytes of uncompressed text into the Node.js process
    const result = await prisma.$queryRaw<{ is_healthy: boolean; }[]>`
      SELECT 
        (LENGTH(code) > 100 AND 
         LENGTH(transpiled) > 0 AND 
         code NOT LIKE '%404 - for now%' AND 
         transpiled NOT LIKE '%404 - for now%') as "is_healthy"
      FROM codespace_sessions 
      WHERE "codeSpace" = ${codeSpace}
      LIMIT 1
    `;

    if (!result || result.length === 0 || !result[0]) {
      return false;
    }

    const healthy = Boolean(result[0].is_healthy);

    // Cache the health status
    try {
      await redis.set(cacheKey, healthy, { ex: SESSION_CACHE_TTL });
    } catch (e) {
      logger.error(`[SessionService] Failed to cache health for ${codeSpace}`, {
        error: e,
      });
    }

    return healthy;
  }

  /**
   * Batch check if multiple codespace sessions are healthy.
   * This reduces N+1 queries when filtering lists of apps.
   */
  static async checkSessionsHealth(
    codeSpaces: string[],
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    if (codeSpaces.length === 0) return results;

    const uniqueSpaces = Array.from(new Set(codeSpaces));
    const keys = uniqueSpaces.map(cs => `codespace:health:${cs}`);

    // Try cache first
    let cached: (boolean | null)[] = [];
    try {
      const raw = await redis.mget<boolean[]>(...keys);
      cached = Array.isArray(raw) ? raw : new Array(uniqueSpaces.length).fill(null);
    } catch (e) {
      logger.error(`[SessionService] Redis error for batch health check`, {
        error: e,
      });
      cached = new Array(uniqueSpaces.length).fill(null);
    }

    const missing: string[] = [];

    uniqueSpaces.forEach((cs, i) => {
      const val = cached[i];
      if (val !== null && val !== undefined) {
        results.set(cs, val);
      } else {
        missing.push(cs);
      }
    });

    if (missing.length === 0) {
      return results;
    }

    // Fallback to DB
    try {
      const dbResults = await prisma.$queryRaw<
        { codeSpace: string; is_healthy: boolean; }[]
      >`
        SELECT
          "codeSpace",
          (LENGTH(code) > 100 AND
           LENGTH(transpiled) > 0 AND
           code NOT LIKE '%404 - for now%' AND
           transpiled NOT LIKE '%404 - for now%') as "is_healthy"
        FROM codespace_sessions
        WHERE "codeSpace" IN (${Prisma.join(missing)})
      `;

      const dbMap = new Map<string, boolean>();
      if (dbResults) {
        dbResults.forEach(row => {
          dbMap.set(row.codeSpace, Boolean(row.is_healthy));
          results.set(row.codeSpace, Boolean(row.is_healthy));
        });
      }

      // Update Redis (use individual set calls - the async proxy doesn't support pipeline()) - Cache block cleared
      const cacheUpdates: Promise<unknown>[] = [];

      missing.forEach(cs => {
        // If not in DB map, it means it doesn't exist, so unhealthy
        const isHealthy = dbMap.get(cs) ?? false;

        // Also update results map for those missing from DB
        if (!results.has(cs)) {
          results.set(cs, isHealthy);
        }

        cacheUpdates.push(
          redis.set(`codespace:health:${cs}`, isHealthy, {
            ex: SESSION_CACHE_TTL,
          }),
        );
      });

      if (cacheUpdates.length > 0) {
        await Promise.all(cacheUpdates);
      }
    } catch (e) {
      logger.error(`[SessionService] DB error for batch health check`, {
        error: e,
      });
      // If DB fails, assume unhealthy for missing ones to be safe
      missing.forEach(cs => {
        if (!results.has(cs)) results.set(cs, false);
      });
    }

    return results;
  }

  /**
   * Initialize a new session with the default template.
   */
  static async initializeSession(codeSpace: string): Promise<ICodeSession> {
    const session: ICodeSession = {
      ...DEFAULT_TEMPLATE,
      codeSpace,
    };

    const hash = computeSessionHash(session);

    await prisma.codespaceSession.upsert({
      where: { codeSpace },
      update: {
        code: session.code,
        transpiled: session.transpiled,
        html: session.html,
        css: session.css,
        hash,
        messages: session.messages as unknown as Prisma.InputJsonValue,
        ...(session.requiresReRender !== undefined ? { requiresReRender: session.requiresReRender } : {}),
      },
      create: {
        codeSpace,
        code: session.code,
        transpiled: session.transpiled,
        html: session.html,
        css: session.css,
        hash,
        messages: session.messages as unknown as Prisma.InputJsonValue,
        ...(session.requiresReRender !== undefined ? { requiresReRender: session.requiresReRender } : {}),
      },
    });

    // Invalidate cache
    await redis.del(this.getCacheKey(codeSpace));

    return { ...session, hash };
  }

  /**
   * Get or create a session.
   */
  static async getOrCreateSession(codeSpace: string): Promise<ICodeSession> {
    const session = await this.getSession(codeSpace);
    if (session) {
      return session;
    }
    return this.initializeSession(codeSpace);
  }

  /**
   * Upsert a session with provided data.
   */
  static async upsertSession(session: ICodeSession): Promise<ICodeSession> {
    const { codeSpace } = session;
    const hash = computeSessionHash(session);

    await prisma.codespaceSession.upsert({
      where: { codeSpace },
      update: {
        code: session.code,
        transpiled: session.transpiled,
        html: session.html,
        css: session.css,
        hash,
        messages: session.messages as unknown as Prisma.InputJsonValue,
        ...(session.requiresReRender !== undefined ? { requiresReRender: session.requiresReRender } : {}),
      },
      create: {
        codeSpace,
        code: session.code,
        transpiled: session.transpiled,
        html: session.html,
        css: session.css,
        hash,
        messages: session.messages as unknown as Prisma.InputJsonValue,
        ...(session.requiresReRender !== undefined ? { requiresReRender: session.requiresReRender } : {}),
      },
    });

    // Invalidate cache
    await redis.del(this.getCacheKey(codeSpace));

    return session;
  }

  /**
   * Update an existing session.
   * Performs an optimistic lock using the expected hash.
   */
  static async updateSession(
    codeSpace: string,
    newSession: ICodeSession,
    expectedHash: string,
  ): Promise<{ success: boolean; session?: ICodeSession; error?: string; }> {
    const newHash = computeSessionHash(newSession);

    // Update with optimistic locking
    const updateResult = await prisma.codespaceSession.updateMany({
      where: {
        codeSpace,
        hash: expectedHash,
      },
      data: {
        code: newSession.code,
        transpiled: newSession.transpiled,
        html: newSession.html,
        css: newSession.css,
        hash: newHash,
        messages: newSession.messages as unknown as Prisma.InputJsonValue,
        requiresReRender: newSession.requiresReRender ?? false,
      },
    });

    if (updateResult.count === 0) {
      // Optimistic lock failure: either codespace doesn't exist or hash mismatched
      const current = await prisma.codespaceSession.findUnique({
        where: { codeSpace },
      });

      if (!current) {
        return { success: false, error: "Codespace not found" };
      }

      return {
        success: false,
        error: "Conflict: Hash mismatch",
        session: {
          code: current.code,
          codeSpace: current.codeSpace,
          transpiled: current.transpiled,
          html: current.html,
          css: current.css,
          requiresReRender: current.requiresReRender,
          messages: (current.messages as unknown as Message[]) || [],
          hash: current.hash,
        },
      };
    }

    // Invalidate cache
    await redis.del(this.getCacheKey(codeSpace));

    // Broadcast the update for real-time sync
    // If this codespace is linked to an app, we use that for broadcasting
    // Fetch once to check for appId if not already present (optimization: check newSession first)
    const appId = newSession.appId
      || (await prisma.codespaceSession.findUnique({
        where: { codeSpace },
        select: { appId: true },
      }))?.appId;

    const broadcastId = appId || `codespace:${codeSpace}`;

    publishSSEEvent(broadcastId, {
      type: "code_updated",
      data: {
        reloadRequired: true,
        codeSpace,
        appId,
      },
      timestamp: Date.now(),
    }).catch(err => {
      logger.error(
        `[SessionService] Failed to broadcast update for ${codeSpace}`,
        { error: err },
      );
    });

    return { success: true, session: { ...newSession, hash: newHash } };
  }

  /**
   * Create an immutable snapshot of the current session state.
   */
  static async saveVersion(codeSpace: string): Promise<CodeVersion | null> {
    const session = await prisma.codespaceSession.findUnique({
      where: { codeSpace },
    });

    if (!session) return null;

    // Get current version number
    const maxVersion = await prisma.codespaceVersion.findFirst({
      where: { sessionId: session.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    const nextNumber = (maxVersion?.number || 0) + 1;

    const version = await prisma.codespaceVersion.create({
      data: {
        sessionId: session.id,
        number: nextNumber,
        code: session.code,
        transpiled: session.transpiled,
        html: session.html,
        css: session.css,
        hash: session.hash,
      },
    });

    return {
      number: version.number,
      code: version.code,
      transpiled: version.transpiled,
      html: version.html,
      css: version.css,
      hash: version.hash,
      createdAt: version.createdAt.getTime(),
    };
  }

  /**
   * Get a specific version of a codespace.
   */
  static async getVersion(
    codeSpace: string,
    number: number,
  ): Promise<CodeVersion | null> {
    const version = await prisma.codespaceVersion.findFirst({
      where: {
        session: { codeSpace },
        number,
      },
    });

    if (!version) return null;

    return {
      number: version.number,
      code: version.code,
      transpiled: version.transpiled,
      html: version.html,
      css: version.css,
      hash: version.hash,
      createdAt: version.createdAt.getTime(),
    };
  }

  /**
   * List all versions for a codespace.
   */
  static async getVersionsList(
    codeSpace: string,
  ): Promise<Array<{ number: number; hash: string; createdAt: number; }>> {
    const versions = await prisma.codespaceVersion.findMany({
      where: {
        session: { codeSpace },
      },
      orderBy: { number: "desc" },
      select: {
        number: true,
        hash: true,
        createdAt: true,
      },
    });

    return versions.map(v => ({
      number: v.number,
      hash: v.hash,
      createdAt: v.createdAt.getTime(),
    }));
  }
}

export const getSession = SessionService.getSession.bind(SessionService);
export const checkSessionHealth = SessionService.checkSessionHealth.bind(
  SessionService,
);
export const checkSessionsHealth = SessionService.checkSessionsHealth.bind(
  SessionService,
);
export const initializeSession = SessionService.initializeSession.bind(
  SessionService,
);
export const getOrCreateSession = SessionService.getOrCreateSession.bind(
  SessionService,
);
export const updateSession = SessionService.updateSession.bind(SessionService);
export const upsertSession = SessionService.upsertSession.bind(SessionService);
export const saveVersion = SessionService.saveVersion.bind(SessionService);
export const getVersion = SessionService.getVersion.bind(SessionService);
export const getVersionsList = SessionService.getVersionsList.bind(
  SessionService,
);
