/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['pg', 'pg-cloudflare', '@glapi/database'],
  },
  // Disable React strict mode for API routes
  reactStrictMode: false,
  // Disable image optimization since this is API-only
  images: {
    unoptimized: true,
  },
  // Custom webpack config to handle cloudflare:sockets
  webpack: (config, { isServer, nextRuntime }) => {
    // Only apply these rules for Node.js runtime (not edge)
    if (isServer && nextRuntime === 'nodejs') {
      // Mock cloudflare:sockets to prevent import errors
      config.resolve.alias = {
        ...config.resolve.alias,
        'cloudflare:sockets': false,
        'pg-cloudflare': false,
      };
      
      // Exclude problematic modules from bundling
      config.externals = [...(config.externals || []), 'pg-cloudflare'];
    }
    
    return config;
  },
};

module.exports = nextConfig;