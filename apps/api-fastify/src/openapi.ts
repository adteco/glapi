import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPublicApiBaseUrl } from './config';

export function generateRuntimeOpenApiSpec() {
  const baseUrl = getPublicApiBaseUrl().replace(/\/$/, '');
  const spec = loadGeneratedOpenApiSpec();

  spec.servers = [
    {
      url: `${baseUrl}/api`,
      description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Runtime server',
    },
  ];

  return spec;
}

function loadGeneratedOpenApiSpec() {
  for (const candidate of getOpenApiCandidates()) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8'));
    }
  }

  throw new Error(
    `Generated OpenAPI spec not found. Run pnpm --filter @glapi/trpc generate:openapi before starting the Fastify API. Checked: ${getOpenApiCandidates().join(', ')}`
  );
}

function getOpenApiCandidates(): string[] {
  return [
    resolve(process.cwd(), 'apps/docs/public/api/openapi.json'),
    resolve(process.cwd(), '../docs/public/api/openapi.json'),
    resolve(process.cwd(), '../../apps/docs/public/api/openapi.json'),
    resolve(__dirname, '../../../apps/docs/public/api/openapi.json'),
  ];
}
