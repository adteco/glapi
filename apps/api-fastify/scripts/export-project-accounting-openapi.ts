import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateRuntimeOpenApiSpec } from '../src/openapi';

const outputPath = resolve(process.argv[2] ?? '/tmp/glapi-project-accounting.openapi.json');
const runtime = generateRuntimeOpenApiSpec();
const paths = Object.fromEntries(
  Object.entries(runtime.paths ?? {}).filter(([path]) =>
    path.startsWith('/v1/project-billing/') || path.startsWith('/v1/project-revenue/'),
  ),
);
const schemas = Object.fromEntries(
  Object.entries(runtime.components?.schemas ?? {}).filter(([name]) =>
    name.startsWith('Project') || name === 'ErrorResponse',
  ),
);

writeFileSync(outputPath, `${JSON.stringify({
  openapi: runtime.openapi,
  info: {
    title: 'GLAPI Project Billing and ASC 606 API',
    version: runtime.info.version,
  },
  servers: runtime.servers,
  paths,
  components: { schemas },
}, null, 2)}\n`);

console.log(`Exported project accounting OpenAPI to ${outputPath}`);
