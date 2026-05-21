import { generateRuntimeOpenApiSpec } from '../src/openapi';

const spec = generateRuntimeOpenApiSpec();
const pathCount = Object.keys(spec.paths ?? {}).length;

if (!spec.openapi || pathCount === 0) {
  console.error('OpenAPI generation failed: no OpenAPI version or paths were generated.');
  process.exit(1);
}

console.log(`OpenAPI generation verified with ${pathCount} paths.`);
