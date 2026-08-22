import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output keeps the production Docker image minimal.
  output: "standalone",
  // Security headers (CSP etc.) are added in Phase 5 via middleware — see CLAUDE.md §5.2.
};

export default nextConfig;
