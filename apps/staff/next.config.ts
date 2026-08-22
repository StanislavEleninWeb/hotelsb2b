import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Security headers (CSP etc.) added in Phase 6 via middleware — see CLAUDE.md §5.2.
};

export default nextConfig;
