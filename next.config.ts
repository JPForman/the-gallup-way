import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Vercel Hobby caps image transformations at 5,000/month. Images are
  // compressed in the browser before upload instead (see CLAUDE.md).
  images: { unoptimized: true },
};

export default nextConfig;
