import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  sourcemap: true,
  noExternal: [
    '@glapi/trpc',
    '@glapi/auth',
    '@glapi/database',
    '@glapi/api-service',
    '@glapi/business',
    '@glapi/shared-types',
    '@glapi/types',
  ],
  external: [
    '@mapbox/node-pre-gyp',
    '@tensorflow/tfjs',
    '@tensorflow/tfjs-node',
    'aws-sdk',
    'mock-aws-s3',
    'nock',
  ],
});
