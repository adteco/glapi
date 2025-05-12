/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle the cloudflare:sockets import
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'cloudflare:sockets': false, // Fallback to an empty module
      'pg-native': false,          // Also handle pg-native import
    };

    return config;
  },
  // Proxy API requests in development to avoid CORS issues
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*'
      }
    ]
  }
};

export default nextConfig;