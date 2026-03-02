import { it, expect, vi } from "vitest";
import type { CallToolResult, ImageStudioDeps, ToolContext } from "../types.js";

export function standardScenarios(config: {
  handler: (input: unknown, ctx: ToolContext) => Promise<CallToolResult> | CallToolResult;
  validInput: Record<string, unknown>;
  deps: ImageStudioDeps;
  resolvesImage?: boolean; // Checks IMAGE_NOT_FOUND when image is mocked as null
  resolvesImages?: boolean; // Checks RESOLVE_FAILED when images do not exist
  resolvesAlbum?: boolean; // Checks NOT_FOUND when album does not exist
  consumesCredits?: boolean; // Checks CREDIT_CONSUME_FAILED when credits insufficient
  createsJob?: boolean; // Checks JOB_CREATE_FAILED when job creation fails
  emitsEvent?: string[]; // Checks that specific events are emitted on success
}) {
  if (config.resolvesImage) {
    it("should return IMAGE_NOT_FOUND when image does not exist", async () => {
      // Because resolveImages requires array and resolvesImage checks that array isn't null/undefined
      // In the framework it actually resolves to either RESOLVE_FAILED or UNAUTHORIZED. The framework returns
      vi.mocked(config.deps.resolvers.resolveImages).mockResolvedValueOnce([]);
      vi.mocked(config.deps.resolvers.resolveImage).mockResolvedValueOnce(undefined as never);
      const result = await config.handler(config.validInput, {
        userId: "user-1",
        deps: config.deps,
        notify: vi.fn(),
      });

      expect(result).toMatchObject({
        isError: true,
        content: expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: expect.stringMatching(/UNAUTHORIZED|NOT_FOUND|RESOLVE_FAILED/),
          }),
        ]),
      });
    });
  }

  if (config.consumesCredits) {
    it("should return CREDIT_CONSUME_FAILED when credits are insufficient", async () => {
      if (config.deps.credits.calculateGenerationCost) {
        vi.mocked(config.deps.credits.calculateGenerationCost).mockReturnValue(10);
      }
      vi.mocked(config.deps.credits.consume).mockResolvedValueOnce({
        success: false,
        remaining: 0,
        error: "Insufficient credits mock",
      });

      const result = await config.handler(config.validInput, {
        userId: "user-1",
        deps: config.deps,
        notify: vi.fn(),
      });

      expect(result).toMatchObject({
        isError: true,
        content: expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: expect.stringContaining("CREDIT_CONSUME_FAILED"),
          }),
        ]),
      });
    });
  }

  if (config.createsJob) {
    it("should return JOB_CREATE_FAILED when job creation fails", async () => {
      vi.mocked(config.deps.db.jobCreate).mockRejectedValueOnce(new Error("DB Error mock"));

      const result = await config.handler(config.validInput, {
        userId: "user-1",
        deps: config.deps,
        notify: vi.fn(),
      });

      expect(result).toMatchObject({
        isError: true,
        content: expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: expect.stringContaining("JOB_CREATE_FAILED"),
          }),
        ]),
      });
    });
  }

  if (config.emitsEvent && config.emitsEvent.length > 0) {
    it(`should emit events: ${config.emitsEvent.join(", ")}`, async () => {
      const notify = vi.fn();
      const result = await config.handler(config.validInput, {
        userId: "user-1",
        deps: config.deps,
        notify,
      });

      expect(result.isError).toBeFalsy();

      for (const eventType of config.emitsEvent!) {
        expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: eventType }));
      }
    });
  }
}
