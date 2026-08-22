import { defineConfig } from "tsup";

// Dual CJS + ESM build so NestJS (CommonJS) and Next.js (ESM) both resolve
// @hotel/shared cleanly via the package "exports" map. See CLAUDE.md.
export default defineConfig({
  // security is a separate entry so Edge-runtime middleware can import it without
  // pulling in Zod (which the Next Edge runtime rejects for dynamic code-gen).
  entry: ["src/index.ts", "src/security.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
