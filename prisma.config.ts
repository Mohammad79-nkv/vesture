import { defineConfig } from "prisma/config";
import "dotenv/config";

// In Prisma 7 the migration engine uses `datasource.url` directly, while the
// runtime client uses the driver adapter in lib/adapters/prisma.ts. We feed
// migrations the unpooled DIRECT_URL so DDL bypasses the connection pooler.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
