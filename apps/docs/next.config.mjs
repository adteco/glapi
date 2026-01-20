import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,

  async redirects() {
    return [
      // Redirect old quickstart path to new location
      {
        source: '/quickstart',
        destination: '/docs/quickstart',
        permanent: true,
      },
      // Redirect old getting-started path
      {
        source: '/getting-started',
        destination: '/docs/getting-started',
        permanent: true,
      },
      // Redirect old API paths (without /docs prefix)
      {
        source: '/api/:path*',
        destination: '/docs/api/:path*',
        permanent: true,
      },
      // Redirect root docs to index
      {
        source: '/documentation',
        destination: '/docs',
        permanent: true,
      },
      // Future: Redirect versioned paths when versions are added
      // Example for v2:
      // {
      //   source: '/docs/v1/:path*',
      //   destination: '/docs/v1/:path*',
      //   permanent: false,
      // },
    ];
  },
};

export default withMDX(config);
