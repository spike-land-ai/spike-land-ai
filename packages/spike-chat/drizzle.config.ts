import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../../src/edge-api/spike-chat/db/schema.ts",
  out: "../../src/edge-api/spike-chat/db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
