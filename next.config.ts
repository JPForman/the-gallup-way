import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the project root (a parent folder has its own lockfile).
  outputFileTracingRoot: __dirname,
  // Vercel Hobby caps image transformations at 5,000/month. Images are
  // compressed in the browser before upload instead (see CLAUDE.md).
  images: { unoptimized: true },
};

export default nextConfig;
