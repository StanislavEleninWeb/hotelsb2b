import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 configuration. The connection URL moved out of schema.prisma:
//  - the CLI (migrate/db seed) reads it from `datasource.url` here;
//  - the runtime PrismaClient gets it via the pg driver adapter (see prisma.service.ts).
// Read straight from process.env (not prisma's `env()`, which throws when unset) so
// `prisma generate` — which never connects — succeeds in build/CI where DATABASE_URL
// is absent; migrate/seed still fail clearly if it's genuinely missing.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Our seed is plain ESM JS (not TS) — invoke it with node, not tsx.
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
