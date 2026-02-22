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
  // Externalize Node.js native modules that cause issues during build
  // (TensorFlow.js dependencies like @mapbox/node-pre-gyp try to require 'nock')
  serverExternalPackages: [
    '@tensorflow/tfjs-node',
    '@mapbox/node-pre-gyp',
    'nock',
  ],
};

export default nextConfig;
