/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  // Disable React strict mode for API routes
  reactStrictMode: false,
  // Disable image optimization since this is API-only
  images: {
    unoptimized: true,
  },
  // Custom webpack config if needed
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig;