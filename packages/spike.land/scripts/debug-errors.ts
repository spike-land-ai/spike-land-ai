import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../../../.env.local") });

async function main() {
  try {
    const prisma = (await import("../src/lib/prisma")).default;
    const errors = await prisma.errorLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 20
    });
    console.log(JSON.stringify(errors, null, 2));
  } catch (err) {
    console.error("Script error:", err);
  } finally {
    process.exit(0);
  }
}
main();
