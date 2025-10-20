import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Allow builds to succeed even with TypeScript errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allow builds to succeed even with ESLint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
