import { tryCatch } from "./packages/mcp-image-studio/src/tools/try-catch.ts";
async function test() {
  const r = await tryCatch(Promise.resolve(1));
  if (!r.ok) {
    console.log(r.error.message);
  }
}
