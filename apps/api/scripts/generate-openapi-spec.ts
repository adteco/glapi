import { generateOpenApiDocument } from 'trpc-openapi';
import { appRouter } from '@glapi/trpc';
import fs from 'fs';
import path from 'path';

// Generate OpenAPI document from tRPC router
const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'GLAPI - General Ledger API',
  description: 'A comprehensive API for managing accounting dimensions, revenue recognition, and financial data',
  version: '1.0.0',
  baseUrl: 'http://localhost:3001/api',
  tags: [
    {
      name: 'accounts',
      description: 'General Ledger Account operations',
    },
    {
      name: 'customers',
      description: 'Customer relationship management',
    },
    {
      name: 'vendors',
      description: 'Vendor relationship management',
    },
    {
      name: 'employees',
      description: 'Employee management',
    },
    {
      name: 'items',
      description: 'Item catalog management',
    },
    {
      name: 'classes',
      description: 'Class dimension management',
    },
    {
      name: 'departments',
      description: 'Department dimension management',
    },
    {
      name: 'locations',
      description: 'Location dimension management',
    },
    {
      name: 'subsidiaries',
      description: 'Subsidiary dimension management',
    },
    {
      name: 'contacts',
      description: 'Contact management',
    },
    {
      name: 'leads',
      description: 'Lead tracking and management',
    },
    {
      name: 'prospects',
      description: 'Prospect management and pipeline',
    },
  ],
  security: [
    {
      bearerAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
});

// Add additional OpenAPI extensions
const enhancedDocument = {
  ...openApiDocument,
  'x-logo': {
    url: '/api/logo.png',
    altText: 'GLAPI Logo',
  },
  'x-api-features': {
    pagination: 'All list endpoints support cursor-based pagination',
    filtering: 'Most endpoints support filtering by various criteria',
    sorting: 'Results can be sorted by multiple fields',
    search: 'Full-text search available on relevant endpoints',
  },
  info: {
    ...openApiDocument.info,
    contact: {
      name: 'API Support',
      url: 'https://glapi.com/support',
      email: 'support@glapi.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    'x-concepts': {
      'accounting-dimensions': 'Core accounting dimensions used for financial reporting and analysis',
      'revenue-recognition': 'ASC 606 compliant revenue recognition system',
      'multi-tenancy': 'All data is scoped to the authenticated user\'s organization',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001/api',
      description: 'Development server',
    },
    {
      url: 'https://api.glapi.com',
      description: 'Production server',
    },
  ],
};

// Write OpenAPI spec to file
const outputPath = path.join(__dirname, '../docs/openapi.json');
const docsDir = path.dirname(outputPath);

// Ensure docs directory exists
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(enhancedDocument, null, 2));

console.log(`OpenAPI specification generated at: ${outputPath}`);

// Also generate YAML version
const yaml = require('yaml');
const yamlPath = path.join(__dirname, '../docs/openapi.yaml');
fs.writeFileSync(yamlPath, yaml.stringify(enhancedDocument));

console.log(`OpenAPI specification (YAML) generated at: ${yamlPath}`);

// Generate endpoint summary
const endpointSummary = {
  totalEndpoints: Object.keys(enhancedDocument.paths).length,
  endpoints: Object.entries(enhancedDocument.paths).map(([path, methods]) => ({
    path,
    methods: Object.keys(methods as any),
    tags: Object.values(methods as any).flatMap((method: any) => method.tags || []),
  })),
  tags: enhancedDocument.tags,
};

const summaryPath = path.join(__dirname, '../docs/endpoints-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(endpointSummary, null, 2));

console.log(`Endpoint summary generated at: ${summaryPath}`);
console.log(`Total endpoints: ${endpointSummary.totalEndpoints}`);
console.log('Generation complete!');

export { enhancedDocument };