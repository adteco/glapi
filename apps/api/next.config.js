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
  // Custom webpack config to handle cloudflare:sockets and TensorFlow
  webpack: (config, { isServer, nextRuntime }) => {
    // Only apply these rules for Node.js runtime (not edge)
    if (isServer && nextRuntime === 'nodejs') {
      // Mock cloudflare:sockets and TensorFlow-related modules to prevent import errors
      config.resolve.alias = {
        ...config.resolve.alias,
        'cloudflare:sockets': false,
        'pg-cloudflare': false,
        '@tensorflow/tfjs-node': false,
        '@mapbox/node-pre-gyp': false,
      };
      
      // Exclude problematic modules from bundling
      config.externals = [
        ...(config.externals || []), 
        'pg-cloudflare',
        '@tensorflow/tfjs-node',
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-core',
        '@tensorflow/tfjs-layers',
        '@tensorflow/tfjs-converter',
        '@tensorflow/tfjs-backend-cpu',
        '@tensorflow/tfjs-backend-webgl',
        '@mapbox/node-pre-gyp',
        'aws-sdk',
        'mock-aws-s3',
        'nock',
      ];
    }
    
    return config;
  },
};

module.exports = nextConfig;