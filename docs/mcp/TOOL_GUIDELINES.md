# MCP Tool Error Handling Guidelines

**Pattern**: `tryCatch` wrapper for consistent error handling and type safety in
MCP Tools.

## Why this Pattern?

Instead of scattered `try...catch` blocks within our MCP tool definitions, we
use a centralized `tryCatch` utility. This provides:

- **Type Safety:** Returns a discriminated union (`Result<T>`) for strict
  TypeScript checking.
- **Consistency:** Ensures no unhandled exceptions leak from business logic.
- **Clean Code:** Reduces boilerplate, making tool logic easier to read and
  maintain.

## The Standard Flow

1. **Input Interface**: Define what your tool expects.
2. **Execution**: Wrap business logic (like DB calls or network requests) in
   `await tryCatch(promise)`.
3. **Error Handling**: Check `!result.ok` and return
   `errorResult(code, message)`.
4. **Success**: Process `result.data` and return `jsonResult(data)`.

### Example

```typescript
import { tryCatch } from "./try-catch.js";
import {
  type CallToolResult,
  errorResult,
  jsonResult,
  type ToolContext,
} from "../types.js";

export interface MyToolInput {
  limit?: number;
}

export async function myTool(
  input: MyToolInput,
  ctx: ToolContext,
): Promise<CallToolResult> {
  const result = await tryCatch(ctx.deps.db.fetchData(input));

  if (!result.ok) {
    // result.error is strongly typed as Error
    return errorResult("FETCH_FAILED", result.error.message);
  }

  // result.data is strongly typed
  return jsonResult({ items: result.data });
}
```

---

> 📝 **Continuous Improvement** We encourage agents and developers to
> continually improve these guidelines.
> [✏️ Edit this document on GitHub](https://github.com/spike-land-ai/spike.land/edit/main/docs/architecture/MCP_TOOL_GUIDELINES.md)
