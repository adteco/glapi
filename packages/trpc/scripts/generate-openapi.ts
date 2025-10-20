#!/usr/bin/env tsx
/**
 * Generate OpenAPI specification from tRPC routers
 *
 * Usage:
 *   pnpm --filter @glapi/trpc generate-openapi
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { generateOpenAPIJSON } from '../src/openapi-generator';

const outputDir = join(__dirname, '../../../apps/docs/public/api');
const outputFile = join(outputDir, 'openapi.json');

console.log('🚀 Generating OpenAPI specification...\n');

try {
  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Generate OpenAPI spec
  const openApiSpec = generateOpenAPIJSON();

  // Write to file
  writeFileSync(outputFile, openApiSpec, 'utf-8');

  console.log('✅ OpenAPI specification generated successfully!\n');
  console.log(`📄 Output: ${outputFile}\n`);
  console.log('📊 Statistics:');
  const spec = JSON.parse(openApiSpec);
  console.log(`   - Paths: ${Object.keys(spec.paths).length}`);
  console.log(`   - Tags: ${new Set(Object.values(spec.paths).flatMap((methods: any) => Object.values(methods).flatMap((op: any) => op.tags || []))).size}`);
  console.log(`   - Operations: ${Object.values(spec.paths).reduce((sum: number, methods: any) => sum + Object.keys(methods).length, 0)}`);
  console.log('\n✨ Done!\n');
  console.log('💡 Next steps:');
  console.log('   1. Review the generated spec at apps/docs/public/api/openapi.json');
  console.log('   2. Test the API documentation at http://localhost:3032/api-reference');
  console.log('   3. Customize individual endpoint descriptions in openapi-generator.ts\n');

  process.exit(0);
} catch (error) {
  console.error('❌ Error generating OpenAPI specification:', error);
  process.exit(1);
}
