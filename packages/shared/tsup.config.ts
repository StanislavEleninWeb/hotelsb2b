import { defineConfig } from "tsup";

// Dual CJS + ESM build so NestJS (CommonJS) and Next.js (ESM) both resolve
// @hotel/shared cleanly via the package "exports" map. See CLAUDE.md.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
