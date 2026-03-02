import { createMockImageStudioDeps } from "./mock-deps.js";
import type { ToolContext } from "../types.js";

/**
 * A test utility that wraps a tool handler, automatically providing
 * a mocked ToolContext. This removes boilerplate like `beforeEach` from tests.
 *
 * @param handler The tool's main handler function to test
 * @param input The validated Zod input arguments for the tool
 * @param userId Optional userId to use in context (defaults to "u1")
 * @returns { result, mocks, deps }
 */
export async function runTool<TInput, TResult>(
  handler: (input: TInput, ctx: ToolContext) => Promise<TResult>,
  input: TInput,
  userId = "u1",
  setupMocks?: (
    mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"],
    deps: ToolContext["deps"],
  ) => void | Promise<void>,
) {
  const { deps, mocks } = createMockImageStudioDeps();
  if (setupMocks) {
    await setupMocks(mocks, deps);
  }

  const ctx: ToolContext = { userId, deps };

  const result = await handler(input, ctx);

  return { result, mocks, deps };
}
